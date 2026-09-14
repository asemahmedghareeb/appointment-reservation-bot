import { config as loadDotenv } from 'dotenv';
import pg from 'pg';
import { Redis } from 'ioredis';

// Load environment variables
loadDotenv();

const { Client } = pg;

function redactSecret(str) {
  if (!str) return '[not set]';
  return '[redacted]';
}

function sanitizeErrorMessage(error) {
  if (!error) return 'Unknown error';
  let message = error.message || String(error);
  // Redact any password or credential patterns from error messages
  message = message.replace(/(:\/\/[^:]+:)([^@]+)(@)/g, '$1***$3');
  message = message.replace(/password=[^;\s]+/gi, 'password=***');
  return message;
}

async function checkPostgres(name, connectionString) {
  if (!connectionString) {
    console.error(`FAIL ${name} - Connection string is missing`);
    return false;
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1;');
    await client.end();
    console.log(`PASS ${name}`);
    return true;
  } catch (err) {
    try {
      await client.end();
    } catch {
      // ignore cleanup errors
    }
    console.error(`FAIL ${name} - ${sanitizeErrorMessage(err)}`);
    return false;
  }
}

async function checkRedis(connectionString) {
  if (!connectionString) {
    console.error('FAIL Upstash Redis - REDIS_URL is missing');
    return false;
  }

  return new Promise((resolve) => {
    let resolved = false;

    const redis = new Redis(connectionString, {
      lazyConnect: true,
      connectTimeout: 10000,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null, // Do not auto-reconnect on verification failure
      tls: connectionString.startsWith('rediss://') ? {} : undefined,
    });

    const timeout = setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        console.error('FAIL Upstash Redis - Connection timed out (10s)');
        try {
          redis.disconnect();
        } catch {
          // ignore
        }
        resolve(false);
      }
    }, 10000);

    (async () => {
      try {
        await redis.connect();
        const pong = await redis.ping();
        clearTimeout(timeout);
        if (pong === 'PONG') {
          console.log('PASS Upstash Redis');
          resolved = true;
          await redis.quit();
          resolve(true);
        } else {
          console.error(`FAIL Upstash Redis - Unexpected response: ${pong}`);
          resolved = true;
          await redis.quit();
          resolve(false);
        }
      } catch (err) {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          console.error(`FAIL Upstash Redis - ${sanitizeErrorMessage(err)}`);
          try {
            redis.disconnect();
          } catch {
            // ignore
          }
          resolve(false);
        }
      }
    })();
  });
}

async function run() {
  console.log('--- Checking Cloud Infrastructure Connectivity ---');

  const poolerUrl = process.env.DATABASE_URL;
  const directUrl = process.env.DIRECT_URL;
  const redisUrl = process.env.REDIS_URL;

  const results = await Promise.all([
    checkPostgres('Supabase Pooler', poolerUrl),
    checkPostgres('Supabase Direct', directUrl),
    checkRedis(redisUrl),
  ]);

  const allPassed = results.every(Boolean);

  console.log('--------------------------------------------------');
  if (allPassed) {
    console.log('Cloud infrastructure connectivity checks PASSED.');
    process.exit(0);
  } else {
    console.error('One or more cloud infrastructure connectivity checks FAILED.');
    process.exit(1);
  }
}

run();
