/**
 * File: bot.js
 * Description: Main entry point for initializing and starting the Telegram bot.
 */

const { Telegraf, session } = require('telegraf');
const config = require('./config');
const logger = require('./utils/logger');
const registerCommands = require('./handlers/commands');
const registerActions = require('./handlers/actions');
const registerEvents = require('./handlers/events');
const { initializeDatabase } = require('./repositories/dbInitializer');

// Initialize the bot
const bot = new Telegraf(config.telegramBotToken);

// Use session middleware
bot.use(session());

// Function to start the bot after initializing the database
async function startBot() {
  try {
    // Initialize the database
    await initializeDatabase();
    logger.info('Database initialized successfully.');

    // Register command and action handlers
    registerCommands(bot);
    registerActions(bot);
    registerEvents(bot);

    // Error handling
    bot.catch((err) => {
      logger.error(`Bot error: ${err.message}`);
    });

    // Start the bot
    await bot.launch();
    logger.info('Bot launched successfully.');

    // Graceful shutdown
    process.once('SIGINT', () => {
      logger.info('Received SIGINT. Stopping bot.');
      bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      logger.info('Received SIGTERM. Stopping bot.');
      bot.stop('SIGTERM');
    });
  } catch (error) {
    logger.error(`Failed to start the bot: ${error.message}`);
    logger.error(error.stack); // Add this line to log the stack trace
    process.exit(1);
  }
}

// Start the bot
startBot();
