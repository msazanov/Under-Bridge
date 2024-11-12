// handlers/actions.js

const { showMyLocals, showMainMenu, showLocalOverview } = require('../services/menu');
const { haiku } = require('../utils/name-generator');
const db = require('../repositories/db'); 
const logger = require('../utils/logger');
const { Markup } = require('telegraf');
const { createLocal, createLocalUser } = require('../services/localService');

function registerActions(bot) {
  // Обработчик подтверждения удаления локалки
  bot.action(/^confirm_delete_local_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.log(`[Action: confirm_delete_local_${localId}] Пользователь ID: ${telegramId} подтвердил удаление локалки ID ${localId}`);

    try {
      const user = await db.getUserByTelegramId(telegramId);
      if (!user) {
        logger.log(`[confirm_delete_local_${localId}] Пользователь ID ${telegramId} не найден.`);
        await ctx.answerCbQuery('❗ Пользователь не найден.', { show_alert: true });
        return;
      }

      await db.deleteLocal(localId, user.id);
      logger.log(`[confirm_delete_local_${localId}] Локалка ID ${localId} удалена.`);

      await ctx.editMessageText('🗑️ Локалка успешно удалена.', { parse_mode: 'Markdown' });
      logger.log(`[confirm_delete_local_${localId}] Сообщение об успешном удалении отправлено.`);

      await showMyLocals(ctx, true);
      logger.log(`[confirm_delete_local_${localId}] Отправлен обновленный список локалок.`);
    } catch (error) {
      logger.error(`[confirm_delete_local_${localId}] Ошибка: ${error.message}`);
      const errorMessage = '❗ Произошла ошибка при удалении локалки. Пожалуйста, попробуйте позже.';
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    }
  });

  // Обработчик кнопки "Удалить локалку"
  bot.action(/^delete_local_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.log(`[Action: delete_local_${localId}] Пользователь ID: ${telegramId} нажал кнопку "Удалить локалку" для локалки ID ${localId}`);

    try {
      const confirmationText = `🗑️ *Вы действительно хотите удалить локалку со всеми пользователями?* Это действие нельзя отменить.`;
      logger.log(`[Action: delete_local_${localId}] Отправка подтверждающего сообщения.`);

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('✅ Да, удалить', `confirm_delete_local_${localId}`)],
        [Markup.button.callback('🔙 Назад', `local_${localId}`)],
      ]);

      await ctx.editMessageText(confirmationText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      logger.log(`[Action: delete_local_${localId}] Подтверждающее сообщение отправлено.`);
    } catch (error) {
      logger.error(`[Action: delete_local_${localId}] Ошибка: ${error.message}`);
      const errorMessage = '❗ Произошла ошибка. Пожалуйста, попробуйте позже.';
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    }
  });

  // Обработчик кнопки "Создать пользователя"
  bot.action(/^add_user_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.log(`[Action: add_user_${localId}] Пользователь ID: ${telegramId} нажал кнопку "Создать пользователя" для локалки ID ${localId}`);

    try {
      const local = await db.getLocalByIdAndOwner(localId, telegramId);
      if (!local) {
        logger.log(`[Action: add_user_${localId}] Локалка ID ${localId} не найдена или не принадлежит пользователю ID ${telegramId}`);
        await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
        return;
      }

      ctx.session.state = 'awaiting_username';
      ctx.session.localId = localId;
      logger.log(`[Action: add_user_${localId}] Устанавливаем состояние: awaiting_username`);

      const messageText = `👤 **Создание пользователя**
      
Пожалуйста, введите имя пользователя для нового участника или нажмите "🔄 Пропустить", чтобы сгенерировать случайное имя.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Пропустить', 'generate_random_username')],
        [Markup.button.callback('🔙 Назад', `local_${localId}`)],
      ]);

      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      logger.log(`[Action: add_user_${localId}] Отправлено сообщение для ввода имени пользователя.`);
    } catch (error) {
      logger.error(`[Action: add_user_${localId}] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик генерации случайного имени пользователя
  bot.action('generate_random_username', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.log(`[Action: generate_random_username] Пользователь ID: ${telegramId} нажал кнопку "Пропустить" для генерации случайного имени пользователя.`);

    try {
      const localId = ctx.session.localId;
      if (!localId) {
        throw new Error('❗ Локалка не установлена в сессии.');
      }

      const username = haiku();
      logger.log(`[Action: generate_random_username] Сгенерировано имя пользователя: ${username}`);

      await createLocalUser(ctx, username, `🎉 Пользователь "${username}" успешно создан.`);
      logger.log(`[Action: generate_random_username] Пользователь "${username}" успешно создан.`);

      ctx.session.state = null;
      ctx.session.localId = null;
      logger.log(`[Action: generate_random_username] Состояние пользователя ID ${telegramId} сброшено.`);
    } catch (error) {
      logger.error(`[Action: generate_random_username] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка при генерации имени пользователя.');
    }
  });

  // Обработчик кнопки "Мои Локалки"
  bot.action('my_locals', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.log(`[Action: my_locals] Пользователь ID: ${telegramId} нажал кнопку "Мои Локалки"`);

    try {
      await showMyLocals(ctx, true);
      logger.log(`[Action: my_locals] Главное меню отправлено пользователю ID ${telegramId}`);
    } catch (error) {
      logger.error(`[Action: my_locals] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик кнопки "Пополнить"
  bot.action('top_up', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.log(`[Action: top_up] Пользователь ID: ${telegramId} нажал кнопку "Пополнить"`);

    try {
      await ctx.answerCbQuery('💳 Функция пополнения баланса пока в разработке.', { show_alert: true });
      logger.log(`[Action: top_up] Информирующее сообщение о разработке отправлено.`);
    } catch (error) {
      logger.error(`[Action: top_up] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик кнопки "Назад" к главному меню
  bot.action('back_to_main', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.log(`[Action: back_to_main] Пользователь ID: ${telegramId} нажал кнопку "Назад"`);

    try {
      ctx.session.state = null;
      ctx.session.currentLocalId = null;
      logger.log(`[Action: back_to_main] Состояние пользователя ID ${telegramId} сброшено.`);

      await showMainMenu(ctx, false);
      logger.log(`[Action: back_to_main] Главное меню отправлено пользователю ID ${telegramId}`);
    } catch (error) {
      logger.error(`[Action: back_to_main] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик выбора конкретной локалки
  bot.action(/^local_(\d+)$/, async (ctx) => {
    const localId = ctx.match[1];
    const telegramId = ctx.from.id;
    logger.log(`[Action: local_${localId}] Пользователь ID: ${telegramId} выбрал локалку ID ${localId}`);

    try {
      ctx.session.currentLocalId = localId;
      logger.log(`[Action: local_${localId}] Устанавливаем currentLocalId: ${localId}`);

      await showLocalOverview(ctx, localId);
      logger.log(`[Action: local_${localId}] Обзорная страница локалки отправлена.`);
    } catch (error) {
      logger.error(`[Action: local_${localId}] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик кнопки "Создать Локалку"
  bot.action('new_local', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.log(`[Action: new_local] Пользователь ID: ${telegramId} нажал кнопку "Создать Локалку"`);

    try {
      ctx.session.state = 'awaiting_local_name';
      logger.log(`[Action: new_local] Устанавливаем состояние: awaiting_local_name`);

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
      logger.log(`[Action: new_local] Отправлено сообщение для создания новой локалки.`);
    } catch (error) {
      logger.error(`[Action: new_local] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка. Пожалуйста, попробуйте позже.');
    }
  });

  // Обработчик генерации случайного названия локалки
  bot.action('generate_random_name', async (ctx) => {
    const telegramId = ctx.from.id;
    logger.log(`[Action: generate_random_name] Пользователь ID: ${telegramId} нажал кнопку "Создать!" для генерации случайного названия локалки.`);

    try {
      const localName = haiku();
      logger.log(`[Action: generate_random_name] Сгенерировано название локалки: "${localName}"`);

      await createLocal(ctx, localName, `🎉 Локалка "${localName}" успешно создана.`);
      logger.log(`[Action: generate_random_name] Локалка "${localName}" успешно создана.`);

      ctx.session.state = null;
      logger.log(`[Action: generate_random_name] Состояние пользователя ID ${telegramId} сброшено.`);
    } catch (error) {
      logger.error(`[Action: generate_random_name] Ошибка: ${error.message}`);
      await ctx.reply('❗ Произошла ошибка при генерации названия локалки.');
    }
  });
}

module.exports = registerActions;
