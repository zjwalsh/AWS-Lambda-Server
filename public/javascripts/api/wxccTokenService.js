/* Token Service maintains the database methods to insert/update/retrieve the access and refresh token details.
Updates the specific details in the database.
Retrieves a new access and refresh token as needed.
 */
const axios = require('axios');
var logger=require('../../../log.js');
const { dynamoDb } = require('../db/dynamodb.js');
const { GetCommand, PutCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = process.env.WX_TOKEN_TABLE_NAME;

/**
 * $Call Webex API to get new Auth Token
 *
 * @async
 * @returns {string}
 */
const getWXRefreshToken = async () => {
    const webexUrl = WXAUTH_URL;
    const params = {
      grant_type: 'refresh_token',
      client_id: WXCLIENT_ID,
      client_secret: WXCLIENT_SECRET,
      refresh_token: WXCC_REFRESH_TOKEN,
    };

    logger.debug(`Trying request for WX Token with params: ${JSON.stringify(params)}`);
    

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

      // Store this in database..
      logger.info(`Storing in WX token database: ${JSON.stringify(response.data)}`);
      // Gives -> access_token, expires_in, refresh_token, refresh_token_expires_in, token_type
      // Returned access token
      let token_data = await response.data;
      let token = '';
      // Checking
      try {
          token = await getWXToken();
        } catch (error) {
          logger.error(`Error while fetching WX token: ${error}`);
      }
      if (token) {
        logger.info(
            `Found existing token details in WX DB: ${JSON.stringify(token)} updating with this data:-> ${JSON.stringify(token_data)}`
          );
      } else {
        logger.info(`No Existing WX token found, updating / creating first one..`);
      }

        // Update Token in DB - Client Secret update
      let dbResponse = '';
      try {
          dbResponse = await updateWXToken(token_data);
          logger.debug(`Created new WX token DB record: ${JSON.stringify(dbResponse)}`);
      } catch (error) {
          logger.error(`Error while updating WX DB: ${error}`);
      }
      return dbResponse;
    } catch (error) {
      logger.error(`MAJOR ERROR in RETRIEVING THE WX ACCESS TOKEN: ${error}`);
    }
  };
  
const getWXToken = async () => {
  try {
    const params = {
      TableName: TABLE_NAME,
      Key: { id: '1' }
    };
    const { Item } = await dynamoDb.send(new GetCommand(params));
    return Item ? [Item] : [];
  } catch (error) {
    logger.error(`Error fetching WX token from DynamoDB: ${error.message}`);
    return [];
  }
};

const updateWXToken = async (token) => {
  try {
    const item = {
      id: '1',
      access_token: token.access_token,
      expires_in: token.expires_in,
      refresh_token: token.refresh_token,
      refresh_token_expires_in: token.refresh_token_expires_in,
      token_type: token.token_type,
      scope: token.scope,
      updatedAt: new Date().toISOString()
    };
    await dynamoDb.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    }));
    return item;
  } catch (error) {
    logger.error(`Error updating WX token in DynamoDB: ${error.message}`);
    throw error;
  }
};

const getWXAccessToken = async () => {
  const token = await getWXToken();
  if (!token || token.length === 0) return null;
  
  let access_token = token[0].access_token;
  logger.debug(`Returning WX Access Token: ${access_token}`);
  return { access_token };
};

const wxDeleteAll = async() => {
  try {
    await dynamoDb.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { id: '1' }
    }));
    logger.debug(`Deleted WX Token record.`);
    return true;
  } catch (error) {
    logger.error(`Error deleting WX Token: ${error.message}`);
    return false;
  }
}

module.exports = { getWXToken, updateWXToken, getWXAccessToken, getWXRefreshToken, wxDeleteAll };
