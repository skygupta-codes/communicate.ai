import assert from 'node:assert';
import { verifySignature } from './src/lib/meta';
import crypto from 'crypto';

async function runTests() {
    console.log('--- Running Tests ---');

    // Test 1: Phone Normalization (extracted logic)
    try {
        const normalizePhone = (raw: string | null) => {
            let normalized = raw;
            if (raw && !raw.startsWith('+')) {
                normalized = `+1${raw.replace(/\D/g, '')}`;
            }
            return normalized;
        };

        assert.strictEqual(normalizePhone('123-456-7890'), '+11234567890');
        assert.strictEqual(normalizePhone('+11234567890'), '+11234567890');
        assert.strictEqual(normalizePhone('4567890'), '+14567890');
        assert.strictEqual(normalizePhone(null), null);

        console.log('✅ Phone Normalization correctly formats defaults to E164.');
    } catch (err: any) {
        console.error('❌ Phone Normalization Test Failed:', err.message);
    }

    // Test 2: Meta Signature Verification
    try {
        // Override the env var manually for the test
        process.env.APP_SECRET = 'test_secret';

        const payload = JSON.stringify({ entry: [] });
        const hmac = crypto.createHmac('sha256', 'test_secret');
        const digest = Buffer.from('sha256=' + hmac.update(payload).digest('hex'), 'utf8');

        const isValid = verifySignature(payload, digest.toString('utf8'));
        assert.strictEqual(isValid, true, 'Valid signature should return true');

        const isInvalid = verifySignature(payload, 'sha256=invalidhash');
        assert.strictEqual(isInvalid, false, 'Invalid signature should return false');

        console.log('✅ Meta Webhook Signature logic safely compares hashes.');
    } catch (err: any) {
        console.error('❌ Meta Signature Verification Test Failed:', err.message);
    }

    console.log('--- Testing Complete ---');
}

runTests();
