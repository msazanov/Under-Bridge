// services/menu.js

const { Markup } = require('telegraf');
const db = require('../repositories/db');
const logger = require('../utils/logger');

async function showMainMenu(ctx, setMainMenuMessageId = false) {
  const telegramId = ctx.from.id;
  logger.log(`[showMainMenu] Пользователь ID: ${telegramId} вызывает главное меню. setMainMenuMessageId: ${setMainMenuMessageId}`);

  try {
    let user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      const { first_name, last_name, username } = ctx.from;
      logger.log(`[showMainMenu] Пользователь не найден. Добавляем нового пользователя: ${first_name} ${last_name}, Username: ${username}`);
      user = await db.addUser(telegramId, first_name, last_name, username);
      await ctx.reply(`🎉 Добро пожаловать, ${first_name}! 🎉 Вы успешно зарегистрированы.`);
      logger.log(`[showMainMenu] Новый пользователь добавлен: ID ${user.id}, Баланс ${user.balance}`);
    } else {
      logger.log(`[showMainMenu] Пользователь найден: ID ${user.id}, Баланс ${user.balance}`);
    }

    const locals = await db.getLocalsByOwnerId(user.id);
    const localsCount = locals.length;
    logger.log(`[showMainMenu] Количество локалок у пользователя ID ${user.id}: ${localsCount}`);

    const messageText = `✨ **Главное меню** ✨

💰 *Ваш текущий баланс:* ${user.balance} рублей
📂 *Ваши локалки:* ${localsCount}

🔽 *Выберите действие:*`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('📁 Мои Локалки', 'my_locals')],
      [Markup.button.callback('💳 Пополнить', 'top_up')],
    ]);

    if (setMainMenuMessageId) {
      logger.log(`[showMainMenu] Отправляем новое главное меню пользователю ID ${telegramId}`);
      const sentMessage = await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      ctx.session.mainMenuMessageId = sentMessage.message_id;
      logger.log(`[showMainMenu] mainMenuMessageId установлен: ${sentMessage.message_id}`);
    } else {
      if (ctx.session.mainMenuMessageId) {
        logger.log(`[showMainMenu] Редактируем главное меню сообщение ID ${ctx.session.mainMenuMessageId} для пользователя ID ${telegramId}`);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.mainMenuMessageId,
          null,
          messageText,
          { parse_mode: 'Markdown', ...keyboard }
        );
      } else {
        logger.log(`[showMainMenu] mainMenuMessageId не установлен. Отправляем новое главное меню пользователю ID ${telegramId}`);
        const sentMessage = await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
        ctx.session.mainMenuMessageId = sentMessage.message_id;
        logger.log(`[showMainMenu] mainMenuMessageId установлен: ${sentMessage.message_id}`);
      }
    }
  } catch (error) {
    logger.error(`[showMainMenu] Ошибка: ${error.message}`);
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
  logger.log(`[showMyLocals] Пользователь ID: ${telegramId} вызывает список локалок. setMainMenuMessageId: ${setMainMenuMessageId}`);

  try {
    const user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      logger.log(`[showMyLocals] Пользователь ID ${telegramId} не найден.`);
      await ctx.reply('❗ Пользователь не найден. Пожалуйста, перезапустите бота.');
      return;
    }
    logger.log(`[showMyLocals] ID пользователя: ${user.id}`);

    const locals = await db.getLocalsByOwnerId(user.id);
    logger.log(`[showMyLocals] Найдено локалок у пользователя ID ${user.id}: ${locals.length}`);

    if (locals.length === 0) {
      const messageText = '📭 У вас пока нет локалок.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('➕ Создать Локалку', 'new_local')],
        [Markup.button.callback('🔙 Назад', 'back_to_main')],
      ]);
      logger.log(`[showMyLocals] Отправляем сообщение о отсутствии локалок пользователю ID ${telegramId}`);

      if (setMainMenuMessageId && ctx.session.mainMenuMessageId) {
        logger.log(`[showMyLocals] Редактируем главное меню сообщение ID ${ctx.session.mainMenuMessageId} для пользователя ID ${telegramId}`);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.mainMenuMessageId,
          null,
          messageText,
          { parse_mode: 'Markdown', ...keyboard }
        );
      } else {
        logger.log(`[showMyLocals] Отправляем новое сообщение о локалках пользователю ID ${telegramId}`);
        const sentMessage = await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
        // Опционально: сохранить message_id
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
      logger.log(`[showMyLocals] Отправляем список локалок пользователю ID ${telegramId}`);

      if (setMainMenuMessageId && ctx.session.mainMenuMessageId) {
        logger.log(`[showMyLocals] Редактируем главное меню сообщение ID ${ctx.session.mainMenuMessageId} для пользователя ID ${telegramId}`);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.mainMenuMessageId,
          null,
          listMessage,
          { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboardButtons) }
        );
      } else {
        logger.log(`[showMyLocals] Отправляем новое сообщение со списком локалок пользователю ID ${telegramId}`);
        const sentMessage = await ctx.reply(listMessage, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboardButtons),
        });
        // Опционально: сохранить message_id
      }
    }
  } catch (error) {
    logger.error(`[showMyLocals] Ошибка: ${error.message}`);
    const errorMessage = '❗ Произошла ошибка при получении ваших локалок.';
    await ctx.answerCbQuery(errorMessage, { show_alert: true });
  }
}

async function showLocalOverview(ctx, localId, motd = '') {
  const telegramId = ctx.from.id;
  logger.log(`[showLocalOverview] Отображение обзора локалки ID ${localId} для пользователя ID ${telegramId}`);

  try {
    const local = await db.getLocalByIdAndOwner(localId, telegramId);
    if (!local) {
      logger.log(`[showLocalOverview] Локалка ID ${localId} не найдена или не принадлежит пользователю ID ${telegramId}`);
      await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
      return;
    }

    logger.log(`[showLocalOverview] Локалка найдена: ${local.name} (${local.ip_network})`);

    const localUsers = await db.getLocalUsers(localId);
    logger.log(`[showLocalOverview] Пользователей в локалке ID ${localId}: ${localUsers.length}`);

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
      const currentMessageId = ctx.callbackQuery.message.message_id;
      logger.log(`[showLocalOverview] Редактируем сообщение ID ${currentMessageId} для отображения обзора локалки ID ${localId}`);
      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } else if (ctx.session.mainMenuMessageId) {
      logger.log(`[showLocalOverview] Редактируем главное меню сообщение ID ${ctx.session.mainMenuMessageId} для отображения обзора локалки ID ${localId}`);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx.session.mainMenuMessageId,
        null,
        messageText,
        { parse_mode: 'Markdown', ...keyboard }
      );
    } else {
      logger.log(`[showLocalOverview] Отправляем новое сообщение для отображения обзора локалки ID ${localId}`);
      const sentMessage = await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      // Опционально: сохранить message_id
    }
  } catch (error) {
    logger.error(`[showLocalOverview] Ошибка: ${error.message}`);
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
