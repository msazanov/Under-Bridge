/**
 * File: repositories/db.js
 * Description: Database repository providing functions for interacting with PostgreSQL.
 */

const { Pool } = require('pg');
const config = require('../config');
const logger = require('../utils/logger');

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.name,
});

// Handle unexpected errors
pool.on('error', (err) => {
  logger.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// User functions
const getUserByTelegramId = async (telegramId) => {
  try {
    const res = await pool.query('SELECT id, balance FROM users WHERE telegram_id = $1', [telegramId]);
    return res.rows[0];
  } catch (error) {
    logger.error(`Error in getUserByTelegramId: ${error.message}`);
    throw error;
  }
};

const addUser = async (telegramId, firstName, lastName, username) => {
  try {
    const res = await pool.query(
      'INSERT INTO users (telegram_id, first_name, last_name, username) VALUES ($1, $2, $3, $4) RETURNING id, balance',
      [telegramId, firstName, lastName, username]
    );
    return res.rows[0];
  } catch (error) {
    logger.error(`Error in addUser: ${error.message}`);
    throw error;
  }
};

// Local functions
const getLocalsByOwnerId = async (ownerId) => {
  try {
    const res = await pool.query('SELECT id, name, ip_network FROM locals WHERE owner_id = $1', [ownerId]);
    return res.rows;
  } catch (error) {
    logger.error(`Error in getLocalsByOwnerId: ${error.message}`);
    throw error;
  }
};

const getLocalByIdAndOwner = async (localId, telegramId) => {
  try {
    const res = await pool.query(
      `SELECT l.*, u.telegram_id FROM locals l
       JOIN users u ON l.owner_id = u.id
       WHERE l.id = $1 AND u.telegram_id = $2`,
      [localId, telegramId]
    );
    return res.rows[0];
  } catch (error) {
    logger.error(`Error in getLocalByIdAndOwner: ${error.message}`);
    throw error;
  }
};

const addLocal = async (ownerId, name, ipNetwork) => {
  try {
    const res = await pool.query(
      'INSERT INTO locals (owner_id, name, ip_network) VALUES ($1, $2, $3) RETURNING id',
      [ownerId, name, ipNetwork]
    );
    return res.rows[0];
  } catch (error) {
    logger.error(`Error in addLocal: ${error.message}`);
    throw error;
  }
};

const deleteLocal = async (localId, ownerId) => {
  await pool.query('BEGIN');
  try {
    // Check ownership
    const res = await pool.query(
      'SELECT 1 FROM locals WHERE id = $1 AND owner_id = $2',
      [localId, ownerId]
    );
    if (res.rows.length === 0) {
      throw new Error('Local not found or not owned by user.');
    }

    // Delete users in the local
    await pool.query('DELETE FROM local_users WHERE local_id = $1', [localId]);

    // Delete the local
    await pool.query('DELETE FROM locals WHERE id = $1', [localId]);

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    logger.error(`Error in deleteLocal: ${error.message}`);
    throw error;
  }
};

const updateLocalName = async (localId, newName) => {
  try {
    await pool.query('UPDATE locals SET name = $1 WHERE id = $2', [newName, localId]);
  } catch (error) {
    logger.error(`Error in updateLocalName: ${error.message}`);
    throw error;
  }
};

// Local user functions
const getLocalUsers = async (localId) => {
  try {
    const res = await pool.query(
      'SELECT id, username, ip_address FROM local_users WHERE local_id = $1',
      [localId]
    );
    return res.rows;
  } catch (error) {
    logger.error(`Error in getLocalUsers: ${error.message}`);
    throw error;
  }
};

const addLocalUser = async (localId, username, ipAddress) => {
  try {
    await pool.query(
      'INSERT INTO local_users (local_id, username, ip_address) VALUES ($1, $2, $3)',
      [localId, username, ipAddress]
    );
  } catch (error) {
    logger.error(`Error in addLocalUser: ${error.message}`);
    throw error;
  }
};

const getUsedIPs = async (localId) => {
  try {
    const res = await pool.query(
      'SELECT ip_address FROM local_users WHERE local_id = $1',
      [localId]
    );
    return res.rows.map(row => row.ip_address);
  } catch (error) {
    logger.error(`Error in getUsedIPs: ${error.message}`);
    throw error;
  }
};

const isUsernameExists = async (localId, username) => {
  try {
    const res = await pool.query(
      'SELECT 1 FROM local_users WHERE username = $1 AND local_id = $2',
      [username, localId]
    );
    return res.rows.length > 0;
  } catch (error) {
    logger.error(`Error in isUsernameExists: ${error.message}`);
    throw error;
  }
};

const isLocalNameExists = async (name) => {
  try {
    const res = await pool.query(
      'SELECT 1 FROM locals WHERE name = $1',
      [name]
    );
    return res.rows.length > 0;
  } catch (error) {
    logger.error(`Error in isLocalNameExists: ${error.message}`);
    throw error;
  }
};

const isIpNetworkExists = async (ipNetwork) => {
  try {
    const res = await pool.query(
      'SELECT 1 FROM locals WHERE ip_network = $1',
      [ipNetwork]
    );
    return res.rows.length > 0;
  } catch (error) {
    logger.error(`Error in isIpNetworkExists: ${error.message}`);
    throw error;
  }
};

// Новые функции для работы с пользователями локалки
const getLocalUserById = async (userId) => {
  try {
    const res = await pool.query(
      'SELECT * FROM local_users WHERE id = $1',
      [userId]
    );
    return res.rows[0];
  } catch (error) {
    logger.error(`Error in getLocalUserById: ${error.message}`);
    throw error;
  }
};

const deleteLocalUser = async (userId) => {
  try {
    await pool.query('DELETE FROM local_users WHERE id = $1', [userId]);
  } catch (error) {
    logger.error(`Error in deleteLocalUser: ${error.message}`);
    throw error;
  }
};

const updateLocalUserUsername = async (userId, newUsername) => {
  try {
    await pool.query('UPDATE local_users SET username = $1 WHERE id = $2', [newUsername, userId]);
  } catch (error) {
    logger.error(`Error in updateLocalUserUsername: ${error.message}`);
    throw error;
  }
};

// Export all functions
module.exports = {
  pool,
  getUserByTelegramId,
  addUser,
  getLocalsByOwnerId,
  getLocalByIdAndOwner,
  addLocal,
  deleteLocal,
  updateLocalName,
  getLocalUsers,
  addLocalUser,
  getUsedIPs,
  isUsernameExists,
  isLocalNameExists,
  isIpNetworkExists,
  getLocalUserById,
  deleteLocalUser,
  updateLocalUserUsername,
};
