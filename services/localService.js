/**
 * File: services/localService.js
 * Description: Provides services for creating locals and local users.
 */

const { haiku } = require('../utils/name-generator');
const db = require('../repositories/db');
const { Markup } = require('telegraf');
const { showLocalOverview } = require('./menu');
const logger = require('../utils/logger');

async function createLocal(ctx, localName, motd) {
  const telegramId = ctx.from.id;
  logger.info(`[createLocal] Creating local for user ID ${telegramId}. Name: ${localName}`);

  try {
    const user = await db.getUserByTelegramId(telegramId);
    if (!user) {
      logger.info(`[createLocal] User ID ${telegramId} not found.`);
      await ctx.reply('❗ Пользователь не найден. Пожалуйста, перезапустите бота.');
      return;
    }

    // Generate a unique IP network
    let ipNetwork;
    let isUnique = false;
    while (!isUnique) {
      ipNetwork = `10.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.0/24`;
      const exists = await db.isIpNetworkExists(ipNetwork);
      if (!exists) {
        isUnique = true;
      }
    }
    logger.info(`[createLocal] Generated IP network: ${ipNetwork}`);

    // Ensure unique local name
    let uniqueName = localName;
    let nameExists = await db.isLocalNameExists(uniqueName);
    if (nameExists) {
      uniqueName = `${localName}-${Math.floor(Math.random() * 1000)}`;
      logger.info(`[createLocal] Local name exists. Using unique name: ${uniqueName}`);
    }

    // Save the local
    const local = await db.addLocal(user.id, uniqueName, ipNetwork);
    const localId = local.id;
    logger.info(`[createLocal] Local created with ID ${localId}`);

    // Show local overview with message of the day
    await showLocalOverview(ctx, localId, motd);
    logger.info(`[createLocal] Local overview for ID ${localId} sent.`);
  } catch (error) {
    logger.error(`[createLocal] Error: ${error.message}`);
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
  logger.info(`[createLocalUser] Creating user "${username}" in local ID ${localId} for user ID ${telegramId}`);

  try {
    const local = await db.getLocalByIdAndOwner(localId, telegramId);
    if (!local) {
      logger.info(`[createLocalUser] Local ID ${localId} not found or access denied for user ID ${telegramId}`);
      await ctx.answerCbQuery('❗ Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
      return;
    }

    // Generate a unique IP for the user
    const baseIP = local.ip_network.split('.').slice(0, 3).join('.') + '.';
    const usedIPs = await db.getUsedIPs(localId);

    let userIP = null;
    for (let i = 2; i < 255; i++) {
      const potentialIP = baseIP + i;
      if (!usedIPs.includes(potentialIP)) {
        userIP = potentialIP;
        break;
      }
    }

    if (!userIP) {
      logger.info(`[createLocalUser] No available IP addresses in local ID ${localId}`);
      await ctx.answerCbQuery('❗ Нет доступных IP-адресов в этой локалке.', { show_alert: true });
      return;
    }
    logger.info(`[createLocalUser] Assigned IP ${userIP} to user "${username}"`);

    // Check if username exists
    const usernameExists = await db.isUsernameExists(localId, username);
    if (usernameExists) {
      logger.info(`[createLocalUser] Username "${username}" already exists in local ID ${localId}`);
      const localId = ctx.session.localId;
      const errorMsg = `❗ *Данное имя уже существует. Пожалуйста, выберите другое имя или сгенерируйте случайное.*\n`;
      const messageText = `${errorMsg}**Создание пользователя** 👤

Пожалуйста, введите имя пользователя для нового участника или нажмите "🔄 Пропустить", чтобы сгенерировать случайное имя.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Пропустить', 'generate_random_username')],
        [Markup.button.callback('🔙 Назад', `local_${localId}`)],
      ]);

      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      } else {
        await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      }

      return;
    }

    // Save the user to the database
    await db.addLocalUser(localId, username, userIP);
    logger.info(`[createLocalUser] User "${username}" added to local ID ${localId} with IP ${userIP}`);

    // Update local overview with motd
    await showLocalOverview(ctx, localId, motd);
    logger.info(`[createLocalUser] Local overview for ID ${localId} updated.`);
  } catch (error) {
    logger.error(`[createLocalUser] Error: ${error.message}`);

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
