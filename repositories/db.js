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
  const res = await pool.query('SELECT id, balance FROM users WHERE telegram_id = $1', [telegramId]);
  return res.rows[0];
};

const addUser = async (telegramId, firstName, lastName, username) => {
  const res = await pool.query(
    'INSERT INTO users (telegram_id, first_name, last_name, username) VALUES ($1, $2, $3, $4) RETURNING id, balance',
    [telegramId, firstName, lastName, username]
  );
  return res.rows[0];
};

// Local functions
const getLocalsByOwnerId = async (ownerId) => {
  const res = await pool.query('SELECT id, name, ip_network FROM locals WHERE owner_id = $1', [ownerId]);
  return res.rows;
};

const getLocalByIdAndOwner = async (localId, telegramId) => {
  const res = await pool.query(
    `SELECT l.*, u.telegram_id FROM locals l
     JOIN users u ON l.owner_id = u.id
     WHERE l.id = $1 AND u.telegram_id = $2`,
    [localId, telegramId]
  );
  return res.rows[0];
};

const addLocal = async (ownerId, name, ipNetwork) => {
  const res = await pool.query(
    'INSERT INTO locals (owner_id, name, ip_network) VALUES ($1, $2, $3) RETURNING id',
    [ownerId, name, ipNetwork]
  );
  return res.rows[0];
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
    throw error;
  }
};

// Local user functions
const getLocalUsers = async (localId) => {
  const res = await pool.query(
    'SELECT username, ip_address FROM local_users WHERE local_id = $1',
    [localId]
  );
  return res.rows;
};

const addLocalUser = async (localId, username, ipAddress) => {
  await pool.query(
    'INSERT INTO local_users (local_id, username, ip_address) VALUES ($1, $2, $3)',
    [localId, username, ipAddress]
  );
};

const getUsedIPs = async (localId) => {
  const res = await pool.query(
    'SELECT ip_address FROM local_users WHERE local_id = $1',
    [localId]
  );
  return res.rows.map(row => row.ip_address);
};

const isUsernameExists = async (localId, username) => {
  const res = await pool.query(
    'SELECT 1 FROM local_users WHERE username = $1 AND local_id = $2',
    [username, localId]
  );
  return res.rows.length > 0;
};

const isLocalNameExists = async (name) => {
  const res = await pool.query(
    'SELECT 1 FROM locals WHERE name = $1',
    [name]
  );
  return res.rows.length > 0;
};

const isIpNetworkExists = async (ipNetwork) => {
  const res = await pool.query(
    'SELECT 1 FROM locals WHERE ip_network = $1',
    [ipNetwork]
  );
  return res.rows.length > 0;
};

module.exports = {
  getUserByTelegramId,
  addUser,
  getLocalsByOwnerId,
  getLocalByIdAndOwner,
  addLocal,
  deleteLocal,
  getLocalUsers,
  addLocalUser,
  getUsedIPs,
  isUsernameExists,
  isLocalNameExists,
  isIpNetworkExists,
};
