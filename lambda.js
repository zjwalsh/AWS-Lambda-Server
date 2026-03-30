/**
 * AWS Lambda Handler for TSMiddleware
 * Replaces Express server with Lambda + API Gateway integration
 */
const { Logger } = require('@aws-lambda-powertools/logger');
const { injectLambdaContext } = require('@aws-lambda-powertools/logger');

const logger = new Logger({ serviceName: 'TSMiddleware' });

// Import route handlers
const webhookRouter = require('./routes/webhookRoute.js');
const tokenRouter = require('./routes/tokenRoute.js');
const tsRouter = require('./routes/telephonic-signature.js');

// Environment variables (same as before)
global.WXCLIENT_ID = process.env.WXCLIENT_ID || process.env.wxcc_wxclient_id || null;
global.WXCLIENT_SECRET = process.env.WXCLIENT_SECRET || process.env.xcc_wxclient_secret || null;
global.WXCLIENT_ORGID = process.env.WXCLIENT_ORGID || process.env.wxcc_orgid || null;
global.CACLIENT_ID = process.env.CACLIENT_ID || process.env.calsaws_client_id || null;
global.CACLIENT_SECRET = process.env.CACLIENT_SECRET || process.env.calsaws_client_secret || null;
global.CACLIENT_SCOPE = process.env.CACLIENT_SCOPE || process.env.calsaws_client_scope || null;
global.CACASEURL = process.env.CACASEURL || process.env.cacaseurl || null;
global.CASTOREURL = process.env.CASTOREURL || process.env.castoreurl || null;
global.LOG_LEVEL = process.env.LOG_LEVEL || process.env.log_level || "INFO";
global.WEBHOOK_PATH = "/webhook/webhook";
global.WEBHOOK_URL = process.env.WEBHOOK_URL || process.env.webhook_url || null;
global.WXAUTH_URL = process.env.WXAUTH_URL || process.env.wxauth_url;
global.CAAUTH_URL = process.env.CAAUTH_URL || process.env.caauth_url;
global.WXCC_WEBHOOK_SECRET = process.env.WXCC_WEBHOOK_SECRET || process.env.wxcc_webhook_secret || null;
global.WXCC_REFRESH_TOKEN = process.env.WXCC_REFRESH_TOKEN || process.env.wxcc_refresh_token || null;
global.SUBSCRIPTION_ID = null;
global.IDLE_TIMER = process.env.IDLE_TIMER || process.env.idle_timer || 0;

if (WEBHOOK_URL) WEBHOOK_URL = WEBHOOK_URL + WEBHOOK_PATH;

// Initialize startup tasks once on cold start (tokens & subscription)
const { initializeOnStartup } = require('./public/javascripts/scheduler/startup.js');
let startupInitialized = false;

const initStartup = async () => {
    if (!startupInitialized) {
        try {
            await initializeOnStartup();
            startupInitialized = true;
            logger.info('Startup initialization completed');
        } catch (error) {
            logger.error('Failed to initialize on startup', { error: error.message });
        }
    }
};

// Validate required configuration
const validateConfig = () => {
    const requiredVars = {
        WXCLIENT_ID: 'WXCLIENT_ID',
        WXCLIENT_ORGID: 'WXCLIENT_ORGID',
        WXCLIENT_SECRET: 'WXCLIENT_SECRET',
        CACLIENT_ID: 'CACLIENT_ID',
        CACLIENT_SECRET: 'CACLIENT_SECRET',
        CACLIENT_SCOPE: 'CACLIENT_SCOPE',
        CACASEURL: 'CACASEURL',
        CASTOREURL: 'CASTOREURL'
    };

    for (const [key, envName] of Object.entries(requiredVars)) {
        if (!global[key]) {
            throw new Error(`${envName} not defined in environment. Cannot run.`);
        }
    }
};

/**
 * Main Lambda handler
 */
exports.handler = async (event, context) => {
    // Add Lambda context to all logs
    logger.addContext(context);

    logger.info('Lambda invoked', {
        path: event.path,
        httpMethod: event.httpMethod,
        requestId: context.requestId
    });

    try {
        // Validate configuration on first invocation
        validateConfig();

        // Initialize startup tasks on cold start (tokens & subscription)
        await initStartup();        // Parse path and method
        const path = event.path || event.rawPath || '/';
        const method = event.httpMethod || event.requestContext?.http?.method || 'GET';
        const body = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf-8') : event.body) : null;
        const parsedBody = body ? JSON.parse(body) : {};

        // Create Express-like request object for compatibility
        const req = {
            path,
            method,
            body: parsedBody,
            rawBody: body,
            headers: event.headers || {},
            query: event.queryStringParameters || {},
            params: event.pathParameters || {},
            get: (header) => (event.headers || {})[header.toLowerCase()]
        };

        // Create Express-like response object
        let response = {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization'
            },
            body: ''
        };

        const res = {
            status: (code) => {
                response.statusCode = code;
                return res;
            },
            json: (data) => {
                response.body = JSON.stringify(data);
                return res;
            },
            send: (data) => {
                response.body = typeof data === 'string' ? data : JSON.stringify(data);
                return res;
            },
            sendStatus: (code) => {
                response.statusCode = code;
                response.body = '';
                return res;
            },
            setHeader: (key, value) => {
                response.headers[key] = value;
                return res;
            },
            render: (view, data) => {
                // Lambda doesn't render views - return error
                response.statusCode = 501;
                response.body = JSON.stringify({ error: 'View rendering not supported in Lambda' });
                return res;
            }
        };

        // Route handling
        if (method === 'OPTIONS') {
            // Handle preflight
            return response;
        }

        // Root endpoint
        if (path === '/') {
            return {
                ...response,
                body: JSON.stringify({
                    name: 'TSForms Lambda API',
                    status: 'running',
                    endpoints: {
                        health: 'GET /telephonic-signature/api/status',
                        pauseResume: 'POST /telephonic-signature/pauseResume',
                        webhook: 'POST /webhook/webhook',
                        status: 'GET /webhook/status'
                    }
                })
            };
        }

        // Route to appropriate handler based on path
        if (path.startsWith('/webhook')) {
            await routeWebhook(req, res, path, method);
        } else if (path.startsWith('/token')) {
            await routeToken(req, res, path, method);
        } else if (path.startsWith('/telephonic-signature')) {
            await routeTelephonicSignature(req, res, path, method);
        } else {
            response.statusCode = 404;
            response.body = JSON.stringify({ error: 'Not Found' });
        }

        return response;

    } catch (error) {
        logger.error('Lambda handler error', { error: error.message, stack: error.stack });

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                error: 'Internal Server Error',
                message: error.message
            })
        };
    }
};

/**
 * Route webhook requests
 */
async function routeWebhook(req, res, path, method) {
    const { subscribe, unsubscribe, getStatus } = require('./public/javascripts/api/webex.js');
    const { findSubscription, updateSubDatabase } = require('./public/javascripts/db/subscriptionDb.js');
    const { proccessRecording } = require('./public/javascripts/api/processRecordings.js');
    const crypto = require('crypto');

    if (path === '/webhook/webhook' && method === 'POST') {
        const body = req.body;
        const orgId = body.comciscoorgid;
        const subscriptionId = req.body.source?.slice(req.body.source.lastIndexOf("/") + 1);

        let payload = req.body;
        logger.debug('Received webhook payload', { payload });

        if (payload.type != "capture:available") {
            logger.warn('Webhook received with no recording available. Discarding.');
            res.sendStatus(200);
            return;
        }

        await proccessRecording(payload);
        res.sendStatus(200);

    } else if (path === '/webhook/status' && method === 'GET') {
        const status = await getStatus();
        res.json(status);

    } else if (path === '/webhook/subscribe' && method === 'GET') {
        logger.info('Creating Subscription');
        let subscriptions = await findSubscription();
        if (subscriptions) {
            global.SUBSCRIPTION_ID = subscriptions;
        }

        if (global.SUBSCRIPTION_ID != null) {
            logger.warn('Already subscribed');
            res.status(400).send({ "error": "subscription already exists" });
            return;
        }

        const response = await subscribe();
        if (response && response !== false) {
            await updateSubDatabase(response);
            res.json({ "status": "subscribed", "subscriptionId": global.SUBSCRIPTION_ID });
        } else {
            res.json({ "status": "unsubscribed", "error": "subscribe failed" });
        }

    } else if (path === '/webhook/unsubscribe' && method === 'GET') {
        logger.info('Removing Subscription');
        if (global.SUBSCRIPTION_ID == null) {
            logger.warn('Already unsubscribed');
            res.status(400).send({ "error": "no subscription present" });
            return;
        }

        const response = await unsubscribe();
        if (response) {
            res.json({ "status": "unsubscribed" });
        } else {
            res.json({ "status": "subscribed", "error": "unsubscribe failed" });
        }
    } else {
        res.status(404).json({ error: 'Not Found' });
    }
}

/**
 * Route token requests
 */
async function routeToken(req, res, path, method) {
    // Token route is currently empty in the original
    res.status(404).json({ error: 'Not Found' });
}

/**
 * Route telephonic signature requests
 */
async function routeTelephonicSignature(req, res, path, method) {
    const { updateAgentDatabase } = require('./public/javascripts/db/agentsDb');
    const { sendPauseResume } = require('./public/javascripts/api/webex');

    if (path === '/telephonic-signature/pauseResume' && method === 'POST') {
        const { metadata } = req.body;

        if (!metadata) {
            logger.error('Missing metadata in request body');
            res.status(400).json({
                success: false,
                error: 'Missing required metadata'
            });
            return;
        }

        const taskId = metadata.taskId || metadata.callData?.id;

        if (!taskId) {
            logger.error('No taskId found in metadata', { metadata });
            res.status(400).json({
                success: false,
                error: 'taskId is required'
            });
            return;
        }

        logger.info(`Processing TS request for taskId: ${taskId}`);

        const dbResult = await updateAgentDatabase({ metadata });

        if (!dbResult) {
            res.status(400).json({
                success: false,
                error: 'Database update Failed for taskid - ' + taskId
            });
            return;
        }

        const sendResponse = await sendPauseResume(taskId);

        if (!sendResponse) {
            logger.error(`Failed to send pause/resume for taskId: ${taskId}`);
            res.status(500).json({
                success: false,
                error: 'Failed to send pause/resume command to Webex'
            });
            return;
        }

        logger.info(`Successfully sent pause/resume request for taskId: ${taskId}`);

        res.status(200).json({
            success: true,
            message: 'Call data processed successfully',
            taskId: taskId,
            timestamp: new Date().toISOString()
        });

    } else if (path === '/telephonic-signature/api/status' && method === 'GET') {
        res.status(200).json({
            success: true,
            service: 'Telephonic Signature Lambda',
            status: 'running',
            endpoints: {
                pauseResume: 'POST /telephonic-signature/pauseResume',
                status: 'GET /telephonic-signature/api/status'
            }
        });

    } else if (path.startsWith('/telephonic-signature/api/task/') && method === 'GET') {
        const taskId = path.split('/').pop();
        const { getMetadata } = require('./public/javascripts/db/agentsDb');

        logger.debug(`Retrieving task metadata for taskId: ${taskId}`);

        const taskData = await getMetadata(taskId);

        if (!taskData) {
            res.status(404).json({
                success: false,
                error: 'Task not found'
            });
            return;
        }

        res.status(200).json({
            success: true,
            taskId: taskId,
            data: taskData
        });

    } else {
        res.status(404).json({ error: 'Not Found' });
    }
}
