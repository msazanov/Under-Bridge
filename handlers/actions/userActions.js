/**
 * File: handlers/actions/userActions.js
 * Description: Contains action handlers related to "users".
 */

const { showLocalOverview } = require('../../services/menu');
const { haiku } = require('../../utils/name-generator');
const db = require('../../repositories/db');
const logger = require('../../utils/logger');
const { Markup } = require('telegraf');
const { createLocalUser } = require('../../services/localService');

function registerUserActions(bot) {
  // Обработчик для кнопки "Создать пользователя"
  bot.action(/^add_user_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: add_user_${localId}] User ID: ${telegramId} pressed "Create User" for local ID ${localId}`);

    try {
      const local = await db.getLocalByIdAndOwner(localId, telegramId);
      if (!local) {
        logger.info(`[Action: add_user_${localId}] Local ID ${localId} not found or access denied for user ID ${telegramId}`);
        await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
        return;
      }

      ctx.session.state = 'awaiting_username';
      ctx.session.localId = localId;

      const messageText = `👤 **Создание пользователя**
          
Пожалуйста, введите имя пользователя для нового участника или нажмите "🔄 Пропустить", чтобы сгенерировать случайное имя.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Пропустить', 'generate_random_username')],
        [Markup.button.callback('🔙 Назад', `user_settings_${localId}`)],
      ]);

      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      logger.info(`[Action: add_user_${localId}] Prompted for username input.`);
    } catch (error) {
      logger.error(`[Action: add_user_${localId}] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для генерации случайного имени пользователя
  bot.action('generate_random_username', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.info(`[Action: generate_random_username] User ID: ${telegramId} requested random username generation.`);

    try {
      const localId = ctx.session.localId;
      if (!localId) {
        throw new Error('Local ID not set in session.');
      }

      const username = haiku();
      logger.info(`[Action: generate_random_username] Generated username: ${username}`);

      await createLocalUser(ctx, username, `🎉 Пользователь "${username}" успешно создан.`);
      logger.info(`[Action: generate_random_username] User "${username}" created successfully.`);

      ctx.session.state = null;
      ctx.session.localId = null;
    } catch (error) {
      logger.error(`[Action: generate_random_username] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка при генерации имени пользователя.');
    }
  });

  // Обработчик для кнопки "Настройки пользователей"
  bot.action(/^user_settings_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: user_settings_${localId}] User ID: ${telegramId} opened user settings for local ID ${localId}`);

    try {
      // Проверяем, что пользователь является владельцем локалки
      const local = await db.getLocalByIdAndOwner(localId, telegramId);
      if (!local) {
        logger.info(`[Action: user_settings_${localId}] Local ID ${localId} not found or access denied for user ID ${telegramId}`);
        await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
        return;
      }

      const localUsers = await db.getLocalUsers(localId);

      const messageText = `👥 **Пользователи локалки "${local.name}"**

🔽 *Выберите пользователя для настроек или создайте нового:*`;

      const keyboardButtons = [];

      // Добавляем кнопки для существующих пользователей
      localUsers.forEach((user) => {
        keyboardButtons.push([
          Markup.button.callback(`${user.username} (${user.ip_address})`, `user_${user.id}`),
        ]);
      });

      // Добавляем кнопку "Создать пользователя"
      keyboardButtons.push([
        Markup.button.callback('➕ Создать пользователя', `add_user_${local.id}`),
      ]);

      keyboardButtons.push([
        Markup.button.callback('🔙 Назад', `local_${local.id}`),
      ]);

      const keyboard = Markup.inlineKeyboard(keyboardButtons);

      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });

      logger.info(`[Action: user_settings_${localId}] User settings menu displayed.`);
    } catch (error) {
      logger.error(`[Action: user_settings_${localId}] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для выбора пользователя в настройках пользователей
  bot.action(/^user_(\d+)$/, async (ctx) => {
    const userId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: user_${userId}] User ID: ${telegramId} opened settings for user ID ${userId}`);

    try {
      // Получаем информацию о пользователе локалки
      const localUser = await db.getLocalUserById(userId);
      if (!localUser) {
        logger.info(`[Action: user_${userId}] Local user ID ${userId} not found.`);
        await ctx.answerCbQuery('❗ Пользователь не найден.', { show_alert: true });
        return;
      }

      // Получаем локалку для проверки владения
      const local = await db.getLocalByIdAndOwner(localUser.local_id, telegramId);
      if (!local) {
        logger.info(`[Action: user_${userId}] Local ID ${localUser.local_id} not found or access denied for user ID ${telegramId}`);
        await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
        return;
      }

      const messageText = `👤 **Настройки пользователя "${localUser.username}"**

🔽 *Выберите действие:*`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✏️ Переименовать', `rename_user_${userId}`)],
        [Markup.button.callback('🗑️ Удалить пользователя', `delete_user_${userId}`)],
        [Markup.button.callback('🔙 Назад', `user_settings_${local.id}`)],
      ]);

      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });

      logger.info(`[Action: user_${userId}] User settings displayed.`);
    } catch (error) {
      logger.error(`[Action: user_${userId}] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для удаления пользователя
  bot.action(/^delete_user_(\d+)$/, async (ctx) => {
    const userId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: delete_user_${userId}] User ID: ${telegramId} wants to delete user ID ${userId}`);

    try {
      // Получаем информацию о пользователе локалки
      const localUser = await db.getLocalUserById(userId);
      if (!localUser) {
        logger.info(`[Action: delete_user_${userId}] Local user ID ${userId} not found.`);
        await ctx.answerCbQuery('❗ Пользователь не найден.', { show_alert: true });
        return;
      }

      // Проверяем права доступа
      const local = await db.getLocalByIdAndOwner(localUser.local_id, telegramId);
      if (!local) {
        logger.info(`[Action: delete_user_${userId}] Access denied for user ID ${telegramId}`);
        await ctx.answerCbQuery('❗ У вас нет прав для этого действия.', { show_alert: true });
        return;
      }

      const confirmationText = `🗑️ *Вы действительно хотите удалить пользователя "${localUser.username}"?* Это действие нельзя отменить.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да, удалить', `confirm_delete_user_${userId}`)],
        [Markup.button.callback('🔙 Назад', `user_${userId}`)],
      ]);

      await ctx.editMessageText(confirmationText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      logger.info(`[Action: delete_user_${userId}] Confirmation message sent.`);
    } catch (error) {
      logger.error(`[Action: delete_user_${userId}] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для подтверждения удаления пользователя
  bot.action(/^confirm_delete_user_(\d+)$/, async (ctx) => {
    const userId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: confirm_delete_user_${userId}] User ID: ${telegramId} confirmed deletion of user ID ${userId}`);

    try {
      // Получаем информацию о пользователе локалки
      const localUser = await db.getLocalUserById(userId);
      if (!localUser) {
        logger.info(`[Action: confirm_delete_user_${userId}] Local user ID ${userId} not found.`);
        await ctx.answerCbQuery('❗ Пользователь не найден.', { show_alert: true });
        return;
      }

      // Получаем локалку для проверки владения
      const local = await db.getLocalByIdAndOwner(localUser.local_id, telegramId);
      if (!local) {
        logger.info(`[Action: confirm_delete_user_${userId}] Local ID ${localUser.local_id} not found or access denied for user ID ${telegramId}`);
        await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
        return;
      }

      // Удаляем пользователя
      await db.deleteLocalUser(userId);
      logger.info(`[Action: confirm_delete_user_${userId}] User ID ${userId} deleted.`);

      await ctx.editMessageText('🗑️ Пользователь успешно удален.', { parse_mode: 'Markdown' });

      // Обновляем список пользователей
      await ctx.answerCbQuery('Пользователь удален.', { show_alert: false });
      await showLocalOverview(ctx, local.id); // Обновляем отображение локалки
    } catch (error) {
      logger.error(`[Action: confirm_delete_user_${userId}] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для переименования пользователя
  bot.action(/^rename_user_(\d+)$/, async (ctx) => {
    const userId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: rename_user_${userId}] User ID: ${telegramId} wants to rename user ID ${userId}`);

    try {
      // Получаем информацию о пользователе локалки
      const localUser = await db.getLocalUserById(userId);
      if (!localUser) {
        logger.info(`[Action: rename_user_${userId}] Local user ID ${userId} not found.`);
        await ctx.answerCbQuery('❗ Пользователь не найден.', { show_alert: true });
        return;
      }

      // Проверяем права доступа
      const local = await db.getLocalByIdAndOwner(localUser.local_id, telegramId);
      if (!local) {
        logger.info(`[Action: rename_user_${userId}] Access denied for user ID ${telegramId}`);
        await ctx.answerCbQuery('❗ У вас нет прав для этого действия.', { show_alert: true });
        return;
      }

      ctx.session.state = 'awaiting_new_username';
      ctx.session.userIdToRename = userId;
      ctx.session.localId = local.id;

      const messageText = `✏️ **Переименование пользователя "${localUser.username}"**

Пожалуйста, введите новое имя пользователя:`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔙 Назад', `user_${userId}`)],
      ]);

      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });

      logger.info(`[Action: rename_user_${userId}] Prompted for new username.`);
    } catch (error) {
      logger.error(`[Action: rename_user_${userId}] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });
}

module.exports = registerUserActions;
