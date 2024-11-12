// handlers/commands.js

const { showMainMenu } = require('../services/menu');
const logger = require('../utils/logger');

function registerCommands(bot) {
  bot.start(async (ctx) => {
    const telegramId = ctx.from.id;
    logger.log(`[Start] Пользователь ID: ${telegramId} вызвал /start`);

    try {
      ctx.session = {};
      logger.log(`[Start] Состояние пользователя ID ${telegramId} сброшено`);
      await showMainMenu(ctx, true);
    } catch (error) {
      logger.error(`[Start] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });
}

module.exports = registerCommands;
