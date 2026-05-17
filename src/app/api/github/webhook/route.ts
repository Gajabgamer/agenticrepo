import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database/prisma';
import { verifySignature } from '@/lib/github/verifySignature';
import { dispatchEvent } from '@/lib/github/handlers/dispatcher';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Read request body as text for signature verification
    const body = await request.text();
    
    // Verify signature
    const signature = request.headers.get('x-hub-signature-256');
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    
    if (!secret) {
      console.error('GITHUB_WEBHOOK_SECRET not configured');
      return NextResponse.json({ success: false }, { status: 500 });
    }
    
    if (!signature || !verifySignature(body, signature, secret)) {
      console.error('Invalid signature');
      return NextResponse.json({ success: false }, { status: 401 });
    }
    
    // Parse body as JSON
    const payload = JSON.parse(body);
    
    // Read x-github-event header
    const eventType = request.headers.get('x-github-event');
    
    // Log event type
    console.log('Event type:', eventType);
    
    // Log payload action if available
    if (payload.action) {
      console.log('Payload action:', payload.action);
    }
    
    // Save to database
    if (eventType) {
      await prisma.githubEvent.create({
        data: {
          eventType,
        },
      });
    }
    
    // Dispatch to appropriate handler
    if (eventType) {
      const result = await dispatchEvent(eventType, payload);
      console.log('Handler result:', result);
    }
    
    // Return success response
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

// Made with Bob
