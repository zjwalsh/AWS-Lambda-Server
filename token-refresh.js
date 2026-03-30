/**
 * Token Refresh Lambda Function
 * Triggered by EventBridge every 15 minutes to refresh WX and CA tokens
 * Replaces toad-scheduler periodic tasks
 */
const { Logger } = require('@aws-lambda-powertools/logger');
const logger = new Logger({ serviceName: 'TSMiddleware-TokenRefresh' });

const { getWXRefreshToken, wxDeleteAll, getWXToken } = require('./public/javascripts/api/wxccTokenService.js');
const { getCAAuthToken, caDeleteAll } = require('./public/javascripts/api/caTokenService.js');

/**
 * Main Lambda handler for token refresh
 * Called by EventBridge on a schedule (every 15 minutes)
 */
exports.handler = async (event, context) => {
    logger.addContext(context);
    logger.info('Token refresh Lambda triggered', {
        scheduleTime: event.time,
        resources: event.resources
    });

    try {
        // Refresh WX Token
        logger.info('Checking WX Token...');
        const wxToken = await getWXToken();

        if (wxToken && wxToken.length > 0) {
            const tokenData = wxToken[0].dataValues || wxToken[0];
            logger.info('WX Access Token exists', { tokenExists: !!tokenData.access_token });

            if (tokenData.access_token != null) {
                const addDate = new Date(tokenData.createdAt).getTime();
                const refreshDate = tokenData.refresh_token_expires_in;
                const dateNow = new Date().getTime();

                // Check if token needs refresh
                if ((addDate + refreshDate) < dateNow) {
                    logger.info('WX Token expired, refreshing...');
                    await wxDeleteAll();
                    await getWXRefreshToken();
                    logger.info('WX Token refreshed successfully');
                } else {
                    logger.info('WX Token still valid, no refresh needed');
                }
            }
        } else {
            logger.warn('No WX Token found, getting new token...');
            await getWXRefreshToken();
        }

        // Refresh CA Token
        logger.info('Refreshing CA Token...');
        await caDeleteAll();
        await getCAAuthToken();
        logger.info('CA Token refreshed successfully');

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Token refresh completed successfully',
                timestamp: new Date().toISOString()
            })
        };

    } catch (error) {
        logger.error('Token refresh failed', {
            error: error.message,
            stack: error.stack
        });

        // Don't throw - return error response so EventBridge doesn't retry excessively
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Token refresh failed',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};
