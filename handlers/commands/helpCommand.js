/**
 * File: handlers/commands/helpCommand.js
 * Description: Handles the /help command.
 */

const { Markup } = require('telegraf');
const logger = require('../../utils/logger');

function registerHelpCommand(bot) {
  bot.command('help', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.info(`[Help] User ID: ${telegramId} invoked /help`);

    try {
      const helpText = `📖 **Справка**

Вот список доступных команд:

/start - Начать работу с ботом
/help - Получить справку
`;

      await ctx.reply(helpText, { parse_mode: 'Markdown' });
      logger.info(`[Help] Help message sent to User ID: ${telegramId}`);
    } catch (error) {
      logger.error(`[Help] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка при отправке справки.');
    }
  });
}

module.exports = registerHelpCommand;
