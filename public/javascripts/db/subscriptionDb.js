/**
 * DynamoDB operations for Subscriptions table
 * Replaces Sequelize-based subscriptionDb.js
 */
const { PutCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDb, TABLES } = require('./dynamodb');
const logger = require('../../../log.js');

/**
 * Query to find if any subscription exists in database
 *
 * @returns {string|null}
 */
const findSubscription = async () => {
  try {
    logger.debug('Find all Subscriptions');

    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.SUBSCRIPTIONS,
        Limit: 1
      })
    );

    if (result.Items && result.Items.length > 0) {
      return result.Items[0].id;
    }
    return null;
  } catch (error) {
    logger.error('Error trying to find Subscriptions', { error: error.message });
    return null;
  }
};

/**
 * Update Database with subscription data
 *
 * @async
 * @param {Object} payload
 * @returns {boolean}
 */
const updateSubDatabase = async (payload) => {
  try {
    const item = {
      id: payload.data.data.id,
      name: payload.data.data.name,
      description: payload.data.data.description,
      createdBy: payload.data.data.createdBy,
      eventTypes: payload.data.data.eventTypes,
      destinationUrl: payload.data.data.destinationUrl,
      status: payload.data.data.status,
      createdTime: payload.data.data.createdTime,
      updatedAt: new Date().toISOString()
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.SUBSCRIPTIONS,
        Item: item
      })
    );

    logger.debug(`Created new Subscription record: ${item.id}`);
    return true;
  } catch (error) {
    logger.error('Error updating subscriptions database', { error: error.message });
    return false;
  }
};

module.exports = {
  updateSubDatabase,
  findSubscription
};