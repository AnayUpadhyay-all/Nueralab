# Neuralab Overhaul Specification & Launch Blueprint
**Status:** Saved & Ready for Immediate Launch  
**Architect:** Principal Product Designer & Senior Systems Frontend Engineer  
**Target Repository:** `/home/anay/nuralab` (`https://github.com/AnayUpadhyay-all/Nueralab`)

---

## 1. Aesthetic Identity: Industrial Systems Minimalism
- **Inspiration:** Linear, Oxide Computer, Tailscale, Stripe Press.
- **Palette Architecture:**
  - Backgrounds: Obsidian / Deep Carbon (`#08090d`, `#0e1017`, `#141721`)
  - Hairline Borders: 1px `rgba(255, 255, 255, 0.08)` and `border-zinc-800`
  - Typography: Stark White (`#f8fafc`), Slate Metadata (`#64748b`), Muted Body (`#94a3b8`)
  - Accent Color: Electric Terminal Emerald (`#10b981`) with Razor Mono White (`#ffffff`)
- **Typography:** Inter / Geist (`system-ui, sans-serif`) + JetBrains Mono / Geist Mono for data/metrics.

---

## 2. Protected JS Functional Hooks & Selectors
All backend hooks verified and preserved with zero breaking changes:
* `#neural3dCanvas` (3D Synaptic Constellation Canvas)
* `#navActions` (Auth session & profile injection)
* `#coursesGrid` (Dynamic course card rendering)
* `#courseSearchInput` (`⌘K` debounced search)
* `.filter-pill` with `data-category` attributes (`all`, `Systems Programming`, `Distributed Systems`, `Artificial Intelligence`, `Web Architecture`, `Cyber Security`, `Quantum & Physics`)
* `#paypalModal`, `#paypalCourseTitle`, `#paypalCourseDuration`, `#paypalCoursePrice`, `#paypalButtonContainer`, `#confirmPaypalBtn`, `#closePaypalModalBtn`
* `#receiptModal`, `#receiptBody`, `#closeReceiptModalBtn`
* `<script src="/assets/js/three-neural.js"></script>`
* `<script src="/assets/js/app.js"></script>`

---

## 3. Execution Files Map
1. **Stylesheet:** `/home/anay/nuralab/frontend/assets/css/neuralab.css`
2. **Frontend Template:** `/home/anay/nuralab/frontend/index.html`
3. **Repository Root Mirror:** `/home/anay/nuralab/index.html` (with asset linking verified)
4. **Git Branch & Push:** Commit to `main` and push upstream to `AnayUpadhyay-all/Nueralab`.
