// services/localService.js

const { haiku } = require('../utils/name-generator');
const db = require('../repositories/db');
const { Markup } = require('telegraf');
const { showLocalOverview } = require('./menu');
const logger = require('../utils/logger');

async function createLocal(ctx, localName, motd) {
  const telegramId = ctx.from.id;
  logger.log(`[createLocal] Создание локалки для пользователя ID ${telegramId}. Название: ${localName}`);

  try {
    const user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      logger.log(`[createLocal] Пользователь ID ${telegramId} не найден.`);
      await ctx.reply('❗ Пользователь не найден. Пожалуйста, перезапустите бота.');
      return;
    }
    logger.log(`[createLocal] ID пользователя: ${user.id}`);

    // Генерируем уникальную IP-сеть
    let ipNetwork;
    let isUnique = false;
    while (!isUnique) {
      ipNetwork = `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.0/24`;
      const exists = await db.isIpNetworkExists(ipNetwork);
      if (!exists) {
        isUnique = true;
      }
    }
    logger.log(`[createLocal] Сгенерирован IP-сеть: ${ipNetwork}`);

    // Проверка уникальности названия локалки
    let uniqueName = localName;
    let nameExists = await db.isLocalNameExists(uniqueName);
    if (nameExists) {
      uniqueName = `${localName}-${Math.floor(Math.random() * 1000)}`;
      logger.log(`[createLocal] Название локалки уже существует. Используем уникальное название: ${uniqueName}`);
    }

    // Сохраняем локалку
    const local = await db.addLocal(user.id, uniqueName, ipNetwork);
    const localId = local.id;
    logger.log(`[createLocal] Локалка создана с ID ${localId}`);

    // Отображаем обзорную страницу локалки с motd
    await showLocalOverview(ctx, localId, motd);
    logger.log(`[createLocal] Обзорная страница локалки ID ${localId} отправлена.`);
  } catch (error) {
    logger.error(`[createLocal] Ошибка: ${error.message}`);
    const errorMessage = `❗ Произошла ошибка при создании локалки: ${error.message}`;
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

async function createLocalUser(ctx, username, motd) {
  const localId = ctx.session.localId;
  const telegramId = ctx.from.id;
  logger.log(`[createLocalUser] Создание пользователя "${username}" в локалке ID ${localId} для пользователя ID ${telegramId}`);

  try {
    const local = await db.getLocalByIdAndOwner(localId, telegramId);
    if (!local) {
      logger.log(`[createLocalUser] Локалка ID ${localId} не найдена или не принадлежит пользователю ID ${telegramId}`);
      await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
      return;
    }
    logger.log(`[createLocalUser] Локалка найдена: ${local.name} (${local.ip_network})`);

    // Генерируем уникальный IP для пользователя
    const baseIP = local.ip_network.split('.').slice(0, 3).join('.') + '.';
    const usedIPs = await db.getUsedIPs(localId);
    logger.log(`[createLocalUser] Занятые IP: ${usedIPs.join(', ')}`);

    let userIP = null;
    for (let i = 2; i < 255; i++) {
      const potentialIP = baseIP + i;
      if (!usedIPs.includes(potentialIP)) {
        userIP = potentialIP;
        break;
      }
    }

    if (!userIP) {
      logger.log(`[createLocalUser] Нет доступных IP-адресов в локалке ID ${localId}`);
      await ctx.answerCbQuery('❗ Нет доступных IP-адресов в этой локалке.', { show_alert: true });
      return;
    }
    logger.log(`[createLocalUser] Присвоен IP ${userIP} пользователю "${username}"`);

    // Проверка уникальности имени пользователя
    const usernameExists = await db.isUsernameExists(localId, username);
    if (usernameExists) {
      logger.log(`[createLocalUser] Имя пользователя "${username}" уже существует в локалке ID ${localId}`);
      const errorMsg = `❗ *Данное имя уже существует. Пожалуйста, выберите другое имя или сгенерируйте случайное.*\n`;
      const messageText = `${errorMsg}**Создание пользователя** 👤

Пожалуйста, введите имя пользователя для нового участника или нажмите "🔄 Пропустить", чтобы сгенерировать случайное имя.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Пропустить', 'generate_random_username')],
        [Markup.button.callback('🔙 Назад', `local_${localId}`)],
      ]);

      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        logger.log(`[createLocalUser] Редактируем сообщение для ошибки дублирования имени пользователя.`);
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      } else {
        logger.log(`[createLocalUser] Отправляем новое сообщение для ошибки дублирования имени пользователя.`);
        await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      }

      return;
    }

    // Сохраняем пользователя в базе данных
    await db.addLocalUser(localId, username, userIP);
    logger.log(`[createLocalUser] Пользователь "${username}" добавлен в локалку ID ${localId} с IP ${userIP}`);

    // Генерируем фейковый QR-код (пока просто текст)
    const qrCodeData = `🔗 VPN Config for ${username}`;
    logger.log(`[createLocalUser] QR-код для пользователя "${username}": ${qrCodeData}`);

    // Обновляем обзорную страницу локалки с motd
    await showLocalOverview(ctx, localId, motd);
    logger.log(`[createLocalUser] Обзорная страница локалки ID ${localId} обновлена.`);
  } catch (error) {
    logger.error(`[createLocalUser] Ошибка: ${error.message}`);

    if (error.message.includes('Имя пользователя уже существует')) {
      const localId = ctx.session.localId;
      const errorMsg = `❗ *Данное имя уже существует. Пожалуйста, выберите другое имя или сгенерируйте случайное.*\n`;
      const messageText = `${errorMsg}**Создание пользователя** 👤

Пожалуйста, введите имя пользователя для нового участника или нажмите "🔄 Пропустить", чтобы сгенерировать случайное имя.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Пропустить', 'generate_random_username')],
        [Markup.button.callback('🔙 Назад', `local_${localId}`)],
      ]);

      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        logger.log(`[createLocalUser] Редактируем сообщение для ошибки дублирования имени пользователя.`);
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      } else {
        logger.log(`[createLocalUser] Отправляем новое сообщение для ошибки дублирования имени пользователя.`);
        await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      }

      return;
    }

    const errorMessage = `❗ Произошла ошибка при создании пользователя: ${error.message}`;
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

module.exports = {
  createLocal,
  createLocalUser,
};
