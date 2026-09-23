/**
 * Neuralab Comprehensive Security & Integrity Audit Suite
 * Architected by Anay Upadhyay
 */

const http = require('http');
const assert = require('assert');

const BASE_URL = 'http://127.0.0.1:5504';

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    options.host = '127.0.0.1';
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) {}
        resolve({ statusCode: res.statusCode, headers: res.headers, body, json });
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Neuralab Security & Functional Verification...\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Health & Security Headers
  await test('Server Health Check & OWASP Security Headers', async () => {
    const res = await request({ path: '/api/health', method: 'GET', port: 5504 });
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.status, 'healthy');
    assert.ok(res.headers['x-content-type-options'] === 'nosniff', 'Missing nosniff header');
    assert.ok(res.headers['content-security-policy'], 'Missing CSP header');
    assert.ok(res.headers['strict-transport-security'], 'Missing HSTS header');
  });

  // 2. Directory Traversal Vulnerability Test
  await test('Path Traversal Prevention (/../../etc/passwd)', async () => {
    const res = await request({ path: '/../../etc/passwd', method: 'GET', port: 5504 });
    assert.ok(res.statusCode === 403 || res.statusCode === 404, `Unexpected status: ${res.statusCode}`);
    assert.ok(!res.body.includes('root:'), 'Leaked /etc/passwd contents!');
  });

  // 3. Public Course Catalog Listing
  await test('Course Catalog Endpoint (GET /api/courses)', async () => {
    const res = await request({ path: '/api/courses', method: 'GET', port: 5504 });
    assert.strictEqual(res.statusCode, 200);
    assert.ok(Array.isArray(res.json.courses), 'courses must be an array');
    assert.ok(res.json.courses.length >= 18, `Expected at least 18 courses, found ${res.json.courses.length}`);
  });

  // 4. Unauthorized Course Creation Blocked
  await test('RBAC: Course Creation rejected without Admin token', async () => {
    const res = await request({
      path: '/api/courses',
      method: 'POST',
      port: 5504,
      headers: { 'Content-Type': 'application/json' }
    }, { title: 'Hack Course', category: 'Exploit', description: 'Test' });
    assert.strictEqual(res.statusCode, 403, 'Should forbid unauthorized creation');
  });

  // 5. Admin Authentication & Course Creation with CSRF Token
  let adminToken = '';
  let adminCsrf = '';
  let createdCourseId = '';

  await test('Admin Authentication & Token Issuance', async () => {
    const res = await request({
      path: '/api/auth/login',
      method: 'POST',
      port: 5504,
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'admin@neuralab.dev', password: 'NeuralabAdmin@2026!' });

    assert.strictEqual(res.statusCode, 200);
    assert.ok(res.json.token, 'Token must be issued');
    assert.ok(res.json.csrfToken, 'CSRF token must be issued');
    assert.strictEqual(res.json.user.role, 'admin');
    adminToken = res.json.token;
    adminCsrf = res.json.csrfToken;
  });

  await test('Admin Course Creation (POST /api/courses with CSRF)', async () => {
    const res = await request({
      path: '/api/courses',
      method: 'POST',
      port: 5504,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-CSRF-Token': adminCsrf
      }
    }, {
      title: 'Automated Test Course',
      category: 'Systems Testing',
      level: 'Advanced',
      price: 199,
      duration: '4 Weeks',
      description: 'Course created by automated audit suite.'
    });

    assert.strictEqual(res.statusCode, 201);
    assert.strictEqual(res.json.success, true);
    assert.ok(res.json.course.id);
    createdCourseId = res.json.course.id;
  });

  // 6. Admin Course Deletion with CSRF Token
  await test('Admin Course Deletion (DELETE /api/courses/:id with CSRF)', async () => {
    assert.ok(createdCourseId, 'No created course ID to delete');
    const res = await request({
      path: `/api/courses/${createdCourseId}`,
      method: 'DELETE',
      port: 5504,
      headers: {
        'Authorization': `Bearer ${adminToken}`,
        'X-CSRF-Token': adminCsrf
      }
    });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.success, true);

    // Verify it is gone
    const checkRes = await request({ path: `/api/courses/${createdCourseId}`, method: 'GET', port: 5504 });
    assert.strictEqual(checkRes.statusCode, 404);
  });

  // 7. PayPal Order Creation & Price Verification
  await test('PayPal Server-Side Price Verification & Order Creation', async () => {
    // Attempt with client tampering amount - backend must ignore client price and use database price!
    const res = await request({
      path: '/api/payments/paypal/create-order',
      method: 'POST',
      port: 5504,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { courseId: 'cpp-foundation', fakeAmount: 1.00 });

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.json.success, true);
    assert.strictEqual(res.json.amount, 149, 'Server MUST verify course price from database (149), not client');
    assert.ok(res.json.orderId.startsWith('PAYPAL_ORD_'));

    // Capture the order
    const captureRes = await request({
      path: '/api/payments/paypal/capture-order',
      method: 'POST',
      port: 5504,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { orderId: res.json.orderId, courseId: 'cpp-foundation' });

    assert.strictEqual(captureRes.statusCode, 200);
    assert.strictEqual(captureRes.json.status, 'COMPLETED');
    assert.strictEqual(captureRes.json.enrolled, true);
  });

  // 8. Admin Statistics & Audit Logs
  await test('Admin Stats & Audit Log Verification', async () => {
    const statsRes = await request({
      path: '/api/admin/stats',
      method: 'GET',
      port: 5504,
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(statsRes.statusCode, 200);
    assert.ok(statsRes.json.stats.totalCourses >= 18);
    assert.ok(statsRes.json.stats.totalRevenue > 0);

    const logsRes = await request({
      path: '/api/admin/audit-logs',
      method: 'GET',
      port: 5504,
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(logsRes.statusCode, 200);
    assert.ok(Array.isArray(logsRes.json.logs));
    assert.ok(logsRes.json.logs.some(l => l.action === 'COURSE_CREATED'));
  });

  console.log(`\n=========================================`);
  console.log(`Audit Complete: ${passed} passed, ${failed} failed`);
  console.log(`=========================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
