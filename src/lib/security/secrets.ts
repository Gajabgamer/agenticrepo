import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const secret =
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    'development-only-nextauth-secret-change-me';

  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptSecret(value: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split(':');

  if (!ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted secret format');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivValue, 'base64')
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

// Made with Bob
// made by bob
