#!/usr/bin/env ruby
require 'open-uri'
require 'fileutils'
require 'zip'
require 'webrick'
require 'optparse'
require 'socket'

# Parse command line arguments
options = {port: 3000, host: false}
OptionParser.new do |opts|
  opts.banner = "Usage: ruby litechat_server.rb [PORT] [options]"
  opts.on("--host", "Allow external connections") { |v| options[:host] = v }
end.parse!

# Get port from args or use default
options[:port] = ARGV[0].to_i if ARGV[0] && ARGV[0].to_i > 0

# Create temp directory
script_dir = File.dirname(File.expand_path(__FILE__))
temp_dir = File.join(script_dir, 'litechat-app')
FileUtils.mkdir_p(temp_dir)

# Download the zip file
zip_path = File.join(temp_dir, 'litechat.zip')
puts "Downloading LiteChat release..."
begin
  URI.open('https://litechat.dbuild.dev/release/latest.zip') do |zip_file|
    File.open(zip_path, 'wb') do |file|
      file.write(zip_file.read)
    end
  end

  puts "Download complete. Extracting..."

  # Extract the zip file
  Zip::File.open(zip_path) do |zip|
    zip.each do |entry|
      entry_path = File.join(temp_dir, entry.name)
      FileUtils.mkdir_p(File.dirname(entry_path))
      zip.extract(entry, entry_path) unless File.exist?(entry_path)
    end
  end

  # Remove the zip file
  FileUtils.rm(zip_path)
  puts "Extraction complete."

  # Serve the files
  server_options = {
    Port: options[:port],
    DocumentRoot: temp_dir
  }

  # Allow external connections if specified
  server_options[:BindAddress] = options[:host] ? '0.0.0.0' : 'localhost'

  # Create server
  server = WEBrick::HTTPServer.new(server_options)

  # Handle SPA routing
  server.mount_proc '/' do |req, res|
    path = File.join(temp_dir, req.path)

    if File.exist?(path) && !File.directory?(path)
      res.body = File.read(path)
      res.content_type = WEBrick::HTTPUtils.mime_type(path, WEBrick::HTTPUtils::DefaultMimeTypes)
    else
      res.body = File.read(File.join(temp_dir, 'index.html'))
      res.content_type = 'text/html'
    end
  end

  # Display access URL
  hostname = Socket.gethostname
  ip = Socket.ip_address_list.find { |addr| addr.ipv4? && !addr.ipv4_loopback? }.ip_address rescue 'localhost'
  access_message = options[:host] ? "http://#{ip}:#{options[:port]} (accessible from other devices)" : "http://localhost:#{options[:port]} (local access only)"
  puts "LiteChat is running at #{access_message}"

  # Handle shutdown
  trap('INT') { server.shutdown }
  server.start

rescue => e
  FileUtils.rm(zip_path) if File.exist?(zip_path)
  puts "Error: #{e.message}"
  exit 1
end
