/**
 * File: repositories/sessionStore.js
 * Description: Implements a session store using PostgreSQL for Telegraf sessions.
 */

const { pool } = require('./db');
const logger = require('../utils/logger');

class SessionStore {
  constructor() {
    this.pool = pool;
  }

  /**
   * Получить сессию по ключу.
   * @param {string} key
   * @returns {object} Данные сессии
   */
  async getSession(key) {
    try {
      const res = await this.pool.query(
        'SELECT data FROM sessions WHERE key = $1',
        [key]
      );
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].data);
      }
      return {};
    } catch (error) {
      logger.error(`SessionStore getSession error: ${error.message}`);
      return {};
    }
  }

  /**
   * Сохранить сессию по ключу.
   * @param {string} key
   * @param {object} data
   */
  async saveSession(key, data) {
    const dataString = JSON.stringify(data);
    try {
      await this.pool.query(
        `INSERT INTO sessions (key, data) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET data = $2`,
        [key, dataString]
      );
    } catch (error) {
      logger.error(`SessionStore saveSession error: ${error.message}`);
    }
  }

  /**
   * Удалить сессию по ключу.
   * @param {string} key
   */
  async deleteSession(key) {
    try {
      await this.pool.query(
        'DELETE FROM sessions WHERE key = $1',
        [key]
      );
    } catch (error) {
      logger.error(`SessionStore deleteSession error: ${error.message}`);
    }
  }
}

module.exports = SessionStore;
