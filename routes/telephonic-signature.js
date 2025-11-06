// ============================================
// FILE: routes/telephonic-signature.js (UPDATED)
// ============================================

const express = require('express');
const router = express.Router();
var logger = require('../log.js');
const { updateAgentDatabase } = require('../public/javascripts/db/agentsDb');
const { sendPauseResume } = require('../public/javascripts/api/webex');

// Serve the telephonic signature widget page
router.get('/', (req, res) => {
    res.render('telephonic-signature', {
        pageTitle: 'Telephonic Signature'
    });
});

/**
 * POST /telephonic-signature/pauseResume
 * Receives call data from the Webex widget and processes it
 */
router.post('/pauseResume', async (req, res) => {
    try {
        const { metadata } = req.body;
        
        // Validate required fields
        if (!metadata) {
            logger.error('Missing metadata in request body');
            return res.status(400).json({
                success: false,
                error: 'Missing required metadata'
            });
        }

        // Extract and validate taskId
        const taskId = metadata.taskId || metadata.callData?.id;
        
        if (!taskId) {
            logger.error('No taskId found in metadata:', JSON.stringify(metadata));
            return res.status(400).json({
                success: false,
                error: 'taskId is required and must come from Webex call data'
            });
        }

        logger.info(`Processing TS request for taskId: ${taskId}`);
        logger.debug(`Full metadata: ${JSON.stringify(metadata)}`);

        // Update database with the call metadata
        const dbResult = await updateAgentDatabase({metadata});

        logger.debug(`Database update result: ${JSON.stringify(dbResult)}`);
        if (!dbResult){
            return res.status(400).json({
            success: false,
            error: 'Database update Failed for taskid - '+ taskId
        });
        }

        // Send pause/resume commands to Webex
        var sendResponse = await sendPauseResume(taskId)
  
        
        if (!sendResponse) {
            logger.error(`Failed to send pause/resume for taskId: ${taskId}`);
            return res.status(500).json({
                success: false,
                error: 'Failed to send pause/resume command to Webex'
            });
        }

        logger.info(`Successfully sent pause /resume request for taskId: ${taskId}`);

        // Return success response
        return res.status(200).json({
            success: true,
            message: 'Call data processed successfully',
            taskId: taskId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        logger.error(`Error in pauseResume endpoint: ${error.message}`);
        logger.debug(error.stack);
        
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /telephonic-signature/api/status
 * Check the status of the widget/service
 */
router.get('/api/status', (req, res) => {
    res.status(200).json({
        success: true,
        service: 'Telephonic Signature Widget',
        status: 'running',
        endpoints: {
            pauseResume: 'POST /telephonic-signature/pauseResume',
            status: 'GET /telephonic-signature/api/status'
        }
    });
});

/**
 * GET /telephonic-signature/api/task/:taskId
 * Retrieve stored metadata for a specific task
 */
router.get('/api/task/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        
        logger.debug(`Retrieving task metadata for taskId: ${taskId}`);
        
        // Query database for this taskId
        const taskData = await getTaskMetadata(taskId);
        
        if (!taskData) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        return res.status(200).json({
            success: true,
            taskId: taskId,
            data: taskData
        });

    } catch (error) {
        logger.error(`Error retrieving task: ${error.message}`);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve task'
        });
    }
});

module.exports = router;