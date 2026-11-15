/**
 * Neuralab Firebase Authentication & Database Engine
 * Unified Auth: Google Identity, Email/Password, Firestore & Realtime Database Sync
 * Architected by Anay Upadhyay
 */

const NeuralabFirebase = {
  config: {
    apiKey: "AIzaSyByxn4QBU0nvDD-vwbzq3Tm68p46HuU2gQ",
    authDomain: "nueralab.firebaseapp.com",
    projectId: "nueralab",
    storageBucket: "nueralab.firebasestorage.app",
    messagingSenderId: "365514463677",
    appId: "1:365514463677:web:46d424463e6f3dd4105ad4",
    measurementId: "G-Y1LX34NT2G"
  },

  auth: null,
  firestore: null,
  database: null,
  currentUser: null,
  initialized: false,
  _listeners: [],

  async init() {
    if (this.initialized) return;

    // Ensure Firebase compat SDKs are loaded
    await this.ensureSdkLoaded();

    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(this.config);
    }

    this.auth = firebase.auth();
    if (firebase.firestore) {
      try { this.firestore = firebase.firestore(); } catch (e) { console.warn('Firestore init warning:', e); }
    }
    if (firebase.database) {
      try { this.database = firebase.database(); } catch (e) { console.warn('RTDB init warning:', e); }
    }

    this.initialized = true;

    // Listen to Firebase Auth state changes
    this.auth.onAuthStateChanged(async (fbUser) => {
      if (fbUser) {
        // Fetch profile from database (or build from fbUser)
        const profile = await this.syncAndFetchUser(fbUser);
        this.currentUser = profile;
        this.cacheUserLocally(profile);
      } else {
        this.currentUser = null;
        this.clearUserCache();
      }
      this._notifyListeners(this.currentUser);
    });
  },

  async ensureSdkLoaded() {
    if (window.firebase && window.firebase.auth) return;

    const scripts = [
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js',
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js',
      'https://www.gstatic.com/firebasejs/10.7.1/firebase-database-compat.js'
    ];

    for (const src of scripts) {
      if (!document.querySelector(`script[src="${src}"]`)) {
        await new Promise((resolve, reject) => {
          const s = document.createElement('script');
          s.src = src;
          s.onload = resolve;
          s.onerror = () => {
            console.warn(`Could not load ${src}, continuing...`);
            resolve();
          };
          document.head.appendChild(s);
        });
      }
    }
  },

  async syncAndFetchUser(fbUser, extra = {}) {
    const email = fbUser.email || '';
    const displayName = extra.name || fbUser.displayName || email.split('@')[0] || 'Engineer';
    const photoURL = fbUser.photoURL || '';
    const isAdmin = (email.toLowerCase().includes('admin') || email.toLowerCase().includes('anay'));

    const userData = {
      uid: fbUser.uid,
      name: displayName,
      email: email,
      photoURL: photoURL,
      role: isAdmin ? 'admin' : 'student',
      lastLoginAt: new Date().toISOString(),
      ...extra
    };

    // Cache locally immediately so the user can proceed without delay
    this.cacheUserLocally(userData);

    // Save asynchronously to databases without blocking UI redirect
    const savePromise = (async () => {
      // 1. Save to Cloud Firestore
      if (this.firestore) {
        try {
          await Promise.race([
            this.firestore.collection('users').doc(fbUser.uid).set(userData, { merge: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore timeout')), 3000))
          ]);
          console.log('[Firebase] User name saved to Firestore:', userData.name);
        } catch (err) {
          console.warn('[Firebase] Firestore write notice:', err.message);
        }
      }

      // 2. Save to Realtime Database
      if (this.database) {
        try {
          await Promise.race([
            this.database.ref('users/' + fbUser.uid).update(userData),
            new Promise((_, reject) => setTimeout(() => reject(new Error('RTDB timeout')), 3000))
          ]);
          console.log('[Firebase] User name saved to Realtime Database:', userData.name);
        } catch (err) {
          console.warn('[Firebase] Realtime DB write notice:', err.message);
        }
      }
    })();

    // Do not await database writes if they take longer than 800ms
    await Promise.race([
      savePromise,
      new Promise(resolve => setTimeout(resolve, 800))
    ]);

    return userData;
  },

  async loginWithGoogle() {
    await this.init();
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    
    // Attempt popup sign in with fallback awareness
    let result;
    try {
      result = await this.auth.signInWithPopup(provider);
    } catch (popupErr) {
      console.error('[Firebase] signInWithPopup error:', popupErr);
      if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/cancelled-popup-request') {
        console.warn('[Firebase] Popup blocked, attempting signInWithRedirect...');
        await this.auth.signInWithRedirect(provider);
        return null;
      }
      throw popupErr;
    }

    if (!result || !result.user) {
      throw new Error('Google identity provider returned no user credential.');
    }

    const userProfile = await this.syncAndFetchUser(result.user);
    this.currentUser = userProfile;
    this.cacheUserLocally(userProfile);
    return userProfile;
  },

  async loginWithEmail(email, password) {
    await this.init();
    const cred = await this.auth.signInWithEmailAndPassword(email, password);
    const userProfile = await this.syncAndFetchUser(cred.user);
    this.currentUser = userProfile;
    this.cacheUserLocally(userProfile);
    return userProfile;
  },

  async registerWithEmail(name, email, password) {
    await this.init();
    const cred = await this.auth.createUserWithEmailAndPassword(email, password);
    if (cred.user && cred.user.updateProfile) {
      try {
        await cred.user.updateProfile({ displayName: name });
      } catch (e) {}
    }
    const userProfile = await this.syncAndFetchUser(cred.user, { name });
    this.currentUser = userProfile;
    this.cacheUserLocally(userProfile);
    return userProfile;
  },

  async logout() {
    await this.init();
    try {
      await this.auth.signOut();
    } catch (e) {}
    this.clearUserCache();
    this.currentUser = null;
    this._notifyListeners(null);
  },

  cacheUserLocally(user) {
    if (!user) return;
    localStorage.setItem('neuralab_jwt', 'fb_' + user.uid);
    localStorage.setItem('neuralab_csrf', 'csrf_' + Date.now());
    localStorage.setItem('neuralab_user', JSON.stringify(user));
    localStorage.setItem('nuerlab_user', JSON.stringify(user));
  },

  clearUserCache() {
    localStorage.removeItem('neuralab_jwt');
    localStorage.removeItem('neuralab_csrf');
    localStorage.removeItem('neuralab_user');
    localStorage.removeItem('nuerlab_user');
  },

  onUserChange(fn) {
    this._listeners.push(fn);
    if (this.currentUser) fn(this.currentUser);
  },

  _notifyListeners(user) {
    this._listeners.forEach(fn => {
      try { fn(user); } catch (e) { console.error(e); }
    });
  }
};

// Auto-initialize on load
window.NeuralabFirebase = NeuralabFirebase;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => NeuralabFirebase.init());
} else {
  NeuralabFirebase.init();
}
