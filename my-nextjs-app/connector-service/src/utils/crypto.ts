import crypto from 'crypto';
import config from '../config'; // To get ENCRYPTION_KEY
import logger from './logger';

const ALGORITHM = 'aes-256-cbc';
// Key length for AES-256 is 32 bytes. IV length for CBC is 16 bytes.
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

// Ensure the encryption key is the correct length.
// In a real application, the key should be securely managed (e.g., Vault)
// and not derived or hardcoded like this for production.
// This is a simplified example for local development.
let encryptionKey: Buffer;

function getKey(): Buffer {
  if (!encryptionKey) {
    if (!config.ENCRYPTION_KEY || config.ENCRYPTION_KEY.length === 0) {
      logger.error('ENCRYPTION_KEY is not set in the environment configuration. Cannot perform encryption/decryption.');
      throw new Error('Encryption key is not configured.');
    }
    // Ensure the key is 32 bytes. If it's too short, pad it. If too long, truncate.
    // A more robust approach would be to use a key derivation function (KDF) like PBKDF2 or scrypt.
    encryptionKey = Buffer.alloc(KEY_LENGTH);
    const keySource = Buffer.from(config.ENCRYPTION_KEY, 'utf-8');
    keySource.copy(encryptionKey, 0, 0, Math.min(keySource.length, KEY_LENGTH));
    if (keySource.length < KEY_LENGTH) {
        logger.warn(`ENCRYPTION_KEY was shorter than ${KEY_LENGTH} bytes and has been padded. This is not secure for production.`);
    } else if (keySource.length > KEY_LENGTH) {
        logger.warn(`ENCRYPTION_KEY was longer than ${KEY_LENGTH} bytes and has been truncated. This is not secure for production.`);
    }
  }
  return encryptionKey;
}


export function encrypt(text: string): string | null {
  if (!text) return null;
  try {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    // Prepend IV to the encrypted text (hex encoded) for use during decryption
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error({ error }, 'Encryption failed.');
    // Depending on policy, you might want to re-throw or return null/error indicator
    return null; 
  }
}

export function decrypt(encryptedText: string): string | null {
  if (!encryptedText) return null;
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      logger.error('Invalid encrypted text format (missing IV separator).');
      return null;
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedData = parts[1];
    
    if (iv.length !== IV_LENGTH) {
        logger.error(`Invalid IV length. Expected ${IV_LENGTH}, got ${iv.length}`);
        return null;
    }

    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    logger.error({ error }, 'Decryption failed. This could be due to an incorrect key, IV, or corrupted data.');
    // Depending on policy, re-throw or return null
    return null;
  }
}

// Example usage (for testing purposes):
// (async () => {
//   // Ensure config.ENCRYPTION_KEY is set in your environment or config for this to run
//   if (config.ENCRYPTION_KEY) {
//     const originalText = "This is a secret message!";
//     console.log("Original:", originalText);
//     const encrypted = encrypt(originalText);
//     console.log("Encrypted:", encrypted);
//     if (encrypted) {
//       const decrypted = decrypt(encrypted);
//       console.log("Decrypted:", decrypted);
//       console.log("Match:", originalText === decrypted);
//     }
//   } else {
//     console.warn("Skipping crypto example: ENCRYPTION_KEY not set.");
//   }
// })();