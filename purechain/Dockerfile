# Use official Node.js image
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and install dependencies
COPY package*.json ./
RUN npm install

# Copy all source code
COPY . .

# Expose port (adjust if your app uses a different one)
EXPOSE 3000

# Start the app
CMD ["node", "app.js"]