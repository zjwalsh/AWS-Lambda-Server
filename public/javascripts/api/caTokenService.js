/* Token Service maintains the database methods to insert/update/retrieve the access and refresh token details.
Updates the specific details in the database.
Retrieves a new access and refresh token as needed.
 */
const axios = require('axios');

var logger=require('../../../log.js');


const { calToken } = require('../../../models/cawsToken');
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

      // Store this in database..
      logger.info(`Storing in CA token database: ${JSON.stringify(response.data)}`);
      // Gives -> access_token, expires_in, refresh_token, refresh_token_expires_in, token_type
      // Returned access token
      let token_data = await response.data;
      let token = '';
      // Checking
      try {
          token = await getCAToken();
        } catch (error) {
          logger.error(`Error while fetching CA token: ${error}`);
      }
      if (token) {
        logger.info(
            `Found existing token details in CA DB: ${JSON.stringify(token)} updating with this data:-> ${JSON.stringify(token_data)}`
          );
      } else {
        logger.info(`No Existing token found in CA Database, updating / creating first one..`);
      }

        // Update Token in DB - Client Secret update
      let dbResponse = '';
      try {
          dbResponse = await updateCAToken(token_data);
          logger.debug(`Created new CA DB record: ${JSON.stringify(dbResponse)}`);
      } catch (error) {
          logger.error(`Error while updating CA DB: ${error}`);
      }
      return dbResponse;
    } catch (error) {
      logger.error(`MAJOR ERROR in RETRIEVING THE CA ACCESS TOKEN: ${error}`);
    }
  };
  
const getCAToken = async () => {
  // Gets the Access Token from the database. This is not per org (yet). CAn be extended if needed.
  const token = calToken.findOne({
    where: {
      id: 1,
    },
  });

  if (token) return token;
  else return {};
};

const updateCAToken = async (token) => {
  // Updates the existing Token in the Database
  
  const record = calToken.upsert(
    {
      id: 1,
      access_token: token.access_token,
      scope: token.scope,
      expires_in: token.expires_in,
      token_type: token.token_type,
    },
    { returning: true }
  );
  return record;
};

const getCAAccessToken = async () => {
  // Fetches the latest access Token if present in the database, else, it returns nothing.
  const token = await getCAToken();
  let access_token = (await token.access_token) ? token.access_token : '';
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
    const retval = calToken.truncate();
    logger.debug(`Delete all records in caltokens.`);
    return true;
  } catch (error) {
    logger.error(`Error while updating CA Token DB: ${error}`);
    return false;
  }
 
}
module.exports = { getCAToken, updateCAToken, getCAAccessToken, getCAAuthToken,caDeleteAll };
