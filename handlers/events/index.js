/**
 * File: handlers/events/index.js
 * Description: Registers all event handlers for the Telegram bot.
 */

const registerTextEvents = require('./textEvents');
// Добавьте другие обработчики событий по мере необходимости

function registerEvents(bot) {
  registerTextEvents(bot);
  // Регистрация других событий
}

module.exports = registerEvents;
