import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { emailQueue } from '../../../queue';
// import { Email } from '@prisma/client';


export async function POST(req: Request) {
  try {
    const data = (await req.json()) as { emails: string[] };
    const emails = data.emails;

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'emails must be a non-empty array' },
        { status: 400 }
      );
    }

    // 1. Create Job record
    const job = await prisma.job.create({
      data: {
        totalEmails: emails.length,
        status: 'PROCESSING',
      },
    });

    // 2. Create Email records (Batch create)
    // In Prisma 7, createMany returns the created records count.
    // We'll create them and then fetch them or use a transaction with creates.
    // For absolute deterministic index, we'll map them carefully.

    await prisma.email.createMany({
      data: emails.map((recipient, index) => ({
        jobId: job.id,
        recipient,
        status: 'PENDING',
        order: index + 1,
      })),
    });

    // Fetch created emails to get their IDs for BullMQ entries
    const createdEmails = await prisma.email.findMany({
      where: { jobId: job.id },
      orderBy: { order: 'asc' }, // ensures deterministic order for emailIndex
    });

    // 3. Push to BullMQ queue
    await Promise.all(
      createdEmails.map((email) =>
        emailQueue.add('bulk-email-dispatches', {
          jobId: job.id,
          emailId: email.id,
          recipient: email.recipient,
          emailIndex: email.order, // 1-based index
        })
      )
    );

    // 4. Return immediately with 202 Accepted
    return NextResponse.json({ jobId: job.id }, { status: 202 });
  } catch (error) {
    console.error('[API_SEND_BULK_ERROR]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
