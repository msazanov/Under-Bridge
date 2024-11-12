// bot.js

const { Telegraf, session } = require('telegraf');
const config = require('./config');
const logger = require('./utils/logger');
const registerCommands = require('./handlers/commands');
const registerActions = require('./handlers/actions');
const registerEvents = require('./handlers/events');

// Инициализация бота
const bot = new Telegraf(config.telegramBotToken);

// Используем сессии
bot.use(session());

// Регистрируем обработчики команд и действий
registerCommands(bot);
registerActions(bot);
registerEvents(bot);

// Обработчик ошибок
bot.catch((err) => {
  logger.error(`❗ Произошла ошибка в боте: ${err.message}`);
});

// Запуск бота
bot.launch().then(() => {
  logger.log('🚀 Бот запущен');
});

// Грейсфул-шатдаун
process.once('SIGINT', () => {
  logger.log('🛑 Получен SIGINT. Останавливаем бота.');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  logger.log('🛑 Получен SIGTERM. Останавливаем бота.');
  bot.stop('SIGTERM');
});
