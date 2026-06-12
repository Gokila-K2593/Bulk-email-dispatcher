import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      total: job.totalEmails,
      processed: job.successCount + job.failureCount,
      success: job.successCount,
      failed: job.failureCount,
      status: job.status,
    });
  } catch (error) {
    console.error('[API_JOB_STATUS_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
