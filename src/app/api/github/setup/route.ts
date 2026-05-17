import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// made by bob
export function GET(request: NextRequest) {
  const installationId = request.nextUrl.searchParams.get('installation_id');
  const setupAction = request.nextUrl.searchParams.get('setup_action');
  const redirectUrl = new URL('/dashboard', request.nextUrl.origin);

  if (installationId) {
    redirectUrl.searchParams.set('installation_id', installationId);
  }

  if (setupAction) {
    redirectUrl.searchParams.set('setup_action', setupAction);
  }

  return NextResponse.redirect(redirectUrl);
}

// Made with Bob
