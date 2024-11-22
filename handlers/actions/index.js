/**
 * File: handlers/actions/index.js
 * Description: Registers all action handlers for the Telegram bot.
 */

const registerLocalActions = require('./localActions');
const registerUserActions = require('./userActions');
const registerAdminActions = require('./adminActions'); // Если есть административные действия

function registerActions(bot) {
  registerLocalActions(bot);
  registerUserActions(bot);
  registerAdminActions(bot); // Если есть административные действия
}

module.exports = registerActions;
