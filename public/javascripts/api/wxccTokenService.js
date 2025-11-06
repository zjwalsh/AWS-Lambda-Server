/* Token Service maintains the database methods to insert/update/retrieve the access and refresh token details.
Updates the specific details in the database.
Retrieves a new access and refresh token as needed.
 */
const axios = require('axios');

var logger=require('../../../log.js');


const { wxToken } = require('../../../models/wxToken');
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
  // Gets the Access Token from the database. This is not per org (yet). Can be extended if needed.
  const token = await wxToken.findAll();
  //   {
  //   where: {
  //     id: 1,
  //   },
  // });

  if (token) return token;
  else return {};
};

const updateWXToken = async (token) => {
  // Updates the existing Token in the Database
  //let [accessToken, clusterId, orgId] = token.access_token.split('_');

  const record = wxToken.upsert(
    {
      id: 1,
      access_token: token.access_token,
      expires_in: token.expires_in,
      refresh_token: token.refresh_token,
      refresh_token_expires_in: token.refresh_token_expires_in,
      token_type: token.token_type,
      scope: token.scope
    },
    { returning: true }
  );
  return record;
};

const getWXAccessToken = async () => {
  // Fetches the latest access Token if present in the database, else, it returns nothing.
  const token = await getWXToken();
  let access_token = (await token[0].dataValues.access_token);
  logger.debug(`Returning WX Access Token: ${access_token}`);
  return { access_token };
};


const wxDeleteAll = async() => {
  
  try {
    const retval = wxToken.truncate();
    logger.debug(`Delete all records in WX Token database.`);
    return true;
  } catch (error) {
    logger.error(`Error while updating WX DB: ${error}`);
    return false;
  }
 
}

module.exports = { getWXToken, updateWXToken, getWXAccessToken, getWXRefreshToken, wxDeleteAll };
