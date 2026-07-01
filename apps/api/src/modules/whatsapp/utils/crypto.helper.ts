import { encrypt, decrypt } from '../../../common/utils/crypto.util';

export function encryptSession(state: any): string {
  if (!state) return '';
  const jsonStr = JSON.stringify(state);
  return encrypt(jsonStr);
}

export function decryptSession(encryptedText: string): any {
  if (!encryptedText) return null;
  const jsonStr = decrypt(encryptedText);
  if (!jsonStr) return null;
  try {
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('Failed to parse decrypted WhatsApp session state:', error);
    return null;
  }
}
