# AWS Lambda Migration Summary

## Overview
Successfully migrated TSMiddleware from an Express.js web server to AWS Lambda with API Gateway and DynamoDB.

## Migration Completed ✅

### 1. Logging System
- **Removed**: Winston logger with file rotation
- **Added**: AWS Lambda Powertools Logger (`@aws-lambda-powertools/logger`)
- **New file**: `log.js` - Lambda Powertools logger instance
- **Benefits**: 
  - Structured JSON logging
  - Automatic CloudWatch Logs integration
  - Lambda context injection
  - No file system dependencies

### 2. Database Layer
- **Removed**: SQLite + Sequelize ORM
- **Added**: AWS DynamoDB with AWS SDK v3
- **New files**: 
  - `public/javascripts/db/dynamodb.js` - DynamoDB client configuration
- **Updated files**:
  - `public/javascripts/db/agentsDb.js` - Now uses DynamoDB PutCommand, GetCommand, UpdateCommand
  - `public/javascripts/db/subscriptionDb.js` - Now uses DynamoDB PutCommand, ScanCommand
  - `public/javascripts/db/db.js` - Exports DynamoDB client instead of Sequelize
- **Tables**: 5 DynamoDB tables (Agents, Captures, Subscriptions, WxToken, CawsToken)

### 3. Web Server → Lambda Handler
- **Removed**: Express.js server with static file hosting, CORS, sessions, views
- **Added**: `lambda.js` - AWS Lambda handler with API Gateway integration
- **Original**: `server.js` (kept for reference but not used)
- **Architecture change**:
  - Express app with `app.listen()` → Lambda `handler()` function
  - HTTP server → API Gateway + Lambda proxy integration
  - Route middleware → Direct route handling in handler

### 4. Package Dependencies
**Removed**:
- `winston`, `winston-daily-rotate-file`
- `sequelize`, `sequelize-cli`, `sqlite3`
- `express` (core kept for route compatibility)
- `cors`, `cookie-parser`, `ejs`
- `react`, `react-dom`, `react-scripts` (client removed)
- `lucide-react` (client UI)

**Added**:
- `@aws-lambda-powertools/logger` (^2.0.0)
- `@aws-sdk/client-dynamodb` (^3.500.0)
- `@aws-sdk/lib-dynamodb` (^3.500.0)
- `serverless` (^3.38.0) - dev dependency
- `serverless-offline` (^13.3.0) - dev dependency

**Kept** (still needed):
- `@wxcc-desktop/sdk`, `@wxcc-desktop/sdk-types` - Webex integration
- `axios`, `axios-retry` - HTTP requests
- `body-parser`, `crypto` - Request parsing and security
- `dotenv` - Environment variables
- `ffmpeg`, `fluent-ffmpeg`, `form-data` - Media processing
- `toad-scheduler` - Task scheduling

### 5. Infrastructure as Code
**New file**: `serverless.yml`
- Complete CloudFormation infrastructure definition
- Lambda function configuration
- API Gateway HTTP API endpoints
- 5 DynamoDB tables with on-demand billing
- IAM roles and permissions
- Environment variable management

### 6. Web Hosting Removal
**Removed from server.js**:
- Express static file serving (`express.static`)
- React build hosting
- CORS middleware
- Widget CSS/JS bundle routes
- EJS view rendering
- Session management
- Cookie parsing
- Root "/" health page that served HTML

**Result**: Pure API-only Lambda function

### 7. Configuration & Documentation
**New files**:
- `README.md` - Complete migration documentation
- `DEPLOYMENT.md` - Step-by-step deployment guide
- `.env.example` - Environment variable template
- `MIGRATION.md` - This file

## Files Modified

### Core Application
- ✅ `lambda.js` - NEW: Main Lambda handler
- ✅ `log.js` - NEW: Lambda Powertools logger
- ✅ `package.json` - Updated dependencies
- ✅ `serverless.yml` - NEW: Infrastructure as Code

### Database Layer
- ✅ `public/javascripts/db/dynamodb.js` - NEW: DynamoDB client
- ✅ `public/javascripts/db/agentsDb.js` - Converted to DynamoDB
- ✅ `public/javascripts/db/subscriptionDb.js` - Converted to DynamoDB  
- ✅ `public/javascripts/db/db.js` - Updated to export DynamoDB client

### Routes (Kept for compatibility, integrated into Lambda)
- `routes/telephonic-signature.js` - Still used by Lambda
- `routes/webhookRoute.js` - Still used by Lambda
- `routes/tokenRoute.js` - Still used by Lambda

### API Services (Unchanged - still compatible)
- `public/javascripts/api/webex.js`
- `public/javascripts/api/caTokenService.js`
- `public/javascripts/api/wxccTokenService.js`
- `public/javascripts/api/processRecordings.js`

### Scheduler (Unchanged)
- `public/javascripts/scheduler/scheduler.js`

## Architecture Comparison

### Before (Express Server)
```
Internet → Load Balancer → EC2/Server
                            ├─ Express App (Port 8443)
                            ├─ Static Files (React App)
                            └─ SQLite DB (Local File)
```

### After (Serverless)
```
Internet → API Gateway → Lambda Function
                         ├─ Lambda Handler
                         └─ DynamoDB Tables (5)
                         
CloudWatch Logs ← Lambda (Auto)
```

## Benefits of Migration

1. **No Server Management**: No EC2 instances to maintain
2. **Auto-Scaling**: Handles traffic spikes automatically
3. **Cost Efficient**: Pay only for actual requests (no idle costs)
4. **High Availability**: Built-in redundancy across AZs
5. **Managed Logging**: Automatic CloudWatch integration
6. **Managed Database**: DynamoDB handles scaling, backups
7. **Version Control**: Infrastructure as Code in Git
8. **Faster Deployments**: `serverless deploy` in minutes

## Testing the Migration

### Local Testing
```bash
npm install
serverless offline
```

### Deploy to AWS
```bash
serverless deploy --stage dev
```

### Test Endpoints
```bash
# Health check
curl https://your-api-url.amazonaws.com/

# Status
curl https://your-api-url.amazonaws.com/telephonic-signature/api/status

# Webhook status
curl https://your-api-url.amazonaws.com/webhook/status
```

## Breaking Changes

1. **No Web UI**: The React client is no longer hosted by this service
   - **Solution**: Deploy React app separately (S3 + CloudFront, Netlify, Vercel)

2. **No View Rendering**: EJS templates not supported in Lambda
   - **Solution**: API-only design, all responses are JSON

3. **Database Schema Changes**: Data must be migrated from SQLite to DynamoDB
   - **Solution**: Create migration script to export SQLite → DynamoDB

4. **Environment Variables**: Different format for Lambda
   - **Solution**: All env vars defined in `serverless.yml` and `.env`

5. **File System Access**: Limited `/tmp` storage in Lambda (512 MB)
   - **Solution**: Use S3 for recording files instead of local `recordingMP3/recordingWav/`

## Next Steps

1. **Data Migration**: Export existing SQLite data to DynamoDB tables
2. **Client Deployment**: Deploy React frontend separately
3. **S3 Integration**: Store recordings in S3 instead of file system
4. **API Gateway Auth**: Add authentication (API keys, Cognito)
5. **Monitoring**: Set up CloudWatch alarms for errors/latency
6. **CI/CD**: Automate deployments with GitHub Actions or similar
7. **Custom Domain**: Configure Route53 + API Gateway custom domain
8. **Backup Strategy**: Enable DynamoDB point-in-time recovery

## Rollback Plan

If issues occur:
1. Keep original `server.js` and old package.json as backup
2. Can redeploy Express version on EC2/container if needed
3. SQLite backup should be preserved
4. `serverless remove` deletes all AWS resources cleanly

## Cost Estimate

Monthly costs for moderate usage (10,000 requests/day):

- **Lambda**: $0 (within 1M free tier)
- **API Gateway**: ~$10
- **DynamoDB**: ~$5-10 (on-demand)
- **CloudWatch Logs**: ~$2
- **Total**: ~$17-22/month

Compare to EC2: ~$15-50/month + management overhead

## Support & Troubleshooting

- See `README.md` for architecture details
- See `DEPLOYMENT.md` for deployment instructions
- Check CloudWatch Logs for runtime errors
- Use `serverless logs -f api --tail` for real-time logs

---

**Migration Completed**: All tasks finished successfully ✅
**Status**: Ready for deployment and testing
