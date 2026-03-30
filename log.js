/**
 * AWS Lambda Powertools Logger
 * Replaces Winston logger for Lambda environment
 */
const { Logger } = require('@aws-lambda-powertools/logger');

// Create logger instance with service name
const logger = new Logger({
    serviceName: 'TSMiddleware',
    logLevel: process.env.LOG_LEVEL || 'INFO'
});

module.exports = logger;
