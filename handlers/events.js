/**
 * File: handlers/events.js
 * Description: Handles text events and other generic events for the Telegram bot.
 */

const { createLocal, createLocalUser } = require('../services/localService');
const logger = require('../utils/logger');

function registerEvents(bot) {
  bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    const userText = ctx.message.text.trim();
    logger.info(`[on:text] User ID: ${telegramId} entered text: "${userText}"`);

    try {
      if (ctx.session.state === 'awaiting_local_name') {
        const localName = userText;
        logger.info(`[on:text] User ID: ${telegramId} is entering local name: "${localName}"`);

        await createLocal(ctx, localName, `🎉 Локалка "${localName}" успешно создана.`);
        logger.info(`[on:text] Local "${localName}" created.`);

        // Delete user's message
        try {
          await ctx.deleteMessage(ctx.message.message_id);
          logger.info(`[on:text] Deleted message ID ${ctx.message.message_id} from user ID ${telegramId}.`);
        } catch (error) {
          logger.error(`[on:text] Error deleting user message: ${error.message}`);
        }

        ctx.session.state = null;
        logger.info(`[on:text] Session state reset for user ID ${telegramId}.`);
      } else if (ctx.session.state === 'awaiting_username') {
        const username = userText;
        logger.info(`[on:text] User ID: ${telegramId} is entering username: "${username}"`);

        await createLocalUser(ctx, username, `🎉 Пользователь "${username}" успешно создан.`);
        logger.info(`[on:text] User "${username}" created in local.`);

        // Delete user's message
        try {
          await ctx.deleteMessage(ctx.message.message_id);
          logger.info(`[on:text] Deleted message ID ${ctx.message.message_id} from user ID ${telegramId}.`);
        } catch (error) {
          logger.error(`[on:text] Error deleting user message: ${error.message}`);
        }

        ctx.session.state = null;
        ctx.session.localId = null;
        logger.info(`[on:text] Session state reset for user ID ${telegramId}.`);
      }
    } catch (error) {
      logger.error(`[on:text] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });
}

module.exports = registerEvents;
