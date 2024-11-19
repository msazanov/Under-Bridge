/**
 * File: handlers/actions.js
 * Description: Contains action handlers for Telegram bot inline keyboard callbacks.
 */

const { showMyLocals, showMainMenu, showLocalOverview } = require('../services/menu');
const { haiku } = require('../utils/name-generator');
const db = require('../repositories/db');
const logger = require('../utils/logger');
const { Markup } = require('telegraf');
const { createLocal, createLocalUser } = require('../services/localService');

function registerActions(bot) {
  // Обработчик для подтверждения удаления локалки
  bot.action(/^confirm_delete_local_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: confirm_delete_local_${localId}] User ID: ${telegramId} confirmed deletion of local ID ${localId}`);

    try {
      const user = await db.getUserByTelegramId(telegramId);
      if (!user) {
        logger.info(`[confirm_delete_local_${localId}] User ID ${telegramId} not found.`);
        await ctx.answerCbQuery('❗ Пользователь не найден.', { show_alert: true });
        return;
      }

      await db.deleteLocal(localId, user.id);
      logger.info(`[confirm_delete_local_${localId}] Local ID ${localId} deleted.`);

      await ctx.editMessageText('🗑️ Локалка успешно удалена.', { parse_mode: 'Markdown' });
      logger.info(`[confirm_delete_local_${localId}] Deletion success message sent.`);

      await showMyLocals(ctx, true);
      logger.info(`[confirm_delete_local_${localId}] Updated list of locals sent.`);
    } catch (error) {
      logger.error(`[confirm_delete_local_${localId}] Error: ${error.message}`);
      const errorMessage = '❗ Произошла ошибка при удалении локалки. Пожалуйста, попробуйте позже.';
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    }
  });

  // Обработчик для кнопки "Удалить локалку"
  bot.action(/^delete_local_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: delete_local_${localId}] User ID: ${telegramId} pressed "Delete Local" for local ID ${localId}`);

    try {
      const confirmationText = `🗑️ *Вы действительно хотите удалить локалку со всеми пользователями?* Это действие нельзя отменить.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да, удалить', `confirm_delete_local_${localId}`)],
        [Markup.button.callback('🔙 Назад', `local_${localId}`)],
      ]);

      await ctx.editMessageText(confirmationText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      logger.info(`[Action: delete_local_${localId}] Confirmation message sent.`);
    } catch (error) {
      logger.error(`[Action: delete_local_${localId}] Error: ${error.message}`);
      const errorMessage = '❗ Произошла ошибка. Пожалуйста, попробуйте позже.';
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    }
  });

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

  // Обработчик для кнопки "Мои Локалки"
  bot.action('my_locals', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.info(`[Action: my_locals] User ID: ${telegramId} pressed "My Locals"`);

    try {
      await showMyLocals(ctx, true);
      logger.info(`[Action: my_locals] Main menu sent to user ID ${telegramId}`);
    } catch (error) {
      logger.error(`[Action: my_locals] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для кнопки "Пополнить"
  bot.action('top_up', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.info(`[Action: top_up] User ID: ${telegramId} pressed "Top Up"`);

    try {
      await ctx.answerCbQuery('💳 Функция пополнения баланса пока в разработке.', { show_alert: true });
      logger.info(`[Action: top_up] Informed user about feature in development.`);
    } catch (error) {
      logger.error(`[Action: top_up] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для кнопки "Назад"
  bot.action('back_to_main', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.info(`[Action: back_to_main] User ID: ${telegramId} pressed "Back"`);

    try {
      ctx.session.state = null;
      ctx.session.currentLocalId = null;
      logger.info(`[Action: back_to_main] Session state reset for user ID ${telegramId}`);

      await showMainMenu(ctx, false);
      logger.info(`[Action: back_to_main] Main menu sent to user ID ${telegramId}`);
    } catch (error) {
      logger.error(`[Action: back_to_main] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для выбора определенной локалки
  bot.action(/^local_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: local_${localId}] User ID: ${telegramId} selected local ID ${localId}`);

    try {
      ctx.session.currentLocalId = localId;

      await showLocalOverview(ctx, localId);
      logger.info(`[Action: local_${localId}] Local overview sent.`);
    } catch (error) {
      logger.error(`[Action: local_${localId}] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для кнопки "Создать Локалку"
  bot.action('new_local', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.info(`[Action: new_local] User ID: ${telegramId} pressed "Create Local"`);

    try {
      ctx.session.state = 'awaiting_local_name';

      const messageText = `🆕 **Создание новой локалки**
          
Пожалуйста, введите название для новой локалки или нажмите "🔄 Создать!", чтобы сгенерировать случайное название.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Создать!', 'generate_random_name')],
        [Markup.button.callback('🔙 Назад', 'back_to_main')],
      ]);

      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      logger.info(`[Action: new_local] Prompted for local name input.`);
    } catch (error) {
      logger.error(`[Action: new_local] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик для генерации случайного имени локалки
  bot.action('generate_random_name', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.info(`[Action: generate_random_name] User ID: ${telegramId} requested random local name generation.`);

    try {
      const localName = haiku();
      logger.info(`[Action: generate_random_name] Generated local name: "${localName}"`);

      await createLocal(ctx, localName, `🎉 Локалка "${localName}" успешно создана.`);
      logger.info(`[Action: generate_random_name] Local "${localName}" created successfully.`);

      ctx.session.state = null;
    } catch (error) {
      logger.error(`[Action: generate_random_name] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка при генерации названия локалки.');
    }
  });

  // Обработчик для кнопки "Настройки локалки"
  bot.action(/^local_settings_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.info(`[Action: local_settings_${localId}] User ID: ${telegramId} opened local settings for local ID ${localId}`);

    try {
      // Проверяем, что пользователь является владельцем локалки
      const local = await db.getLocalByIdAndOwner(localId, telegramId);
      if (!local) {
        logger.info(`[Action: local_settings_${localId}] Local ID ${localId} not found or access denied for user ID ${telegramId}`);
        await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
        return;
      }

      const messageText = `⚙️ **Настройки локалки "${local.name}"**`;

      const keyboard = Markup.inlineKeyboard([
        // Убираем кнопку "Создать пользователя" отсюда
        [Markup.button.callback('🗑️ Удалить локалку', `delete_local_${local.id}`)],
        [Markup.button.callback('🔙 Назад', `local_${local.id}`)],
      ]);

      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });

      logger.info(`[Action: local_settings_${localId}] Local settings menu displayed.`);
    } catch (error) {
      logger.error(`[Action: local_settings_${localId}] Error: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
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

module.exports = registerActions;
