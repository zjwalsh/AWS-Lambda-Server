/**Collection of webex API commands used by application
 * 
 */

const axios = require("axios");
const { getWXAccessToken } = require('../api/wxccTokenService.js')
const { findSubscription, deleteSubscription } = require('../db/subscriptionDb.js');
var logger = require('../../../log.js');
var curModual = " - api.js - "

/**
 * $Send Pause Resume to start segment recording
 *
 * @async
 * @returns {string}
 */
const sendPauseResume = async (taskId) => {
  try {
    logger.info(curModual + "sendPauseResume - Sending Pause/Resume Command to WebEx for taskId " + taskId);
    const accessToken = await getWXAccessToken();
    if (accessToken == null) {
      logger.warn(curModual + "sendPauseResume - No Access Token");
      return null;
    }

    // Send the Pause Resume commands to Webexcc
    logger.info(curModual + "sendPauseResume - Sending Pause/Resume Command to WebEx");
    let config = {
      method: 'post',
      maxBodyLength: Infinity,
      headers: {
        'Authorization': 'Bearer ' + accessToken.access_token,
        'Content-Type': 'application/json'
      }
    };

    // Send the Pause command
    let url = 'https://api.wxcc-us1.cisco.com/v1/tasks/' + taskId + '/record/pause';
    try {
      const pauseResponse = await axios.request(url, config);
      logger.debug("Webex Response to Pause: " + JSON.stringify(pauseResponse.data));
    } catch (error) {
      logger.error("Pause returned error: " + error.message);
      return null;
    }

    //Send the Resume command
    url = 'https://api.wxcc-us1.cisco.com/v1/tasks/' + taskId + '/record/resume';
    try {
      const resumeResponse = await axios.request(url, config);
      logger.debug("Webex Response to Resume: " + JSON.stringify(resumeResponse.data));
      
      // Capture Cisco's server time from the response headers to align with segment timestamps
      const ciscoDate = resumeResponse.headers.date;
      const ciscoTimestamp = ciscoDate ? new Date(ciscoDate).getTime() : Date.now();
      
      logger.info(curModual + `sendPauseResume - Success for taskId ${taskId}. Cisco Time: ${ciscoTimestamp}`);
      
      return { success: true, timestamp: ciscoTimestamp };
    } catch (error) {
      logger.error("Resume returned error: " + error.message);
      return null;
    }

  } catch (error) {
    logger.error("Send pause resume error: " + error.message);
    return null;
  }
}


/**
 * $Subscribel to Wxcc Webhook. Will send call center events.
 *
 * @async
 * @returns {string}
 */
const subscribe = async () => {

  logger.info(curModual + "subscribe - Subscribing to WebEx WebHooks");

  // Check for an existing subscription record in the database to prevent duplicate entries
  const existingId = await findSubscription();
  if (existingId) {
    logger.warn(curModual + "subscribe - Subscription already exists in database: " + existingId);
    return { data: { data: { id: existingId, status: "active" } }, alreadyExists: true };
  }

  const accessToken = await getWXAccessToken();

  let payload = {
    name: "Captures",
    description: "Capture Events",
    eventTypes: [
      "capture:available",
    ],
    destinationUrl: WEBHOOK_URL,
    orgId: WXCLIENT_ORGID,
    secret: WXCC_WEBHOOK_SECRET,
    resourceVersion: "capture:1.0.0"
  };
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://api.wxcc-us1.cisco.com/v2/subscriptions',
    headers: {
      'Authorization': 'Bearer ' + accessToken.access_token,
      'Content-Type': 'application/json'
    },
    data: payload
  };


  try {
    logger.debug(curModual + "subscribe - subscription sent - Request- " + JSON.stringify(config));
    const response = await axios.request(config)
    logger.debug(curModual + "subscribe - subscription sent - status " + response.data.data.status + " - TrackingId - " + response.headers.trackingid);
    logger.debug(curModual + "subscribe - subscription id - " + response.data.data.id);
    SUBSCRIPTION_ID = response.data.data.id;
    return response;
  } catch (error) {
    logger.warn(curModual + "subscribe - failed to establish subscription");
    logger.debug(curModual + "subscribe - error info - " + JSON.stringify(error.message));
    return false;
  }

};

/**
 * $unsubscribr from active webhook
 *
 * @async
 * @returns {string,Boolean}
 */
const unsubscribe = async () => {
  logger.info(curModual + "unsubscribe - Unsubscribing to WebEx WebHooks");
  const accessToken = await getWXAccessToken();
  if (SUBSCRIPTION_ID == null) {
    logger.debug(curModual + "unsubscribe - no subscription id found");
    return;
  }
  try {
    const response = await axios.delete(
      "https://api.wxcc-us1.cisco.com/v2/subscriptions/" + SUBSCRIPTION_ID,
      {
        headers: {
          "Accept": "application/json",
          "Authorization": "Bearer " + accessToken.access_token
        }
      }
    )
    logger.debug(curModual + "unsubscribe - unsubscription sent");
    logger.debug(curModual + "unsubscribe - HTTP Response code " + response.status + " - TrackingId - " + response.headers.trackingid);
    await deleteSubscription(SUBSCRIPTION_ID);
    SUBSCRIPTION_ID = null;
    return true;
  } catch (error) {
    logger.warn(curModual + "unsubscribe - failed to unsubscribe");
    logger.debug(curModual + "unsubsribe - error info - " + error.message);
    return false;
  }
};

/**
 * $Returns if subscribed and subscrition number
 *
 * @async
 * @returns {Object.JSON}
 */
const getStatus = async () => {
  try {

    if (SUBSCRIPTION_ID != null) {
      let retval = {
        subscriptionId: SUBSCRIPTION_ID,
        status: "Active",
      };
      return retval;
    } else {
      let retval = {
        subscriptionId: "",
        status: "No Subscription",
      };
      return retval;
    };
  } catch (error) {
    logger.debug(curModual + "Get Status - error info - " + error.message);
    return error;

  }
}

/**
 * Make API Call to WXCC to get agent User Information
 * @param {string} agentId 
 * @returns {Object.JSON}
 */
const getAgentInfo = async (agentId) => {
  logger.debug(curModual + "Get Agent Information - " + agentId);
  const accessToken = await getAccessToken();

  let config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: 'https://api.wxcc-us1.cisco.com/organization/' + CLIENT_ORGID + '/user/by-ci-user-id/' + agentId,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken.access_token
    },
  };
  try {
    logger.debug(curModual + "Get Agent Information - Request " + JSON.stringify(config));
    const response = await axios.request(config)
    logger.debug(curModual + "Get Agent Information - Response " + response.status + " - TrackingId - " + response.headers.trackingid);
    //Get Agent type from profileID    
    var ProfileInfo = await getProfileInfo(response.data.userProfileId);
    response["profileType"] = ProfileInfo.response.data.profileType
    return { response };
  } catch (error) {
    logger.debug(curModual + "Get Agent Information - error info - " + error.message);
    return { error };
  }
};

/**
* Make API Call to WXCC to get Agent User Profile
* @param {string} profileId 
* @returns {Object.JSON}
*/
const getProfileInfo = async (profileId) => {

  try {
    logger.debug(curModual + "Get Profile Information - " + profileId);
    const accessToken = await getAccessToken();
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: 'https://api.wxcc-us1.cisco.com/organization/' + CLIENT_ORGID + '/user-profile/' + profileId,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + accessToken.access_token
      },
    };

    logger.debug(curModual + "Get Agent Information - Request " + JSON.stringify(config));
    const response = await axios.request(config)
    logger.debug(curModual + "Get Agent Information - Response " + response.status + " - TrackingId - " + response.headers.trackingid);
    return { response };
  } catch (error) {
    logger.debug(curModual + "Get Agent Information - error info - " + error.message);
    return { error };
  }
};

module.exports = { subscribe, unsubscribe, getAgentInfo, getStatus, sendPauseResume };
