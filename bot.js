/**
 * File: bot.js
 * Description: Main entry point for initializing and starting the Telegram bot.
 */

const { Telegraf } = require('telegraf');
const config = require('./config');
const logger = require('./utils/logger');
const registerCommands = require('./handlers/commands');
const registerActions = require('./handlers/actions');
const registerEvents = require('./handlers/events');
const { initializeDatabase } = require('./repositories/dbInitializer');
const SessionStore = require('./repositories/sessionStore');

// Initialize the bot
const bot = new Telegraf(config.telegramBotToken);

// Initialize session store
const sessionStore = new SessionStore();

// Middleware для управления сессиями
bot.use(async (ctx, next) => {
  if (!ctx.from || !ctx.chat) {
    // Игнорируем сообщения без пользователя или чата
    return;
  }

  // Генерируем уникальный ключ для сессии на основе ID пользователя и чата
  const key = `${ctx.from.id}:${ctx.chat.id}`;

  // Загружаем данные сессии из базы данных
  ctx.session = await sessionStore.getSession(key);

  // Продолжаем обработку
  await next();

  // Сохраняем данные сессии обратно в базу данных
  await sessionStore.saveSession(key, ctx.session);
});

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
    bot.catch((err, ctx) => {
      logger.error(`Bot error: ${err.message}`);
      logger.error(err.stack);
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
    logger.error(error.stack);
    process.exit(1);
  }
}

// Start the bot
startBot();