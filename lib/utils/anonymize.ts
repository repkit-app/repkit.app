import { createHmac } from 'crypto';

/**
 * Anonymize PII for logging using HMAC
 * Prevents offline reversal of hashed values from leaked logs
 *
 * In production, LOG_HASH_KEY environment variable MUST be set.
 * Using a default key in production would make hashes reversible.
 *
 * @param value - The string to anonymize (e.g., device token, IP address)
 * @returns First 12 characters of HMAC-SHA256 hash, or 'unknown' if value is empty
 */
export function anonymize(value: string): string {
  const key = process.env.LOG_HASH_KEY;

  if (!key && process.env.NODE_ENV === 'production') {
    throw new Error(
      'LOG_HASH_KEY environment variable is required in production to prevent reversible PII hashing'
    );
  }

  // In development, use a default key for convenience
  const hashKey = key || 'change-me-in-prod';

  return value
    ? createHmac('sha256', hashKey).update(value).digest('hex').slice(0, 12)
    : 'unknown';
}
