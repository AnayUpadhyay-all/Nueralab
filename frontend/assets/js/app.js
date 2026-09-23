/**
 * Neuralab Core Client Application
 * Architected by Anay Upadhyay
 * State, Auth, Dynamic Catalog, Secure PayPal Engine & Notifications
 */

const App = {
  state: {
    user: null,
    token: localStorage.getItem('neuralab_jwt') || null,
    csrfToken: localStorage.getItem('neuralab_csrf') || null,
    courses: [],
    selectedCourse: null
  },

  async init() {
    this.setupAuthUI();
    await this.fetchCurrentUser();
    await this.fetchCourses();
    this.bindEvents();
  },

  async fetchCurrentUser() {
    if (!this.state.token) return;
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${this.state.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.state.user = data.user;
        this.state.csrfToken = data.csrfToken;
        localStorage.setItem('neuralab_csrf', data.csrfToken);
        this.setupAuthUI();
      } else {
        this.logout(false);
      }
    } catch (e) {
      console.warn('Could not verify session:', e);
    }
  },

  setupAuthUI() {
    const navActions = document.getElementById('navActions');
    if (!navActions) return;

    if (this.state.user) {
      const isAdmin = this.state.user.role === 'admin';
      navActions.innerHTML = `
        <div style="display:flex; align-items:center; gap: 0.85rem;">
          ${isAdmin ? `<a href="/admin.html" class="btn btn-secondary btn-sm" style="border-color:var(--accent-purple); color:#d8b4fe;">⚡ Admin Panel</a>` : ''}
          <a href="/neural-platform.html" class="btn btn-secondary btn-sm">Dashboard</a>
          <span style="font-size:0.85rem; color:var(--text-secondary);">${this.escapeHTML(this.state.user.name)}</span>
          <button id="logoutBtn" class="btn btn-secondary btn-sm" style="padding:0.35rem 0.65rem;">Sign Out</button>
        </div>
      `;
      document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    } else {
      navActions.innerHTML = `
        <a href="/login.html" class="btn btn-secondary btn-sm">Sign In</a>
        <a href="/login.html?tab=register" class="btn btn-primary btn-sm">Get Started</a>
      `;
    }
  },

  async fetchCourses(query = '') {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">Syncing Neural Course Matrix...</div>';

    try {
      const res = await fetch(`/api/courses${query}`);
      const data = await res.json();
      this.state.courses = data.courses || [];
      this.renderCourses(this.state.courses);
    } catch (err) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--accent-red);">Failed to connect to Neuralab core.</div>';
    }
  },

  renderCourses(courses) {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;

    if (courses.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:4rem; color:var(--text-muted);">No courses found matching your criteria.</div>';
      return;
    }

    grid.innerHTML = courses.map(c => `
      <div class="card" data-id="${c.id}">
        <div class="card-header">
          <div class="card-icon">${c.icon || '⚡'}</div>
          <span class="badge ${c.badge === 'Core Track' ? 'badge-cyan' : c.badge === 'Flagship' ? 'badge-purple' : 'badge-green'}">${this.escapeHTML(c.badge || c.level)}</span>
        </div>
        <h3 class="card-title">${this.escapeHTML(c.title)}</h3>
        <p class="card-desc">${this.escapeHTML(c.description)}</p>
        <div class="card-meta">
          <span>⏱️ ${this.escapeHTML(c.duration)} • ${c.modulesCount} Modules</span>
          <div class="card-price">$${c.price} <span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">USD</span></div>
        </div>
        <div style="display:flex; gap:0.5rem; margin-top:1.25rem;">
          <a href="/courses/${encodeURIComponent(c.file || c.slug + '.html')}" class="btn btn-secondary btn-sm" style="flex:1;">View Syllabus</a>
          <button class="btn btn-primary btn-sm enroll-btn" data-id="${c.id}" style="flex:1;">Enroll with PayPal</button>
        </div>
      </div>
    `).join('');

    // Attach enroll listeners
    grid.querySelectorAll('.enroll-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const courseId = e.currentTarget.getAttribute('data-id');
        this.openPayPalCheckout(courseId);
      });
    });
  },

  async openPayPalCheckout(courseId) {
    if (!this.state.user) {
      this.showToast('Please sign in to enroll in this course.', 'error');
      setTimeout(() => { window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname)}`; }, 1000);
      return;
    }

    const course = this.state.courses.find(c => c.id === courseId);
    if (!course) return;

    this.state.selectedCourse = course;
    const modal = document.getElementById('paypalModal');
    const modalTitle = document.getElementById('paypalCourseTitle');
    const modalPrice = document.getElementById('paypalCoursePrice');
    const modalDuration = document.getElementById('paypalCourseDuration');

    if (modal && modalTitle && modalPrice) {
      modalTitle.textContent = course.title;
      modalPrice.textContent = `$${course.price} USD`;
      if (modalDuration) modalDuration.textContent = course.duration;
      modal.classList.add('active');
    }
  },

  async executePayPalPayment() {
    const course = this.state.selectedCourse;
    if (!course) return;

    const payBtn = document.getElementById('confirmPaypalBtn');
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = 'Processing with PayPal...';
    }

    try {
      // 1. Create order on backend (Server verifies price against DB)
      const createRes = await fetch('/api/payments/paypal/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify({ courseId: course.id })
      });

      const orderData = await createRes.json();
      if (!createRes.ok || !orderData.orderId) {
        throw new Error(orderData.message || 'Order creation failed.');
      }

      // 2. Capture payment on backend
      const captureRes = await fetch('/api/payments/paypal/capture-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify({
          orderId: orderData.orderId,
          courseId: course.id
        })
      });

      const captureData = await captureRes.json();
      if (!captureRes.ok || !captureData.success) {
        throw new Error(captureData.message || 'Payment capture failed.');
      }

      // 3. Success! Render receipt & unlock course
      this.closePayPalModal();
      this.showReceiptModal(captureData.receipt, course);
      this.showToast(`Enrolled in "${course.title}" successfully!`, 'success');

      if (!this.state.user.enrolledCourses) this.state.user.enrolledCourses = [];
      this.state.user.enrolledCourses.push(course.id);

    } catch (err) {
      this.showToast(err.message, 'error');
    } finally {
      if (payBtn) {
        payBtn.disabled = false;
        payBtn.textContent = 'Complete PayPal Checkout';
      }
    }
  },

  closePayPalModal() {
    const modal = document.getElementById('paypalModal');
    if (modal) modal.classList.remove('active');
    this.state.selectedCourse = null;
  },

  showReceiptModal(receipt, course) {
    const modal = document.getElementById('receiptModal');
    const body = document.getElementById('receiptBody');
    if (!modal || !body) return;

    body.innerHTML = `
      <div style="text-align:center; margin-bottom:1.5rem;">
        <div style="font-size:3rem; color:var(--accent-green); margin-bottom:0.5rem;">✓</div>
        <h3 style="font-size:1.4rem;">Payment Verified</h3>
        <p style="color:var(--text-secondary); font-size:0.9rem;">PayPal Transaction Completed</p>
      </div>
      <div style="background:var(--bg-tertiary); padding:1rem; border-radius:var(--radius-sm); font-size:0.9rem; line-height:1.8;">
        <div><strong>Course:</strong> ${this.escapeHTML(receipt.item)}</div>
        <div><strong>Amount Paid:</strong> ${this.escapeHTML(receipt.amount)}</div>
        <div><strong>Student:</strong> ${this.escapeHTML(receipt.buyer)}</div>
        <div><strong>Date:</strong> ${new Date(receipt.date).toLocaleString()}</div>
      </div>
      <div style="margin-top:1.5rem; display:flex; gap:0.5rem;">
        <a href="/courses/${encodeURIComponent(course.file || course.slug + '.html')}" class="btn btn-primary" style="flex:1;">Access Course Material</a>
      </div>
    `;
    modal.classList.add('active');
  },

  bindEvents() {
    // PayPal Confirm Button
    document.getElementById('confirmPaypalBtn')?.addEventListener('click', () => this.executePayPalPayment());
    document.getElementById('closePaypalModalBtn')?.addEventListener('click', () => this.closePayPalModal());
    document.getElementById('closeReceiptModalBtn')?.addEventListener('click', () => {
      document.getElementById('receiptModal')?.classList.remove('active');
    });

    // Search input
    const searchInput = document.getElementById('courseSearchInput');
    if (searchInput) {
      let timeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          const val = e.target.value.trim();
          this.fetchCourses(val ? `?search=${encodeURIComponent(val)}` : '');
        }, 250);
      });
    }

    // Category pills
    document.querySelectorAll('.filter-pill').forEach(pill => {
      pill.addEventListener('click', (e) => {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const cat = e.currentTarget.getAttribute('data-category');
        this.fetchCourses(cat === 'all' ? '' : `?category=${encodeURIComponent(cat)}`);
      });
    });
  },

  logout(redirect = true) {
    localStorage.removeItem('neuralab_jwt');
    localStorage.removeItem('neuralab_csrf');
    this.state.token = null;
    this.state.user = null;
    this.state.csrfToken = null;
    this.setupAuthUI();
    this.showToast('You have been logged out.', 'info');
    if (redirect && window.location.pathname.includes('admin')) {
      window.location.href = '/login.html';
    }
  },

  showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
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

window.addEventListener('DOMContentLoaded', () => App.init());
