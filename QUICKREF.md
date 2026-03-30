# TSMiddleware Lambda - Quick Reference

## Common Commands

### Deployment
```bash
# Deploy to dev
serverless deploy

# Deploy to production
serverless deploy --stage prod

# Deploy to specific region
serverless deploy --region us-west-2

# Deploy only function code (faster)
serverless deploy function -f api

# Deploy with verbose output
serverless deploy --verbose
```

### Local Development
```bash
# Install dependencies
npm install

# Run locally with serverless-offline
serverless offline

# Test locally
curl http://localhost:3000/telephonic-signature/api/status
```

### Monitoring & Logs
```bash
# Tail logs in real-time
serverless logs -f api --tail

# View recent logs
serverless logs -f api

# View logs from last hour
serverless logs -f api --startTime 1h

# View logs for specific stage
serverless logs -f api --stage prod --tail
```

### Information & Status
```bash
# Get service info (endpoints, ARNs, etc.)
serverless info

# Get function info
serverless info --verbose

# List all deployments
serverless deploy list

# Get CloudFormation stack outputs
aws cloudformation describe-stacks --stack-name tsmiddleware-lambda-dev
```

### Testing
```bash
# Invoke function locally
serverless invoke local -f api --path test-event.json

# Invoke deployed function
serverless invoke -f api --path test-event.json

# Test health endpoint
curl https://your-api-url.amazonaws.com/

# Test status endpoint
curl https://your-api-url.amazonaws.com/telephonic-signature/api/status

# Test with POST
curl -X POST https://your-api-url.amazonaws.com/telephonic-signature/pauseResume \
  -H "Content-Type: application/json" \
  -d '{"metadata": {"taskId": "test-123"}}'
```

### Data Migration
```bash
# Migrate data from SQLite to DynamoDB
node migrate-data.js

# Set table names if not using defaults
export AGENTS_TABLE_NAME=tsmiddleware-prod-Agents
export CAPTURES_TABLE_NAME=tsmiddleware-prod-Captures
node migrate-data.js
```

### Cleanup
```bash
# Remove all resources (WARNING: Deletes everything!)
serverless remove

# Remove specific stage
serverless remove --stage dev

# Check what will be removed
aws cloudformation describe-stack-resources --stack-name tsmiddleware-lambda-dev
```

### Rollback
```bash
# List previous deployments
serverless deploy list

# Rollback to previous version
serverless rollback

# Rollback to specific timestamp
serverless rollback --timestamp 2024-01-15T10:30:00
```

## Environment Variables

### Required Variables (in .env)
```bash
WXCLIENT_ID=your_webex_client_id
WXCLIENT_SECRET=your_webex_client_secret
WXCLIENT_ORGID=your_webex_org_id
CACLIENT_ID=your_ca_client_id
CACLIENT_SECRET=your_ca_client_secret
CACLIENT_SCOPE=your_ca_scope
CACASEURL=https://your-ca-case-url.com
CASTOREURL=https://your-ca-store-url.com
WXAUTH_URL=https://webexapis.com/v1/authorize
CAAUTH_URL=https://your-ca-auth-url.com
WEBHOOK_URL=https://your-api-gateway-url.amazonaws.com
```

### Auto-configured (by Serverless)
```bash
AGENTS_TABLE_NAME
CAPTURES_TABLE_NAME
SUBSCRIPTIONS_TABLE_NAME
WX_TOKEN_TABLE_NAME
CAWS_TOKEN_TABLE_NAME
AWS_REGION
```

## API Endpoints

### Health & Status
- `GET /` - Service information
- `GET /telephonic-signature/api/status` - Service status

### Telephonic Signature
- `POST /telephonic-signature/pauseResume` - Process pause/resume
- `GET /telephonic-signature/api/task/{taskId}` - Get task metadata

### Webhooks
- `POST /webhook/webhook` - Receive webhooks
- `GET /webhook/status` - Webhook status
- `GET /webhook/subscribe` - Subscribe to webhooks
- `GET /webhook/unsubscribe` - Unsubscribe from webhooks

## DynamoDB Tables

All tables use on-demand billing (pay-per-request).

### Agents Table
- **Key**: taskId (String)
- **Attributes**: program, appNumber, caseNumber, firstName, lastName, formId, formName, documentumid

### Captures Table
- **Key**: taskId (String)
- **Attributes**: filePath, recordingURL, startTime, endTime, participantANI, participantId

### Subscriptions Table
- **Key**: id (String)
- **Attributes**: name, description, createdBy, eventTypes, destinationUrl, status, createdTime

### WxToken Table
- **Key**: id (String)
- **Attributes**: token-related fields

### CawsToken Table
- **Key**: id (String)
- **Attributes**: token-related fields

## AWS Console Quick Links

```bash
# Lambda Functions
https://console.aws.amazon.com/lambda/home?region=us-west-1#/functions

# API Gateway
https://console.aws.amazon.com/apigateway/home?region=us-west-1

# DynamoDB Tables
https://console.aws.amazon.com/dynamodb/home?region=us-west-1

# CloudWatch Logs
https://console.aws.amazon.com/cloudwatch/home?region=us-west-1#logsV2:log-groups

# CloudFormation Stacks
https://console.aws.amazon.com/cloudformation/home?region=us-west-1
```

## Troubleshooting

### Function Timing Out
```yaml
# In serverless.yml
provider:
  timeout: 60  # Increase from 30 to 60 seconds
```

### Out of Memory
```yaml
# In serverless.yml
provider:
  memorySize: 1024  # Increase from 512 to 1024 MB
```

### Cold Start Issues
```yaml
# In serverless.yml - Add provisioned concurrency
functions:
  api:
    provisionedConcurrency: 1
```

### DynamoDB Throttling
```bash
# Check metrics in CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=tsmiddleware-dev-Agents \
  --start-time 2024-01-15T00:00:00Z \
  --end-time 2024-01-15T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### View Lambda Errors
```bash
# Filter for errors only
serverless logs -f api --filter ERROR

# Filter for specific term
serverless logs -f api --filter "taskId"
```

## Performance Tuning

### Optimize Cold Starts
1. Keep dependencies minimal
2. Increase memory (faster CPU)
3. Use Lambda layers for large dependencies
4. Enable provisioned concurrency

### Optimize DynamoDB
1. Use consistent key design
2. Avoid scans, use queries with indexes
3. Batch operations when possible
4. Enable caching with DAX if needed

### Optimize Costs
1. Use on-demand billing for variable traffic
2. Switch to provisioned for predictable traffic
3. Enable CloudWatch Logs retention (7-30 days)
4. Use X-Ray sampling, not 100% tracing

## Security Checklist

- [ ] API Gateway authentication enabled (API keys, Cognito, or IAM)
- [ ] Secrets in AWS Secrets Manager, not environment variables
- [ ] VPC configuration if accessing private resources
- [ ] Enable CloudTrail for audit logging
- [ ] Set up WAF rules for API Gateway
- [ ] Enable encryption at rest for DynamoDB
- [ ] Use least-privilege IAM roles
- [ ] Enable MFA for AWS console access

## Cost Monitoring

```bash
# View current month costs
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Set up billing alerts
aws cloudwatch put-metric-alarm \
  --alarm-name lambda-cost-alert \
  --alarm-description "Alert when Lambda costs exceed threshold" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --evaluation-periods 1 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

## Backup & Recovery

```bash
# Enable DynamoDB point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name tsmiddleware-dev-Agents \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true

# Create on-demand backup
aws dynamodb create-backup \
  --table-name tsmiddleware-dev-Agents \
  --backup-name manual-backup-$(date +%Y%m%d)

# List backups
aws dynamodb list-backups --table-name tsmiddleware-dev-Agents
```

## Useful Scripts

### Get API Gateway URL
```bash
aws cloudformation describe-stacks \
  --stack-name tsmiddleware-lambda-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' \
  --output text
```

### Get Table ARNs
```bash
aws dynamodb describe-table \
  --table-name tsmiddleware-dev-Agents \
  --query 'Table.TableArn' \
  --output text
```

### Count Items in Table
```bash
aws dynamodb scan \
  --table-name tsmiddleware-dev-Agents \
  --select COUNT \
  --query 'Count'
```

---

**Pro Tip**: Bookmark this page for quick reference during development and operations!
