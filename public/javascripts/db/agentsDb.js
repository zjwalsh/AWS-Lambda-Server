/**
 * DynamoDB operations for Agents table
 * Replaces Sequelize-based agentsDb.js
 */
const { PutCommand, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDb, TABLES } = require('./dynamodb');
const logger = require('../../../log.js');

/**
 * Query to find taskId from database
 *
 * @param {string} taskId
 * @returns {Object|null}
 */
const getMetadata = async (taskId) => {
  try {
    logger.debug(`Find Task Id - ${taskId}`);

    const result = await dynamoDb.send(
      new GetCommand({
        TableName: TABLES.AGENTS,
        Key: { taskId }
      })
    );

    return result.Item || null;
  } catch (error) {
    logger.error(`Failed find Task Id - ${taskId}`, { error: error.message });
    return null;
  }
};

/**
 * Update Database with agent metadata
 * Upserts record (creates if not exists, updates if exists)
 *
 * @async
 * @param {Object} payload
 * @returns {boolean}
 */
const updateAgentDatabase = async (payload) => {
  try {
    const item = {
      taskId: payload.metadata.taskId,
      program: payload.metadata.program,
      appNumber: payload.metadata.appNumber,
      caseNumber: payload.metadata.caseNumber,
      firstName: payload.metadata.firstName,
      lastName: payload.metadata.lastName,
      formId: payload.metadata.process,
      formName: payload.metadata.formId,
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.AGENTS,
        Item: item
      })
    );

    logger.debug(`Agent record saved: ${payload.metadata.taskId}`);
    return true;
  } catch (error) {
    logger.error('Error updating database', {
      error: error.message,
      taskId: payload?.metadata?.taskId
    });
    return false;
  }
};

/**
 * Update Documentum ID for a specific task
 *
 * @async
 * @param {Object} payload - {taskId, documentumid}
 * @returns {boolean}
 */
const updateADocumentId = async (payload) => {
  try {
    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.AGENTS,
        Key: { taskId: payload.taskId },
        UpdateExpression: 'SET documentumid = :docId, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':docId': payload.documentumid,
          ':updatedAt': new Date().toISOString()
        }
      })
    );

    logger.debug(`Agent record updated with documentId: ${payload.taskId}`);
    return true;
  } catch (error) {
    logger.error('Error updating documentId', {
      error: error.message,
      taskId: payload?.taskId
    });
    return false;
  }
};

module.exports = {
  updateAgentDatabase,
  getMetadata,
  updateADocumentId
};