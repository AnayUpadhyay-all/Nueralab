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

  // 8. PayPal Route Aliases & Error Handling
  await test('PayPal Route Aliases & Input Validation (/api/paypal/create-order)', async () => {
    // Missing courseId test
    const failRes = await request({
      path: '/api/paypal/create-order',
      method: 'POST',
      port: 5504,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, {});
    assert.strictEqual(failRes.statusCode, 400);

    // Valid creation on alias endpoint
    const aliasRes = await request({
      path: '/api/paypal/create-order',
      method: 'POST',
      port: 5504,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      }
    }, { courseId: 'rust-core' });

    assert.strictEqual(aliasRes.statusCode, 200);
    assert.strictEqual(aliasRes.json.amount, 169);
    assert.ok(aliasRes.json.orderId);
  });

  // 9. Static Route Fallback Resolution
  await test('Static Routing: Course Page Resolution with and without /courses/ prefix', async () => {
    const directRes = await request({ path: '/courses/rust-core.html', method: 'GET', port: 5504 });
    assert.strictEqual(directRes.statusCode, 200);
    assert.ok(directRes.body.includes('Rust Core'));

    const fallbackRes = await request({ path: '/rust-core.html', method: 'GET', port: 5504 });
    assert.strictEqual(fallbackRes.statusCode, 200);
    assert.ok(fallbackRes.body.includes('Rust Core'));
  });

  // 10. Admin Statistics & Audit Logs
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

  // 11. Course Edit & Publish Toggle Verification
  await test('Admin Course Edit & Publish Toggle (PUT /api/courses/:id)', async () => {
    const updateRes = await request({
      path: '/api/courses/rust-core',
      method: 'PUT',
      port: 5504,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-CSRF-Token': adminCsrf
      }
    }, { published: true, price: 169 });
    assert.strictEqual(updateRes.statusCode, 200);
    assert.strictEqual(updateRes.json.success, true);
    assert.strictEqual(updateRes.json.course.price, 169);
  });

  // 12. Student & User CRM Verification
  await test('Student & User CRM Endpoint (GET /api/admin/users & enroll)', async () => {
    const usersRes = await request({
      path: '/api/admin/users',
      method: 'GET',
      port: 5504,
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(usersRes.statusCode, 200);
    assert.ok(Array.isArray(usersRes.json.users));
    assert.ok(usersRes.json.users.length > 0);
    // Sensitive fields must be excluded
    assert.strictEqual(usersRes.json.users[0].password, undefined);

    const student = usersRes.json.users.find(u => u.role === 'student');
    if (student) {
      const enrollRes = await request({
        path: `/api/admin/users/${student.id}/enroll`,
        method: 'POST',
        port: 5504,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`,
          'X-CSRF-Token': adminCsrf
        }
      }, { courseId: 'rust-core', action: 'enroll' });
      assert.strictEqual(enrollRes.statusCode, 200);
      assert.ok(enrollRes.json.enrolledCourses.includes('rust-core'));
    }
  });

  // 13. System Health & Route Explorer Verification
  await test('System Health & Route Explorer (GET /api/admin/system-health & orders)', async () => {
    const healthRes = await request({
      path: '/api/admin/system-health',
      method: 'GET',
      port: 5504,
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(healthRes.statusCode, 200);
    assert.ok(healthRes.json.telemetry.memory.heapUsedMb);
    assert.ok(healthRes.json.routes.length >= 20);

    const ordersRes = await request({
      path: '/api/admin/orders',
      method: 'GET',
      port: 5504,
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(ordersRes.statusCode, 200);
    assert.ok(Array.isArray(ordersRes.json.orders));
  });

  // 14. DRM Curriculum Content Gating & Inspect-Proof Verification
  await test('DRM Content Gating (GET /api/courses/:id/content rejection & decryption)', async () => {
    // A. Unauthenticated request must be rejected with 401
    const unauthRes = await request({ path: '/api/courses/cpp-foundation/content', method: 'GET', port: 5504 });
    assert.strictEqual(unauthRes.statusCode, 401);

    // B. Verified Admin gets decrypted materials
    const adminRes = await request({
      path: '/api/courses/cpp-foundation/content',
      method: 'GET',
      port: 5504,
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminRes.statusCode, 200);
    assert.strictEqual(adminRes.json.success, true);
    assert.ok(adminRes.json.content.modules.length > 0);
  });

  // 15. Admin Multi-Step Access Request Verification
  await test('Admin Multi-Step Access Request (POST /api/admin/request-access)', async () => {
    const reqRes = await request({
      path: '/api/admin/request-access',
      method: 'POST',
      port: 5504,
      headers: { 'Content-Type': 'application/json' }
    }, {
      name: 'Security Researcher',
      email: 'researcher@sec.org',
      justification: 'External audit inspection'
    });

    assert.strictEqual(reqRes.statusCode, 202);
    assert.strictEqual(reqRes.json.status, 'PENDING_OWNER_APPROVAL');
    assert.ok(reqRes.json.requestId);
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
