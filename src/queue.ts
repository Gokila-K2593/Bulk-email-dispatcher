import { Queue } from 'bullmq';
import IORedis from 'ioredis';

// Redis connection - using standard defaults for simplicity
export const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

/**
 * BullMQ Queue for handling bulk email dispatches.
 * Strictly follows the technical requirements:
 * - 3 retries (total 4 attempts)
 * - Exponential backoff (1s, 2s, 4s)
 */
export const emailQueue = new Queue('bulk-email-dispatches', {
  connection: connection as any,
  defaultJobOptions: {
    attempts: 4,
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s initial delay
    },
    removeOnComplete: false, // For debugging/trace availability
  },
});
