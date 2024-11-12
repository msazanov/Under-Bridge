/**
 * File: utils/logger.js
 * Description: Configures and exports a winston logger for application-wide logging.
 */

const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info', // Set the minimum level of messages to log
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.printf((info) => {
      return `[${info.timestamp}] ${info.level.toUpperCase()}: ${info.message}`;
    })
  ),
  transports: [
    new transports.Console(),
    // You can add additional transports like File here
  ],
});

module.exports = logger;
