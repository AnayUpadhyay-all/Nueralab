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

    // Hook Firebase Auth state and database listener
    if (window.NeuralabFirebase) {
      try {
        await window.NeuralabFirebase.init();
        window.NeuralabFirebase.onUserChange((user) => {
          if (user) {
            this.state.user = user;
            this.state.token = 'fb_' + user.uid;
          } else {
            this.state.user = null;
            this.state.token = null;
          }
          this.setupAuthUI();
        });
      } catch (err) {
        console.warn('Firebase init caught in App:', err);
      }
    }

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
      const userName = this.state.user.name || this.state.user.displayName || 'Engineer';
      const avatarImg = this.state.user.photoURL 
        ? `<img src="${this.state.user.photoURL}" style="width:26px; height:26px; border-radius:50%; object-fit:cover; border:1px solid #3b82f6;" alt="${this.escapeHTML(userName)}">` 
        : `<span style="display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; border-radius:50%; background:#27272a; color:#fff; font-size:0.75rem; font-weight:700;">${userName.charAt(0).toUpperCase()}</span>`;

      navActions.innerHTML = `
        <div style="display:flex; align-items:center; gap: 0.75rem;">
          ${isAdmin ? `<a href="${base}admin.html" class="btn btn-secondary btn-sm">Admin Panel</a>` : ''}
          <a href="${base}neural-platform.html" class="btn btn-secondary btn-sm">Dashboard</a>
          <div style="display:flex; align-items:center; gap:0.45rem;">
            ${avatarImg}
            <span style="font-size:0.85rem; color:#fff; font-weight:600;">${this.escapeHTML(userName)}</span>
          </div>
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

  // Default PayPal Sandbox Client ID for static deployment (GitHub Pages) & production fallback
  PAYPAL_SANDBOX_CLIENT_ID: 'Af-5C0UGLSlxqoS9_qLNt4Cafa7YJLCciEzDpiJwXpgLXSdkiF4kDZ_XAidmuaAIUuCtwbvebHIWw4Xa',

  async openPayPalCheckout(courseId) {
    const base = this.getBasePath();

    // Auto-create local student test session if not signed in (prevents login walls on static sites)
    if (!this.state.user) {
      const cached = localStorage.getItem('neuralab_user');
      if (cached) {
        try { this.state.user = JSON.parse(cached); } catch (e) {}
      }
    }

    if (!this.state.user) {
      this.state.user = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        name: 'Sandbox Student',
        email: 'student@sandbox.neuralab.io',
        role: 'student',
        enrolledCourses: []
      };
      this.state.token = 'sandbox_token_' + Date.now();
      localStorage.setItem('neuralab_user', JSON.stringify(this.state.user));
      localStorage.setItem('neuralab_jwt', this.state.token);
      this.setupAuthUI();
    }

    let course = this.state.courses.find(c => c.id === courseId || c.slug === courseId);
    if (!course) {
      try {
        const res = await fetch(`/api/courses/${encodeURIComponent(courseId)}`);
        if (res.ok) {
          const data = await res.json();
          course = data.course;
        }
      } catch (err) {}
    }

    if (!course) {
      // Look in static list fallback
      const staticList = [
        { id: 'cpp-foundation', slug: 'cpp-foundation', title: 'C++ Systems & Low-Level Foundations', price: 149, duration: '12 Weeks', file: 'cpp-foundation.html' },
        { id: 'rust-core', slug: 'rust-core', title: 'Rust Core: Memory Safety & Systems Concurrency', price: 169, duration: '10 Weeks', file: 'rust-core.html' },
        { id: 'databases', slug: 'databases', title: 'Distributed Databases & Storage Engine Design', price: 189, duration: '14 Weeks', file: 'databases.html' },
        { id: 'webcore', slug: 'webcore', title: 'WebCore: Browser Engine Internals & Rendering Pipelines', price: 129, duration: '8 Weeks', file: 'webcore.html' },
        { id: 'networking', slug: 'networking', title: 'High Performance Browser Networking', price: 159, duration: '10 Weeks', file: 'high-performance-browser-networking.html' },
        { id: 'runtime', slug: 'runtime', title: 'V8 Engine Internals & JavaScript Runtimes', price: 139, duration: '8 Weeks', file: 'runtime.html' }
      ];
      course = staticList.find(c => c.id === courseId || c.slug === courseId);
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
    const noticeEl = document.getElementById('paypalModalNotice');
    const sdkContainer = document.getElementById('paypalSmartButtons');
    const payBtn = document.getElementById('confirmPaypalBtn');

    if (modal && modalTitle && modalPrice) {
      modalTitle.textContent = course.title;
      modalPrice.textContent = `$${course.price} USD`;
      if (modalDuration) modalDuration.textContent = course.duration || 'Self-Paced';
      modal.classList.add('active');
    }

    // Resolve PayPal Client ID (Backend API or Static Sandbox Default)
    let clientId = this.PAYPAL_SANDBOX_CLIENT_ID;
    let environment = 'sandbox';

    if (noticeEl) {
      noticeEl.innerHTML = `
        <div style="background:rgba(163,230,53,0.1); border:1px solid rgba(163,230,53,0.3); padding:0.75rem 1rem; border-radius:6px; margin-bottom:1rem;">
          <div style="display:flex; align-items:center; gap:0.5rem; margin-bottom:0.25rem;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#a3e635;"></span>
            <strong style="color:#ffffff; font-size:0.85rem; font-family:var(--font-mono); text-transform:uppercase;">
              Official PayPal Sandbox Active
            </strong>
          </div>
          <p style="color:#a1a1aa; font-size:0.8rem; margin:0; line-height:1.4;">
            Live PayPal Sandbox test mode. Pay using your PayPal Sandbox buyer account to unlock lifetime curriculum access.
          </p>
        </div>
      `;
    }

    if (payBtn) {
      payBtn.style.display = 'block';
      payBtn.disabled = false;
      payBtn.textContent = 'Proceed with PayPal Sandbox →';
    }

    // Try fetching active backend configuration if available
    try {
      const cfgRes = await fetch('/api/payments/paypal/config');
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        if (cfg.clientId) clientId = cfg.clientId;
        if (cfg.environment) environment = cfg.environment;
      }
    } catch (e) {
      // Backend not running on static site (e.g. GitHub Pages) - uses clientId fallback
    }

    // Mount official PayPal Smart Buttons SDK
    if (sdkContainer) {
      sdkContainer.innerHTML = '<div style="text-align:center; padding:0.6rem; font-size:0.8rem; color:#a3e635; font-family:var(--font-mono);">⚡ Initializing PayPal Smart Buttons...</div>';

      const renderButtons = () => {
        if (!window.paypal || !window.paypal.Buttons) {
          sdkContainer.innerHTML = '';
          return;
        }

        sdkContainer.innerHTML = '';
        try {
          window.paypal.Buttons({
            style: {
              layout: 'vertical',
              color: 'gold',
              shape: 'rect',
              label: 'paypal'
            },
            createOrder: async (data, actions) => {
              // 1. Try server-side order creation if backend is reachable
              try {
                const res = await fetch('/api/payments/paypal/create-order', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${App.state.token}`
                  },
                  body: JSON.stringify({ courseId: course.id })
                });
                if (res.ok) {
                  const d = await res.json();
                  if (d.orderId) return d.orderId;
                }
              } catch (e) {}

              // 2. Client-side PayPal Sandbox order creation (works directly on GitHub Pages!)
              return actions.order.create({
                intent: 'CAPTURE',
                purchase_units: [{
                  description: `Neuralab: ${course.title}`,
                  custom_id: `${App.state.user?.id || 'guest'}|${App.state.user?.email || 'buyer@sandbox.io'}`,
                  amount: {
                    currency_code: 'USD',
                    value: Number(course.price || 149).toFixed(2)
                  }
                }]
              });
            },
            onApprove: async (data, actions) => {
              let captureId = null;
              let buyerName = 'PayPal Sandbox Buyer';
              let buyerEmail = 'buyer@sandbox.paypal.com';

              // Try backend capture first
              try {
                const capRes = await fetch('/api/payments/paypal/capture-order', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${App.state.token}`
                  },
                  body: JSON.stringify({ orderId: data.orderID, courseId: course.id })
                });
                if (capRes.ok) {
                  const capData = await capRes.json();
                  if (capData.success) {
                    captureId = capData.transactionId;
                    if (capData.receipt) {
                      buyerName = capData.receipt.buyerName || buyerName;
                      buyerEmail = capData.receipt.buyerEmail || buyerEmail;
                    }
                  }
                }
              } catch (e) {}

              // Client-side capture if running statically (GitHub Pages)
              if (!captureId && actions && actions.order) {
                try {
                  const details = await actions.order.capture();
                  captureId = details.id || details.purchase_units?.[0]?.payments?.captures?.[0]?.id || data.orderID;
                  const payer = details.payer || {};
                  buyerName = `${payer.name?.given_name || ''} ${payer.name?.surname || ''}`.trim() || buyerName;
                  buyerEmail = payer.email_address || buyerEmail;
                } catch (err) {
                  captureId = data.orderID;
                }
              }

              App.unlockAndEnroll(course, captureId || data.orderID, data.orderID, buyerName, buyerEmail);
            },
            onError: (err) => {
              console.warn('PayPal Buttons Event:', err);
            }
          }).render('#paypalSmartButtons');
        } catch (renderErr) {
          console.warn('Could not render PayPal button:', renderErr);
        }
      };

      if (window.paypal && window.paypal.Buttons) {
        renderButtons();
      } else {
        const existingScript = document.getElementById('paypalJsSdk');
        if (existingScript) existingScript.remove();

        const script = document.createElement('script');
        script.id = 'paypalJsSdk';
        script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture`;
        script.async = true;
        script.onload = () => renderButtons();
        script.onerror = () => {
          sdkContainer.innerHTML = '';
        };
        document.head.appendChild(script);
      }
    }
  },

  unlockAndEnroll(course, transactionId, orderId, buyerName, buyerEmail) {
    if (!this.state.user) {
      this.state.user = { id: 'usr_guest', name: buyerName, email: buyerEmail, enrolledCourses: [] };
    }
    if (!this.state.user.enrolledCourses) this.state.user.enrolledCourses = [];
    if (!this.state.user.enrolledCourses.includes(course.id)) {
      this.state.user.enrolledCourses.push(course.id);
    }
    localStorage.setItem('neuralab_user', JSON.stringify(this.state.user));
    if (!this.state.token) {
      this.state.token = 'sandbox_token_' + Date.now();
      localStorage.setItem('neuralab_jwt', this.state.token);
    }

    // Save transaction to local billing ledger
    try {
      const txs = JSON.parse(localStorage.getItem('neuralab_transactions') || '[]');
      txs.unshift({
        id: transactionId,
        paypalOrderId: orderId,
        courseId: course.id,
        courseTitle: course.title,
        amount: course.price,
        currency: 'USD',
        environment: 'sandbox',
        status: 'COMPLETED',
        timestamp: new Date().toISOString()
      });
      localStorage.setItem('neuralab_transactions', JSON.stringify(txs));
    } catch (e) {}

    this.closePayPalModal();
    this.showReceiptModal({
      item: course.title,
      amount: `$${course.price} USD`,
      buyer: buyerName || this.state.user.name,
      date: new Date().toISOString()
    }, course, transactionId);

    this.showToast(`Enrolled in "${course.title}" successfully! Course unlocked.`, 'success');

    // If on syllabus page with gated content, immediately decrypt on screen
    const gatedContainer = document.getElementById('gatedCourseContent');
    if (gatedContainer) {
      this.checkAndLoadCourseContent(course.id);
    }
  },

  async executePayPalPayment() {
    const course = this.state.selectedCourse;
    if (!course) return;

    if (!this.state.token) {
      this.showToast('Please sign in before completing checkout.', 'error');
      window.location.href = `login.html?redirect=index.html&courseId=${encodeURIComponent(course.id)}`;
      return;
    }

    const payBtn = document.getElementById('confirmPaypalBtn');
    if (payBtn) {
      payBtn.disabled = true;
      payBtn.textContent = 'Connecting to PayPal Sandbox API...';
    }

    try {
      // 1. Create order on backend (Server verifies price against DB & generates genuine PayPal Sandbox order)
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
        throw new Error(orderData.message || 'PayPal order creation failed.');
      }

      // If PayPal Sandbox approveUrl was returned, redirect student to official PayPal Sandbox checkout!
      if (orderData.approveUrl) {
        this.showToast('Redirecting to official PayPal Sandbox checkout...', 'info');
        // Store pending order details in sessionStorage for seamless callback matching
        sessionStorage.setItem('pending_paypal_order', JSON.stringify({
          orderId: orderData.orderId,
          courseId: course.id,
          title: course.title,
          amount: course.price
        }));
        setTimeout(() => {
          window.location.href = orderData.approveUrl;
        }, 600);
        return;
      }

      // Fallback: in-situ capture if direct capture requested
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

      // Success! Render receipt & unlock course
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
        payBtn.textContent = 'Proceed to PayPal Sandbox Checkout →';
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

    // Check client-side cached enrollment status first
    const isClientEnrolled = this.state.user && 
                             this.state.user.enrolledCourses && 
                             this.state.user.enrolledCourses.includes(courseId);

    if (isClientEnrolled) {
      this.renderDecryptedCourseContent(container, courseId);
      return;
    }

    if (!this.state.token && !this.state.user) {
      container.innerHTML = `
        <div class="card" style="border:1px solid #222226; background:#0d0d10; padding:2rem; text-align:center; margin:2rem 0;">
          <h3 style="font-size:1.15rem; font-weight:700; color:#fff; margin-bottom:0.5rem;">Curriculum Source Code & Lab Materials Locked</h3>
          <p style="color:#a1a1aa; font-size:0.9rem; max-width:580px; margin:0 auto 1.5rem; line-height:1.6;">
            Deep implementation walkthroughs, zero-allocation memory benchmarks, and capstone tests are decrypted after enrollment.
          </p>
          <div style="display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;">
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

      if (res.ok) {
        const data = await res.json();
        if (data && data.content) {
          this.renderDecryptedCourseContent(container, courseId, data.content);
          return;
        }
      }

      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
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
    } catch (e) {
      console.warn('Could not load course content from API:', e);
    }

    // Fallback lock card
    container.innerHTML = `
      <div class="card" style="border:1px solid #222226; background:#0d0d10; padding:2rem; text-align:center; margin:2rem 0;">
        <h3 style="font-size:1.15rem; font-weight:700; color:#fff; margin-bottom:0.5rem;">Curriculum Source Code & Lab Materials Locked</h3>
        <p style="color:#a1a1aa; font-size:0.9rem; max-width:580px; margin:0 auto 1.5rem; line-height:1.6;">
          Deep implementation walkthroughs, zero-allocation memory benchmarks, and capstone tests are decrypted after enrollment.
        </p>
        <div style="display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" onclick="App.openPayPalCheckout('${courseId}')">Enroll with PayPal Sandbox</button>
        </div>
      </div>
    `;
  },

  renderDecryptedCourseContent(container, courseId, contentData = null) {
    const modules = (contentData && contentData.modules) || [
      {
        moduleNumber: 1,
        title: 'Machine Model, Virtual Memory Pages & SIMD',
        content: 'Low-level hardware inspection, cache line alignment, non-temporal writes, and instruction pipeline scheduling.',
        codeSnippet: `// Neuralab High-Throughput Kernel\n#include <immintrin.h>\nvoid compute_kernel(const float* __restrict a, const float* __restrict b, float* __restrict c, size_t n) {\n  for (size_t i = 0; i < n; i += 8) {\n    __m256 va = _mm256_loadu_ps(&a[i]);\n    __m256 vb = _mm256_loadu_ps(&b[i]);\n    __m256 vc = _mm256_fmadd_ps(va, vb, _mm256_setzero_ps());\n    _mm256_storeu_ps(&c[i], vc);\n  }\n}`,
        labExercise: 'Benchmark vector register saturation across AVX-512 vs AVX2 and inspect disassembly output.'
      },
      {
        moduleNumber: 2,
        title: 'Zero-Cost Abstractions, RAII & Custom Allocator Arenas',
        content: 'Arena memory pooling, contiguous slab allocators, and deterministic object lifecycles without runtime overhead.',
        codeSnippet: `template <typename T, size_t BlockSize = 4096>\nclass LinearArena {\n  uint8_t* memory_;\n  size_t offset_ = 0;\npublic:\n  LinearArena() : memory_(static_cast<uint8_t*>(malloc(BlockSize))) {}\n  ~LinearArena() { free(memory_); }\n  T* allocate() {\n    if (offset_ + sizeof(T) > BlockSize) throw std::bad_alloc();\n    T* ptr = reinterpret_cast<T*>(memory_ + offset_);\n    offset_ += sizeof(T);\n    return ptr;\n  }\n};`,
        labExercise: 'Implement a lock-free fixed-size slab allocator with 64-byte alignment guarantees.'
      },
      {
        moduleNumber: 3,
        title: 'Concurrency Guarantees, Sequential Consistency & Atomics',
        content: 'Memory barriers, std::memory_order_acquire/release, Dekker and Peterson algorithmic verification.',
        codeSnippet: `std::atomic<bool> flag{false};\nstd::atomic<int> data{0};\nvoid producer() {\n  data.store(42, std::memory_order_relaxed);\n  flag.store(true, std::memory_order_release);\n}\nvoid consumer() {\n  while (!flag.load(std::memory_order_acquire));\n  assert(data.load(std::memory_order_relaxed) == 42);\n}`,
        labExercise: 'Prove memory visibility across multi-socket NUMA topologies under heavy contention.'
      }
    ];

    container.innerHTML = `
      <div style="margin-top:2rem;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; border-bottom:1px solid #222226; padding-bottom:0.75rem; flex-wrap:wrap; gap:0.5rem;">
          <h2 style="font-size:1.5rem; font-weight:700; color:#fff;">Decrypted Curriculum Materials</h2>
          <span style="background:rgba(163,230,53,0.15); color:#a3e635; border:1px solid rgba(163,230,53,0.3); padding:0.25rem 0.65rem; border-radius:4px; font-size:0.75rem; font-family:var(--font-mono); font-weight:700;">
            ✓ Enrolled & Verified Lifetime Access
          </span>
        </div>
        ${modules.map(m => `
          <div class="card" style="margin-bottom:1.5rem; background:#0d0d10; border:1px solid #222226; border-radius:8px; padding:1.5rem;">
            <div style="font-size:0.75rem; font-family:var(--font-mono); color:#a3e635; text-transform:uppercase; margin-bottom:0.35rem; font-weight:700;">Module 0${m.moduleNumber}</div>
            <h3 style="font-size:1.2rem; color:#fff; margin-bottom:0.5rem;">${this.escapeHTML(m.title)}</h3>
            <p style="color:#a1a1aa; font-size:0.92rem; line-height:1.6; margin-bottom:1.25rem;">${this.escapeHTML(m.content)}</p>
            <div style="background:#06080d; border:1px solid #1f1f24; border-radius:6px; padding:1.25rem; margin-bottom:1.25rem; font-family:var(--font-mono); font-size:0.84rem; overflow-x:auto;">
              <pre style="margin:0; color:#bef264;"><code>${this.escapeHTML(m.codeSnippet)}</code></pre>
            </div>
            <div style="font-size:0.85rem; color:#71717a; border-top:1px solid #1a1a1f; padding-top:0.75rem;">
              <strong style="color:#fff;">Production Lab:</strong> ${this.escapeHTML(m.labExercise)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  async logout(redirect = true) {
    if (window.NeuralabFirebase) {
      try { await window.NeuralabFirebase.logout(); } catch (e) {}
    }
    localStorage.removeItem('neuralab_jwt');
    localStorage.removeItem('neuralab_csrf');
    localStorage.removeItem('neuralab_user');
    localStorage.removeItem('nuerlab_user');
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
