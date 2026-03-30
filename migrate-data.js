/**
 * Data Migration Script: SQLite → DynamoDB
 * 
 * This script migrates existing data from SQLite database to DynamoDB tables.
 * Run this AFTER deploying the Lambda function to create the DynamoDB tables.
 * 
 * Usage:
 *   node migrate-data.js
 */

const fs = require('fs');
const path = require('path');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const sqlite3 = require('sqlite3').verbose();

// Configuration
const SQLITE_DB_PATH = './lacts.db'; // Path to your SQLite database
const AWS_REGION = process.env.AWS_REGION || 'us-west-1';
const BATCH_SIZE = 25; // DynamoDB batch write limit

// Table names (should match your deployed DynamoDB tables)
const TABLES = {
    AGENTS: process.env.AGENTS_TABLE_NAME || 'tsmiddleware-dev-Agents',
    CAPTURES: process.env.CAPTURES_TABLE_NAME || 'tsmiddleware-dev-Captures',
    SUBSCRIPTIONS: process.env.SUBSCRIPTIONS_TABLE_NAME || 'tsmiddleware-dev-Subscriptions',
    WX_TOKEN: process.env.WX_TOKEN_TABLE_NAME || 'tsmiddleware-dev-WxToken',
    CAWS_TOKEN: process.env.CAWS_TOKEN_TABLE_NAME || 'tsmiddleware-dev-CawsToken'
};

// Initialize DynamoDB client
const client = new DynamoDBClient({ region: AWS_REGION });
const dynamoDb = DynamoDBDocumentClient.from(client);

/**
 * Read all records from a SQLite table
 */
function readSQLiteTable(db, tableName) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM ${tableName}`, (err, rows) => {
            if (err) {
                if (err.message.includes('no such table')) {
                    console.log(`⚠️  Table ${tableName} not found in SQLite, skipping...`);
                    resolve([]);
                } else {
                    reject(err);
                }
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * Write records to DynamoDB in batches
 */
async function writeToDynamoDB(tableName, items) {
    if (items.length === 0) {
        console.log(`  No items to migrate for table ${tableName}`);
        return;
    }

    console.log(`  Migrating ${items.length} items to ${tableName}...`);

    // Process in batches of 25 (DynamoDB limit)
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        const batch = items.slice(i, i + BATCH_SIZE);

        try {
            // Use individual PutCommand for better error handling
            for (const item of batch) {
                await dynamoDb.send(
                    new PutCommand({
                        TableName: tableName,
                        Item: item
                    })
                );
            }
            console.log(`  ✓ Wrote batch ${Math.floor(i / BATCH_SIZE) + 1} (${batch.length} items)`);
        } catch (error) {
            console.error(`  ✗ Error writing batch to ${tableName}:`, error.message);
            throw error;
        }
    }

    console.log(`  ✅ Successfully migrated ${items.length} items to ${tableName}`);
}

/**
 * Transform SQLite record to DynamoDB format
 */
function transformRecord(record, tableName) {
    // Remove null/undefined values
    const cleaned = {};
    for (const [key, value] of Object.entries(record)) {
        if (value !== null && value !== undefined) {
            cleaned[key] = value;
        }
    }

    // Add timestamps if not present
    if (!cleaned.createdAt && cleaned.createdTime) {
        cleaned.createdAt = cleaned.createdTime;
    }
    if (!cleaned.updatedAt) {
        cleaned.updatedAt = new Date().toISOString();
    }

    return cleaned;
}

/**
 * Main migration function
 */
async function migrate() {
    console.log('\n🚀 Starting SQLite to DynamoDB Migration\n');
    console.log('Configuration:');
    console.log(`  SQLite DB: ${SQLITE_DB_PATH}`);
    console.log(`  AWS Region: ${AWS_REGION}`);
    console.log(`  Target Tables:`);
    Object.entries(TABLES).forEach(([key, value]) => {
        console.log(`    ${key}: ${value}`);
    });
    console.log();

    // Check if SQLite database exists
    if (!fs.existsSync(SQLITE_DB_PATH)) {
        console.error(`❌ SQLite database not found at: ${SQLITE_DB_PATH}`);
        console.log('Please ensure the database file exists or update SQLITE_DB_PATH');
        process.exit(1);
    }

    // Open SQLite database
    const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
            console.error('❌ Error opening SQLite database:', err.message);
            process.exit(1);
        }
    });

    try {
        // Migrate Agents (wxAgents table)
        console.log('📊 Migrating Agents...');
        const agents = await readSQLiteTable(db, 'wxAgents');
        const transformedAgents = agents.map(record => transformRecord(record, 'agents'));
        await writeToDynamoDB(TABLES.AGENTS, transformedAgents);

        // Migrate Captures
        console.log('\n📊 Migrating Captures...');
        const captures = await readSQLiteTable(db, 'captures');
        const transformedCaptures = captures.map(record => transformRecord(record, 'captures'));
        await writeToDynamoDB(TABLES.CAPTURES, transformedCaptures);

        // Migrate Subscriptions
        console.log('\n📊 Migrating Subscriptions...');
        const subscriptions = await readSQLiteTable(db, 'subscriptions');
        const transformedSubscriptions = subscriptions.map(record => transformRecord(record, 'subscriptions'));
        await writeToDynamoDB(TABLES.SUBSCRIPTIONS, transformedSubscriptions);

        // Migrate WxToken
        console.log('\n📊 Migrating WxToken...');
        const wxTokens = await readSQLiteTable(db, 'wxTokens');
        const transformedWxTokens = wxTokens.map(record => transformRecord(record, 'wxTokens'));
        await writeToDynamoDB(TABLES.WX_TOKEN, transformedWxTokens);

        // Migrate CawsToken
        console.log('\n📊 Migrating CawsToken...');
        const cawsTokens = await readSQLiteTable(db, 'cawsTokens');
        const transformedCawsTokens = cawsTokens.map(record => transformRecord(record, 'cawsTokens'));
        await writeToDynamoDB(TABLES.CAWS_TOKEN, transformedCawsTokens);

        console.log('\n✅ Migration completed successfully!\n');

        // Summary
        console.log('Migration Summary:');
        console.log(`  Agents: ${transformedAgents.length} records`);
        console.log(`  Captures: ${transformedCaptures.length} records`);
        console.log(`  Subscriptions: ${transformedSubscriptions.length} records`);
        console.log(`  WxTokens: ${transformedWxTokens.length} records`);
        console.log(`  CawsTokens: ${transformedCawsTokens.length} records`);
        console.log(`  Total: ${transformedAgents.length + transformedCaptures.length + transformedSubscriptions.length + transformedWxTokens.length + transformedCawsTokens.length} records\n`);

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        // Close SQLite database
        db.close((err) => {
            if (err) {
                console.error('Error closing SQLite database:', err.message);
            }
        });
    }
}

// Run migration
if (require.main === module) {
    migrate().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

module.exports = { migrate };
