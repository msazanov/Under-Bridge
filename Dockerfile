# Use the official Node.js image with the desired version
FROM node:22.11.0

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Expose the port your bot is listening on (optional, for debugging purposes)
EXPOSE 3000

# Start the bot
CMD ["node", "bot.js"]
