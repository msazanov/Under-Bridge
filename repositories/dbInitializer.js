/**
 * File: repositories/dbInitializer.js
 * Description: Initializes the database by ensuring all required tables and fields exist.
 */

const { pool } = require('./db');
const logger = require('../utils/logger');

async function initializeDatabase() {
  try {
    // Create 'users' table
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

    // Create 'locals' table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS locals (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) UNIQUE NOT NULL,
        ip_network CIDR UNIQUE NOT NULL
      );
    `);
    logger.info("Checked 'locals' table.");

    // Create 'local_users' table
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

    // Add any additional table creation scripts here

    logger.info('Database initialization completed successfully.');
  } catch (error) {
    logger.error(`Database initialization error: ${error.message}`);
    logger.error(error.stack); // Add this line to log the stack trace
    throw error;
  }
}

module.exports = {
    initializeDatabase,
  };