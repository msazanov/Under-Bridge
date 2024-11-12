// handlers/events.js

const { createLocal, createLocalUser } = require('../services/localService');
const { showLocalOverview } = require('../services/menu');
const logger = require('../utils/logger');

function registerEvents(bot) {
  bot.on('text', async (ctx) => {
    const telegramId = ctx.from.id;
    const userText = ctx.message.text.trim();
    logger.log(`[on:text] Пользователь ID: ${telegramId} ввел текст: "${userText}"`);

    try {
      if (ctx.session.state === 'awaiting_local_name') {
        const localName = userText;
        logger.log(`[on:text] Пользователь ID: ${telegramId} вводит название локалки: "${localName}"`);

        await createLocal(ctx, localName, `🎉 Локалка "${localName}" успешно создана.`);
        logger.log(`[on:text] Локалка "${localName}" создана.`);

        // Удаляем сообщение пользователя
        try {
          await ctx.deleteMessage(ctx.message.message_id);
          logger.log(`[on:text] Сообщение ID ${ctx.message.message_id} пользователя ID ${telegramId} удалено.`);
        } catch (error) {
          logger.error(`[on:text] Ошибка при удалении сообщения пользователя: ${error.message}`);
        }

        // Сбрасываем состояние
        ctx.session.state = null;
        logger.log(`[on:text] Состояние пользователя ID ${telegramId} сброшено.`);
      } else if (ctx.session.state === 'awaiting_username') {
        const username = userText;
        logger.log(`[on:text] Пользователь ID: ${telegramId} вводит имя пользователя: "${username}"`);

        await createLocalUser(ctx, username, `🎉 Пользователь "${username}" успешно создан.`);
        logger.log(`[on:text] Пользователь "${username}" создан в локалке.`);

        // Удаляем сообщение пользователя
        try {
          await ctx.deleteMessage(ctx.message.message_id);
          logger.log(`[on:text] Сообщение ID ${ctx.message.message_id} пользователя ID ${telegramId} удалено.`);
        } catch (error) {
          logger.error(`[on:text] Ошибка при удалении сообщения пользователя: ${error.message}`);
        }

        // Сбрасываем состояние
        ctx.session.state = null;
        ctx.session.localId = null;
        logger.log(`[on:text] Состояние пользователя ID ${telegramId} сброшено.`);
      }
    } catch (error) {
      logger.error(`[on:text] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });
}

module.exports = registerEvents;
