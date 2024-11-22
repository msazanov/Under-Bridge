/**
 * File: handlers/commands/index.js
 * Description: Registers all command handlers for the Telegram bot.
 */

const logger = require('../../utils/logger'); // Добавлено: импорт логгера
const registerStartCommand = require('./startCommand');
const registerHelpCommand = require('./helpCommand');
// Добавьте другие команды по мере необходимости

function registerCommands(bot) {
  logger.debug('Registering command handlers.');

  registerStartCommand(bot);
  registerHelpCommand(bot);
  // Регистрация других команд
}

module.exports = registerCommands;
