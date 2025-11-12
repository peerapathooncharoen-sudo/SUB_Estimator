const AUTH_KEY = 'sub_app_user_v1';
const USER_DB_KEY = 'sub_app_users_v1';

const PASSCODE = '123188'; // เปลี่ยนรหัสผ่านระบบได้ที่นี่

// [CHANGE DEFAULT] ไม่บังคับ passcode เสมอ (ยังใช้ได้ปกติเมื่อรันผ่าน http/https)
const REQUIRE_PASSCODE_ALWAYS = false;
// [ADD] อนุญาต session เก่า (username อะไรก็ได้) หากตั้ง true (ตั้ง false = เข้มงวด)
const ALLOW_LEGACY_SESSION = false;
// [ADD] เปิด/ปิด debug log
const AUTH_DEBUG = true;

// [ADD] unified storage helper: ใช้ sessionStorage และ fallback ไป localStorage (รองรับ file://)
const STORAGE = {
  set(key, val) {
    try { sessionStorage.setItem(key, val); } catch (e) { if (AUTH_DEBUG) console.warn('[auth] sessionStorage.set failed', e); }
    try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
  },
  get(key) {
    try {
      const v = sessionStorage.getItem(key);
      if (v != null) return v;
    } catch (e) { /* ignore */ }
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  remove(key) {
    try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
  }
};

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
    STORAGE.set(AUTH_KEY, JSON.stringify(payload));
    if (AUTH_DEBUG) console.log('[auth] setSession OK', payload);
  } catch (e) { if (AUTH_DEBUG) console.warn('[auth] setSession failed', e); }
}
function getSession() {
  try {
    const raw = STORAGE.get(AUTH_KEY);
    const obj = raw ? JSON.parse(raw) : null;
    if (AUTH_DEBUG) console.log('[auth] getSession =>', obj);
    return obj;
  } catch (e) { if (AUTH_DEBUG) console.warn('[auth] getSession failed', e); return null; }
}
function clearSession() {
  try {
    STORAGE.remove(AUTH_KEY);
    if (AUTH_DEBUG) console.log('[auth] clearSession done');
  } catch (e) { /* ignore */ }
}

// [ADD] helper ตรวจว่า session ปัจจุบันเป็นของ passcode
function isPasscodeSession() {
  const s = getSession();
  const ok = !!(s && s.username === 'passcode');
  if (AUTH_DEBUG) console.log('[auth] isPasscodeSession =', ok, 'session=', s);
  return ok;
}

// [MODIFY] ensureAuth: bypass เมื่อรันแบบ file:// (เปิดไฟล์ตรงได้ทันที)
function ensureAuth(redirectTo = 'login.html') {
  const proto = (typeof location !== 'undefined' && location.protocol) || '';
  // รันแบบเปิดไฟล์โดยตรง: อนุญาตให้ใช้งานทันที (ไม่บังคับไปหน้า passcode)
  if (proto === 'file:') {
    if (AUTH_DEBUG) console.log('[auth] file:// detected -> bypass auth');
    return true;
  }

  const s = getSession();
  if (AUTH_DEBUG) console.log('[auth] ensureAuth start session=', s);

  if (REQUIRE_PASSCODE_ALWAYS && !isPasscodeSession()) {
    if (ALLOW_LEGACY_SESSION && s && s.username) {
      if (AUTH_DEBUG) console.log('[auth] legacy session allowed ->', s.username);
      return true;
    }
    if (AUTH_DEBUG) console.warn('[auth] no valid passcode session -> redirect');
    // กันลูป redirect หากอยู่ที่หน้า login อยู่แล้ว
    try {
      const here = (location.pathname || '').toLowerCase();
      if (!here.endsWith('/login.html') && !here.endsWith('\\login.html')) {
        location.href = redirectTo;
      }
    } catch (_) {}
    return false;
  }

  if (!s || !s.username) {
    if (AUTH_DEBUG) console.warn('[auth] no session -> redirect');
    try {
      const here = (location.pathname || '').toLowerCase();
      if (!here.endsWith('/login.html') && !here.endsWith('\\login.html')) {
        location.href = redirectTo;
      }
    } catch (_) {}
    return false;
  }

  if (AUTH_DEBUG) console.log('[auth] ensureAuth ok');
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
window.isPasscodeSession = isPasscodeSession;

