/**
 * Neuralab Unified Admin Command Center Engine
 * Architected by Anay Upadhyay
 * Zero-Trust RBAC, CSRF-Guarded Course CRUD, Student CRM, Order Ledger, Telemetry
 */

const AdminApp = {
  token: localStorage.getItem('neuralab_jwt'),
  csrfToken: localStorage.getItem('neuralab_csrf'),
  user: null,
  courses: [],
  users: [],
  orders: [],
  routes: [],
  selectedCourseId: null,
  selectedUserId: null,

  async init() {
    if (!this.token) {
      window.location.href = 'login.html?redirect=admin.html';
      return;
    }

    await this.verifyAdmin();
    await this.loadStats();
    await this.loadCourses();
    await this.loadUsers();
    await this.loadOrders();
    await this.loadSystemHealth();
    await this.loadAuditLogs();
    this.bindEvents();
  },

  async verifyAdmin() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      if (data.user.role !== 'admin') {
        alert('Access Denied: Administrator role required.');
        window.location.href = 'index.html';
        return;
      }
      this.user = data.user;
      this.csrfToken = data.csrfToken;
      localStorage.setItem('neuralab_csrf', data.csrfToken);
      const nameEl = document.getElementById('adminUserName');
      if (nameEl) nameEl.textContent = this.user.name;
    } catch (e) {
      const cached = localStorage.getItem('neuralab_user');
      if (cached) {
        try {
          this.user = JSON.parse(cached);
          const nameEl = document.getElementById('adminUserName');
          if (nameEl) nameEl.textContent = this.user.name || 'Admin';
          return;
        } catch (err) {}
      }
      localStorage.removeItem('neuralab_jwt');
      window.location.href = 'login.html?redirect=admin.html';
    }
  },

  async loadStats() {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const statCourses = document.getElementById('statTotalCourses');
        const statStudents = document.getElementById('statTotalStudents');
        const statRevenue = document.getElementById('statTotalRevenue');
        const statHealth = document.getElementById('statSystemHealth');

        if (statCourses) statCourses.textContent = data.stats.totalCourses;
        if (statStudents) statStudents.textContent = data.stats.totalStudents;
        if (statRevenue) statRevenue.textContent = `$${data.stats.totalRevenue.toLocaleString()}`;
        if (statHealth) statHealth.textContent = data.stats.healthy ? 'Nominal (100%)' : 'Degraded';
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  },

  /* ==========================================================================
     1. CURRICULUM MANAGEMENT & COURSE EDIT & PUBLISH TOGGLES
     ========================================================================== */
  async loadCourses() {
    try {
      const res = await fetch('/api/courses');
      const data = await res.json();
      this.courses = data.courses || [];
      this.renderCourseTable(this.courses);
    } catch (e) {
      console.error('Failed to load courses:', e);
    }
  },

  renderCourseTable(courses) {
    const tbody = document.getElementById('adminCourseTableBody');
    if (!tbody) return;

    if (!courses || courses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No courses matching criteria.</td></tr>';
      return;
    }

    tbody.innerHTML = courses.map(c => {
      const isPublished = c.published !== false;
      return `
        <tr>
          <td>
            <div style="font-weight:700; color:#fff; display:flex; align-items:center; gap:0.4rem;">
              <span>${c.icon || '⚡'}</span>
              <span>${this.escapeHTML(c.title)}</span>
              ${c.badge ? `<span class="badge badge-purple" style="font-size:0.7rem; padding:0.15rem 0.45rem;">${this.escapeHTML(c.badge)}</span>` : ''}
            </div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono); margin-top:0.2rem;">ID: ${c.id}</div>
          </td>
          <td><span class="badge badge-cyan">${this.escapeHTML(c.category)}</span></td>
          <td><span style="font-size:0.85rem; color:var(--text-secondary);">${this.escapeHTML(c.level || 'Advanced')}</span></td>
          <td style="font-weight:700; color:var(--accent-emerald); font-family:var(--font-mono);">$${c.price} USD</td>
          <td style="font-family:var(--font-mono);">${c.enrolledStudents || 0}</td>
          <td>
            <button class="publish-toggle-btn ${isPublished ? 'published' : 'draft'}" data-id="${c.id}" data-published="${isPublished}">
              <span class="status-dot ${isPublished ? 'green' : 'amber'}"></span>
              <span>${isPublished ? 'Live Matrix' : 'Draft'}</span>
            </button>
          </td>
          <td style="text-align:right;">
            <div class="table-action-group" style="justify-content:flex-end;">
              <a href="/courses/${encodeURIComponent(c.file || c.slug + '.html')}" target="_blank" class="btn btn-secondary btn-sm" title="Preview Syllabus">↗ Preview</a>
              <button class="btn btn-secondary btn-sm edit-course-btn" data-id="${c.id}" title="Edit Course Details">Edit</button>
              <button class="btn btn-danger btn-sm delete-course-btn" data-id="${c.id}" data-title="${this.escapeHTML(c.title)}" title="Purge Track">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind Publish Toggles
    tbody.querySelectorAll('.publish-toggle-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const currentPub = e.currentTarget.getAttribute('data-published') === 'true';
        await this.toggleCoursePublish(id, !currentPub);
      });
    });

    // Bind Edit Clicks
    tbody.querySelectorAll('.edit-course-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        this.openEditModal(id);
      });
    });

    // Bind Delete Clicks
    tbody.querySelectorAll('.delete-course-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const title = e.currentTarget.getAttribute('data-title');
        this.openDeleteModal(id, title);
      });
    });
  },

  async toggleCoursePublish(courseId, newStatus) {
    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-CSRF-Token': this.csrfToken
        },
        body: JSON.stringify({ published: newStatus })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to toggle status');
      await this.loadCourses();
      await this.loadAuditLogs();
    } catch (err) {
      alert(`Error updating publish state: ${err.message}`);
    }
  },

  openEditModal(courseId) {
    const course = this.courses.find(c => c.id === courseId);
    if (!course) return;

    document.getElementById('editCourseId').value = course.id;
    document.getElementById('editCourseHeading').textContent = course.title;
    document.getElementById('editTitle').value = course.title;
    document.getElementById('editCategory').value = course.category || 'Systems Programming';
    document.getElementById('editLevel').value = course.level || 'Advanced';
    document.getElementById('editPrice').value = course.price;
    document.getElementById('editDuration').value = course.duration || '8 Weeks';
    document.getElementById('editIcon').value = course.icon || '⚡';
    document.getElementById('editBadge').value = course.badge || '';
    document.getElementById('editPublished').checked = course.published !== false;
    document.getElementById('editDescription').value = course.description || '';
    document.getElementById('editPrereq').value = course.prerequisites || '';

    document.getElementById('editCourseModal').classList.add('active');
  },

  closeEditModal() {
    document.getElementById('editCourseModal').classList.remove('active');
  },

  async handleEditCourse(e) {
    e.preventDefault();
    const courseId = document.getElementById('editCourseId').value;
    const btn = document.getElementById('submitEditCourseBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const payload = {
      title: document.getElementById('editTitle').value.trim(),
      category: document.getElementById('editCategory').value,
      level: document.getElementById('editLevel').value,
      price: Number(document.getElementById('editPrice').value),
      duration: document.getElementById('editDuration').value.trim(),
      icon: document.getElementById('editIcon').value.trim() || '⚡',
      badge: document.getElementById('editBadge').value.trim(),
      published: document.getElementById('editPublished').checked,
      description: document.getElementById('editDescription').value.trim(),
      prerequisites: document.getElementById('editPrereq').value.trim()
    };

    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-CSRF-Token': this.csrfToken
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to update course track.');
      }

      this.closeEditModal();
      await this.loadCourses();
      await this.loadAuditLogs();
      await this.loadSystemHealth();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save Changes';
    }
  },

  openAddModal() {
    document.getElementById('addCourseForm').reset();
    document.getElementById('addCourseModal').classList.add('active');
  },

  closeAddModal() {
    document.getElementById('addCourseModal').classList.remove('active');
  },

  async handleAddCourse(e) {
    e.preventDefault();
    const btn = document.getElementById('submitAddCourseBtn');
    btn.disabled = true;
    btn.textContent = 'Provisioning...';

    const payload = {
      title: document.getElementById('addTitle').value.trim(),
      category: document.getElementById('addCategory').value,
      level: document.getElementById('addLevel').value,
      price: Number(document.getElementById('addPrice').value),
      duration: document.getElementById('addDuration').value.trim() || '8 Weeks',
      icon: document.getElementById('addIcon').value.trim() || '⚡',
      badge: document.getElementById('addBadge').value.trim() || 'Core Track',
      description: document.getElementById('addDescription').value.trim(),
      prerequisites: document.getElementById('addPrereq').value.trim() || 'Foundations of Computer Science'
    };

    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-CSRF-Token': this.csrfToken
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to provision course.');
      }

      this.closeAddModal();
      await this.loadCourses();
      await this.loadStats();
      await this.loadAuditLogs();
      await this.loadSystemHealth();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Course';
    }
  },

  openDeleteModal(id, title) {
    this.selectedCourseId = id;
    document.getElementById('deleteCourseTitle').textContent = `"${title}" (${id})`;
    document.getElementById('deleteCourseModal').classList.add('active');
  },

  closeDeleteModal() {
    this.selectedCourseId = null;
    document.getElementById('deleteCourseModal').classList.remove('active');
  },

  async confirmDeleteCourse() {
    if (!this.selectedCourseId) return;
    const btn = document.getElementById('confirmDeleteBtn');
    btn.disabled = true;
    btn.textContent = 'Purging...';

    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(this.selectedCourseId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'X-CSRF-Token': this.csrfToken
        }
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to delete course.');
      }

      this.closeDeleteModal();
      await this.loadCourses();
      await this.loadStats();
      await this.loadAuditLogs();
      await this.loadSystemHealth();
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Yes, Delete Course';
    }
  },

  /* ==========================================================================
     2. STUDENT & USER CRM
     ========================================================================== */
  async loadUsers() {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.users = data.users || [];
        this.renderUserTable(this.users);
      }
    } catch (e) {
      console.error('Failed to load users:', e);
    }
  },

  renderUserTable(users) {
    const tbody = document.getElementById('adminUserTableBody');
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No users found.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isAdmin = u.role === 'admin';
      const enrolledCount = (u.enrolledCourses || []).length;
      return `
        <tr>
          <td>
            <div style="font-weight:700; color:#fff;">${this.escapeHTML(u.name || 'Anonymous Engineer')}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); font-family:var(--font-mono);">${u.id}</div>
          </td>
          <td style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-primary);">${this.escapeHTML(u.email)}</td>
          <td>
            <span class="badge ${isAdmin ? 'badge-purple' : 'badge-green'}">
              ${isAdmin ? '🛡️ Admin' : '⚡ Student'}
            </span>
          </td>
          <td>
            <span style="font-weight:700; color:var(--accent-cyan); font-family:var(--font-mono);">${enrolledCount} Tracks</span>
          </td>
          <td style="font-size:0.8rem; color:var(--text-secondary);">${new Date(u.createdAt).toLocaleDateString()}</td>
          <td style="text-align:right;">
            <div class="table-action-group" style="justify-content:flex-end;">
              <button class="btn btn-secondary btn-sm manage-enroll-btn" data-id="${u.id}" data-name="${this.escapeHTML(u.name)}">Manage Tracks</button>
              <button class="btn ${isAdmin ? 'btn-secondary' : 'btn-primary'} btn-sm toggle-role-btn" data-id="${u.id}" data-role="${u.role}">
                ${isAdmin ? 'Demote' : 'Make Admin'}
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Bind Toggle Role
    tbody.querySelectorAll('.toggle-role-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const userId = e.currentTarget.getAttribute('data-id');
        const currentRole = e.currentTarget.getAttribute('data-role');
        const newRole = currentRole === 'admin' ? 'student' : 'admin';
        if (confirm(`Change role of user to ${newRole}?`)) {
          await this.updateUserRole(userId, newRole);
        }
      });
    });

    // Bind Manage Enrollments
    tbody.querySelectorAll('.manage-enroll-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const userId = e.currentTarget.getAttribute('data-id');
        const name = e.currentTarget.getAttribute('data-name');
        this.openEnrollModal(userId, name);
      });
    });
  },

  async updateUserRole(userId, newRole) {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-CSRF-Token': this.csrfToken
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update user role');
      await this.loadUsers();
      await this.loadAuditLogs();
    } catch (err) {
      alert(`Role Update Error: ${err.message}`);
    }
  },

  openEnrollModal(userId, userName) {
    this.selectedUserId = userId;
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('enrollModalUserName').textContent = userName || user.email;
    const list = document.getElementById('enrollCoursesList');
    const enrolledIds = user.enrolledCourses || [];

    list.innerHTML = this.courses.map(c => {
      const isEnrolled = enrolledIds.includes(c.id);
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-card); padding:0.75rem 1rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
          <div>
            <div style="font-weight:600; color:#fff; font-size:0.9rem;">${c.icon || '⚡'} ${this.escapeHTML(c.title)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">$${c.price} USD • ${c.category}</div>
          </div>
          <button class="btn btn-sm ${isEnrolled ? 'btn-danger' : 'btn-primary'} enroll-toggle-btn" data-course-id="${c.id}" data-action="${isEnrolled ? 'unenroll' : 'enroll'}">
            ${isEnrolled ? 'Revoke Access' : 'Grant Access'}
          </button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.enroll-toggle-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const courseId = e.currentTarget.getAttribute('data-course-id');
        const action = e.currentTarget.getAttribute('data-action');
        await this.toggleEnrollment(userId, courseId, action);
      });
    });

    document.getElementById('userEnrollModal').classList.add('active');
  },

  closeEnrollModal() {
    this.selectedUserId = null;
    document.getElementById('userEnrollModal').classList.remove('active');
  },

  async toggleEnrollment(userId, courseId, action) {
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/enroll`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-CSRF-Token': this.csrfToken
        },
        body: JSON.stringify({ courseId, action })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Failed to update enrollment');

      await this.loadUsers();
      await this.loadCourses();
      await this.loadStats();
      await this.loadAuditLogs();
      const user = this.users.find(u => u.id === userId);
      this.openEnrollModal(userId, user ? user.name : '');
    } catch (err) {
      alert(`Enrollment Error: ${err.message}`);
    }
  },

  /* ==========================================================================
     3. ORDERS & FINANCIAL LEDGER
     ========================================================================== */
  async loadOrders() {
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.orders = data.orders || [];
        this.renderOrderTable(this.orders);
      }
    } catch (e) {
      console.error('Failed to load orders:', e);
    }
  },

  renderOrderTable(orders) {
    const tbody = document.getElementById('adminOrderTableBody');
    if (!tbody) return;

    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No verified transactions found in ledger.</td></tr>';
      return;
    }

    tbody.innerHTML = orders.map(o => `
      <tr>
        <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--accent-cyan);">${this.escapeHTML(o.id || o.paypalOrderId)}</td>
        <td style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-primary);">${this.escapeHTML(o.userEmail || 'N/A')}</td>
        <td style="font-weight:600; color:#fff;">${this.escapeHTML(o.courseTitle || o.courseId)}</td>
        <td style="font-weight:700; color:var(--accent-emerald); font-family:var(--font-mono);">$${o.amount} ${o.currency || 'USD'}</td>
        <td><span class="badge badge-green">COMPLETED</span></td>
        <td style="font-size:0.8rem; color:var(--text-secondary);">${new Date(o.timestamp).toLocaleString()}</td>
        <td style="text-align:right;">
          <button class="btn btn-secondary btn-sm view-receipt-btn" data-tx="${o.id}">Receipt</button>
        </td>
      </tr>
    `).join('');

    tbody.querySelectorAll('.view-receipt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const txId = e.currentTarget.getAttribute('data-tx');
        this.openReceiptModal(txId);
      });
    });
  },

  openReceiptModal(txId) {
    const order = this.orders.find(o => o.id === txId || o.paypalOrderId === txId);
    if (!order) return;

    const body = document.getElementById('receiptModalBody');
    body.innerHTML = `
      <div style="background:var(--bg-tertiary); padding:1.25rem; border-radius:var(--radius-sm); border:1px solid var(--border-subtle); margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
          <span style="color:var(--text-secondary); font-size:0.85rem;">Transaction Hash</span>
          <span style="font-family:var(--font-mono); font-size:0.85rem; color:var(--accent-cyan); font-weight:bold;">${this.escapeHTML(order.id)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
          <span style="color:var(--text-secondary); font-size:0.85rem;">PayPal Reference</span>
          <span style="font-family:var(--font-mono); font-size:0.85rem; color:var(--text-primary);">${this.escapeHTML(order.paypalOrderId)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
          <span style="color:var(--text-secondary); font-size:0.85rem;">Enrolled Engineer</span>
          <span style="font-size:0.85rem; color:#fff; font-weight:bold;">${this.escapeHTML(order.userEmail)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; margin-bottom:0.75rem;">
          <span style="color:var(--text-secondary); font-size:0.85rem;">Curriculum Track</span>
          <span style="font-size:0.85rem; color:#fff; font-weight:bold;">${this.escapeHTML(order.courseTitle)}</span>
        </div>
        <div style="display:flex; justify-content:space-between; padding-top:0.75rem; border-top:1px dashed var(--border-subtle);">
          <span style="color:var(--text-secondary); font-size:0.95rem; font-weight:bold;">Amount Captured</span>
          <span style="font-size:1.2rem; color:var(--accent-emerald); font-weight:bold; font-family:var(--font-mono);">$${order.amount} ${order.currency || 'USD'}</span>
        </div>
      </div>
      <p style="font-size:0.78rem; color:var(--text-muted); text-align:center;">
        🔒 Verified PayPal Orders v2 HMAC transaction record. Immutably logged in Neuralab ledger.
      </p>
    `;

    document.getElementById('orderReceiptModal').classList.add('active');
  },

  closeReceiptModal() {
    document.getElementById('orderReceiptModal').classList.remove('active');
  },

  /* ==========================================================================
     4. SYSTEM HEALTH & WHOLE WEBSITE ROUTE EXPLORER
     ========================================================================== */
  async loadSystemHealth() {
    try {
      const res = await fetch('/api/admin/system-health', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const t = data.telemetry;

        const heapEl = document.getElementById('telemetryHeap');
        const rssEl = document.getElementById('telemetryRss');
        const uptimeEl = document.getElementById('telemetryUptime');
        const nodeEl = document.getElementById('telemetryNode');
        const platformEl = document.getElementById('telemetryPlatform');

        if (heapEl) heapEl.textContent = `${t.memory.heapUsedMb} / ${t.memory.heapTotalMb} MB`;
        if (rssEl) rssEl.textContent = `Total Resident Memory: ${t.memory.rssMb} MB`;
        if (uptimeEl) uptimeEl.textContent = t.uptimeFormatted;
        if (nodeEl) nodeEl.textContent = `Node.js ${t.nodeVersion}`;
        if (platformEl) platformEl.textContent = t.platform;

        this.routes = data.routes || [];
        this.renderRouteTable(this.routes);
      }
    } catch (e) {
      console.error('Failed to load system health:', e);
    }
  },

  renderRouteTable(routes) {
    const tbody = document.getElementById('adminRouteTableBody');
    if (!tbody) return;

    if (!routes || routes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">No routes registered.</td></tr>';
      return;
    }

    tbody.innerHTML = routes.map(r => {
      const isOk = r.exists !== false;
      const typeBadge = r.type === 'Curriculum' ? 'badge-cyan' : r.type === 'Portal' ? 'badge-purple' : r.type === 'Studio' ? 'badge-green' : 'badge-emerald';
      return `
        <tr>
          <td style="font-family:var(--font-mono); font-size:0.85rem; font-weight:600; color:var(--accent-cyan);">${this.escapeHTML(r.path)}</td>
          <td><span class="badge ${typeBadge}">${r.type}</span></td>
          <td style="color:#fff; font-size:0.85rem;">
            ${this.escapeHTML(r.title)}
            ${r.category ? `<span style="color:var(--text-muted); font-size:0.75rem; display:block;">(${r.category})</span>` : ''}
          </td>
          <td style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-muted);">${r.sizeFormatted || 'API Route'}</td>
          <td>
            <span class="publish-toggle-btn ${isOk ? 'published' : 'draft'}" style="pointer-events:none;">
              <span class="status-dot ${isOk ? 'green' : 'red'}"></span>
              <span>${r.status || 'Active'}</span>
            </span>
          </td>
          <td style="text-align:right;">
            <a href="${r.path}" target="_blank" class="btn btn-secondary btn-sm">Test Route ↗</a>
          </td>
        </tr>
      `;
    }).join('');
  },

  /* ==========================================================================
     5. CRYPTOGRAPHIC AUDIT LOGS
     ========================================================================== */
  async loadAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const container = document.getElementById('auditLogsContainer');
        if (!container) return;

        if (!data.logs || data.logs.length === 0) {
          container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; text-align:center; padding:1.5rem;">No security events recorded yet.</div>';
          return;
        }

        container.innerHTML = data.logs.map(log => `
          <div style="padding:0.75rem 0; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; font-size:0.85rem; font-family:var(--font-mono); align-items:center; flex-wrap:wrap; gap:0.5rem;">
            <div>
              <span style="color:var(--accent-cyan); font-weight:bold;">[${log.action}]</span>
              <span style="color:var(--text-primary); margin-left:0.5rem;">${this.escapeHTML(log.details)}</span>
            </div>
            <div style="color:var(--text-muted); font-size:0.75rem;">${new Date(log.timestamp).toLocaleTimeString()} • ${this.escapeHTML(log.performedBy)}</div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    }
  },

  /* ==========================================================================
     EVENT BINDINGS & TAB CONTROLLERS
     ========================================================================== */
  bindEvents() {
    // Tabs Navigation Controller
    document.querySelectorAll('.admin-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetTab = e.currentTarget.getAttribute('data-tab');

        document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-tab-pane').forEach(p => p.classList.remove('active'));

        e.currentTarget.classList.add('active');
        const pane = document.getElementById(targetTab);
        if (pane) pane.classList.add('active');
      });
    });

    // Add Course Modal
    document.getElementById('openAddCourseModalBtn')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('closeAddModalBtn')?.addEventListener('click', () => this.closeAddModal());
    document.getElementById('cancelAddModalBtn')?.addEventListener('click', () => this.closeAddModal());
    document.getElementById('addCourseForm')?.addEventListener('submit', (e) => this.handleAddCourse(e));

    // Edit Course Modal
    document.getElementById('closeEditModalBtn')?.addEventListener('click', () => this.closeEditModal());
    document.getElementById('cancelEditModalBtn')?.addEventListener('click', () => this.closeEditModal());
    document.getElementById('editCourseForm')?.addEventListener('submit', (e) => this.handleEditCourse(e));

    // Delete Course Modal
    document.getElementById('closeDeleteModalBtn')?.addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('cancelDeleteModalBtn')?.addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.confirmDeleteCourse());

    // User Enrollment Modal
    document.getElementById('closeEnrollModalBtn')?.addEventListener('click', () => this.closeEnrollModal());
    document.getElementById('finishEnrollModalBtn')?.addEventListener('click', () => this.closeEnrollModal());

    // Receipt Modal
    document.getElementById('closeReceiptModalBtn')?.addEventListener('click', () => this.closeReceiptModal());
    document.getElementById('dismissReceiptModalBtn')?.addEventListener('click', () => this.closeReceiptModal());

    // Refresh Audit Log
    document.getElementById('refreshAuditBtn')?.addEventListener('click', () => this.loadAuditLogs());

    // Search Filters
    document.getElementById('adminCourseSearch')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = this.courses.filter(c => 
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
      this.renderCourseTable(filtered);
    });

    document.getElementById('adminUserSearch')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = this.users.filter(u => 
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        u.id.toLowerCase().includes(q)
      );
      this.renderUserTable(filtered);
    });

    document.getElementById('adminOrderSearch')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = this.orders.filter(o => 
        (o.id && o.id.toLowerCase().includes(q)) ||
        (o.userEmail && o.userEmail.toLowerCase().includes(q)) ||
        (o.courseTitle && o.courseTitle.toLowerCase().includes(q))
      );
      this.renderOrderTable(filtered);
    });

    document.getElementById('adminRouteSearch')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = this.routes.filter(r => 
        r.path.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        (r.category && r.category.toLowerCase().includes(q))
      );
      this.renderRouteTable(filtered);
    });

    // Close Modals on Backdrop Click or Escape Key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAddModal();
        this.closeEditModal();
        this.closeDeleteModal();
        this.closeEnrollModal();
        this.closeReceiptModal();
      }
    });

    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.closeAddModal();
          this.closeEditModal();
          this.closeDeleteModal();
          this.closeEnrollModal();
          this.closeReceiptModal();
        }
      });
    });
  },

  escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }
};

window.addEventListener('DOMContentLoaded', () => AdminApp.init());
