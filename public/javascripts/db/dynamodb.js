/**
 * DynamoDB client configuration
 * Replaces Sequelize/SQLite with AWS DynamoDB
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

// Create DynamoDB client
const client = new DynamoDBClient({
    region: process.env.AWS_REGION || 'us-west-1'
});

// Create Document client with simplified data marshalling
const dynamoDb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false
    }
});

// Table names from environment variables
const TABLES = {
    AGENTS: process.env.AGENTS_TABLE_NAME || 'TSMiddleware-Agents',
    CAPTURES: process.env.CAPTURES_TABLE_NAME || 'TSMiddleware-Captures',
    SUBSCRIPTIONS: process.env.SUBSCRIPTIONS_TABLE_NAME || 'TSMiddleware-Subscriptions',
    WX_TOKEN: process.env.WX_TOKEN_TABLE_NAME || 'TSMiddleware-WxToken',
    CAWS_TOKEN: process.env.CAWS_TOKEN_TABLE_NAME || 'TSMiddleware-CawsToken'
};

module.exports = {
    dynamoDb,
    TABLES
};
