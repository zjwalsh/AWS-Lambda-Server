//const { db } = require('./db');
//const { sequelize } = require('sequelize');
//const Op = require('sequelize').Op;
var logger = require('../../../log.js');

/**
 * $Captures Database object
 *
 * @type {Object.JSON}
 */
const { wxAgents } = require('../../../models/Agents.js');


/**
 * Query to find taksId from database
 *
 * @param {string} taskId
 * @returns {Object.JSON}
 */
const getMetadata = async (taskId) => {

    try{
        logger.debug("Find Task Id - " + taskId);
        
        const findMetaData = wxAgents.findOne({
            where: {
                taskId: taskId,
            },
        });
        return findMetaData;
    }catch (error){
      logger.debug("Failed find Task Id - " + JSON.stringify(payload.taskId) + error.message);
      return false
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
const updateAgentDatabase = async (payload) => {

  try{

      //Query for agent by ID
      await wxAgents.upsert(
          {
            taskId: payload.metadata.taskId,
            program: payload.metadata.program,
            appNumber: payload.metadata.appNumber,
            caseNumber: payload.metadata.caseNumber,
            firstName: payload.metadata.firstName,
            lastName: payload.metadata.lastName,
            formId: payload.metadata.process,
            formName: payload.metadata.formId,
          },

          { returning: true }
        );
        logger.debug('Agent record Done: ' + payload.taskId);
        return true
  }catch(error){
    logger.error("Error Updateing database - " + JSON.stringify(error.message));
    return false
  }
};

const updateADocumentId= async (payload) => {

  try{
      //Query for agent by ID
      await wxAgents.update(

        { documentumid: payload.documentumid },
        { 
          where: { taskId: payload.taskId },
          returning: true 
        }
      );
      logger.debug('Agent record Done: ' + payload.taskId);
      return true
  }catch(error){
    logger.error("Error Updateing database - " + JSON.stringify(error.message));
    return false
  }
};

module.exports = {updateAgentDatabase, getMetadata, updateADocumentId};