const AUTH_KEY = 'sub_app_user_v1';
const USER_DB_KEY = 'sub_app_users_v1';

// hash password (SHA-256 -> hex)
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(String(password || ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function getUsers() {
  try { return JSON.parse(localStorage.getItem(USER_DB_KEY) || '[]'); }
  catch (e) { return []; }
}
function saveUsers(list) {
  localStorage.setItem(USER_DB_KEY, JSON.stringify(list || []));
}

// register a new user (username unique)
async function registerUser(username, password) {
  username = String(username || '').trim();
  if (!username) return { success: false, error: 'username required' };
  if (!password) return { success: false, error: 'password required' };

  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { success: false, error: 'username exists' };
  }
  const hash = await hashPassword(password);
  const user = {
    username,
    hash,
    createdAt: Date.now()
  };
  users.unshift(user);
  saveUsers(users);
  return { success: true, user };
}

// verify credentials: returns { success: true, user } or { success:false, error }
async function verifyCredentials(username, password) {
  username = String(username || '').trim();
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) return { success: false, error: 'user not found' };
  const hash = await hashPassword(password);
  if (hash !== user.hash) return { success: false, error: 'invalid password' };
  return { success: true, user };
}

// session helpers (store username in sessionStorage so it clears on tab close)
function setSession(username) {
  const payload = { username: String(username || ''), ts: Date.now() };
  try {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(payload));
  } catch (e) { /* ignore storage errors */ }
}
function getSession() {
  try { return JSON.parse(sessionStorage.getItem(AUTH_KEY) || 'null'); }
  catch (e) { return null; }
}
function clearSession() {
  try { sessionStorage.removeItem(AUTH_KEY); } catch (e) {}
}
function ensureAuth(redirectTo = 'login.html') {
  const s = getSession();
  if (!s || !s.username) {
    if (!location.href.includes(redirectTo)) location.href = redirectTo;
    return false;
  }
  return true;
}

// Expose minimal auth functions globally
window.hashPassword = hashPassword;
window.getUsers = getUsers;
window.saveUsers = saveUsers;
window.registerUser = registerUser;
window.verifyCredentials = verifyCredentials;
window.setSession = setSession;
window.getSession = getSession;
window.clearSession = clearSession;
window.ensureAuth = ensureAuth;

// Configuration: do NOT auto-create a default admin in distributable packages.
// Set AUTO_CREATE_DEFAULT_ADMIN = true only for local development if you want the old behavior.
// enable auto-create ONLY for local development (file:// or localhost)
const AUTO_CREATE_DEFAULT_ADMIN = (typeof window !== 'undefined') && (
  location.protocol === 'file:' ||
  location.hostname === 'localhost' ||
  location.hostname === '127.0.0.1'
);

// ensure there is at least one admin/user for first-time use - safer default: do not auto-create
(async function ensureDefaultAdmin(){
  const users = getUsers();
  if (!users || users.length === 0) {
    if (AUTO_CREATE_DEFAULT_ADMIN) {
      // safe default for development only
      await registerUser('admin','admin');
      console.warn('Auto-created default admin (admin/admin) for local development only. Change password immediately.');
    } else {
      console.warn('No users found. Auto-creation of default admin is disabled. To create the first user, open the browser console and run:');
      console.warn('  await registerUser("your-username","your-password");');
      console.warn('  setSession("your-username");');
      window.createInitialAdmin = async function(username, password) {
        username = String(username || '').trim();
        password = String(password || '').trim();
        const existing = getUsers();
        if (existing && existing.length > 0) return { success: false, error: 'users already exist' };
        if (!username || !password) return { success: false, error: 'username and password required' };
        const res = await registerUser(username, password);
        if (res && res.success) {
          setSession(username);
          console.log('Initial user created and session set for', username);
        }
        return res;
      };
    }
  }
})();

