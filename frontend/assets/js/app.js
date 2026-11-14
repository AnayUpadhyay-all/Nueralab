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

  getBasePath() {
    return window.location.pathname.includes('/courses/') ? '../' : './';
  },

  getCoursesPath() {
    return window.location.pathname.includes('/courses/') ? '' : 'courses/';
  },

  async init() {
    this.setupAuthUI();
    await this.fetchCurrentUser();
    await this.fetchCourses();
    this.bindEvents();

    // Check if on a course syllabus page with gated content container
    const gatedContainer = document.getElementById('gatedCourseContent');
    if (gatedContainer) {
      const courseId = gatedContainer.getAttribute('data-course-id') || 
                       window.location.pathname.split('/').pop().replace('.html', '').replace('courses/', '');
      await this.checkAndLoadCourseContent(courseId);
    }
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
        localStorage.setItem('neuralab_user', JSON.stringify(data.user));
        this.setupAuthUI();
        return;
      } else if (res.status === 401) {
        this.logout(false);
        return;
      }
    } catch (e) {
      console.warn('Could not verify session via API:', e);
    }

    // Static / demo session fallback
    const cached = localStorage.getItem('neuralab_user');
    if (cached) {
      try {
        this.state.user = JSON.parse(cached);
        this.setupAuthUI();
      } catch (e) {}
    }
  },

  setupAuthUI() {
    const navActions = document.getElementById('navActions');
    if (!navActions) return;

    const base = this.getBasePath();
    if (this.state.user) {
      const isAdmin = this.state.user.role === 'admin';
      navActions.innerHTML = `
        <div style="display:flex; align-items:center; gap: 0.75rem;">
          ${isAdmin ? `<a href="${base}admin.html" class="btn btn-secondary btn-sm">Admin Panel</a>` : ''}
          <a href="${base}neural-platform.html" class="btn btn-secondary btn-sm">Dashboard</a>
          <span style="font-size:0.85rem; color:var(--text-secondary);">${this.escapeHTML(this.state.user.name)}</span>
          <button id="logoutBtn" class="btn btn-secondary btn-sm" style="padding:0.35rem 0.65rem;">Sign Out</button>
        </div>
      `;
      document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    } else {
      navActions.innerHTML = `
        <a href="${base}login.html" class="btn btn-secondary btn-sm">Sign In</a>
        <a href="${base}login.html?tab=register" class="btn btn-primary btn-sm">Get Started</a>
      `;
    }
  },

  async fetchCourses(query = '') {
    const grid = document.getElementById('coursesGrid');
    if (grid) {
      grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">Loading curriculum...</div>';
    }

    let loadedCourses = null;

    // 1. Try server API
    try {
      const res = await fetch(`/api/courses${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.courses && data.courses.length > 0) {
          loadedCourses = data.courses;
        }
      }
    } catch (err) {
      // API not reachable
    }

    // 2. Fallback to static courses data (for GitHub Pages & offline previews)
    if (!loadedCourses) {
      try {
        const basePath = this.getBasePath();
        const staticRes = await fetch(`${basePath}assets/data/courses.json`);
        if (staticRes.ok) {
          let list = await staticRes.json();
          if (query) {
            const params = new URLSearchParams(query.replace('?', ''));
            const search = (params.get('search') || '').toLowerCase();
            const category = params.get('category');
            if (search) {
              list = list.filter(c => 
                (c.title && c.title.toLowerCase().includes(search)) || 
                (c.description && c.description.toLowerCase().includes(search)) ||
                (c.category && c.category.toLowerCase().includes(search))
              );
            }
            if (category && category !== 'all') {
              list = list.filter(c => c.category && c.category.toLowerCase() === category.toLowerCase());
            }
          }
          loadedCourses = list;
        }
      } catch (e) {
        console.warn('Could not load static courses fallback:', e);
      }
    }

    if (loadedCourses && loadedCourses.length > 0) {
      this.state.courses = loadedCourses;
      if (grid) this.renderCourses(this.state.courses);
    } else if (grid) {
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

    const coursesPath = this.getCoursesPath();
    grid.innerHTML = courses.map(c => `
      <div class="card" data-id="${c.id}">
        <div class="card-header">
          <span class="card-category">${this.escapeHTML(c.category)}</span>
          <span class="card-level">${this.escapeHTML(c.level || 'Advanced')}</span>
        </div>
        <h3 class="card-title">${this.escapeHTML(c.title)}</h3>
        <p class="card-desc">${this.escapeHTML(c.description)}</p>
        <div class="card-meta">
          <span>${this.escapeHTML(c.duration)} &bull; ${c.modulesCount || 8} modules</span>
          <div class="card-price">$${c.price} USD</div>
        </div>
        <div class="card-actions">
          <a href="${coursesPath}${encodeURIComponent(c.file || c.slug + '.html')}" class="btn btn-secondary btn-sm" style="flex:1;">View syllabus</a>
          <button class="btn btn-primary btn-sm enroll-btn" data-id="${c.id}" style="flex:1;">Enroll</button>
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
    const base = this.getBasePath();
    if (!this.state.user) {
      this.showToast('Please sign in to enroll in this course.', 'error');
      setTimeout(() => { window.location.href = `${base}login.html?redirect=${encodeURIComponent(window.location.pathname)}`; }, 1000);
      return;
    }

    let course = this.state.courses.find(c => c.id === courseId || c.slug === courseId);
    if (!course) {
      try {
        const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}`);
        if (res.ok) {
          const data = await res.json();
          course = data.course;
        }
      } catch (err) {
        console.warn('Could not fetch single course:', err);
      }
    }

    if (!course) {
      this.showToast('Course details could not be found.', 'error');
      return;
    }

    this.state.selectedCourse = course;
    const modal = document.getElementById('paypalModal');
    const modalTitle = document.getElementById('paypalCourseTitle');
    const modalPrice = document.getElementById('paypalCoursePrice');
    const modalDuration = document.getElementById('paypalCourseDuration');

    if (modal && modalTitle && modalPrice) {
      modalTitle.textContent = course.title;
      modalPrice.textContent = `$${course.price} USD`;
      if (modalDuration) modalDuration.textContent = course.duration || 'Self-Paced';
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
      this.showReceiptModal(captureData.receipt, course, captureData.transactionId);
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
    const payBtn = document.getElementById('confirmPaypalBtn');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = 'Complete PayPal Checkout';
    }
  },

  showReceiptModal(receipt, course, transactionId) {
    const modal = document.getElementById('receiptModal');
    const body = document.getElementById('receiptBody');
    if (!modal || !body) return;

    body.innerHTML = `
      <div style="text-align:center; margin-bottom:1.5rem;">
        <h3 style="font-size:1.3rem; font-weight:700; color:#ffffff; margin-bottom:0.25rem;">Payment Verified</h3>
        <p style="color:var(--text-secondary); font-size:0.85rem; font-family:var(--font-mono);">PayPal Transaction Completed</p>
      </div>
      <div style="background:var(--bg-tertiary); border:1px solid var(--border-subtle); padding:1.25rem; border-radius:var(--radius-sm); font-size:0.88rem; line-height:1.9;">
        <div><strong style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.75rem; text-transform:uppercase;">Course:</strong> <span style="color:#ffffff; font-weight:600;">${this.escapeHTML(receipt.item)}</span></div>
        <div><strong style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.75rem; text-transform:uppercase;">Amount Paid:</strong> <span style="color:var(--accent-emerald-light); font-family:var(--font-mono); font-weight:700;">${this.escapeHTML(receipt.amount)}</span></div>
        <div><strong style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.75rem; text-transform:uppercase;">Student:</strong> <span style="color:var(--text-secondary);">${this.escapeHTML(receipt.buyer)}</span></div>
        ${transactionId ? `<div><strong style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.75rem; text-transform:uppercase;">Transaction ID:</strong> <span style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.8rem;">${this.escapeHTML(transactionId)}</span></div>` : ''}
        <div><strong style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.75rem; text-transform:uppercase;">Timestamp:</strong> <span style="color:var(--text-muted); font-family:var(--font-mono); font-size:0.8rem;">${new Date(receipt.date).toLocaleString()}</span></div>
      </div>
      <div style="margin-top:1.5rem; display:flex; gap:0.75rem;">
        <a href="${this.getCoursesPath()}${encodeURIComponent(course.file || course.slug + '.html')}" class="btn btn-primary" style="flex:1;">Access Course Syllabus</a>
        <a href="${this.getBasePath()}neural-platform.html" class="btn btn-secondary" style="flex:1;">View in Dashboard</a>
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

    // Modal Backdrop Click to Close
    document.getElementById('paypalModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'paypalModal') this.closePayPalModal();
    });
    document.getElementById('receiptModal')?.addEventListener('click', (e) => {
      if (e.target.id === 'receiptModal') {
        document.getElementById('receiptModal')?.classList.remove('active');
      }
    });

    // Escape Key to Close Active Modals
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closePayPalModal();
        document.getElementById('receiptModal')?.classList.remove('active');
      }
    });

    // Search input & ⌘K shortcut
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

      // Global ⌘K / Ctrl+K listener
      window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
          e.preventDefault();
          searchInput.focus();
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
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

  async checkAndLoadCourseContent(courseId) {
    const container = document.getElementById('gatedCourseContent');
    if (!container) return;

    if (!this.state.token) {
      container.innerHTML = `
        <div class="card" style="border:1px solid #222226; background:#0d0d10; padding:2rem; text-align:center; margin:2rem 0;">
          <h3 style="font-size:1.15rem; font-weight:700; color:#fff; margin-bottom:0.5rem;">Curriculum Source Code & Lab Materials Locked</h3>
          <p style="color:#a1a1aa; font-size:0.9rem; max-width:580px; margin:0 auto 1.5rem; line-height:1.6;">
            Deep implementation walkthroughs, zero-allocation memory benchmarks, and capstone tests are decrypted after enrollment.
          </p>
          <div style="display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;">
            <a href="${this.getBasePath()}login.html?redirect=${encodeURIComponent(window.location.pathname)}" class="btn btn-secondary btn-sm">Sign In</a>
            <button class="btn btn-primary btn-sm" onclick="App.openPayPalCheckout('${courseId}')">Enroll to Decrypt Track</button>
          </div>
        </div>
      `;
      return;
    }

    try {
      const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}/content`, {
        headers: { 'Authorization': `Bearer ${this.state.token}` }
      });
      const data = await res.json();

      if (res.status === 403 || data.error === 'ENROLLMENT_REQUIRED') {
        container.innerHTML = `
          <div class="card" style="border:1px solid #222226; background:#0d0d10; padding:2rem; text-align:center; margin:2rem 0;">
            <h3 style="font-size:1.15rem; font-weight:700; color:#fff; margin-bottom:0.5rem;">Curriculum Source Code & Lab Materials Locked</h3>
            <p style="color:#a1a1aa; font-size:0.9rem; max-width:580px; margin:0 auto 1.5rem; line-height:1.6;">
              You are signed in as <strong style="color:#fff;">${this.escapeHTML(this.state.user ? this.state.user.email : '')}</strong>, but have not enrolled in this track yet. Complete verified checkout to decrypt full source code, compiler benchmarks, and capstone repositories.
            </p>
            <button class="btn btn-primary btn-sm" onclick="App.openPayPalCheckout('${courseId}')">Enroll with PayPal ($${data.price || 149} USD)</button>
          </div>
        `;
        return;
      }

      if (res.ok && data.content) {
        const c = data.content;
        container.innerHTML = `
          <div style="margin-top:2rem;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; border-bottom:1px solid #222226; padding-bottom:0.75rem;">
              <h2 style="font-size:1.5rem; font-weight:700; color:#fff;">Decrypted Curriculum Materials</h2>
              <span class="card-level" style="color:var(--accent-emerald); border-color:rgba(16,185,129,0.3);">Enrolled & Verified</span>
            </div>
            ${(c.modules || []).map(m => `
              <div class="card" style="margin-bottom:1.25rem;">
                <div style="font-size:0.75rem; font-family:var(--font-mono); color:#71717a; text-transform:uppercase; margin-bottom:0.25rem;">Module 0${m.moduleNumber}</div>
                <h3 style="font-size:1.15rem; color:#fff; margin-bottom:0.5rem;">${this.escapeHTML(m.title)}</h3>
                <p style="color:#a1a1aa; font-size:0.9rem; line-height:1.6; margin-bottom:1rem;">${this.escapeHTML(m.content)}</p>
                <div style="background:#06080d; border:1px solid #222226; border-radius:6px; padding:1rem; margin-bottom:1rem; font-family:var(--font-mono); font-size:0.82rem; overflow-x:auto;">
                  <pre style="margin:0; color:#34d399;"><code>${this.escapeHTML(m.codeSnippet)}</code></pre>
                </div>
                <div style="font-size:0.82rem; color:#71717a;">
                  <strong style="color:#fff;">Lab Exercise:</strong> ${this.escapeHTML(m.labExercise)}
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (e) {
      console.warn('Could not load course content:', e);
    }
  },

  logout(redirect = true) {
    localStorage.removeItem('neuralab_jwt');
    localStorage.removeItem('neuralab_csrf');
    localStorage.removeItem('neuralab_user');
    this.state.token = null;
    this.state.user = null;
    this.state.csrfToken = null;
    this.setupAuthUI();
    this.showToast('You have been logged out.', 'info');
    if (redirect && window.location.pathname.includes('admin')) {
      window.location.href = `${this.getBasePath()}login.html`;
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
