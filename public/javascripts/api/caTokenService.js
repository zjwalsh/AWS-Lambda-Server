/* Token Service maintains the database methods to insert/update/retrieve the access and refresh token details.
Updates the specific details in the database.
Retrieves a new access and refresh token as needed.
 */
const axios = require('axios');
var logger=require('../../../log.js');
const { dynamoDb } = require('../db/dynamodb.js');
const { GetCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.CAWS_TOKEN_TABLE_NAME;

/**
 * $CAll Webex API to get new Auth Token
 *
 * @async
 * @returns {string}
 */
const getCAAuthToken = async () => {
    const webexUrl = CAAUTH_URL;
    const params = {
      client_id: CACLIENT_ID,
      client_secret: CACLIENT_SECRET,
      scope:CACLIENT_SCOPE,
    };

    logger.debug(`Trying CA token request with params: ${JSON.stringify(params)}`);
    

    let urlParams = Object.entries(params)
      .map((x) => `${encodeURIComponent(x[0])}=${encodeURIComponent(x[1])}`)
      .join('&');

    const config = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    };

    try {
      const response = await axios.post(webexUrl, urlParams, config);

      let token_data = response.data;
      logger.info(`CA API response received`, { access_token_present: !!token_data.access_token, token_type: token_data.token_type });

      if (!token_data.access_token) {
        logger.error(`CA API returned response but no access_token present: ${JSON.stringify(token_data)}`);
        throw new Error('CA API returned no access_token');
      }

      const dbResponse = await updateCAToken(token_data);
      logger.info(`CA token stored in database successfully`);
      return dbResponse;
    } catch (error) {
      logger.error(`MAJOR ERROR in RETRIEVING THE CA ACCESS TOKEN: ${error}`);
    }
  };
  
const getCAToken = async () => {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { id: '1' }
    };
    const { Item } = await dynamoDb.send(new GetCommand(params));
    return Item ? [Item] : [];
  } catch (error) {
    logger.error(`Error fetching CA token from DynamoDB: ${error.message}`);
    return [];
  }
};

const updateCAToken = async (token) => {
  try {
    const item = {
      id: '1',
      access_token: token.access_token,
      scope: token.scope,
      expires_in: token.expires_in,
      token_type: token.token_type,
      updatedAt: new Date().toISOString()
    };
    await dynamoDb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    }));
    return item;
  } catch (error) {
    logger.error(`Error updating CA token in DynamoDB: ${error.message}`);
    throw error;
  }
};

const getCAAccessToken = async () => {
  const token = await getCAToken();
  if (!token || token.length === 0) {
    logger.debug('No CA token found in database');
    return { access_token: '' };
  }
  
  let access_token = token[0].access_token || '';
  logger.debug(`Returning CA Access Token: ${access_token}`);
  return { access_token };
};

/**
 * Delete all records in agent Databbase
 *
 * @async
 * @returns {string,boolean}
 */
const caDeleteAll = async() => {
  try {
    await dynamoDb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id: '1' }
    }));
    logger.debug(`Deleted CA Token record.`);
    return true;
  } catch (error) {
    logger.error(`Error deleting CA Token: ${error.message}`);
    return false;
  }
}
module.exports = { getCAToken, updateCAToken, getCAAccessToken, getCAAuthToken,caDeleteAll };
