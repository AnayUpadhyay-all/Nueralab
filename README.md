# ⚡ Neuralab — Deep Tech & Systems Engineering Academy

> **"Beyond 'Vibe Coding': Reclaiming Depth, Rigor, and First-Principles Mastery."**  
> **Founded & Architected by Anay Upadhyay**

---

## 🌟 The Philosophy & Founder's Journey

### Why Neuralab Exists
Modern software development has become dangerously superficial. The rise of superficial tutorial channels and "vibe coding"—blindly copying frameworks and relying on LLM autocomplete hallucinations without understanding runtime mechanics—leaves engineers defenseless when confronted with:
- V8 garbage collection latency pauses freezing main event loops
- Lock-free memory synchronization bugs and cache-line false sharing
- LSM-tree write-ahead log I/O saturation during peak load
- Distributed consensus deadlocks and network split-brain scenarios

**Anay Upadhyay** built **Neuralab** to bridge this gap. Transitioning from high-level web interfaces into low-level systems, kernel observability, and neural architectures, Anay realized that true engineering excellence requires understanding the full machine stack: from CPU silicon registers and memory pages up to distributed consensus and tensor matrix calculus.

Neuralab provides an uncompromising, first-principles curriculum where developers build systems from scratch with zero hand-waving.

---

## 🛡️ Zero-Trust Security Architecture

Neuralab's core server is intentionally engineered with **Zero External Third-Party Runtime Dependencies**, completely eliminating supply-chain vulnerabilities, NPM prototype pollution, and malicious package attacks.

1. **Authentication & Authorization**:
   - Cryptographic PBKDF2 password hashing (100,000 rounds, SHA-512, unique 32-byte salt).
   - Constant-time verification (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.
   - HMAC-SHA256 session tokens with strict expiration and issuer verification.
   - Role-Based Access Control (RBAC) isolating administrative privileges (`admin` vs `student`).

2. **Cross-Site Request Forgery (CSRF) Protection**:
   - Cryptographically signed CSRF tokens validated on all state-changing endpoints (`POST`, `PUT`, `DELETE`).

3. **Rate Limiting (Sliding Window)**:
   - Dedicated token bucket rate limiters protecting against brute-force attacks on auth routes (max 10 requests / 5 min) and API abuse (max 150 req / min).

4. **OWASP Security Headers**:
   - `Content-Security-Policy`: Strictly allows authorized script, styles, fonts, and PayPal frames.
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: SAMEORIGIN`
   - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Permissions-Policy: camera=(), microphone=(), geolocation=()`

5. **Path Traversal Immunity**:
   - Strict `path.resolve` bounds checking prevents directory traversal attacks (`/../../etc/passwd` returns 403).

6. **Immutable Cryptographic Audit Logging**:
   - All critical events (course creations, deletions, admin logins, PayPal transactions) are immutably logged with client IP and timestamps in `audit_logs.json`.

---

## 💳 PayPal Orders v2 Engine

Client-side price manipulation is strictly prevented through **Server-Side Price Verification**:
- `POST /api/payments/paypal/create-order`: Client submits only the `courseId`. The server looks up the authoritative price from `courses.json` and creates a verified order.
- `POST /api/payments/paypal/capture-order`: Captures payment on PayPal servers, records the order in `orders.json`, increments student enrollments, and grants access.
- `POST /api/payments/paypal/webhook`: Validates incoming webhook notifications with cryptographic signature checks.

---

## 🎨 Interactive 3D Synaptic Constellation Engine

The platform features an interactive 3D particle constellation:
- **Perspective 3D Projection**: Pure mathematical vector rotation and depth sorting (z-buffering).
- **Interactive Parallax**: Dynamic 3D camera orientation reacts smoothly to cursor position.
- **Synaptic Pulses**: Realistic energy signals travel along 3D neural edges between curriculum domains.
- **3D Raycaster**: Hovering near nodes highlights interconnected systems tracks and displays domain names.

---

## 📚 Complete Curriculum Tracks (18 Courses)

| Track Name | Domain | Level | Price |
| :--- | :--- | :--- | :--- |
| **C++ Systems & Low-Level Foundations** | Systems Programming | Advanced | $149 |
| **Rust Core: Memory Safety & Concurrency** | Systems Programming | Advanced | $169 |
| **WebCore: Browser Engine Internals** | Web Architecture | Intermediate | $129 |
| **High Performance Browser Networking** | Networking & Protocols | Advanced | $159 |
| **Distributed Databases & Storage Engines** | Distributed Systems | Expert | $189 |
| **V8 Engine Internals & JS Runtimes** | Compilers & Runtimes | Advanced | $139 |
| **Modern Framework Architecture (Signals to VDOM)** | Frontend Architecture | Intermediate | $119 |
| **High-Scale Distributed APIs & Microservices** | Backend Architecture | Advanced | $149 |
| **Bare-Metal Embedded Systems & RTOS** | Hardware & Embedded | Advanced | $179 |
| **Enterprise Systems & Cloud-Native** | Enterprise Software | Advanced | $159 |
| **Neural Foundations & Transformers** | Artificial Intelligence | Expert | $199 |
| **Interactive Neural Computation & WebGPU Lab** | Artificial Intelligence | Intermediate | $129 |
| **High-Performance Python (No-GIL)** | Data Engineering | Intermediate | $129 |
| **GPU-Accelerated CSS & Houdini** | Web Architecture | Intermediate | $99 |
| **Quantum Computing & Qubit Algorithms** | Quantum & Physics | Expert | $219 |
| **Binary Exploitation & Systems Security** | Cyber Security | Expert | $199 |
| **High-Scale Site Reliability & Linux eBPF** | Infrastructure & SRE | Advanced | $179 |
| **Deep Consensus: Raft, Paxos & PBFT** | Distributed Systems | Expert | $209 |

---

## 🗂️ Project Structure

```
c_7666da5dbeae0823/
├── backend/
│   ├── data/
│   │   ├── courses.json         # Authoritative course database
│   │   ├── users.json           # User profiles & hashed credentials
│   │   ├── orders.json          # Completed transactions & enrollments
│   │   └── audit_logs.json      # Cryptographic security audit log
│   ├── tests/
│   │   └── security_test.js     # Automated OWASP & RBAC test suite
│   ├── package.json
│   └── server.js                # Zero-dependency, high-security server
├── frontend/
│   ├── assets/
│   │   ├── css/
│   │   │   └── neuralab.css     # Cyberpunk / Deep Tech design system
│   │   └── js/
│   │       ├── three-neural.js  # 3D Neural Constellation engine
│   │       ├── app.js           # Client app, PayPal modal, auth
│   │       └── admin.js         # Admin dashboard, CSRF, course CRUD
│   ├── courses/                 # 18 rich course syllabus pages
│   ├── index.html               # Main landing page with 3D canvas
│   ├── admin.html               # Admin control center
│   ├── login.html               # Auth portal (login & registration)
│   ├── code-editor.html         # Interactive multi-language IDE
│   ├── ai-lab.html              # Tensor & Neural Network playground
│   ├── neural-platform.html     # Student dashboard & course tracker
│   ├── manifest.json            # PWA manifest
│   └── sw.js                    # Service worker offline caching
└── README.md
```

---

## 🚀 Running the Platform

1. **Start the Production Server**:
   ```bash
   cd backend
   node server.js
   ```
2. **Access the Portals**:
   - Public Platform: `http://localhost:5504/`
   - Admin Control Center: `http://localhost:5504/admin.html`
   - Code Studio: `http://localhost:5504/code-editor.html`
   - Neural Lab: `http://localhost:5504/ai-lab.html`

3. **Default Credentials**:
   - **Admin**: `admin@neuralab.dev` / `NeuralabAdmin@2026!`
   - **Student Demo**: `student@neuralab.dev` / `Student@2026!`

4. **Run Security Audit Suite**:
   ```bash
   node backend/tests/security_test.js
   ```
