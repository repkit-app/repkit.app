#!/usr/bin/env node
/**
 * Test script for HMAC request signature validation
 *
 * Usage: node test-hmac.js
 *
 * Prerequisites:
 * - Dev server running: npm run dev
 * - HMAC_SECRET configured in .env.local
 */

const crypto = require('crypto');

// Configuration (overridable via env)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const HMAC_SECRET =
  process.env.HMAC_SECRET ||
  '772c22aaaf2444bbd6f859d2ae55c8847e59da949adc8aec0f37eeb5d68bb3f9';
const DEVICE_TOKEN = process.env.X_DEVICE_TOKEN || 'test-device-token';

// Test payload
const testBody = {
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Say "HMAC test successful" if you can read this.' }
  ],
  max_tokens: 50
};

/**
 * Generate HMAC signature for request
 */
function generateSignature(body, timestamp) {
  const bodyText = JSON.stringify(body);
  const payload = bodyText + timestamp;
  return crypto.createHmac('sha256', HMAC_SECRET)
    .update(payload)
    .digest('hex');
}

/**
 * Make authenticated request to API
 */
async function makeRequest(endpoint, body, signature, timestamp) {
  const headers = {
    'Content-Type': 'application/json',
    'X-Device-Token': DEVICE_TOKEN,
  };

  if (signature) {
    headers['X-Request-Signature'] = signature;
  }
  if (timestamp) {
    headers['X-Request-Timestamp'] = timestamp;
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: await response.json().catch(() => ({}))
  };
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('🔐 Testing HMAC Request Signature Validation\n');
  console.log('=' .repeat(60));
  console.log(`Base URL: ${BASE_URL}`);
  console.log(
    `HMAC secret: ${HMAC_SECRET === process.env.HMAC_SECRET ? '(from env)' : '(default sample)'}`,
  );
  console.log(`Device token: ${DEVICE_TOKEN}\n`);

  // Test 1: Valid signature
  console.log('\n1️⃣  Test: Valid signature (should succeed)');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = generateSignature(testBody, timestamp);

    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Signature: ${signature.substring(0, 16)}...`);

    const result = await makeRequest('/api/ai/chat/mini', testBody, signature, timestamp);

    if (result.status === 200) {
      console.log('   ✅ PASS: Request succeeded (status 200)');
      console.log(`   Response: ${result.body.choices?.[0]?.message?.content?.substring(0, 50) || 'N/A'}...`);
    } else {
      console.log(`   ❌ FAIL: Expected 200, got ${result.status}`);
      console.log(`   Error: ${result.body.error || 'Unknown'}`);
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
  }

  // Test 2: Invalid signature
  console.log('\n2️⃣  Test: Invalid signature (should reject with 401)');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const invalidSignature = 'invalid-signature-12345';

    console.log(`   Timestamp: ${timestamp}`);
    console.log(`   Signature: ${invalidSignature}`);

    const result = await makeRequest('/api/ai/chat/mini', testBody, invalidSignature, timestamp);

    if (result.status === 401) {
      console.log('   ✅ PASS: Request rejected (status 401)');
      console.log(`   Error: ${result.body.error}`);
    } else {
      console.log(`   ❌ FAIL: Expected 401, got ${result.status}`);
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
  }

  // Test 3: Missing signature
  console.log('\n3️⃣  Test: Missing signature (should reject with 401)');
  try {
    const result = await makeRequest('/api/ai/chat/mini', testBody, null, null);

    if (result.status === 401) {
      console.log('   ✅ PASS: Request rejected (status 401)');
      console.log(`   Error: ${result.body.error}`);
    } else {
      console.log(`   ❌ FAIL: Expected 401, got ${result.status}`);
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
  }

  // Test 4: Expired timestamp (6 minutes old)
  console.log('\n4️⃣  Test: Expired timestamp (should reject with 401)');
  try {
    const expiredTimestamp = Math.floor((Date.now() - 6 * 60 * 1000) / 1000).toString();
    const signature = generateSignature(testBody, expiredTimestamp);

    console.log(`   Timestamp: ${expiredTimestamp} (6 minutes ago)`);
    console.log(`   Signature: ${signature.substring(0, 16)}...`);

    const result = await makeRequest('/api/ai/chat/mini', testBody, signature, expiredTimestamp);

    if (result.status === 401) {
      console.log('   ✅ PASS: Request rejected (status 401)');
      console.log(`   Error: ${result.body.error}`);
    } else {
      console.log(`   ❌ FAIL: Expected 401, got ${result.status}`);
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
  }

  // Test 5: Future timestamp (should reject with 401)
  console.log('\n5️⃣  Test: Future timestamp (should reject with 401)');
  try {
    const futureTimestamp = Math.floor((Date.now() + 10 * 1000) / 1000).toString();
    const signature = generateSignature(testBody, futureTimestamp);

    console.log(`   Timestamp: ${futureTimestamp} (10 seconds in future)`);
    console.log(`   Signature: ${signature.substring(0, 16)}...`);

    const result = await makeRequest('/api/ai/chat/mini', testBody, signature, futureTimestamp);

    if (result.status === 401) {
      console.log('   ✅ PASS: Request rejected (status 401)');
      console.log(`   Error: ${result.body.error}`);
    } else {
      console.log(`   ❌ FAIL: Expected 401, got ${result.status}`);
    }
  } catch (error) {
    console.log(`   ❌ FAIL: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✨ Tests complete!\n');
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite failed:', error);
  process.exit(1);
});
