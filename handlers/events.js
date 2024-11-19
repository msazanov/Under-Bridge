/**
 * File: handlers/events.js
 * Description: Handles text events and other generic events for the Telegram bot.
 */

const { createLocal, createLocalUser } = require('../services/localService');
const { showLocalOverview } = require('../services/menu');
const logger = require('../utils/logger');
const db = require('../repositories/db');
const { Markup } = require('telegraf');

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

        // Удаляем сообщение пользователя
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

        // Удаляем сообщение пользователя
        try {
          await ctx.deleteMessage(ctx.message.message_id);
          logger.info(`[on:text] Deleted message ID ${ctx.message.message_id} from user ID ${telegramId}.`);
        } catch (error) {
          logger.error(`[on:text] Error deleting user message: ${error.message}`);
        }

        ctx.session.state = null;
        ctx.session.localId = null;
        logger.info(`[on:text] Session state reset for user ID ${telegramId}.`);
      } else if (ctx.session.state === 'awaiting_new_username') {
        const newUsername = userText;
        const userIdToRename = ctx.session.userIdToRename;
        const localId = ctx.session.localId;
        logger.info(`[on:text] User ID: ${telegramId} is renaming user ID ${userIdToRename} to "${newUsername}"`);

        // Проверяем, что пользователь существует и есть права
        const localUser = await db.getLocalUserById(userIdToRename);
        if (!localUser) {
          logger.info(`[on:text] Local user ID ${userIdToRename} not found.`);
          await ctx.reply('❗ Пользователь не найден.');
          return;
        }

        const local = await db.getLocalByIdAndOwner(localId, telegramId);
        if (!local) {
          logger.info(`[on:text] Access denied for user ID ${telegramId}`);
          await ctx.reply('❗ У вас нет прав для этого действия.');
          return;
        }

        // Проверяем уникальность имени
        const usernameExists = await db.isUsernameExists(local.id, newUsername);
        if (usernameExists) {
          await ctx.reply('❗ Пользователь с таким именем уже существует. Пожалуйста, выберите другое имя.');
          return;
        }

        // Обновляем имя пользователя в базе данных
        await db.updateLocalUserUsername(userIdToRename, newUsername);
        logger.info(`[on:text] User ID ${userIdToRename} renamed to "${newUsername}"`);

        // Удаляем сообщение пользователя
        try {
          await ctx.deleteMessage(ctx.message.message_id);
          logger.info(`[on:text] Deleted message ID ${ctx.message.message_id} from user ID ${telegramId}.`);
        } catch (error) {
          logger.error(`[on:text] Error deleting user message: ${error.message}`);
        }

        // Сбрасываем состояние сессии
        ctx.session.state = null;
        ctx.session.userIdToRename = null;
        ctx.session.localId = null;

        // Обновляем меню, редактируя существующее сообщение
        await showLocalOverview(ctx, local.id);
      }
    } catch (error) {
      logger.error(`[on:text] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });
}

module.exports = registerEvents;
