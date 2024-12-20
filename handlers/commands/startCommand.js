/**
 * File: handlers/commands/startCommand.js
 * Description: Handles the /start command.
 */

const { showMainMenu } = require('../../services/menu');
const logger = require('../../utils/logger');

function registerStartCommand(bot) {
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    logger.info(`[Start] User ID: ${telegramId} invoked /start`);

    try {
      ctx.session = {};
      logger.info(`[Start] Session reset for user ID ${telegramId}`);
      await showMainMenu(ctx, true);
    } catch (error) {
      logger.error(`[Start] Error: ${error.message}`, error);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });
}

module.exports = registerStartCommand;
