#!/bin/bash

# Parse command line arguments
PORT=${1:-3000}
HOST_PARAM=${2}

# Determine if we should allow external connections
if [[ "$HOST_PARAM" == "--host" || "$HOST_PARAM" == "-h" ]]; then
  HOST_FLAG=true
else
  HOST_FLAG=false
fi

# Create temp directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
TEMP_DIR="$SCRIPT_DIR/litechat-app"
mkdir -p "$TEMP_DIR"

# Download the zip file
ZIP_PATH="$TEMP_DIR/litechat.zip"
echo "Downloading LiteChat release..."
if command -v curl &> /dev/null; then
  curl -L https://litechat.dbuild.dev/release/latest.zip -o "$ZIP_PATH"
elif command -v wget &> /dev/null; then
  wget https://litechat.dbuild.dev/release/latest.zip -O "$ZIP_PATH"
else
  echo "Error: Neither curl nor wget is installed. Please install one of them."
  exit 1
fi

if [ $? -ne 0 ]; then
  echo "Error downloading LiteChat."
  rm -f "$ZIP_PATH"
  exit 1
fi

echo "Download complete. Extracting..."

# Extract the zip file
if command -v unzip &> /dev/null; then
  unzip -o "$ZIP_PATH" -d "$TEMP_DIR"
  if [ $? -ne 0 ]; then
    echo "Error extracting files."
    rm -f "$ZIP_PATH"
    exit 1
  fi
else
  echo "Error: unzip is not installed. Please install it."
  rm -f "$ZIP_PATH"
  exit 1
fi

# Remove the zip file
rm -f "$ZIP_PATH"
echo "Extraction complete."

# Serve the files
cd "$TEMP_DIR"

# Create index.html if it doesn't exist (failsafe)
if [ ! -f "index.html" ]; then
  echo "Warning: index.html not found. Creating a placeholder..."
  echo "<html><body><h1>LiteChat</h1><p>The files may not have extracted correctly.</p></body></html>" > index.html
fi

# Determine which web server to use
if command -v python3 &> /dev/null; then
  echo "Starting server with Python 3..."

  # Create a simple Python router for SPA
  cat > server.py << 'EOF'
import http.server
import socketserver
import os

class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if not os.path.exists(self.translate_path(self.path)):
            self.path = '/index.html'
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

Handler = SPAHandler
EOF

  if [ "$HOST_FLAG" = true ]; then
    HOST_IP="0.0.0.0"
    SERVER_URL="http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "LiteChat is running at $SERVER_URL (accessible from other devices)"
    python3 -c "import socketserver, http.server; import server; handler = server.SPAHandler; httpd = socketserver.TCPServer(('0.0.0.0', $PORT), handler); httpd.serve_forever()"
  else
    HOST_IP="localhost"
    echo "LiteChat is running at http://localhost:$PORT (local access only)"
    python3 -c "import socketserver, http.server; import server; handler = server.SPAHandler; httpd = socketserver.TCPServer(('localhost', $PORT), handler); httpd.serve_forever()"
  fi

elif command -v python &> /dev/null; then
  echo "Starting server with Python 2..."

  # Create a simple Python router for SPA
  cat > server.py << 'EOF'
import SimpleHTTPServer
import SocketServer
import os

class SPAHandler(SimpleHTTPServer.SimpleHTTPRequestHandler):
    def do_GET(self):
        if not os.path.exists(self.translate_path(self.path)):
            self.path = '/index.html'
        return SimpleHTTPServer.SimpleHTTPRequestHandler.do_GET(self)

Handler = SPAHandler
EOF

  if [ "$HOST_FLAG" = true ]; then
    HOST_IP="0.0.0.0"
    SERVER_URL="http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "LiteChat is running at $SERVER_URL (accessible from other devices)"
    python -c "import SocketServer, SimpleHTTPServer; import server; handler = server.SPAHandler; httpd = SocketServer.TCPServer(('0.0.0.0', $PORT), handler); httpd.serve_forever()"
  else
    HOST_IP="localhost"
    echo "LiteChat is running at http://localhost:$PORT (local access only)"
    python -c "import SocketServer, SimpleHTTPServer; import server; handler = server.SPAHandler; httpd = SocketServer.TCPServer(('localhost', $PORT), handler); httpd.serve_forever()"
  fi

elif command -v php &> /dev/null; then
  echo "Starting server with PHP..."

  # Create a PHP router file for SPA
  cat > router.php << 'EOF'
<?php
$path = parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH);
$file = __DIR__ . $path;
if (is_file($file)) {
    return false;
} else {
    include __DIR__ . "/index.html";
}
EOF

  if [ "$HOST_FLAG" = true ]; then
    HOST_IP="0.0.0.0"
    SERVER_URL="http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "LiteChat is running at $SERVER_URL (accessible from other devices)"
    php -S 0.0.0.0:$PORT router.php
  else
    HOST_IP="localhost"
    echo "LiteChat is running at http://localhost:$PORT (local access only)"
    php -S localhost:$PORT router.php
  fi

elif command -v npx &> /dev/null; then
  echo "Starting server with Node.js (npx)..."

  # Try using http-server if available via npx
  if [ "$HOST_FLAG" = true ]; then
    HOST_IP="0.0.0.0"
    SERVER_URL="http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "LiteChat is running at $SERVER_URL (accessible from other devices)"
    npx http-server -p $PORT -a 0.0.0.0 --spa
  else
    HOST_IP="localhost"
    echo "LiteChat is running at http://localhost:$PORT (local access only)"
    npx http-server -p $PORT -a localhost --spa
  fi

else
  echo "Error: No suitable web server found. Please install Python, PHP, or Node.js."
  echo "Then run the script again."
  exit 1
fi
