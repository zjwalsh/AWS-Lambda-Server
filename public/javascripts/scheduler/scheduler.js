// Scheduler
const {
    ToadScheduler,
    SimpleIntervalJob,
    AsyncTask,
  } = require('toad-scheduler');

const { db } = require('../db/db.js');
const { getWXRefreshToken, wxDeleteAll, getWXToken } = require('../api/wxccTokenService.js');
const { getCAAuthToken, caDeleteAll, getCAToken  } =  require('../api/caTokenService.js')
const { findSubscription, updateSubDatabase } = require('../db/subscriptionDb.js')
const {subscribe} = require('../api/webex.js');

var logger=require('../../../log.js');
const { get } = require('http');

const INTERVAL = 15;

// Connect to your database. Change the parameters inside of db.js to switch your database type.
db.sync({
  force: false,
})
  .then(() => logger.info('DB Connected!'))
  .catch((err) => logger.error(err));



    /**
 * $Start Scheduler 
 */
const initializeScheduler = async () => {
  
  // Initialize the Access Tokens upon startup.
  // If WXToken is good then dont refresh. if you do this to many times WXCC will kill the integration.
  try{
    var retVal = await getWXToken();
      logger.info('WXCC Access Token upon startup: ' + retVal[0].dataValues.access_token);
      if (retVal[0].dataValues.access_token != null) {
        var addDate = new Date(retVal[0].dataValues.createdAt).getTime();
        var refreshDate = retVal[0].dataValues.refresh_token_expires_in;
        var dateNow = new Date().getTime();
        if ((addDate + refreshDate) < dateNow){
          wxDeleteAll();
          getWXRefreshToken();

        }

      }
    await caDeleteAll();
    await getCAAuthToken();

    // Check for existing subscription, create one if not found
    subscription_id  =  await findSubscription();
    if (subscription_id.length == 0) {
      logger.info('No existing Webex CC Subscription found in DB. A new subscription will be created upon server start.');
      response = await subscribe();
      if (response != null) {
        if (response!=false) {
            await updateSubDatabase(response);
            res.json({"status": "subscribed", "subscriptionId": subscription_Id});
            
        } else {
            res.json({"status": "unsubscribed", "error": "subscribe failed"});
        }
      };
    };
  }catch(error){
    logger.error(`MAJOR ERROR Starting Scheduler: ${error}`);
  }
    //configure scheduler
    logger.info('Initializing the Scheduler..');
    const scheduler = new ToadScheduler();
    const task_getWXRefreshToken = new AsyncTask('Fetch Refresh Token', getWXRefreshToken);
    const job_getWXRefreshToken = new SimpleIntervalJob({ minutes: 15 }, task_getWXRefreshToken);
    const task_getCAAccessToken = new AsyncTask('Fetch Refresh Token', getCAAuthToken);
    const job_getCAAccessToken = new SimpleIntervalJob({ minutes: 15 }, task_getCAAccessToken);

    //Start Scheduler
    try{
      scheduler.addSimpleIntervalJob(job_getWXRefreshToken);
      scheduler.addSimpleIntervalJob(job_getCAAccessToken);
      logger.info('Initializing the Scheduler - job_getWXRefreshToken');
      console.log('Initializing the Scheduler - job_getWXRefreshToken');
      logger.info('Initializing the Scheduler - job_getCAAccessToken');
      console.log('Initializing the Scheduler - job_getCAAccessToken');
    }catch(error){
      logger.error(`MAJOR ERROR Starting Scheduler: ${error}`);
    }

    return;
  };
  
  module.exports = { initializeScheduler };