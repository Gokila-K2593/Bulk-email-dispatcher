"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailQueue = exports.connection = void 0;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
// Redis connection - using standard defaults for simplicity
exports.connection = new ioredis_1.default({
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
exports.emailQueue = new bullmq_1.Queue('bulk-email-dispatches', {
    connection: exports.connection,
    defaultJobOptions: {
        attempts: 4,
        backoff: {
            type: 'exponential',
            delay: 1000, // 1s initial delay
        },
        removeOnComplete: false, // For debugging/trace availability
    },
});
