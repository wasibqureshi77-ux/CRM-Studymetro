import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';

function getSecretKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptPassword(password: string, secret: string): string {
  const iv = crypto.randomBytes(16);
  const key = getSecretKey(secret);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(password, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

export function decryptPassword(encryptedText: string, secret: string): string {
  const [ivHex, encrypted] = encryptedText.split(':');
  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted password format');
  }
  const iv = Buffer.from(ivHex, 'hex');
  const key = getSecretKey(secret);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
