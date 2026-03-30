# TSMiddleware - AWS Lambda Migration

This application has been migrated from an Express.js server to AWS Lambda with API Gateway and DynamoDB.

## Major Changes

### 1. **Removed Web Hosting Code**
- Removed Express static file serving
- Removed CORS middleware (now handled by API Gateway)
- Removed React client hosting
- Removed EJS view rendering

### 2. **Logging Migration**
- **Old**: Winston logger with file rotation
- **New**: AWS Lambda Powertools Logger
- Logs are now sent to CloudWatch Logs automatically
- Structured logging with Lambda context

### 3. **Database Migration**
- **Old**: SQLite with Sequelize ORM
- **New**: AWS DynamoDB with AWS SDK v3
- Tables created via serverless.yml CloudFormation
- No more local database files

### 4. **Architecture**
- **Old**: Express.js server on port 8443
- **New**: Lambda function behind API Gateway
- Serverless, auto-scaling architecture
- Pay-per-request pricing

## File Structure

```
├── lambda.js                           # Main Lambda handler (replaces server.js)
├── log.js                              # Lambda Powertools logger
├── serverless.yml                      # Infrastructure as Code
├── package.json                        # Updated dependencies
├── routes/
│   ├── telephonic-signature.js        # API routes
│   ├── webhookRoute.js                # Webhook handlers
│   └── tokenRoute.js                  # Token routes
├── public/javascripts/
│   ├── db/
│   │   ├── dynamodb.js                # DynamoDB client config
│   │   ├── agentsDb.js                # Agents table operations
│   │   ├── subscriptionDb.js          # Subscriptions table operations
│   │   └── db.js                      # Database exports
│   ├── api/                           # API service functions
│   └── scheduler/                     # Scheduler module
└── models/                            # (Legacy - replaced by DynamoDB)
```

## Prerequisites

1. **AWS CLI** configured with appropriate credentials
2. **Node.js** 18.x or later
3. **Serverless Framework** (installed via npm)
4. **AWS Account** with permissions to create:
   - Lambda functions
   - API Gateway
   - DynamoDB tables
   - IAM roles
   - CloudWatch Logs

## Installation

```bash
# Install dependencies
npm install

# Install Serverless Framework globally (if not already installed)
npm install -g serverless
```

## Configuration

Create a `.env` file with your environment variables:

```bash
# Copy the example
cp .env.example .env

# Edit with your values
nano .env
```

Required environment variables:
- `WXCLIENT_ID` - Webex Client ID
- `WXCLIENT_SECRET` - Webex Client Secret
- `WXCLIENT_ORGID` - Webex Organization ID
- `CACLIENT_ID` - CA Client ID
- `CACLIENT_SECRET` - CA Client Secret
- `CACLIENT_SCOPE` - CA Client Scope
- `CACASEURL` - CA Case URL
- `CASTOREURL` - CA Store URL
- `WXAUTH_URL` - Webex Auth URL
- `CAAUTH_URL` - CA Auth URL
- `WEBHOOK_URL` - Webhook callback URL
- `WXCC_WEBHOOK_SECRET` - Webex Webhook Secret
- `WXCC_REFRESH_TOKEN` - Webex Refresh Token

## Deployment

### Deploy to AWS

```bash
# Deploy to dev stage (default)
serverless deploy

# Deploy to production
serverless deploy --stage prod

# Deploy to specific region
serverless deploy --region us-west-2
```

After deployment, you'll receive:
- **API Gateway URL**: The base URL for your API
- **DynamoDB Table Names**: Names of created tables

### Local Testing (Optional)

```bash
# Start serverless-offline for local testing
serverless offline
```

## DynamoDB Tables

The following tables are created automatically:

1. **Agents Table**
   - Primary Key: `taskId` (String)
   - Stores agent metadata

2. **Captures Table**
   - Primary Key: `taskId` (String)
   - Stores recording captures

3. **Subscriptions Table**
   - Primary Key: `id` (String)
   - Stores webhook subscriptions

4. **WxToken Table**
   - Primary Key: `id` (String)
   - Stores Webex tokens

5. **CawsToken Table**
   - Primary Key: `id` (String)
   - Stores CA tokens

All tables use **Pay-Per-Request** billing mode for cost optimization.

## API Endpoints

### Root
- `GET /` - Health check and service info

### Webhook
- `POST /webhook/webhook` - Receive webhooks
- `GET /webhook/status` - Get webhook status
- `GET /webhook/subscribe` - Subscribe to webhooks
- `GET /webhook/unsubscribe` - Unsubscribe from webhooks

### Telephonic Signature
- `POST /telephonic-signature/pauseResume` - Process pause/resume requests
- `GET /telephonic-signature/api/status` - Service status
- `GET /telephonic-signature/api/task/{taskId}` - Get task metadata

## Logging

Logs are automatically sent to **CloudWatch Logs**. View them:

```bash
# View recent logs
serverless logs -f api

# Tail logs in real-time
serverless logs -f api --tail

# View logs for specific stage
serverless logs -f api --stage prod
```

## Monitoring

Monitor your Lambda function in the AWS Console:
- **CloudWatch Metrics**: Invocations, errors, duration
- **CloudWatch Logs**: Application logs with structured data
- **X-Ray**: Distributed tracing (can be enabled)

## Cost Optimization

This serverless architecture provides:
- **No idle costs**: Pay only when functions execute
- **Auto-scaling**: Handles traffic spikes automatically
- **DynamoDB on-demand**: Pay per request, no provisioning

## Cleanup

To remove all AWS resources:

```bash
serverless remove

# Remove specific stage
serverless remove --stage prod
```

## Migration Notes

### Removed Dependencies
- `winston`, `winston-daily-rotate-file` → AWS Lambda Powertools Logger
- `sequelize`, `sequelize-cli`, `sqlite3` → AWS SDK DynamoDB
- `express` (static/session), `cors`, `cookie-parser`, `ejs` → API Gateway handles routing

### Added Dependencies
- `@aws-lambda-powertools/logger` - Structured logging for Lambda
- `@aws-sdk/client-dynamodb` - DynamoDB client
- `@aws-sdk/lib-dynamodb` - Simplified DynamoDB operations

### Breaking Changes
1. No more web page hosting - API only
2. Database moved from local SQLite to DynamoDB
3. Logs now in CloudWatch instead of local files
4. No more Express middleware (CORS, sessions, etc.)

## Troubleshooting

### Lambda Timeout
If functions timeout, increase in `serverless.yml`:
```yaml
provider:
  timeout: 60  # seconds
```

### Memory Issues
Increase memory allocation:
```yaml
provider:
  memorySize: 1024  # MB
```

### DynamoDB Throttling
If you experience throttling, consider:
- Adding GSIs for query patterns
- Switching to provisioned capacity for predictable workloads

## Support

For issues or questions, contact the development team.
