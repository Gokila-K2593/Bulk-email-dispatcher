import { Worker, Job as BullMQJob } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { connection } from './queue';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface EmailJobData {
  jobId: string;
  emailId: string;
  recipient: string;
  emailIndex: number;
}

/**
 * Bulk Email Worker strictly follows the requirements:
 * 1. Concurrency = 3
 * 2. Deterministic failure simulation (every 5th email fails)
 * 3. Atomic Job counter updates via Prisma
 * 4. Detailed lifecycle logging (jobId, emailId, attempt)
 */
export const emailWorker = new Worker<EmailJobData>(
  'bulk-email-dispatches',
  async (job: BullMQJob<EmailJobData>) => {
    const { jobId, emailId, recipient, emailIndex } = job.data;
    const attempt = job.attemptsMade + 1;

    // 1. IDEMPOTENCY GUARD: Prevent duplicate processing if crashed after DB update
    const emailData = await prisma.email.findUnique({ where: { id: emailId } });
    if (emailData?.status === 'SUCCESS') {
      console.warn(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] - Already SUCCESS, skipping.`);
      return { success: true, skipped: true };
    }

    console.log(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] [ATTEMPT:${attempt}] - Processing started for ${recipient}`);

    // Update to PROCESSING only on the first attempt to avoid redundant writes
    if (attempt === 1) {
      await prisma.email.update({
        where: { id: emailId },
        data: { status: 'PROCESSING' },
      });
    }

    if ((emailIndex + 1) % 5 === 0) {
      throw new Error("Simulated Failure");
    }

    // SIMULATED EMAIL SENDING LOGIC
    await new Promise((resolve) => setTimeout(resolve, 500));

    // ON SUCCESS: Atomic transaction for data consistency
    console.log(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] [ATTEMPT:${attempt}] - Email successfully sent`);

    const [updatedJob] = await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: {
          successCount: { increment: 1 },
          // processedCount removed: Computed from success + failure counts
        },
        select: { successCount: true, failureCount: true, totalEmails: true },
      }),
      prisma.email.update({
        where: { id: emailId },
        data: { status: 'SUCCESS' },
      }),
    ]);

    // IDEMPOTENT COMPLETION CHECK: Computed processed count (success + failure)
    const processed = updatedJob.successCount + updatedJob.failureCount;

    if (processed === updatedJob.totalEmails) {
      await prisma.job.updateMany({
        where: { id: jobId, status: 'PROCESSING' },
        data: { status: 'COMPLETED' },
      });
    }

    return { success: true };
  },
  {
    connection,
    concurrency: 3,
  }
);

// ERROR EVENT LISTENER: For retries and final failure
emailWorker.on('failed', async (job, err) => {
  if (!job) return;
  const { jobId, emailId } = job.data;
  const attempt = job.attemptsMade;

  if (attempt < job.opts.attempts!) {
    const nextDelay = Math.pow(2, attempt - 1) * 1000;
    console.warn(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] - Retry attempt ${attempt} scheduled in ${nextDelay}ms`);

    // UPDATE retryCount in database: Guard ensures we don't exceed max retries logic
    if (attempt <= 3) {
      await prisma.email.update({
        where: { id: emailId },
        data: { retryCount: { increment: 1 } }
      });
    }
  } else {
    // FINAL FAILURE logic: Atomic transaction for data consistency
    console.error(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] - Final failure after ${attempt} attempts`);

    const [updatedJob] = await prisma.$transaction([
      prisma.job.update({
        where: { id: jobId },
        data: {
          failureCount: { increment: 1 },
          // processedCount removed: Computed dynamically
        },
        select: { successCount: true, failureCount: true, totalEmails: true },
      }),
      prisma.email.update({
        where: { id: emailId },
        data: { status: 'FAILED' },
      }),
    ]);

    // IDEMPOTENT COMPLETION CHECK: Computed processed count
    const processed = updatedJob.successCount + updatedJob.failureCount;

    if (processed === updatedJob.totalEmails) {
      await prisma.job.updateMany({
        where: { id: jobId, status: 'PROCESSING' },
        data: { status: 'COMPLETED' },
      });
    }
  }
});

// GRACEFUL SHUTDOWN
process.on('SIGINT', async () => {
  console.log('[WORKER] Shutting down gracefully...');
  await emailWorker.close();
  process.exit(0);
});
