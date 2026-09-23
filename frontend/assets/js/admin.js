/**
 * Neuralab Admin Management Engine
 * Architected by Anay Upadhyay
 * Zero-Trust RBAC, CSRF-Guarded Course CRUD, Metrics & Audit Trail
 */

const AdminApp = {
  token: localStorage.getItem('neuralab_jwt'),
  csrfToken: localStorage.getItem('neuralab_csrf'),
  user: null,
  courses: [],
  selectedCourseId: null,

  async init() {
    if (!this.token) {
      window.location.href = '/login.html?redirect=admin.html';
      return;
    }

    await this.verifyAdmin();
    await this.loadStats();
    await this.loadCourses();
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
        window.location.href = '/index.html';
        return;
      }
      this.user = data.user;
      this.csrfToken = data.csrfToken;
      localStorage.setItem('neuralab_csrf', data.csrfToken);
      document.getElementById('adminUserName').textContent = this.user.name;
    } catch (e) {
      localStorage.removeItem('neuralab_jwt');
      window.location.href = '/login.html?redirect=admin.html';
    }
  },

  async loadStats() {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        document.getElementById('statTotalCourses').textContent = data.stats.totalCourses;
        document.getElementById('statTotalStudents').textContent = data.stats.totalStudents;
        document.getElementById('statTotalRevenue').textContent = `$${data.stats.totalRevenue.toLocaleString()}`;
        document.getElementById('statSystemHealth').textContent = data.stats.healthy ? 'Nominal (100%)' : 'Degraded';
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  },

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

    if (courses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:2rem; color:var(--text-muted);">No courses registered in matrix.</td></tr>';
      return;
    }

    tbody.innerHTML = courses.map(c => `
      <tr>
        <td><strong>${c.icon || '📘'} ${this.escapeHTML(c.title)}</strong></td>
        <td><span class="badge badge-cyan">${this.escapeHTML(c.category)}</span></td>
        <td>${this.escapeHTML(c.level)}</td>
        <td>$${c.price} USD</td>
        <td>${c.enrolledStudents || 0}</td>
        <td><span class="badge ${c.published ? 'badge-green' : 'badge-purple'}">${c.published ? 'Active' : 'Draft'}</span></td>
        <td>
          <div style="display:flex; gap:0.5rem;">
            <a href="/courses/${encodeURIComponent(c.file || c.slug + '.html')}" target="_blank" class="btn btn-secondary btn-sm">Preview</a>
            <button class="btn btn-danger btn-sm delete-course-btn" data-id="${c.id}" data-title="${this.escapeHTML(c.title)}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

    // Bind delete clicks
    tbody.querySelectorAll('.delete-course-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const title = e.currentTarget.getAttribute('data-title');
        this.openDeleteModal(id, title);
      });
    });
  },

  async loadAuditLogs() {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const container = document.getElementById('auditLogsContainer');
        if (!container) return;

        container.innerHTML = data.logs.map(log => `
          <div style="padding:0.75rem 0; border-bottom:1px solid var(--border-subtle); display:flex; justify-content:space-between; font-size:0.85rem; font-family:var(--font-mono);">
            <div>
              <span style="color:var(--accent-cyan); font-weight:bold;">[${log.action}]</span>
              <span style="color:var(--text-primary); margin-left:0.5rem;">${this.escapeHTML(log.details)}</span>
            </div>
            <div style="color:var(--text-muted);">${new Date(log.timestamp).toLocaleTimeString()} • ${this.escapeHTML(log.performedBy)}</div>
          </div>
        `).join('');
      }
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    }
  },

  openAddModal() {
    document.getElementById('addCourseForm').reset();
    document.getElementById('addCourseModal').classList.add('active');
  },

  closeAddModal() {
    document.getElementById('addCourseModal').classList.remove('active');
  },

  openDeleteModal(id, title) {
    this.selectedCourseId = id;
    document.getElementById('deleteCourseTitle').textContent = `"${title}" (${id})`;
    document.getElementById('deleteCourseModal').classList.add('active');
  },

  closeDeleteModal() {
    document.getElementById('deleteCourseModal').classList.remove('active');
    this.selectedCourseId = null;
  },

  async handleAddCourse(e) {
    e.preventDefault();
    const btn = document.getElementById('submitAddCourseBtn');
    btn.disabled = true;
    btn.textContent = 'Registering in Matrix...';

    const courseData = {
      title: document.getElementById('addTitle').value.trim(),
      category: document.getElementById('addCategory').value,
      level: document.getElementById('addLevel').value,
      price: parseFloat(document.getElementById('addPrice').value) || 0,
      duration: document.getElementById('addDuration').value.trim() || '8 Weeks',
      badge: document.getElementById('addBadge').value.trim() || 'Core Track',
      icon: document.getElementById('addIcon').value.trim() || '⚡',
      description: document.getElementById('addDescription').value.trim(),
      prerequisites: document.getElementById('addPrereq').value.trim() || 'Programming fundamentals'
    };

    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-CSRF-Token': this.csrfToken
        },
        body: JSON.stringify(courseData)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Course creation failed.');
      }

      this.closeAddModal();
      await this.loadCourses();
      await this.loadStats();
      await this.loadAuditLogs();
      alert(`Course "${data.course.title}" created successfully!`);
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create Course';
    }
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
    } catch (err) {
      alert(`Error: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Yes, Delete Course';
    }
  },

  bindEvents() {
    document.getElementById('openAddCourseModalBtn')?.addEventListener('click', () => this.openAddModal());
    document.getElementById('closeAddModalBtn')?.addEventListener('click', () => this.closeAddModal());
    document.getElementById('cancelAddModalBtn')?.addEventListener('click', () => this.closeAddModal());
    document.getElementById('addCourseForm')?.addEventListener('submit', (e) => this.handleAddCourse(e));

    document.getElementById('closeDeleteModalBtn')?.addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('cancelDeleteModalBtn')?.addEventListener('click', () => this.closeDeleteModal());
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => this.confirmDeleteCourse());

    // Search filter
    document.getElementById('adminCourseSearch')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      const filtered = this.courses.filter(c => 
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
      );
      this.renderCourseTable(filtered);
    });
  },

  escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
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
