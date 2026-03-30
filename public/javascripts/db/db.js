/**
 * DynamoDB database configuration
 * Replaced Sequelize/SQLite with AWS DynamoDB
 */
const { dynamoDb, TABLES } = require('./dynamodb');
const logger = require('../../../log.js');

logger.info('DynamoDB client initialized', {
  region: process.env.AWS_REGION || 'us-east-1',
  tables: TABLES
});

// Export for backward compatibility
module.exports.db = dynamoDb;
module.exports.dynamoDb = dynamoDb;
module.exports.TABLES = TABLES;