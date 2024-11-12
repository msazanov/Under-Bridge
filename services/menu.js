/**
 * File: services/menu.js
 * Description: Provides functions to display various menus and overviews in the Telegram bot.
 */

const { Markup } = require('telegraf');
const db = require('../repositories/db');
const logger = require('../utils/logger');

async function showMainMenu(ctx, setMainMenuMessageId = false) {
  const telegramId = ctx.from.id;
  logger.info(`[showMainMenu] User ID: ${telegramId} is accessing the main menu.`);

  try {
    let user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      const { first_name, last_name, username } = ctx.from;
      logger.info(`[showMainMenu] User not found. Adding new user: ${first_name} ${last_name}, Username: ${username}`);
      user = await db.addUser(telegramId, first_name, last_name, username);
      await ctx.reply(`🎉 Добро пожаловать, ${first_name}! 🎉 Вы успешно зарегистрированы.`);
      logger.info(`[showMainMenu] New user added: ID ${user.id}, Balance ${user.balance}`);
    } else {
      logger.info(`[showMainMenu] User found: ID ${user.id}, Balance ${user.balance}`);
    }

    const locals = await db.getLocalsByOwnerId(user.id);
    const localsCount = locals.length;
    logger.info(`[showMainMenu] User ID ${user.id} has ${localsCount} locals.`);

    const messageText = `✨ **Главное меню** ✨

💰 *Ваш текущий баланс:* ${user.balance} рублей
📂 *Ваши локалки:* ${localsCount}

🔽 *Выберите действие:*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📁 Мои Локалки', 'my_locals')],
      [Markup.button.callback('💳 Пополнить', 'top_up')],
    ]);

    if (setMainMenuMessageId) {
      const sentMessage = await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      ctx.session.mainMenuMessageId = sentMessage.message_id;
      logger.info(`[showMainMenu] mainMenuMessageId set: ${sentMessage.message_id}`);
    } else {
      if (ctx.session.mainMenuMessageId) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.mainMenuMessageId,
          null,
          messageText,
          { parse_mode: 'Markdown', ...keyboard }
        );
      } else {
        const sentMessage = await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
        ctx.session.mainMenuMessageId = sentMessage.message_id;
        logger.info(`[showMainMenu] mainMenuMessageId set: ${sentMessage.message_id}`);
      }
    }
  } catch (error) {
    logger.error(`[showMainMenu] Error: ${error.message}`);
    const errorMessage = '❗ Произошла ошибка. Пожалуйста, попробуйте позже.';
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

async function showMyLocals(ctx, setMainMenuMessageId = false) {
  const telegramId = ctx.from.id;
  logger.info(`[showMyLocals] User ID: ${telegramId} is requesting their locals.`);

  try {
    const user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      logger.info(`[showMyLocals] User ID ${telegramId} not found.`);
      await ctx.reply('❗ Пользователь не найден. Пожалуйста, перезапустите бота.');
      return;
    }

    const locals = await db.getLocalsByOwnerId(user.id);
    logger.info(`[showMyLocals] Found ${locals.length} locals for user ID ${user.id}.`);

    if (locals.length === 0) {
      const messageText = '📭 У вас пока нет локалок.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Создать Локалку', 'new_local')],
        [Markup.button.callback('🔙 Назад', 'back_to_main')],
      ]);

      if (setMainMenuMessageId && ctx.session.mainMenuMessageId) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.mainMenuMessageId,
          null,
          messageText,
          { parse_mode: 'Markdown', ...keyboard }
        );
      } else {
        await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      }
    } else {
      const keyboardButtons = [];
      for (const local of locals) {
        const localUsers = await db.getLocalUsers(local.id);
        const usersCount = localUsers.length;
        keyboardButtons.push([
          Markup.button.callback(
            `📁 ${local.name} \`${local.ip_network}\` [${usersCount}/254]`,
            `local_${local.id}`
          ),
        ]);
      }

      keyboardButtons.push([
        Markup.button.callback('➕ Создать Локалку', 'new_local'),
      ]);
      keyboardButtons.push([
        Markup.button.callback('🔙 Назад', 'back_to_main'),
      ]);

      const listMessage = '📂 **Ваши локалки:**';

      if (setMainMenuMessageId && ctx.session.mainMenuMessageId) {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.mainMenuMessageId,
          null,
          listMessage,
          { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboardButtons) }
        );
      } else {
        await ctx.reply(listMessage, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboardButtons),
        });
      }
    }
  } catch (error) {
    logger.error(`[showMyLocals] Error: ${error.message}`);
    const errorMessage = '❗ Произошла ошибка при получении ваших локалок.';
    await ctx.answerCbQuery(errorMessage, { show_alert: true });
  }
}

async function showLocalOverview(ctx, localId, motd = '') {
  const telegramId = ctx.from.id;
  logger.info(`[showLocalOverview] Displaying overview of local ID ${localId} for user ID ${telegramId}`);

  try {
    const local = await db.getLocalByIdAndOwner(localId, telegramId);
    if (!local) {
      logger.info(`[showLocalOverview] Local ID ${localId} not found or access denied for user ID ${telegramId}`);
      await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
      return;
    }

    const localUsers = await db.getLocalUsers(localId);
    let usersListText = '';
    if (localUsers.length > 0) {
      usersListText = '\n**👥 Пользователи:**\n';
      localUsers.forEach((user) => {
        usersListText += `- ${user.username}: \`${user.ip_address}\`\n`;
      });
    } else {
      usersListText = '\n👤 Пользователей пока нет.';
    }

    const messageText = `${motd}**📁 ${local.name}**
🌐 *IP сеть:* \`${local.ip_network}\`${usersListText}

🔽 *Выберите действие:*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('➕ Создать пользователя', `add_user_${local.id}`)],
      [Markup.button.callback('🗑️ Удалить локалку', `delete_local_${local.id}`)],
      [Markup.button.callback('🔙 Назад', 'my_locals')],
    ]);

    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } else if (ctx.session.mainMenuMessageId) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx.session.mainMenuMessageId,
        null,
        messageText,
        { parse_mode: 'Markdown', ...keyboard }
      );
    } else {
      await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    }
  } catch (error) {
    logger.error(`[showLocalOverview] Error: ${error.message}`);
    const errorMessage = '❗ Произошла ошибка при отображении локалки.';
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

module.exports = {
  showMainMenu,
  showMyLocals,
  showLocalOverview,
};
