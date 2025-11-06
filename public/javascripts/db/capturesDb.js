const { db } = require('./db.js');
const { sequelize } = require('sequelize');
const Op = require('sequelize').Op;
var logger = require('../../../log.js');


/**
 * $Captures Database object
 *
 * @type {Object.JSON}
 */
const { captures } = require('../../../models/captures.js');

const updateCaptures = async (Agent) => {

  try{
      //Query for agent by ID
      let retval = await findSingleAgent(Agent)
      if (retval) {
        //If return true than agent already in Database. Just do update
        const record = await Agents.update(
          {
              agent_id: Agent.data.agentId,
              currentState: Agent.data.currentState,
              org_id: Agent.data.comciscoorgid,
              loggedOutBy: Agent.data.loggedOutBy,
              createdTime:  Agent.data.createdTime
          },
            {
              where: {
                agent_id: Agent.data.agentId,
              },
            },
          { returning: true }
        );
        logger.debug('Updated agent record: ' + Agent.data.agentId);
      //If new record get run WebEx API to get agent email and Type
      }else{
        const agentInfo = await getAgentInfo(Agent.data.agentId);
        logger.debug("Agent login - " + agentInfo.response.data.email);
        logger.debug("Agent Type - " + agentInfo.response.profileType);
        //Add Record to DB
        const record = await Agents.create(
          {
              agent_id: Agent.data.agentId,
              currentState: Agent.data.currentState,
              agentLogin: agentInfo.response.data.email,
              org_id: Agent.data.comciscoorgid,
              loggedOutBy: Agent.data.loggedOutBy,
              type: agentInfo.response.profileType,
              createdTime:  Agent.data.createdTime
          },
          { returning: true }
        );
        logger.debug('Created new agent record: ' + Agent.data.agentId);
      }
  }catch(error){
    logger.error("Error Updateing database - " + JSON.stringify(error));
  }
};

module.exports = {updateCaptures};
