# Scheduler Migration: ToadScheduler → EventBridge

## What Changed

### Before (ToadScheduler)
- Used in-process `toad-scheduler` library
- Ran continuously inside Lambda container
- Inefficient for serverless (keeps Lambda warm)
- Scheduled tasks:
  - WX Token refresh every 15 minutes
  - CA Token refresh every 15 minutes

### After (EventBridge)
- **Separate Lambda function** (`token-refresh.js`) for scheduled tasks
- **EventBridge rule** triggers the function every 15 minutes
- More cost-effective (only runs when needed)
- Better separation of concerns

## Architecture

```
┌─────────────────┐      Every 15 min      ┌──────────────────┐
│  EventBridge    │ ──────────────────────> │  tokenRefresh    │
│  Schedule Rule  │                         │  Lambda Function │
└─────────────────┘                         └──────────────────┘
                                                     │
                                                     ▼
                                            ┌────────────────┐
                                            │  DynamoDB      │
                                            │  Token Tables  │
                                            └────────────────┘

┌─────────────────┐       On cold start    ┌──────────────────┐
│  API Lambda     │ ──────────────────────> │  startup.js      │
│  (lambda.js)    │    Initialize once      │  Tokens + Sub    │
└─────────────────┘                         └──────────────────┘
```

## New Files

### 1. `token-refresh.js`
**Purpose**: Lambda function triggered by EventBridge  
**Schedule**: Every 15 minutes  
**Tasks**:
- Check and refresh WX token if expired
- Refresh CA token
- Logs to CloudWatch

### 2. `public/javascripts/scheduler/startup.js`
**Purpose**: One-time initialization on Lambda cold start  
**Tasks**:
- Initialize WX token
- Initialize CA token
- Check/create Webex subscription
- Runs only once per Lambda container lifecycle

## Updated Files

### 1. `lambda.js`
- Removed `toad-scheduler` import
- Now calls `initializeOnStartup()` on cold start
- No more in-process scheduling

### 2. `serverless.yml`
Added new Lambda function:
```yaml
tokenRefresh:
  handler: token-refresh.handler
  events:
    - schedule:
        rate: rate(15 minutes)
```

### 3. `package.json`
- Removed `toad-scheduler` dependency

## Benefits

### Cost Savings
- **Before**: Lambda runs continuously to keep scheduler alive
- **After**: Token refresh Lambda only runs 96 times/day (every 15 min)
- API Lambda can scale to zero between requests

### Better Reliability
- EventBridge guarantees delivery
- Automatic retries on failure
- Separate logs for scheduled tasks

### Easier Monitoring
- CloudWatch metrics per function
- Can monitor token refresh independently
- Easier to debug issues

### Scalability
- API Lambda scales independently of scheduled tasks
- No scheduler overhead in API requests
- Cold starts are faster (no scheduler initialization)

## How It Works

### Cold Start (First Request)
1. API Lambda starts
2. `initializeOnStartup()` runs once
3. Tokens and subscription initialized
4. Lambda ready to handle requests

### Every 15 Minutes
1. EventBridge triggers `tokenRefresh` Lambda
2. Function checks and refreshes tokens
3. Updates DynamoDB
4. Function terminates

### API Requests
1. API Lambda handles request
2. No scheduler running in background
3. Uses tokens from DynamoDB
4. Lambda can scale to zero when idle

## Testing

### Test Token Refresh Function
```bash
# Invoke locally
serverless invoke local -f tokenRefresh

# Invoke in AWS
serverless invoke -f tokenRefresh

# View logs
serverless logs -f tokenRefresh --tail
```

### Test API Lambda
```bash
# Test status endpoint
curl https://your-api-url/telephonic-signature/api/status
```

## Deployment

Deploy as usual:
```bash
serverless deploy
```

This will create:
1. API Lambda function (existing)
2. **NEW**: Token Refresh Lambda function
3. **NEW**: EventBridge rule (runs every 15 minutes)
4. DynamoDB tables (existing)

## Monitoring

### CloudWatch Metrics
- **API Lambda**: Invocations, errors, duration
- **Token Refresh Lambda**: Scheduled executions, errors

### CloudWatch Logs
```bash
# API logs
serverless logs -f api --tail

# Token refresh logs
serverless logs -f tokenRefresh --tail
```

### EventBridge Rules
Check in AWS Console:
- EventBridge → Rules
- Find rule: `tsmiddleware-lambda-dev-tokenRefresh-schedule-1`
- View invocation metrics

## Cost Comparison

### Before (ToadScheduler)
- Lambda runs 24/7 to keep scheduler alive
- Estimated: $10-20/month (always on)

### After (EventBridge)
- Token refresh: 96 invocations/day × 30 days = 2,880/month
- EventBridge: Free (included in Lambda free tier)
- Lambda compute: ~$0.20/month
- **Savings**: ~$10-20/month

## Cleanup

The old scheduler files can be removed:
- `public/javascripts/scheduler/scheduler.js` - No longer used
- Keep `startup.js` - Used for cold start initialization

## Troubleshooting

### Tokens Not Refreshing
Check EventBridge rule is enabled:
```bash
aws events describe-rule --name tsmiddleware-lambda-dev-tokenRefresh-schedule-1
```

### Token Refresh Failing
View logs:
```bash
serverless logs -f tokenRefresh --startTime 1h
```

### Manual Token Refresh
Invoke function manually:
```bash
serverless invoke -f tokenRefresh
```

## Future Enhancements

Could add more scheduled tasks:
```yaml
functions:
  cleanupOldData:
    handler: cleanup.handler
    events:
      - schedule:
          rate: rate(1 day)
          
  healthCheck:
    handler: health.handler
    events:
      - schedule:
          rate: rate(5 minutes)
```

---

**Migration Complete**: ToadScheduler replaced with EventBridge scheduled Lambda functions! ✅
