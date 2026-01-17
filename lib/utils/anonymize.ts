import { createHmac } from 'crypto';

/**
 * Anonymize PII for logging using HMAC
 * Prevents offline reversal of hashed values from leaked logs
 *
 * @param value - The string to anonymize (e.g., device token, IP address)
 * @returns First 12 characters of HMAC-SHA256 hash, or 'unknown' if value is empty
 */
export function anonymize(value: string): string {
  const key = process.env.LOG_HASH_KEY || 'change-me-in-prod';
  return value
    ? createHmac('sha256', key).update(value).digest('hex').slice(0, 12)
    : 'unknown';
}
