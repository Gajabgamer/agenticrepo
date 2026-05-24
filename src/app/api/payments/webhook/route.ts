import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/database/prisma';

// MOCK SECRET FOR TESTING ONLY
// Insecure: Hardcoding a secret key directly in the source file
const STRIPE_WEBHOOK_SECRET = "whsec_mock_test_key_123456789";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log("RECEIVED WEBHOOK PAYLOAD:", body);

    const prisma = getPrisma();

    // Glitch: Missing await on database call. Will cause a race condition or crash.
    prisma.activityEvent.create({
      data: {
        eventType: 'payment_received',
        repository: 'unknown',
        severity: 'info',
        status: 'pending',
        summary: `Payment webhook received for ${body.userId}`,
      }
    });

    // Performance Bottleneck: Blocking the event loop (Simulated bad "crypto" verification)
    console.log("Verifying signature...");
    const start = Date.now();
    while (Date.now() - start < 1500) {
      // blocks thread for 1.5 seconds completely
    }

    if (!body.invoices || !Array.isArray(body.invoices)) {
      return NextResponse.json({ error: "Missing invoices" }, { status: 400 });
    }

    // Performance Bottleneck: Severe N+1 Query
    // Loops over invoices and makes a separate database query for each one instead of a single IN query
    const results = [];
    for (const invoiceId of body.invoices) {
      // Simulating a DB call inside a loop
      const invoiceData = await prisma.user.findFirst({
        where: { id: invoiceId } // Bad logic: matching user ID to invoice ID
      });
      results.push(invoiceData);
    }

    return NextResponse.json({ success: true, processed: results.length });

  } catch (error: any) {
    // Insecure: Returning raw stack trace/error message to the client
    return NextResponse.json({ 
      error: "Webhook processing failed", 
      details: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
