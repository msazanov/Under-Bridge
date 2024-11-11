require('dotenv').config();
const { Telegraf, Markup, session } = require('telegraf');
const pool = require('./modules/db'); // Убедитесь, что этот модуль корректно подключен
const { haiku } = require('./modules/name-generator'); // Убедитесь, что этот модуль корректно подключен

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Используем сессии для хранения состояния пользователя
bot.use(session());

/**
 * Функция для отображения главного меню
 * @param {Telegraf.Context} ctx
 * @param {boolean} setMainMenuMessageId - флаг для установки mainMenuMessageId
 */
async function showMainMenu(ctx, setMainMenuMessageId = false) {
  const telegramId = ctx.from.id;
  console.log(`[showMainMenu] Пользователь ID: ${telegramId} вызывает главное меню. setMainMenuMessageId: ${setMainMenuMessageId}`);
  
  try {
    // Получаем данные пользователя
    const res = await pool.query(
      'SELECT id, balance FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    let user;
    if (res.rows.length === 0) {
      // Если пользователя нет, добавляем его
      const { first_name, last_name, username } = ctx.from;
      console.log(`[showMainMenu] Пользователь не найден. Добавляем нового пользователя: ${first_name} ${last_name}, Username: ${username}`);
      await pool.query(
        'INSERT INTO users (telegram_id, first_name, last_name, username) VALUES ($1, $2, $3, $4)',
        [telegramId, first_name, last_name, username]
      );
      await ctx.reply(`Добро пожаловать, ${first_name}! Вы успешно зарегистрированы.`);
      // Получаем вновь добавленного пользователя
      const newRes = await pool.query(
        'SELECT id, balance FROM users WHERE telegram_id = $1',
        [telegramId]
      );
      user = newRes.rows[0];
      console.log(`[showMainMenu] Новый пользователь добавлен: ID ${user.id}, Баланс ${user.balance}`);
    } else {
      user = res.rows[0];
      console.log(`[showMainMenu] Пользователь найден: ID ${user.id}, Баланс ${user.balance}`);
    }

    // Получаем количество локалок пользователя
    const localsRes = await pool.query(
      'SELECT COUNT(*) FROM locals WHERE owner_id = $1',
      [user.id]
    );
    const localsCount = localsRes.rows[0].count;
    console.log(`[showMainMenu] Количество локалок у пользователя ID ${user.id}: ${localsCount}`);

    const messageText = `**Главное меню**

Ваш текущий баланс: *${user.balance} рублей*
Ваши локалки: *${localsCount}*

Выберите действие:`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Мои Локалки', 'my_locals')],
      [Markup.button.callback('Пополнить', 'top_up')],
    ]);

    if (setMainMenuMessageId) {
      // Отправляем новое сообщение и сохраняем его message_id как mainMenuMessageId
      console.log(`[showMainMenu] Отправляем новое главное меню пользователю ID ${telegramId}`);
      const sentMessage = await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      ctx.session.mainMenuMessageId = sentMessage.message_id;
      console.log(`[showMainMenu] mainMenuMessageId установлен: ${sentMessage.message_id}`);
    } else {
      // Редактируем существующее сообщение главного меню
      if (ctx.session.mainMenuMessageId) {
        console.log(`[showMainMenu] Редактируем главное меню сообщение ID ${ctx.session.mainMenuMessageId} для пользователя ID ${telegramId}`);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.mainMenuMessageId,
          null,
          messageText,
          { parse_mode: 'Markdown', ...keyboard }
        );
      }
      else {
        // Если mainMenuMessageId не установлен, отправляем новое сообщение
        console.log(`[showMainMenu] mainMenuMessageId не установлен. Отправляем новое главное меню пользователю ID ${telegramId}`);
        const sentMessage = await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
        ctx.session.mainMenuMessageId = sentMessage.message_id;
        console.log(`[showMainMenu] mainMenuMessageId установлен: ${sentMessage.message_id}`);
      }
    }
  } catch (error) {
    console.error(`[showMainMenu] Ошибка: ${error.message}`);
    const errorMessage = 'Произошла ошибка. Пожалуйста, попробуйте позже.';
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

// Обработчик команды /start
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Start] Пользователь ID: ${telegramId} вызвал /start`);
  try {
    // Сбрасываем состояние пользователя
    ctx.session = {};
    console.log(`[Start] Состояние пользователя ID ${telegramId} сброшено`);
    // Отображаем главное меню
    await showMainMenu(ctx, true);
  } catch (error) {
    console.error(`[Start] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

/**
 * Функция для отображения списка локалок пользователя
 * @param {Telegraf.Context} ctx
 * @param {boolean} setMainMenuMessageId - флаг для установки mainMenuMessageId
 */
async function showMyLocals(ctx, setMainMenuMessageId = false) {
  const telegramId = ctx.from.id;
  console.log(`[showMyLocals] Пользователь ID: ${telegramId} вызывает список локалок. setMainMenuMessageId: ${setMainMenuMessageId}`);

  try {
    // Получаем ID пользователя
    const userRes = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    if (userRes.rows.length === 0) {
      console.log(`[showMyLocals] Пользователь ID ${telegramId} не найден.`);
      await ctx.reply('Пользователь не найден. Пожалуйста, перезапустите бота.');
      return;
    }
    const userId = userRes.rows[0].id;
    console.log(`[showMyLocals] ID пользователя: ${userId}`);

    // Получаем список локалок пользователя
    const localsRes = await pool.query(
      'SELECT id, name, ip_network FROM locals WHERE owner_id = $1',
      [userId]
    );
    const locals = localsRes.rows;
    console.log(`[showMyLocals] Найдено локалок у пользователя ID ${userId}: ${locals.length}`);

    if (locals.length === 0) {
      const messageText = 'У вас пока нет локалок.';
      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Создать Локалку', 'new_local')],
        [Markup.button.callback('Назад', 'back_to_main')],
      ]);
      console.log(`[showMyLocals] Отправляем сообщение о отсутствии локалок пользователю ID ${telegramId}`);

      if (setMainMenuMessageId && ctx.session.mainMenuMessageId) {
        // Редактируем существующее сообщение главного меню
        console.log(`[showMyLocals] Редактируем главное меню сообщение ID ${ctx.session.mainMenuMessageId} для пользователя ID ${telegramId}`);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.mainMenuMessageId,
          null,
          messageText,
          { parse_mode: 'Markdown', ...keyboard }
        );
      }
      else {
        // Отправляем новое сообщение
        console.log(`[showMyLocals] Отправляем новое сообщение о локалках пользователю ID ${telegramId}`);
        const sentMessage = await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
        // Если необходимо, можно сохранить другой message_id
      }
    } else {
      // Создаем кнопки для каждой локалки
      const keyboardButtons = [];
      for (const local of locals) {
        // Получаем количество пользователей в локалке
        const usersRes = await pool.query(
          'SELECT COUNT(*) FROM local_users WHERE local_id = $1',
          [local.id]
        );
        const usersCount = usersRes.rows[0].count;
        keyboardButtons.push([
          Markup.button.callback(
            `${local.name} \`${local.ip_network}\` [${usersCount}/254]`,
            `local_${local.id}`
          ),
        ]);
      }

      // Добавляем кнопки "Создать Локалку" и "Назад"
      keyboardButtons.push([
        Markup.button.callback('Создать Локалку', 'new_local'),
      ]);
      keyboardButtons.push([
        Markup.button.callback('Назад', 'back_to_main'),
      ]);

      const listMessage = 'Ваши локалки:';
      console.log(`[showMyLocals] Отправляем список локалок пользователю ID ${telegramId}`);

      if (setMainMenuMessageId && ctx.session.mainMenuMessageId) {
        // Редактируем существующее сообщение главного меню
        console.log(`[showMyLocals] Редактируем главное меню сообщение ID ${ctx.session.mainMenuMessageId} для пользователя ID ${telegramId}`);
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          ctx.session.mainMenuMessageId,
          null,
          listMessage,
          { parse_mode: 'Markdown', ...Markup.inlineKeyboard(keyboardButtons) }
        );
      }
      else {
        // Отправляем новое сообщение
        console.log(`[showMyLocals] Отправляем новое сообщение со списком локалок пользователю ID ${telegramId}`);
        const sentMessage = await ctx.reply(listMessage, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard(keyboardButtons),
        });
        // Если необходимо, можно сохранить другой message_id
      }
    }
  } catch (error) {
    console.error(`[showMyLocals] Ошибка: ${error.message}`);
    const errorMessage = 'Произошла ошибка при получении ваших локалок.';
    await ctx.answerCbQuery(errorMessage, { show_alert: true });
  }
}

// Регистрируем обработчики действий в правильном порядке и с точными регулярными выражениями

/**
 * Обработчик для подтверждения удаления локалки
 * Должен быть зарегистрирован первым, чтобы избежать перекрытия с delete_local_{id}
 */
bot.action(/^confirm_delete_local_(\d+)$/, async (ctx) => {
  const localId = ctx.match[1];
  const telegramId = ctx.from.id;
  console.log(`[Action: confirm_delete_local_${localId}] Пользователь ID: ${telegramId} подтвердил удаление локалки ID ${localId}`);

  try {
    // Начинаем транзакцию
    await pool.query('BEGIN');
    console.log(`[confirm_delete_local_${localId}] Начата транзакция для удаления локалки ID ${localId}`);

    // Проверяем принадлежность локалки пользователю
    const res = await pool.query(
      `SELECT l.id FROM locals l
       JOIN users u ON l.owner_id = u.id
       WHERE l.id = $1 AND u.telegram_id = $2`,
      [localId, telegramId]
    );

    if (res.rows.length === 0) {
      console.log(`[confirm_delete_local_${localId}] Локалка ID ${localId} не найдена или не принадлежит пользователю ID ${telegramId}`);
      await pool.query('ROLLBACK');
      await ctx.answerCbQuery('Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
      return;
    }

    // Удаляем всех пользователей в локалке
    await pool.query(
      'DELETE FROM local_users WHERE local_id = $1',
      [localId]
    );
    console.log(`[confirm_delete_local_${localId}] Удалены все пользователи в локалке ID ${localId}`);

    // Удаляем саму локалку
    await pool.query(
      'DELETE FROM locals WHERE id = $1',
      [localId]
    );
    console.log(`[confirm_delete_local_${localId}] Локалка ID ${localId} удалена из базы данных`);

    // Фиксируем транзакцию
    await pool.query('COMMIT');
    console.log(`[confirm_delete_local_${localId}] Транзакция зафиксирована`);

    // Сообщаем пользователю об успешном удалении
    await ctx.editMessageText('Локалка успешно удалена.', { parse_mode: 'Markdown' });
    console.log(`[confirm_delete_local_${localId}] Сообщение об успешном удалении отправлено.`);

    // Отправляем обновленный список локалок
    await showMyLocals(ctx, true);
    console.log(`[confirm_delete_local_${localId}] Отправлен обновленный список локалок.`);
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    await pool.query('ROLLBACK');
    console.error(`[confirm_delete_local_${localId}] Ошибка: ${error.message}`);
    const errorMessage = 'Произошла ошибка при удалении локалки. Пожалуйста, попробуйте позже.';
    await ctx.answerCbQuery(errorMessage, { show_alert: true });
  }
});

/**
 * Обработчик для кнопки "Удалить локалку"
 * Должен быть зарегистрирован после confirm_delete_local_{id}, чтобы избежать перекрытия
 */
bot.action(/^delete_local_(\d+)$/, async (ctx) => {
  const localId = ctx.match[1];
  const telegramId = ctx.from.id;
  console.log(`[Action: delete_local_${localId}] Пользователь ID: ${telegramId} нажал кнопку "Удалить локалку" для локалки ID ${localId}`);

  try {
    const confirmationText = `Вы действительно хотите удалить локалку со всеми пользователями? Это действие нельзя отменить.`;
    console.log(`[Action: delete_local_${localId}] Отправка подтверждающего сообщения.`);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Да, удалить', `confirm_delete_local_${localId}`)],
      [Markup.button.callback('Назад', `local_${localId}`)],
    ]);

    await ctx.editMessageText(confirmationText, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
    console.log(`[Action: delete_local_${localId}] Подтверждающее сообщение отправлено.`);
  } catch (error) {
    console.error(`[Action: delete_local_${localId}] Ошибка: ${error.message}`);
    const errorMessage = 'Произошла ошибка. Пожалуйста, попробуйте позже.';
    await ctx.answerCbQuery(errorMessage, { show_alert: true });
  }
});

/**
 * Обработчик для создания пользователя в локалке
 */
bot.action(/^add_user_(\d+)$/, async (ctx) => {
  const localId = ctx.match[1];
  const telegramId = ctx.from.id;
  console.log(`[Action: add_user_${localId}] Пользователь ID: ${telegramId} нажал кнопку "Создать пользователя" для локалки ID ${localId}`);

  // Проверяем, что локалка принадлежит пользователю
  const res = await pool.query(
    `SELECT l.*, u.telegram_id FROM locals l
     JOIN users u ON l.owner_id = u.id
     WHERE l.id = $1 AND u.telegram_id = $2`,
    [localId, telegramId]
  );

  if (res.rows.length === 0) {
    console.log(`[Action: add_user_${localId}] Локалка ID ${localId} не найдена или не принадлежит пользователю ID ${telegramId}`);
    await ctx.answerCbQuery('Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
    return;
  }

  // Устанавливаем состояние
  ctx.session.state = 'awaiting_username';
  ctx.session.localId = localId;
  console.log(`[Action: add_user_${localId}] Устанавливаем состояние: awaiting_username`);

  const messageText = `**Создание пользователя**

Пожалуйста, введите имя пользователя для нового участника или нажмите "Пропустить", чтобы сгенерировать случайное имя.`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Пропустить', 'generate_random_username')],
    [Markup.button.callback('Назад', `local_${localId}`)],
  ]);

  await ctx.editMessageText(messageText, {
    parse_mode: 'Markdown',
    ...keyboard,
  });
  console.log(`[Action: add_user_${localId}] Отправлено сообщение для ввода имени пользователя.`);
});

/**
 * Обработчик генерации случайного имени пользователя
 */
bot.action('generate_random_username', async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Action: generate_random_username] Пользователь ID: ${telegramId} нажал кнопку "Пропустить" для генерации случайного имени пользователя.`);

  try {
    const localId = ctx.session.localId;
    // Генерируем уникальное имя пользователя
    const username = haiku();
    console.log(`[Action: generate_random_username] Сгенерировано имя пользователя: ${username}`);

    // Создаём пользователя с сгенерированным именем и motd
    await createLocalUser(ctx, username, `Пользователь "${username}" успешно создан.`);
    console.log(`[Action: generate_random_username] Пользователь "${username}" успешно создан.`);

    // Сбрасываем состояние
    ctx.session.state = null;
    ctx.session.localId = null;
    console.log(`[Action: generate_random_username] Состояние пользователя ID ${telegramId} сброшено.`);
  } catch (error) {
    console.error(`[Action: generate_random_username] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка при генерации имени пользователя.');
  }
});

/**
 * Обработчик ввода названия локалки или имени пользователя
 */
bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id;
  const userText = ctx.message.text.trim();
  console.log(`[on:text] Пользователь ID: ${telegramId} ввел текст: "${userText}"`);
  
  try {
    if (ctx.session.state === 'awaiting_local_name') {
      const localName = userText;
      console.log(`[on:text] Пользователь ID: ${telegramId} вводит название локалки: "${localName}"`);

      // Создаем локалку с введенным названием
      await createLocal(ctx, localName, `Локалка "${localName}" успешно создана.`);
      console.log(`[on:text] Локалка "${localName}" создана.`);

      // Удаляем сообщение пользователя
      try {
        await ctx.deleteMessage(ctx.message.message_id);
        console.log(`[on:text] Сообщение ID ${ctx.message.message_id} пользователя ID ${telegramId} удалено.`);
      } catch (error) {
        console.error(`[on:text] Ошибка при удалении сообщения пользователя: ${error.message}`);
      }

      // Сбрасываем состояние
      ctx.session.state = null;
      console.log(`[on:text] Состояние пользователя ID ${telegramId} сброшено.`);
    } else if (ctx.session.state === 'awaiting_username') {
      const username = userText;
      console.log(`[on:text] Пользователь ID: ${telegramId} вводит имя пользователя: "${username}"`);

      // Создаем пользователя в локалке
      await createLocalUser(ctx, username, `Пользователь "${username}" успешно создан.`);
      console.log(`[on:text] Пользователь "${username}" создан в локалке.`);

      // Удаляем сообщение пользователя
      try {
        await ctx.deleteMessage(ctx.message.message_id);
        console.log(`[on:text] Сообщение ID ${ctx.message.message_id} пользователя ID ${telegramId} удалено.`);
      } catch (error) {
        console.error(`[on:text] Ошибка при удалении сообщения пользователя: ${error.message}`);
      }

      // Сбрасываем состояние
      ctx.session.state = null;
      ctx.session.localId = null;
      console.log(`[on:text] Состояние пользователя ID ${telegramId} сброшено.`);
    }
  } catch (error) {
    console.error(`[on:text] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

/**
 * Обработчик кнопки "Новая Локалка" на странице "Мои Локалки"
 */
bot.action('new_local', async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Action: new_local] Пользователь ID: ${telegramId} нажал кнопку "Создать Локалку"`);

  try {
    // Устанавливаем состояние
    ctx.session.state = 'awaiting_local_name';
    console.log(`[Action: new_local] Устанавливаем состояние: awaiting_local_name`);

    const messageText = `**Создание новой локалки**

Пожалуйста, введите название для новой локалки или нажмите "Создать!", чтобы сгенерировать случайное название.`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Создать!', 'generate_random_name')],
      [Markup.button.callback('Назад', 'back_to_main')],
    ]);

    await ctx.editMessageText(messageText, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
    console.log(`[Action: new_local] Отправлено сообщение для создания новой локалки.`);
  } catch (error) {
    console.error(`[Action: new_local] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

/**
 * Обработчик генерации случайного названия локалки
 */
bot.action('generate_random_name', async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Action: generate_random_name] Пользователь ID: ${telegramId} нажал кнопку "Создать!" для генерации случайного названия локалки.`);

  try {
    // Генерируем случайное название
    const localName = haiku();
    console.log(`[Action: generate_random_name] Сгенерировано название локалки: "${localName}"`);

    // Создаем локалку
    await createLocal(ctx, localName, `Локалка "${localName}" успешно создана.`);
    console.log(`[Action: generate_random_name] Локалка "${localName}" успешно создана.`);

    // Сбрасываем состояние
    ctx.session.state = null;
    console.log(`[Action: generate_random_name] Состояние пользователя ID ${telegramId} сброшено.`);
  } catch (error) {
    console.error(`[Action: generate_random_name] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка при генерации названия локалки.');
  }
});

/**
 * Функция для создания локалки
 * @param {Telegraf.Context} ctx
 * @param {string} localName - название локалки
 * @param {string} motd - сообщение об успешном создании
 */
async function createLocal(ctx, localName, motd) {
  const telegramId = ctx.from.id;
  console.log(`[createLocal] Создание локалки для пользователя ID ${telegramId}. Название: ${localName}`);
  
  try {
    // Получаем ID пользователя
    const userRes = await pool.query(
      'SELECT id FROM users WHERE telegram_id = $1',
      [telegramId]
    );
    if (userRes.rows.length === 0) {
      console.log(`[createLocal] Пользователь ID ${telegramId} не найден.`);
      await ctx.reply('Пользователь не найден. Пожалуйста, перезапустите бота.');
      return;
    }
    const userId = userRes.rows[0].id;
    console.log(`[createLocal] ID пользователя: ${userId}`);

    // Генерируем уникальный IP-адрес для локалки
    const ipNetwork = `10.${Math.floor(
      Math.random() * 256
    )}.${Math.floor(Math.random() * 256)}.0/24`;
    console.log(`[createLocal] Сгенерирован IP-сеть: ${ipNetwork}`);

    // Проверка уникальности IP-сети
    const ipCheckRes = await pool.query(
      'SELECT 1 FROM locals WHERE ip_network = $1',
      [ipNetwork]
    );
    if (ipCheckRes.rows.length > 0) {
      throw new Error('Сгенерированная IP-сеть уже существует. Попробуйте снова.');
    }

    // Проверка уникальности названия локалки
    const nameCheckRes = await pool.query(
      'SELECT 1 FROM locals WHERE name = $1',
      [localName]
    );
    if (nameCheckRes.rows.length > 0) {
      throw new Error('Сгенерированное название локалки уже существует. Попробуйте снова.');
    }

    // Сохраняем локалку в базе данных и получаем её ID
    const insertRes = await pool.query(
      'INSERT INTO locals (owner_id, name, ip_network) VALUES ($1, $2, $3) RETURNING id',
      [userId, localName, ipNetwork]
    );
    const localId = insertRes.rows[0].id;
    console.log(`[createLocal] Локалка создана с ID ${localId}`);

    // Отображаем обзорную страницу локалки с motd
    await showLocalOverview(ctx, localId, motd);
    console.log(`[createLocal] Обзорная страница локалки ID ${localId} отправлена.`);
  } catch (error) {
    console.error(`[createLocal] Ошибка: ${error.message}`);
    const errorMessage = `Произошла ошибка при создании локалки: ${error.message}`;
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Функция для создания пользователя в локалке
 * @param {Telegraf.Context} ctx
 * @param {string} username - имя пользователя
 * @param {string} motd - сообщение об успешном создании
 */
async function createLocalUser(ctx, username, motd) {
  const localId = ctx.session.localId;
  const telegramId = ctx.from.id;
  console.log(`[createLocalUser] Создание пользователя "${username}" в локалке ID ${localId} для пользователя ID ${telegramId}`);

  try {
    // Проверяем, что локалка принадлежит пользователю
    const res = await pool.query(
      `SELECT l.*, u.telegram_id FROM locals l
       JOIN users u ON l.owner_id = u.id
       WHERE l.id = $1 AND u.telegram_id = $2`,
      [localId, telegramId]
    );

    if (res.rows.length === 0) {
      console.log(`[createLocalUser] Локалка ID ${localId} не найдена или не принадлежит пользователю ID ${telegramId}`);
      await ctx.answerCbQuery('Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
      return;
    }

    const local = res.rows[0];
    console.log(`[createLocalUser] Локалка найдена: ${local.name} (${local.ip_network})`);

    // Генерируем IP для нового пользователя
    const ipParts = local.ip_network.split('.');
    const baseIP = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.`;
    console.log(`[createLocalUser] Базовый IP для пользователей: ${baseIP}`);

    // Получаем список занятых IP
    const ipRes = await pool.query(
      'SELECT ip_address FROM local_users WHERE local_id = $1',
      [localId]
    );
    const usedIPs = ipRes.rows.map(row => row.ip_address);
    console.log(`[createLocalUser] Занятые IP: ${usedIPs.join(', ')}`);

    // Ищем свободный IP
    let userIP = null;
    for (let i = 2; i < 255; i++) {
      const potentialIP = baseIP + i;
      if (!usedIPs.includes(potentialIP)) {
        userIP = potentialIP;
        break;
      }
    }

    if (!userIP) {
      console.log(`[createLocalUser] Нет доступных IP-адресов в локалке ID ${localId}`);
      await ctx.answerCbQuery('Нет доступных IP-адресов в этой локалке.', { show_alert: true });
      return;
    }
    console.log(`[createLocalUser] Присвоен IP ${userIP} пользователю "${username}"`);

    // Проверка уникальности имени пользователя в локалке
    const nameCheckRes = await pool.query(
      'SELECT 1 FROM local_users WHERE username = $1 AND local_id = $2',
      [username, localId]
    );
    if (nameCheckRes.rows.length > 0) {
      console.log(`[createLocalUser] Имя пользователя "${username}" уже существует в локалке ID ${localId}`);
      // Обработка ошибки дублирования имени
      const errorMsg = `**Данное имя уже есть в системе, напишите уникальное имя либо сгенерируйте случайное.**\n`;
      const messageText = `${errorMsg}**Создание пользователя**

Пожалуйста, введите имя пользователя для нового участника или нажмите "Пропустить", чтобы сгенерировать случайное имя.`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Пропустить', 'generate_random_username')],
        [Markup.button.callback('Назад', `local_${localId}`)],
      ]);

      // Проверяем наличие callbackQuery.message
      if (ctx.callbackQuery && ctx.callbackQuery.message) {
        console.log(`[createLocalUser] Редактируем сообщение для ошибки дублирования имени пользователя.`);
        await ctx.editMessageText(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      } else {
        // Если нет, отправляем новое сообщение
        console.log(`[createLocalUser] Отправляем новое сообщение для ошибки дублирования имени пользователя.`);
        await ctx.reply(messageText, {
          parse_mode: 'Markdown',
          ...keyboard,
        });
      }

      // Прекращаем дальнейшее выполнение функции
      return;
    }

    // Сохраняем пользователя в базе данных
    await pool.query(
      'INSERT INTO local_users (local_id, username, ip_address) VALUES ($1, $2, $3)',
      [localId, username, userIP]
    );
    console.log(`[createLocalUser] Пользователь "${username}" добавлен в локалку ID ${localId} с IP ${userIP}`);

    // Генерируем фейковый QR-код (пока просто текст)
    const qrCodeData = `VPN Config for ${username}`;
    console.log(`[createLocalUser] QR-код для пользователя "${username}": ${qrCodeData}`);

    // Обновляем обзорную страницу локалки с motd
    await showLocalOverview(ctx, localId, motd);
    console.log(`[createLocalUser] Обзорная страница локалки ID ${localId} обновлена.`);
  } catch (error) {
    console.error(`[createLocalUser] Ошибка: ${error.message}`);

    // Если ошибка уже обработана выше, не дублируем обработку
    if (error.message.includes('Имя пользователя уже существует')) {
      // Уже обработано выше, ничего не делаем
      return;
    }

    // Обработка других ошибок
    const errorMessage = `Произошла ошибка при создании пользователя: ${error.message}`;
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Функция отображения обзорной страницы локалки
 * @param {Telegraf.Context} ctx
 * @param {number} localId - ID локалки
 * @param {string} motd - сообщение об успешном создании
 */
async function showLocalOverview(ctx, localId, motd = '') {
  const telegramId = ctx.from.id;
  console.log(`[showLocalOverview] Отображение обзора локалки ID ${localId} для пользователя ID ${telegramId}`);

  try {
    // Получаем информацию о локалке
    const res = await pool.query(
      `SELECT l.*, u.telegram_id FROM locals l
       JOIN users u ON l.owner_id = u.id
       WHERE l.id = $1 AND u.telegram_id = $2`,
      [localId, telegramId]
    );

    if (res.rows.length === 0) {
      console.log(`[showLocalOverview] Локалка ID ${localId} не найдена или не принадлежит пользователю ID ${telegramId}`);
      await ctx.answerCbQuery('Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
      return;
    }

    const local = res.rows[0];
    const localName = local.name; // Уже без подчёркиваний
    console.log(`[showLocalOverview] Локалка найдена: ${localName} (${local.ip_network})`);

    // Получаем пользователей локалки
    const usersRes = await pool.query(
      'SELECT username, ip_address FROM local_users WHERE local_id = $1',
      [localId]
    );
    const localUsers = usersRes.rows;
    console.log(`[showLocalOverview] Пользователей в локалке ID ${localId}: ${localUsers.length}`);

    // Формируем список пользователей
    let usersListText = '';
    if (localUsers.length > 0) {
      usersListText = '\n**Пользователи:**\n';
      localUsers.forEach((user) => {
        usersListText += `- ${user.username}: \`${user.ip_address}\`\n`;
      });
    } else {
      usersListText = '\nПользователей пока нет.';
    }

    // Формируем текст сообщения
    const messageText = `${motd}**${localName}**
IP сеть: \`${local.ip_network}\`${usersListText}

Выберите действие:`;

    // Обновленная клавиатура с добавленной кнопкой "Удалить локалку"
    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Создать пользователя', `add_user_${local.id}`)],
      [Markup.button.callback('Удалить локалку', `delete_local_${local.id}`)], // Новая кнопка
      [Markup.button.callback('Назад', 'my_locals')],
    ]);

    // Редактируем сообщение, из которого пришел callback, или отправляем новое
    if (ctx.callbackQuery && ctx.callbackQuery.message) {
      const currentMessageId = ctx.callbackQuery.message.message_id;
      console.log(`[showLocalOverview] Редактируем сообщение ID ${currentMessageId} для отображения обзора локалки ID ${localId}`);
      await ctx.editMessageText(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
    } else if (ctx.session.mainMenuMessageId) {
      // Если нет callbackQuery, но есть mainMenuMessageId, редактируем его
      console.log(`[showLocalOverview] Редактируем главное меню сообщение ID ${ctx.session.mainMenuMessageId} для отображения обзора локалки ID ${localId}`);
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx.session.mainMenuMessageId,
        null,
        messageText,
        { parse_mode: 'Markdown', ...keyboard }
      );
    } else {
      // Если нет callbackQuery и mainMenuMessageId, отправляем новое сообщение
      console.log(`[showLocalOverview] Отправляем новое сообщение для отображения обзора локалки ID ${localId}`);
      const sentMessage = await ctx.reply(messageText, {
        parse_mode: 'Markdown',
        ...keyboard,
      });
      // При необходимости, можно сохранить другой message_id
    }
  } catch (error) {
    console.error(`[showLocalOverview] Ошибка: ${error.message}`);
    const errorMessage = 'Произошла ошибка при отображении локалки.';
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery(errorMessage, { show_alert: true });
    } else {
      await ctx.reply(errorMessage);
    }
  }
}

/**
 * Обработчик кнопки "Мои Локалки"
 */
bot.action('my_locals', async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Action: my_locals] Пользователь ID: ${telegramId} нажал кнопку "Мои Локалки"`);
  await showMyLocals(ctx, true); // Устанавливаем setMainMenuMessageId в true для редактирования главного меню
});

/**
 * Обработчик для подтверждения удаления локалки
 * Должен быть зарегистрирован первым, чтобы избежать перекрытия с delete_local_{id}
 */
bot.action(/^confirm_delete_local_(\d+)$/, async (ctx) => {
  const localId = ctx.match[1];
  const telegramId = ctx.from.id;
  console.log(`[Action: confirm_delete_local_${localId}] Пользователь ID: ${telegramId} подтвердил удаление локалки ID ${localId}`);

  try {
    // Начинаем транзакцию
    await pool.query('BEGIN');
    console.log(`[confirm_delete_local_${localId}] Начата транзакция для удаления локалки ID ${localId}`);

    // Проверяем принадлежность локалки пользователю
    const res = await pool.query(
      `SELECT l.id FROM locals l
       JOIN users u ON l.owner_id = u.id
       WHERE l.id = $1 AND u.telegram_id = $2`,
      [localId, telegramId]
    );

    if (res.rows.length === 0) {
      console.log(`[confirm_delete_local_${localId}] Локалка ID ${localId} не найдена или не принадлежит пользователю ID ${telegramId}`);
      await pool.query('ROLLBACK');
      await ctx.answerCbQuery('Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
      return;
    }

    // Удаляем всех пользователей в локалке
    await pool.query(
      'DELETE FROM local_users WHERE local_id = $1',
      [localId]
    );
    console.log(`[confirm_delete_local_${localId}] Удалены все пользователи в локалке ID ${localId}`);

    // Удаляем саму локалку
    await pool.query(
      'DELETE FROM locals WHERE id = $1',
      [localId]
    );
    console.log(`[confirm_delete_local_${localId}] Локалка ID ${localId} удалена из базы данных`);

    // Фиксируем транзакцию
    await pool.query('COMMIT');
    console.log(`[confirm_delete_local_${localId}] Транзакция зафиксирована`);

    // Сообщаем пользователю об успешном удалении
    await ctx.editMessageText('Локалка успешно удалена.', { parse_mode: 'Markdown' });
    console.log(`[confirm_delete_local_${localId}] Сообщение об успешном удалении отправлено.`);

    // Отправляем обновленный список локалок
    await showMyLocals(ctx, true);
    console.log(`[confirm_delete_local_${localId}] Отправлен обновленный список локалок.`);
  } catch (error) {
    // Откатываем транзакцию в случае ошибки
    await pool.query('ROLLBACK');
    console.error(`[confirm_delete_local_${localId}] Ошибка: ${error.message}`);
    const errorMessage = 'Произошла ошибка при удалении локалки. Пожалуйста, попробуйте позже.';
    await ctx.answerCbQuery(errorMessage, { show_alert: true });
  }
});

/**
 * Обработчик для кнопки "Удалить локалку"
 * Должен быть зарегистрирован после confirm_delete_local_{id}, чтобы избежать перекрытия
 */
bot.action(/^delete_local_(\d+)$/, async (ctx) => {
  const localId = ctx.match[1];
  const telegramId = ctx.from.id;
  console.log(`[Action: delete_local_${localId}] Пользователь ID: ${telegramId} нажал кнопку "Удалить локалку" для локалки ID ${localId}`);

  try {
    const confirmationText = `Вы действительно хотите удалить локалку со всеми пользователями? Это действие нельзя отменить.`;
    console.log(`[Action: delete_local_${localId}] Отправка подтверждающего сообщения.`);

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Да, удалить', `confirm_delete_local_${localId}`)],
      [Markup.button.callback('Назад', `local_${localId}`)],
    ]);

    await ctx.editMessageText(confirmationText, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
    console.log(`[Action: delete_local_${localId}] Подтверждающее сообщение отправлено.`);
  } catch (error) {
    console.error(`[Action: delete_local_${localId}] Ошибка: ${error.message}`);
    const errorMessage = 'Произошла ошибка. Пожалуйста, попробуйте позже.';
    await ctx.answerCbQuery(errorMessage, { show_alert: true });
  }
});

/**
 * Обработчик для создания пользователя в локалке
 */
bot.action(/^add_user_(\d+)$/, async (ctx) => {
  const localId = ctx.match[1];
  const telegramId = ctx.from.id;
  console.log(`[Action: add_user_${localId}] Пользователь ID: ${telegramId} нажал кнопку "Создать пользователя" для локалки ID ${localId}`);

  // Проверяем, что локалка принадлежит пользователю
  const res = await pool.query(
    `SELECT l.*, u.telegram_id FROM locals l
     JOIN users u ON l.owner_id = u.id
     WHERE l.id = $1 AND u.telegram_id = $2`,
    [localId, telegramId]
  );

  if (res.rows.length === 0) {
    console.log(`[Action: add_user_${localId}] Локалка ID ${localId} не найдена или не принадлежит пользователю ID ${telegramId}`);
    await ctx.answerCbQuery('Локалка не найдена или вы не имеете к ней доступа.', { show_alert: true });
    return;
  }

  // Устанавливаем состояние
  ctx.session.state = 'awaiting_username';
  ctx.session.localId = localId;
  console.log(`[Action: add_user_${localId}] Устанавливаем состояние: awaiting_username`);

  const messageText = `**Создание пользователя**

Пожалуйста, введите имя пользователя для нового участника или нажмите "Пропустить", чтобы сгенерировать случайное имя.`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Пропустить', 'generate_random_username')],
    [Markup.button.callback('Назад', `local_${localId}`)],
  ]);

  await ctx.editMessageText(messageText, {
    parse_mode: 'Markdown',
    ...keyboard,
  });
  console.log(`[Action: add_user_${localId}] Отправлено сообщение для ввода имени пользователя.`);
});

/**
 * Обработчик генерации случайного имени пользователя
 */
bot.action('generate_random_username', async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Action: generate_random_username] Пользователь ID: ${telegramId} нажал кнопку "Пропустить" для генерации случайного имени пользователя.`);

  try {
    const localId = ctx.session.localId;
    // Генерируем уникальное имя пользователя
    const username = haiku();
    console.log(`[Action: generate_random_username] Сгенерировано имя пользователя: ${username}`);

    // Создаём пользователя с сгенерированным именем и motd
    await createLocalUser(ctx, username, `Пользователь "${username}" успешно создан.`);
    console.log(`[Action: generate_random_username] Пользователь "${username}" успешно создан.`);

    // Сбрасываем состояние
    ctx.session.state = null;
    ctx.session.localId = null;
    console.log(`[Action: generate_random_username] Состояние пользователя ID ${telegramId} сброшено.`);
  } catch (error) {
    console.error(`[Action: generate_random_username] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка при генерации имени пользователя.');
  }
});

/**
 * Обработчик ввода названия локалки или имени пользователя
 */
bot.on('text', async (ctx) => {
  const telegramId = ctx.from.id;
  const userText = ctx.message.text.trim();
  console.log(`[on:text] Пользователь ID: ${telegramId} ввел текст: "${userText}"`);
  
  try {
    if (ctx.session.state === 'awaiting_local_name') {
      const localName = userText;
      console.log(`[on:text] Пользователь ID: ${telegramId} вводит название локалки: "${localName}"`);

      // Создаем локалку с введенным названием
      await createLocal(ctx, localName, `Локалка "${localName}" успешно создана.`);
      console.log(`[on:text] Локалка "${localName}" создана.`);

      // Удаляем сообщение пользователя
      try {
        await ctx.deleteMessage(ctx.message.message_id);
        console.log(`[on:text] Сообщение ID ${ctx.message.message_id} пользователя ID ${telegramId} удалено.`);
      } catch (error) {
        console.error(`[on:text] Ошибка при удалении сообщения пользователя: ${error.message}`);
      }

      // Сбрасываем состояние
      ctx.session.state = null;
      console.log(`[on:text] Состояние пользователя ID ${telegramId} сброшено.`);
    } else if (ctx.session.state === 'awaiting_username') {
      const username = userText;
      console.log(`[on:text] Пользователь ID: ${telegramId} вводит имя пользователя: "${username}"`);

      // Создаем пользователя в локалке
      await createLocalUser(ctx, username, `Пользователь "${username}" успешно создан.`);
      console.log(`[on:text] Пользователь "${username}" создан в локалке.`);

      // Удаляем сообщение пользователя
      try {
        await ctx.deleteMessage(ctx.message.message_id);
        console.log(`[on:text] Сообщение ID ${ctx.message.message_id} пользователя ID ${telegramId} удалено.`);
      } catch (error) {
        console.error(`[on:text] Ошибка при удалении сообщения пользователя: ${error.message}`);
      }

      // Сбрасываем состояние
      ctx.session.state = null;
      ctx.session.localId = null;
      console.log(`[on:text] Состояние пользователя ID ${telegramId} сброшено.`);
    }
  } catch (error) {
    console.error(`[on:text] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

/**
 * Обработчик кнопки "Новая Локалка" на странице "Мои Локалки"
 */
bot.action('new_local', async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Action: new_local] Пользователь ID: ${telegramId} нажал кнопку "Создать Локалку"`);

  try {
    // Устанавливаем состояние
    ctx.session.state = 'awaiting_local_name';
    console.log(`[Action: new_local] Устанавливаем состояние: awaiting_local_name`);

    const messageText = `**Создание новой локалки**

Пожалуйста, введите название для новой локалки или нажмите "Создать!", чтобы сгенерировать случайное название.`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('Создать!', 'generate_random_name')],
      [Markup.button.callback('Назад', 'back_to_main')],
    ]);

    await ctx.editMessageText(messageText, {
      parse_mode: 'Markdown',
      ...keyboard,
    });
    console.log(`[Action: new_local] Отправлено сообщение для создания новой локалки.`);
  } catch (error) {
    console.error(`[Action: new_local] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

/**
 * Обработчик генерации случайного названия локалки
 */
bot.action('generate_random_name', async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Action: generate_random_name] Пользователь ID: ${telegramId} нажал кнопку "Создать!" для генерации случайного названия локалки.`);

  try {
    // Генерируем случайное название
    const localName = haiku();
    console.log(`[Action: generate_random_name] Сгенерировано название локалки: "${localName}"`);

    // Создаем локалку
    await createLocal(ctx, localName, `Локалка "${localName}" успешно создана.`);
    console.log(`[Action: generate_random_name] Локалка "${localName}" успешно создана.`);

    // Сбрасываем состояние
    ctx.session.state = null;
    console.log(`[Action: generate_random_name] Состояние пользователя ID ${telegramId} сброшено.`);
  } catch (error) {
    console.error(`[Action: generate_random_name] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка при генерации названия локалки.');
  }
});

/**
 * Обработчик кнопки "Пополнить"
 */
bot.action('top_up', async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Action: top_up] Пользователь ID: ${telegramId} нажал кнопку "Пополнить"`);

  try {
    await ctx.answerCbQuery('Функция пополнения баланса пока в разработке.', { show_alert: true });
    console.log(`[Action: top_up] Информирующее сообщение о разработке отправлено.`);
  } catch (error) {
    console.error(`[Action: top_up] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

/**
 * Обработчик кнопки "Назад" к главному меню
 */
bot.action('back_to_main', async (ctx) => {
  const telegramId = ctx.from.id;
  console.log(`[Action: back_to_main] Пользователь ID: ${telegramId} нажал кнопку "Назад"`);

  try {
    // Сбрасываем состояние
    ctx.session.state = null;
    ctx.session.currentLocalId = null;
    console.log(`[Action: back_to_main] Состояние пользователя ID ${telegramId} сброшено.`);

    // Возвращаемся в главное меню
    await showMainMenu(ctx, false);
    console.log(`[Action: back_to_main] Главное меню отправлено пользователю ID ${telegramId}`);
  } catch (error) {
    console.error(`[Action: back_to_main] Ошибка: ${error.message}`);
    await ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

/**
 * Обработчик выбора конкретной локалки
 */
bot.action(/^local_(\d+)$/, async (ctx) => {
  const localId = ctx.match[1];
  const telegramId = ctx.from.id;
  console.log(`[Action: local_${localId}] Пользователь ID: ${telegramId} выбрал локалку ID ${localId}`);

  // Устанавливаем текущую локалку в сессии
  ctx.session.currentLocalId = localId;
  console.log(`[Action: local_${localId}] Устанавливаем currentLocalId: ${localId}`);

  // Отображаем обзорную страницу локалки без motd
  await showLocalOverview(ctx, localId);
  console.log(`[Action: local_${localId}] Обзорная страница локалки отправлена.`);
});

// Обработчик ошибок
bot.catch((err) => {
  console.error(`Произошла ошибка в боте: ${err.message}`);
});

// Запуск бота
bot.launch().then(() => {
  console.log('Бот запущен');
});

// Грейсфул-шатдаун
process.once('SIGINT', () => {
  console.log('Получен SIGINT. Останавливаем бота.');
  bot.stop('SIGINT');
});
process.once('SIGTERM', () => {
  console.log('Получен SIGTERM. Останавливаем бота.');
  bot.stop('SIGTERM');
});
