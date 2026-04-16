# TSMiddleware Lambda - Deployment Guide

## Quick Start

### 1. Prerequisites Check
```bash
# Check Node.js version (v4 supports Node 22.x)
node --version

# Authenticate with AWS SSO
aws sso login --profile lac-customer

# Install Serverless Framework v4 globally
npm install -g serverless@latest
```

### 2. Install Dependencies
```bash
cd server
npm install
```

### 3. Configure Environment
```bash
# Copy example environment file
cp .env.example .env

# Edit with your actual values
# Required: All WXCLIENT_*, CACLIENT_*, and URL variables
nano .env
```

### 4. Deploy to AWS
```bash
# Deploy to dev environment (default)
serverless deploy

# Or deploy to production
serverless deploy --stage prod --region us-west-1
```

### 5. Get Your API URL
After deployment, note the API Gateway URL from the output:
```
Service Information
service: tsmiddleware-lambda
stage: dev
region: us-west-1
api keys:
  None
endpoints:
  GET - https://xxxxxxxxxx.execute-api.us-west-1.amazonaws.com/
  ...
```

### 6. Update Webhook URL
Update your `.env` file with the deployed API URL:
```bash
WEBHOOK_URL=https://xxxxxxxxxx.execute-api.us-west-1.amazonaws.com
```

Redeploy to apply the change:
```bash
serverless deploy
```

### 7. Test Your Deployment
```bash
# Test health endpoint
curl https://xxxxxxxxxx.execute-api.us-west-1.amazonaws.com/

# Test status endpoint
curl https://xxxxxxxxxx.execute-api.us-west-1.amazonaws.com/telephonic-signature/api/status
```

## Deployment Checklist

- [ ] AWS CLI configured with proper credentials
- [ ] Node.js 22.x installed
- [ ] All environment variables set in `.env`
- [ ] Dependencies installed (`npm install`)
- [ ] Serverless Framework installed globally
- [ ] AWS account has necessary IAM permissions
- [ ] Deployed with `serverless deploy`
- [ ] API Gateway URL obtained
- [ ] Webhook URL updated and redeployed
- [ ] Endpoints tested successfully

## IAM Permissions Required

Your AWS user/role needs these permissions:
- `lambda:*` - Create and manage Lambda functions
- `apigateway:*` - Create and manage API Gateway
- `dynamodb:*` - Create and manage DynamoDB tables
- `iam:*` - Create IAM roles for Lambda
- `cloudformation:*` - Deploy CloudFormation stacks
- `logs:*` - Create CloudWatch log groups
- `s3:*` - Upload deployment artifacts (Serverless creates a bucket)

## Environment-Specific Deployments

### Development
```bash
serverless deploy --stage dev
```

### Staging
```bash
serverless deploy --stage staging
```

### Production
```bash
serverless deploy --stage prod
```

Each stage creates separate resources with stage name in the resource names.

## Monitoring After Deployment

### View Logs
```bash
# Real-time logs
serverless logs -f api --tail

# Recent logs
serverless logs -f api --startTime 1h
```

### Check Function Status
```bash
serverless info
```

### Invoke Function Directly (Testing)
```bash
# Create a test event file (test-event.json)
cat > test-event.json << EOF
{
  "path": "/telephonic-signature/api/status",
  "httpMethod": "GET",
  "headers": {},
  "queryStringParameters": null
}
EOF

# Invoke the function
serverless invoke -f api --path test-event.json
```

## Updating After Changes

After making code changes:
```bash
# Quick deploy (faster, only updates function code)
serverless deploy function -f api

# Full deploy (updates all infrastructure)
serverless deploy
```

## Rolling Back

If something goes wrong:
```bash
# List deployments
serverless deploy list

# Rollback to previous deployment
serverless rollback --timestamp <timestamp>
```

## Cost Estimation

Typical monthly costs for moderate usage:
- **Lambda**: $0 (likely within free tier: 1M requests/month)
- **API Gateway**: ~$3.50 per million requests
- **DynamoDB**: Pay-per-request, typically $0-10/month for low-medium traffic
- **CloudWatch Logs**: ~$0.50/GB ingested

**Total estimated cost**: $5-15/month for moderate usage

## Troubleshooting

### Deployment Fails
```bash
# Check for SAM Conflicts
# Serverless v4 may crash if template.yaml or samconfig.toml exist.
# Delete or rename these files if you encounter "Received null" path errors.
rm template.yaml, samconfig.toml

# Check CloudFormation stack events
aws cloudformation describe-stack-events --stack-name tsmiddleware-lambda-dev

# Check for existing stacks
aws cloudformation list-stacks --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE
```

### Function Times Out
Increase timeout in `serverless.yml`:
```yaml
provider:
  timeout: 60  # seconds (default is 30)
```

### Out of Memory
Increase memory in `serverless.yml`:
```yaml
provider:
  memorySize: 1024  # MB (default is 512)
```

### DynamoDB Access Denied
Check IAM role has DynamoDB permissions in `serverless.yml` under `provider.iam.role.statements`

### Cold Start Issues
Consider:
- Using provisioned concurrency (costs extra)
- Increasing memory (faster CPU)
- Keeping functions warm with scheduled events

## Cleanup

To completely remove all resources:
```bash
# Remove dev environment
serverless remove --stage dev

# Remove prod environment  
serverless remove --stage prod
```

**Warning**: This deletes all DynamoDB tables and data!

## Security Best Practices

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use AWS Secrets Manager** for sensitive values in production
3. **Enable API Gateway authentication** (API keys, Cognito, IAM)
4. **Set up VPC** if accessing private resources
5. **Enable CloudTrail** for audit logging
6. **Use WAF** for API Gateway protection

## Next Steps

1. Set up CI/CD pipeline (GitHub Actions, GitLab CI, etc.)
2. Configure custom domain name for API Gateway
3. Add monitoring and alerting (CloudWatch Alarms)
4. Set up automated backups for DynamoDB
5. Implement API versioning
6. Add request throttling and quotas

## Support

For questions or issues:
1. Check CloudWatch Logs for error details
2. Review AWS CloudFormation stack events
3. Contact your AWS administrator for IAM/permission issues
4. Refer to the main README.md for architecture details
