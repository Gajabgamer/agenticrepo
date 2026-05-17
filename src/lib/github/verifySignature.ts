import { createHmac, timingSafeEqual } from 'crypto';

export function verifySignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  // GitHub sends signature as "sha256=<hash>"
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // Use timingSafeEqual to prevent timing attacks
  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(signatureBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

// Made with Bob
