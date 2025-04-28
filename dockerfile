FROM nginx:alpine

# Create app directory
WORKDIR /usr/share/nginx/html

# Install necessary tools
RUN apk add --no-cache curl unzip

# Download and extract the latest LiteChat release
RUN curl -L https://litechat.dbuild.dev/release/latest.zip -o litechat.zip && \
    unzip -o litechat.zip && \
    rm litechat.zip

# Copy nginx configuration for SPA and potential API proxy
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
