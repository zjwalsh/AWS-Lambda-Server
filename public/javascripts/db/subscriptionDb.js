const { db } = require('./db');
const { sequelize } = require('sequelize');
var logger = require('../../../log.js');


/**
 * $subscriptions Database object
 *
 * @type {Object.JSON}
 */
const { subscriptions } = require('../../../models/subscriptions.js');

/**
 * Query to find if any subscription exists in database
 *
 * @returns {Object.JSON}
 */
const findSubscription = async () => {

    try{
        logger.debug("Find all Subscription  " );
        const subscription = await subscriptions.findAll({limit: 1});
        return subscription[0].dataValues.id;
    }catch (error){
      logger.debug("Error trying to find Subscriptions - " +  error.message);
      return [];
    }

};

 /**
 * Update Database. Check if new user or existing. If new Call getagentInfo to get email and 
 * agent type. If existing just update.
 *
 * @async
 * @param {string} payload
 * @returns {boolean}
 */
const updateSubDatabase = async (payload) => {

  try{
        //Add Record to DB
        const record = await subscriptions.create(
          {
              id: payload.data.data.id,
              name: payload.data.data.name,
              description: payload.data.data.description,
              createdBy: payload.data.data.createdBy,
              eventTypes: payload.data.data.eventTypes,
              destinationUrl: payload.data.data.destinationUrl,
              status: payload.data.data.status,
              createdTime: payload.data.data.createdTime
          },
          { returning: true }
        );
        logger.debug('Created new Subscription record: ' + payload.taskId);

    }catch(error){
        logger.error("Error Updateing subscriptions Database - " + JSON.stringify(error.message));
        return false
    }
};

module.exports = {updateSubDatabase, findSubscription};