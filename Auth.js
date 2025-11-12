const AUTH_KEY = 'sub_app_user_v1';
const USER_DB_KEY = 'sub_app_users_v1';

const PASSCODE = '123188'; // เปลี่ยนรหัสผ่านระบบได้ที่นี่

// hash password (SHA-256 -> hex)
async function hashPassword(password) {
  const enc = new TextEncoder();
  const data = enc.encode(String(password || ''));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hashBuffer);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ปิดระบบหลายผู้ใช้: ให้ getUsers คืน 1 ผู้ใช้หลอก
function getUsers() { return [{ username: 'passcode' }]; }
function saveUsers(list) { /* no-op */ }
// ปิดการสมัครผู้ใช้
async function registerUser() { return { success: false, error: 'registration disabled' }; }
// ใช้ passcode เดียวในการเข้า
async function verifyCredentials(usernameOrUnused, passcodeInput) {
  const ok = String(passcodeInput || '') === PASSCODE;
  return ok ? { success: true, user: { username: 'passcode' } } : { success: false, error: 'invalid passcode' };
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

