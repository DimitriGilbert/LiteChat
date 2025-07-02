FROM lipanski/docker-static-website:latest

# Copy the built application files
COPY build/ .

# Create httpd.conf for SPA routing and any needed configuration
COPY docker/httpd.conf .

# The base image already exposes port 3000 and runs the httpd server
# No additional configuration needed
