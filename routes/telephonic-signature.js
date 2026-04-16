// ============================================
// FILE: routes/telephonic-signature.js
// ============================================

const express = require('express');
const router = express.Router();
var logger = require('../log.js');
const { createAgentRecord, countRecordsByTaskId, updateRecordTimestamp } = require('../public/javascripts/db/agentsDb');
const { sendPauseResume } = require('../public/javascripts/api/webex');

// Serve the telephonic signature widget page
router.get('/', (req, res) => {
    res.render('telephonic-signature', {
        pageTitle: 'Telephonic Signature'
    });
});

/**
 * POST /telephonic-signature/pauseResume
 *
 * Each call to this endpoint represents one pause/resume pair.
 * A new DB record is created for each invocation so that multiple
 * pairs within the same call each carry their own form metadata.
 */
router.post('/pauseResume', async (req, res) => {
    try {
        const { metadata } = req.body;

        if (!metadata) {
            logger.error('Missing metadata in request body');
            return res.status(400).json({ success: false, error: 'Missing required metadata' });
        }

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

        // Determine which pair this is within the call (0-based)
        const pairIndex = await countRecordsByTaskId(taskId);
        logger.debug(`pairIndex for taskId ${taskId}: ${pairIndex}`);

        // Create record with current local time as a fallback
        const recordId = await createAgentRecord({ ...metadata, taskId, pauseSentAtMs: Date.now() }, pairIndex);

        if (!recordId) {
            return res.status(500).json({
                success: false,
                error: 'Failed to save record for taskId - ' + taskId
            });
        }

        // Send pause/resume commands to Webex
        const sendResponse = await sendPauseResume(taskId);

        if (!sendResponse) {
            logger.error(`Failed to send pause/resume for taskId: ${taskId}`);
            return res.status(500).json({
                success: false,
                error: 'Failed to send pause/resume command to Webex'
            });
        }

        // Update the record with the actual Cisco server timestamp for perfect matching
        await updateRecordTimestamp(taskId, recordId, sendResponse.timestamp);

        logger.info(`Successfully sent pause/resume for taskId: ${taskId} pairIndex: ${pairIndex}`);

        return res.status(200).json({
            success: true,
            message: 'Call data processed successfully',
            taskId,
            recordId,
            pairIndex
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

module.exports = router;
