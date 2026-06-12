"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const prisma_1 = require("../../../../lib/prisma");
async function GET(request, { params }) {
    try {
        const { jobId } = await params;
        const job = await prisma_1.prisma.job.findUnique({
            where: { id: jobId },
        });
        if (!job) {
            return server_1.NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }
        return server_1.NextResponse.json({
            total: job.totalEmails,
            processed: job.successCount + job.failureCount,
            success: job.successCount,
            failed: job.failureCount,
            status: job.status,
        });
    }
    catch (error) {
        console.error('[API_JOB_STATUS_ERROR]', error);
        return server_1.NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
