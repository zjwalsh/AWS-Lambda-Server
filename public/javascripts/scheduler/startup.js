/**
 * Startup initialization for Lambda environment
 * Handles token initialization and subscription setup on cold start
 */

var logger = require('../../../log.js');

/**
 * Initialize tokens and subscriptions on Lambda cold start
 */
async function initializeOnStartup() {
    try {
        logger.info('Starting Lambda initialization...');

        // Initialize tokens if needed
        await initializeTokens();

        // Initialize subscription if needed  
        await initializeSubscription();

        logger.info('Lambda initialization completed successfully');

    } catch (error) {
        logger.error('Failed to initialize on startup', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Initialize authentication tokens
 */
async function initializeTokens() {
    try {
        logger.info('Initializing authentication tokens...');

        const { getWXRefreshToken, wxDeleteAll, getWXToken } = require('../api/wxccTokenService.js');
        const { getCAAuthToken, caDeleteAll } = require('../api/caTokenService.js');

        // Check and refresh WX token if needed
        const wxTokenResult = await getWXToken();
        if (wxTokenResult && wxTokenResult.length > 0) {
            const tokenData = wxTokenResult[0];
            logger.info('WXCC Access Token found on startup', {
                tokenExists: !!tokenData.access_token
            });

            if (tokenData.access_token != null) {
                const addDate = new Date(tokenData.updatedAt).getTime();
                const refreshDate = tokenData.refresh_token_expires_in * 1000; // API returns seconds, convert to ms
                const dateNow = new Date().getTime();

                if ((addDate + refreshDate) < dateNow) {
                    logger.info('WX Token expired, refreshing...');
                    await wxDeleteAll();
                    await getWXRefreshToken();
                    logger.info('WX Token refreshed successfully');
                } else {
                    logger.info('WX Token still valid');
                }
            } else {
                // Record exists but has no access_token (e.g. from a previous failed write)
                logger.info('WX Token record incomplete, deleting and fetching new token...');
                await wxDeleteAll();
                await getWXRefreshToken();
            }
        } else {
            logger.info('No WX Token found, getting new token...');
            await getWXRefreshToken();
        }

        // Always refresh CA token on startup
        logger.info('Refreshing CA Token...');
        await caDeleteAll();
        await getCAAuthToken();
        logger.info('CA Token initialized successfully');

    } catch (error) {
        logger.error('Token initialization failed', { error: error.message });
        throw error;
    }
}

/**
 * Initialize webhook subscription
 */
async function initializeSubscription() {
    try {
        // Check existing subscription status
        logger.debug('Checking subscription status...');

        const { findSubscription, updateSubDatabase } = require('../db/subscriptionDb.js');
        const { subscribe } = require('../api/webex.js');

        // Try to find existing subscription
        let existingSubscriptionId = await findSubscription();
        if (existingSubscriptionId) {
            global.SUBSCRIPTION_ID = existingSubscriptionId;
            logger.info('Found existing subscription', { subscriptionId: global.SUBSCRIPTION_ID });
        } else {
            logger.info('No existing subscription found, creating new one...');
            const response = await subscribe();
            if (response && response !== false) {
                // Store subscription in database
                const dbResult = await updateSubDatabase(response);
                if (dbResult) {
                    global.SUBSCRIPTION_ID = response.data.data.id;
                    logger.info('Successfully created and stored new subscription', {
                        subscriptionId: global.SUBSCRIPTION_ID
                    });
                } else {
                    logger.error('Failed to store subscription in database');
                }
            } else {
                logger.error('Failed to create subscription via WebEx API');
            }
        }

    } catch (error) {
        logger.error('Subscription initialization failed', { error: error.message });
        // Don't throw here - subscription can be created later
        logger.warn('Continuing without subscription - will be created on first webhook request');
    }
}

module.exports = {
    initializeOnStartup,
    initializeTokens,
    initializeSubscription
};