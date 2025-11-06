/**Collection of webex API commands used by application
 * 
 */

const axios = require("axios");
const {getWXAccessToken} = require('../api/wxccTokenService.js')
var logger=require('../../../log.js');
var curModual = " - api.js - "

/**
 * $Send Pause Resume to start segment recording
 *
 * @async
 * @returns {string}
 */
const sendPauseResume = async (taskId) => {
  try{
    logger.info(curModual + "sendPauseResume - Sending Pause/Resume Command to WebEx for taskId " + taskId);
    const accessToken = await getWXAccessToken();
    if (accessToken == null) {
      logger.warn(curModual + "sendPauseResume - No Access Token");
      return false;
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
      logger.debug("Pause returned error: " + error.message);
      return false;
    }

    //Send the Resume command
    url = 'https://api.wxcc-us1.cisco.com/v1/tasks/' + taskId + '/record/resume';
    try {
      const resumeResponse = await axios.request(url, config);
      logger.debug("Webex Response to Resume: " + JSON.stringify(resumeResponse.data));
      logger.info(curModual + "sendPauseResume - Successfully sent pause/resume commands for taskId " + taskId);
      return true; // Return true on successful completion
    } catch (error) {
      logger.debug("Resume returned error: " + error.message);
      return false;
    }

  }catch (error){
    logger.debug("Send pause resume error: " + error.message);
    return false;
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

    const accessToken = await getWXAccessToken();

    let payload = {
        name: "Captures",
        description: "Capture Events",
        eventTypes: [
          "capture:available",
        ],
        destinationUrl: WEBHOOK_URL,
        secret: WXCLIENT_SECRET,
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
        data : payload
      };


    try{
        logger.debug(curModual + "subscribe - subscription sent - Request- " + JSON.stringify(config));
        const response = await axios.request(config)
        logger.debug(curModual + "subscribe - subscription sent - status " + response.data.data.status + " - TrackingId - " + response.headers.trackingid);
        logger.debug(curModual + "subscribe - subscription id - " + response.data.data.id);
        subscription_Id = response.data.data.id;
       return response;
    }catch(error) {
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
    if (subscription_Id == null) {
        logger.debug(curModual + "unsubscribe - no subscription id found");
        return;
    }
    try {
        const response = await axios.delete(
            "https://api.wxcc-us1.cisco.com/v2/subscriptions/" + subscription_Id,
            {
                headers: {
                    "Accept": "application/json",
                    "Authorization": "Bearer " + accessToken.access_token
                }
            }
        )
        logger.debug(curModual + "unsubscribe - unsubscription sent");
        logger.debug(curModual + "unsubscribe - HTTP Response code " + response.status + " - TrackingId - " + response.headers.trackingid);
        subscription_Id = null;
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
  try{
    
    if (subscription_Id != null){
      let retval ={
        subscriptionId: subscription_Id,
        status:"Active",      
      };
      return retval;
    }else{
      let retval ={
        subscriptionId: "",
        status:"No Subscription",      
      };
      return retval;
    };
  }catch(error) {
    logger.debug(curModual + "Get Status - error info - " + error.message);
    return error;

  }
}

 /**
  * Make API Call to WXCC to get agent User Information
  * @param {string} agentId 
  * @returns {Object.JSON}
  */
  const getAgentInfo = async (agentId) =>{
    logger.debug(curModual + "Get Agent Information - " + agentId);
    const accessToken = await getAccessToken();

    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: 'https://api.wxcc-us1.cisco.com/organization/' + CLIENT_ORGID + '/user/by-ci-user-id/' + agentId ,
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': 'Bearer ' + accessToken.access_token
      },
    };
      try{
          logger.debug(curModual + "Get Agent Information - Request " + JSON.stringify(config));
          const response = await axios.request(config)   
          logger.debug(curModual + "Get Agent Information - Response " + response.status+ " - TrackingId - " + response.headers.trackingid);
          //Get Agent type from profileID    
          var ProfileInfo = await getProfileInfo(response.data.userProfileId);
          response["profileType"] = ProfileInfo.response.data.profileType
          return {response};
      }catch(error) {
          logger.debug(curModual + "Get Agent Information - error info - " + error.message);
          return {error};
      }
  };

   /**
  * Make API Call to WXCC to get Agent User Profile
  * @param {string} profileId 
  * @returns {Object.JSON}
  */
  const getProfileInfo = async (profileId) =>{

    try{
      logger.debug(curModual + "Get Profile Information - " + profileId);
      const accessToken = await getAccessToken();
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://api.wxcc-us1.cisco.com/organization/' + CLIENT_ORGID + '/user-profile/' + profileId ,
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': 'Bearer ' + accessToken.access_token
        },
      };

      logger.debug(curModual + "Get Agent Information - Request " + JSON.stringify(config));
      const response = await axios.request(config)   
      logger.debug(curModual + "Get Agent Information - Response " + response.status + " - TrackingId - " + response.headers.trackingid);       
      return {response};
    }catch(error) {
      logger.debug(curModual + "Get Agent Information - error info - " + error.message);
      return {error};
    }
  };

  module.exports = { subscribe,unsubscribe,getAgentInfo,getStatus,sendPauseResume };
