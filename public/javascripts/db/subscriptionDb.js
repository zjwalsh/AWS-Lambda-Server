/**
 * Subscription Database Module
 * Manages Webex Webhook subscription persistence in DynamoDB
 */
const { dynamoDb, TABLES } = require('./dynamodb.js');
const { PutCommand, ScanCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
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

/**
 * Delete all subscriptions from database
 *
 * @async
 * @returns {boolean}
 */
const clearAllSubscriptions = async () => {
  try {
    logger.debug('Clearing all subscriptions from database');

    const result = await dynamoDb.send(
      new ScanCommand({
        TableName: TABLES.SUBSCRIPTIONS
      })
    );

    if (!result.Items || result.Items.length === 0) {
      logger.debug('No subscriptions to clear');
      return true;
    }

    const deletePromises = result.Items.map(item =>
      dynamoDb.send(
        new DeleteCommand({
          TableName: TABLES.SUBSCRIPTIONS,
          Key: { id: item.id }
        })
      )
    );

    await Promise.all(deletePromises);
    logger.info(`Cleared ${result.Items.length} subscription(s) from database`);
    return true;
  } catch (error) {
    logger.error('Error clearing subscriptions from database', { error: error.message });
    return false;
  }
};

/**
 * Delete a specific subscription from database by ID
 *
 * @async
 * @param {string} subscriptionId
 * @returns {boolean}
 */
const deleteSubscription = async (subscriptionId) => {
  try {
    logger.debug(`Deleting subscription ${subscriptionId} from database`);

    await dynamoDb.send(
      new DeleteCommand({
        TableName: TABLES.SUBSCRIPTIONS,
        Key: { id: subscriptionId }
      })
    );

    logger.info(`Deleted subscription ${subscriptionId} from database`);
    return true;
  } catch (error) {
    logger.error('Error deleting subscription from database', { error: error.message });
    return false;
  }
};

module.exports = {
  findSubscription,
  updateSubDatabase,
  clearAllSubscriptions,
  deleteSubscription
};
