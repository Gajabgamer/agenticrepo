import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(
    {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'GitHub Engineering Agent',
      version: '1.0.0',
    },
    { status: 200 }
  );
}

// Made with Bob
