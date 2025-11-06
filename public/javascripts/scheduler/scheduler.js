// Scheduler
const {
    ToadScheduler,
    SimpleIntervalJob,
    AsyncTask,
  } = require('toad-scheduler');

const { db } = require('../db/db.js');
const { getWXRefreshToken, wxDeleteAll } = require('../api/wxccTokenService.js');
const { getCAAuthToken, caDeleteAll } =  require('../api/caTokenService.js')
const { findSubscription } = require('../db/subscriptionDb.js')

var logger=require('../../../log.js');

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
    wxDeleteAll();
    caDeleteAll();

    getWXRefreshToken();
    getCAAuthToken();
    subscription_id  =  await findSubscription();
    

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