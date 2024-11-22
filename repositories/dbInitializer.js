/**
 * File: repositories/dbInitializer.js
 * Description: Initializes the database by ensuring all required tables and fields exist.
 */

const { pool } = require('./db');
const logger = require('../utils/logger');

async function initializeDatabase() {
  try {
    // Создаем таблицу 'users'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        telegram_id BIGINT UNIQUE NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        username VARCHAR(255),
        balance DECIMAL(10, 2) DEFAULT 0
      );
    `);
    logger.info("Checked 'users' table.");

    // Создаем таблицу 'locals'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS locals (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) UNIQUE NOT NULL,
        ip_network CIDR UNIQUE NOT NULL
      );
    `);
    logger.info("Checked 'locals' table.");

    // Создаем таблицу 'local_users'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS local_users (
        id SERIAL PRIMARY KEY,
        local_id INTEGER REFERENCES locals(id) ON DELETE CASCADE,
        username VARCHAR(255) NOT NULL,
        ip_address INET NOT NULL,
        UNIQUE (local_id, username),
        UNIQUE (local_id, ip_address)
      );
    `);
    logger.info("Checked 'local_users' table.");

    // Создаем таблицу 'sessions'
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL
      );
    `);
    logger.info("Checked 'sessions' table.");

    // Добавьте любые дополнительные скрипты создания таблиц здесь

    logger.info('Database initialization completed successfully.');
  } catch (error) {
    logger.error(`Database initialization error: ${error.message}`);
    logger.error(error.stack); // Логируем стек ошибки
    throw error;
  }
}

module.exports = {
  initializeDatabase,
};
