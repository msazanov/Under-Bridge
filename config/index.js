/**
 * File: config/index.js
 * Description: Configuration file that loads environment variables.
 */

require('dotenv').config();

const config = {
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'your-db-user',
    password: process.env.DB_PASSWORD || 'your-db-password',
    name: process.env.DB_NAME || 'your-db-name',
  },
};

module.exports = config;
