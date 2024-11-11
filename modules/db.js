// modules/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,         // Хост базы данных
  port: parseInt(process.env.DB_PORT, 10), // Порт базы данных
  user: process.env.DB_USER,         // Имя пользователя
  password: process.env.DB_PASSWORD, // Пароль пользователя
  database: process.env.DB_NAME,     // Имя базы данных
});

// Обработка неожиданных ошибок подключения
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
