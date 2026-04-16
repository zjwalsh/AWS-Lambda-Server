/**
 * DynamoDB operations for Agents table
 *
 * Schema: composite key
 *   taskId  (partition key) - Webex call identifier, groups all pairs for a call
 *   recordId (sort key, UUID) - uniquely identifies each pause/resume pair
 */
const { PutCommand, UpdateCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDb, TABLES } = require('./dynamodb');
const logger = require('../../../log.js');
const { randomUUID } = require('crypto');


/**
 * Query to find taskId from database
 *
 * @param {string} taskId
 * @returns {Object|null}
 */
const getDbMetadata = async (taskId) => {
  try {
    logger.debug(`Find Task Id - ${taskId}`);

    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: TABLES.AGENTS,
        KeyConditionExpression: 'taskId = :taskId',
        ExpressionAttributeValues: { ':taskId': taskId },
        Limit: 1
      })
    );

    return (result.Items && result.Items.length > 0) ? result.Items[0] : null;
  } catch (error) {
    logger.error(`Failed find Task Id - ${taskId}`, { error: error.message });
    return null;
  }
};

/**
 * Get all pause/resume records for a taskId, sorted by pairIndex.
 *
 * @param {string} taskId
 * @returns {Array}
 */
const getRecordsByTaskId = async (taskId) => {
  try {
    logger.debug(`Query all records for taskId - ${taskId}`);
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: TABLES.AGENTS,
        KeyConditionExpression: 'taskId = :taskId',
        ExpressionAttributeValues: { ':taskId': taskId }
      })
    );
    const items = result.Items || [];
    items.sort((a, b) => a.pairIndex - b.pairIndex);
    return items;
  } catch (error) {
    logger.error(`Failed to query records for taskId - ${taskId}`, { error: error.message });
    return [];
  }
};

/**
 * Count existing pause/resume records for a taskId.
 * Used to assign the pairIndex for a new record.
 *
 * @param {string} taskId
 * @returns {number}
 */
const countRecordsByTaskId = async (taskId) => {
  try {
    const result = await dynamoDb.send(
      new QueryCommand({
        TableName: TABLES.AGENTS,
        KeyConditionExpression: 'taskId = :taskId',
        ExpressionAttributeValues: { ':taskId': taskId },
        Select: 'COUNT'
      })
    );
    return result.Count || 0;
  } catch (error) {
    logger.error(`Failed to count records for taskId - ${taskId}`, { error: error.message });
    return 0;
  }
};

/**
 * Create a new record for one pause/resume pair.
 * Each invocation of pauseResume creates its own record with all form metadata.
 *
 * @param {Object} metadata - form data from the widget
 * @param {number} pairIndex - 0-based index of this pair within the call
 * @returns {string|null} recordId on success, null on failure
 */
const createAgentRecord = async (metadata, pairIndex) => {
  try {
    const recordId = randomUUID();
    const now = new Date().toISOString();

    const item = {
      taskId: metadata.taskId,
      recordId,
      pairIndex,
      program: metadata.program,
      appNumber: metadata.appNumber,
      caseNumber: metadata.caseNumber,
      firstName: metadata.firstName,
      lastName: metadata.lastName,
      formId: metadata.process,
      formName: metadata.formId,
      status: 'pending',
      // Server-side epoch-ms recorded just before the Webex pause API call.
      // Used at webhook time to identify the correct segment even when hold/transfer
      // creates additional segment boundaries at unrelated times in the call.
      pauseSentAtMs: metadata.pauseSentAtMs,
      createdAt: now,
      updatedAt: now
    };

    await dynamoDb.send(
      new PutCommand({
        TableName: TABLES.AGENTS,
        Item: item
      })
    );

    logger.debug(`Agent record created: taskId=${metadata.taskId} recordId=${recordId} pairIndex=${pairIndex}`);
    return recordId;
  } catch (error) {
    logger.error('Error creating agent record', {
      error: error.message,
      taskId: metadata?.taskId
    });
    return null;
  }
};

/**
 * Update the record with the precise timestamp returned from the Webex API.
 */
const updateRecordTimestamp = async (taskId, recordId, timestamp) => {
  try {
    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.AGENTS,
        Key: { taskId, recordId },
        UpdateExpression: 'SET pauseSentAtMs = :ts, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':ts': timestamp,
          ':updatedAt': new Date().toISOString()
        }
      })
    );
    return true;
  } catch (error) {
    logger.error('Error updating record timestamp', { error: error.message, taskId, recordId });
    return false;
  }
};

/**
 * Update a specific record with the Documentum ID after a successful upload.
 *
 * @param {string} taskId
 * @param {string} recordId
 * @param {string} documentumId
 * @returns {boolean}
 */
const updateRecordDocumentId = async (taskId, recordId, documentumId) => {
  try {
    await dynamoDb.send(
      new UpdateCommand({
        TableName: TABLES.AGENTS,
        Key: { taskId, recordId },
        UpdateExpression: 'SET documentumId = :docId, #st = :status, updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#st': 'status' },
        ExpressionAttributeValues: {
          ':docId': documentumId,
          ':status': 'processed',
          ':updatedAt': new Date().toISOString()
        }
      })
    );
    logger.debug(`Record updated with documentId: taskId=${taskId} recordId=${recordId}`);
    return true;
  } catch (error) {
    logger.error('Error updating documentId', { error: error.message, taskId, recordId });
    return false;
  }
};

/**
 * Update agent record with caseUUID from CALSAWS API call
 * This should be called before uploading to third party
 * @param {string} taskId - WebEx TaskId
 * @param {string} caseUUID - Case UUID returned from CALSAWS API
 */
const updateAgentWithCaseUUID = async (taskId, caseUUID) => {
  try {
    const records = await getRecordsByTaskId(taskId);
    if (!records || records.length === 0) {
      logger.debug(`No records found for taskId ${taskId} when updating caseUUID`);
      return false;
    }

    const updatePromises = records.map(record =>
      dynamoDb.send(
        new UpdateCommand({
          TableName: TABLES.AGENTS,
          Key: { taskId: record.taskId, recordId: record.recordId },
          UpdateExpression: 'SET caseUUID = :caseUUID, updatedAt = :updatedAt',
          ExpressionAttributeValues: {
            ':caseUUID': caseUUID,
            ':updatedAt': new Date().toISOString()
          }
        })
      )
    );

    await Promise.all(updatePromises);
    logger.debug(`Updated agent record ${taskId} with caseUUID: ${caseUUID}`);
    return true;
  } catch (error) {
    logger.error('Error updating agent with caseUUID', { error: error.message, taskId });
    return false;
  }
};


/**
 * Update all records for a taskId with the provided fields.
 * Used by processRecordings to set status, documentumId, caseUUID, etc.
 *
 * @param {string} taskId
 * @param {Object} fields - key/value pairs to set
 * @returns {boolean}
 */
const updateAgentFields = async (taskId, fields) => {
  try {
    const records = await getRecordsByTaskId(taskId);
    if (!records || records.length === 0) {
      logger.debug(`No records found for taskId ${taskId} when updating fields`);
      return false;
    }

    // Filter out undefined/null so DynamoDB doesn't reject the expression
    const fieldKeys = Object.keys(fields).filter(k => fields[k] !== undefined && fields[k] !== null);
    if (fieldKeys.length === 0) {
      logger.warn(`updateAgentFields called with no valid fields for taskId ${taskId}`);
      return false;
    }
    const UpdateExpression = 'SET ' + fieldKeys.map(k => `#${k} = :${k}`).join(', ') + ', updatedAt = :updatedAt';
    const ExpressionAttributeNames = fieldKeys.reduce((acc, k) => ({ ...acc, [`#${k}`]: k }), {});
    const ExpressionAttributeValues = fieldKeys.reduce((acc, k) => ({ ...acc, [`:${k}`]: fields[k] }), { ':updatedAt': new Date().toISOString() });

    const updatePromises = records.map(record =>
      dynamoDb.send(
        new UpdateCommand({
          TableName: TABLES.AGENTS,
          Key: { taskId: record.taskId, recordId: record.recordId },
          UpdateExpression,
          ExpressionAttributeNames,
          ExpressionAttributeValues
        })
      )
    );

    await Promise.all(updatePromises);
    logger.debug(`Updated ${records.length} record(s) for taskId=${taskId}`, { fields });
    return true;
  } catch (error) {
    logger.error('Error updating agent fields', { error: error.message, taskId, fields });
    return false;
  }
};

/**
 * Scan all records where createdAt falls within the given date range.
 * startDate and endDate are YYYY-MM-DD strings (endDate is inclusive).
 *
 * @param {string} startDate - e.g. "2026-04-09"
 * @param {string} endDate   - e.g. "2026-04-16"
 * @returns {Array}
 */
const getRecordsByDateRange = async (startDate, endDate) => {
  try {
    const start = `${startDate}T00:00:00.000Z`;
    const end   = `${endDate}T23:59:59.999Z`;

    let allItems = [];
    let lastEvaluatedKey = undefined;

    do {
      const params = {
        TableName: TABLES.AGENTS,
        FilterExpression: 'createdAt BETWEEN :start AND :end',
        ExpressionAttributeValues: { ':start': start, ':end': end },
        ...(lastEvaluatedKey && { ExclusiveStartKey: lastEvaluatedKey })
      };

      const result = await dynamoDb.send(new ScanCommand(params));
      allItems = allItems.concat(result.Items || []);
      lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    allItems.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    logger.debug(`getRecordsByDateRange found ${allItems.length} records between ${startDate} and ${endDate}`);
    return allItems;

  } catch (error) {
    logger.error(`Failed to scan records by date range`, { error: error.message, startDate, endDate });
    return [];
  }
};

module.exports = {
  createAgentRecord,
  countRecordsByTaskId,
  getRecordsByTaskId,
  updateRecordDocumentId,
  updateRecordTimestamp,
  updateAgentWithCaseUUID,
  updateAgentFields,
  getRecordsByDateRange,
  getDbMetadata
};
