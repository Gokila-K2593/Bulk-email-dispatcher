"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.emailWorker = void 0;
const bullmq_1 = require("bullmq");
const client_1 = require("@prisma/client");
const queue_1 = require("./queue");
const nodemailer_1 = __importDefault(require("nodemailer"));
require("dotenv/config");
const prisma = new client_1.PrismaClient();
// Configure SMTP transporter targeting Mailpit
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025'),
    secure: false,
    ignoreTLS: true, // Mailpit doesn't mandate TLS by default
});
/**
 * Bulk Email Worker strictly follows the requirements:
 * 1. Concurrency = 3
 * 2. Deterministic failure simulation (every 5th email fails)
 * 3. Atomic Job counter updates via Prisma
 * 4. Detailed lifecycle logging (jobId, emailId, attempt)
 */
exports.emailWorker = new bullmq_1.Worker('bulk-email-dispatches', async (job) => {
    const { jobId, emailId, recipient, emailIndex } = job.data;
    const attempt = job.attemptsMade + 1;
    // 1. IDEMPOTENCY GUARD: Prevent duplicate processing if crashed after DB update
    const emailData = await prisma.email.findUnique({ where: { id: emailId } });
    if (!emailData) {
        console.error(`[WORKER] Email not found: ${emailId}`);
        return;
    }
    if (emailData?.status === 'SUCCESS') {
        console.warn(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] - Already SUCCESS, skipping.`);
        return;
    }
    console.log(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] [INDEX:${emailIndex}] [ATTEMPT:${attempt}] - Processing started for ${recipient}`);
    // Update to PROCESSING only on the first attempt to avoid redundant writes
    if (attempt === 1) {
        await prisma.email.update({
            where: { id: emailId },
            data: { status: 'PROCESSING' },
        });
    }
    if (emailIndex % 5 === 0) {
        console.error(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] [INDEX:${emailIndex}] - Simulated Failure`);
        throw new Error("Simulated Failure");
    }
    // Real SMTP delivery via Mailpit
    await transporter.sendMail({
        from: '"Bulk Email Dispatcher" <noreply@dispatcher.local>',
        to: recipient,
        subject: `[BATCH] Email #${emailIndex} - Job ${jobId.substring(0, 8)}`,
        text: `Hi,\n\nThis is a simulated email processed through our background queue.\n\nJob ID: ${jobId}\nEmail ID: ${emailId}\nIndex: ${emailIndex}\nAttempt: ${attempt} / 4\n\nThanks!`,
        html: `
        <div style="font-family: sans-serif; padding: 24px; background-color: #f8fafc; color: #0f172a; max-width: 600px; border-radius: 12px; border: 1px solid #e2e8f0; margin: 0 auto;">
          <h2 style="color: #4f46e5; margin-bottom: 8px;">📧 Bulk Email Dispatcher</h2>
          <p style="color: #475569; font-size: 14px; margin-bottom: 24px;">Your background job has successfully processed this email delivery simulation.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; font-weight: 600; color: #475569; width: 120px;">Recipient</td>
              <td style="padding: 10px 0; font-weight: 500;">${recipient}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; font-weight: 600; color: #475569;">Job ID</td>
              <td style="padding: 10px 0; font-family: monospace; color: #6366f1;">${jobId}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; font-weight: 600; color: #475569;">Email Index</td>
              <td style="padding: 10px 0;">#${emailIndex}</td>
            </tr>
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 10px 0; font-weight: 600; color: #475569;">Attempt</td>
              <td style="padding: 10px 0;">${attempt} / 4</td>
            </tr>
          </table>

          <div style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
            Sent by Bulk Email Dispatcher • Background Worker Node
          </div>
        </div>
      `,
    });
    // ON SUCCESS: Atomic transaction for data consistency
    console.log(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] [ATTEMPT:${attempt}] - Email successfully sent`);
    await prisma.email.update({
        where: { id: job.data.emailId },
        data: { status: "SUCCESS" }
    });
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
}, {
    connection: queue_1.connection,
    concurrency: 3,
});
// ERROR EVENT LISTENER: For retries and final failure
exports.emailWorker.on('failed', async (job, err) => {
    if (!job)
        return;
    const { jobId, emailId } = job.data;
    const attempt = job.attemptsMade;
    if (attempt < job.opts.attempts) {
        const nextDelay = Math.pow(2, attempt - 1) * 1000;
        console.warn(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] - Retry attempt ${attempt} scheduled in ${nextDelay}ms`);
        // UPDATE retryCount in database: Guard ensures we don't exceed max retries logic
        if (attempt <= 3) {
            await prisma.email.update({
                where: { id: emailId },
                data: { retryCount: { increment: 1 } }
            });
        }
    }
    else {
        // FINAL FAILURE logic: Atomic transaction for data consistency
        console.error(`[WORKER] [JOB:${jobId}] [EMAIL:${emailId}] - Final failure after ${attempt} attempts`);
        await prisma.email.update({
            where: { id: job.data.emailId },
            data: { status: "FAILED" }
        });
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
    await exports.emailWorker.close();
    process.exit(0);
});
