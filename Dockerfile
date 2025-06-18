# Use the official Node.js image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Create a non-root user to run the application
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Switch to the non-root user
USER nodejs

# Expose the port Cloud Run will use
EXPOSE 8080

# Start the server
CMD ["node", "src/http-wrapper.js"]