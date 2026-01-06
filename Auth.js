const AUTH_KEY = 'sub_app_user_v1';
const USER_DB_KEY = 'sub_app_users_v1';

const PASSCODE = '123188'; // เปลี่ยนรหัสผ่านระบบได้ที่นี่

// [CHANGE] บังคับต้องมี passcode เสมอ เพื่อให้ปิดแล้วเปิดใหม่ต้องใส่ใหม่
const REQUIRE_PASSCODE_ALWAYS = true;
// [ADD] อนุญาต session เก่า (username อะไรก็ได้) หากตั้ง true (ตั้ง false = เข้มงวด)
const ALLOW_LEGACY_SESSION = false;
// [ADD] เปิด/ปิด debug log
const AUTH_DEBUG = true;

// [ADD] คีย์รีเลย์ชั่วคราว (สำหรับ file:// ที่ sessionStorage คนละ origin)
// ใช้สำหรับส่งผ่าน session แค่ครั้งแรกจากหน้า login -> index แล้วจะลบทิ้ง
const RELAY_KEY = AUTH_KEY + '_relay';

// [KEEP] unified storage helpers
const STORAGE = {
  set(key, val) {
    try { sessionStorage.setItem(key, val); } catch (e) { if (AUTH_DEBUG) console.warn('[auth] sessionStorage.set failed', e); }
    // หมายเหตุ: ไม่เขียนค่า session หลักลง localStorage ตรง ๆ อีกต่อไป
  },
  get(key) {
    try {
      const v = sessionStorage.getItem(key);
      if (v != null) return v;
    } catch (e) { /* ignore */ }
    return null;
  },
  remove(key) {
    try { sessionStorage.removeItem(key); } catch (e) { /* ignore */ }
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
    try { localStorage.setItem(RELAY_KEY, JSON.stringify(payload)); } catch (_) {}
    if (AUTH_DEBUG) console.log('[auth] setSession OK', payload);
  } catch (e) { if (AUTH_DEBUG) console.warn('[auth] setSession failed', e); }
}

// [MODIFY] อ่าน session จาก sessionStorage ก่อน หากไม่มีให้ดึงจาก relay (localStorage) แล้วย้ายเข้า sessionStorage และลบ relay
function getSession() {
  try {
    let raw = STORAGE.get(AUTH_KEY);
    if (!raw) {
      try {
        const relay = localStorage.getItem(RELAY_KEY);
        if (relay) {
          // ย้าย relay -> session แล้วลบทิ้ง
          sessionStorage.setItem(AUTH_KEY, relay);
          try { localStorage.removeItem(RELAY_KEY); } catch (_) {}
          raw = relay;
          if (AUTH_DEBUG) console.log('[auth] relay used to restore session');
        }
      } catch (_) {}
    }
    const obj = raw ? JSON.parse(raw) : null;
    if (AUTH_DEBUG) console.log('[auth] getSession =>', obj);
    return obj;
  } catch (e) { if (AUTH_DEBUG) console.warn('[auth] getSession failed', e); return null; }
}

// [MODIFY] ลบทั้ง session และ relay
function clearSession() {
  try {
    STORAGE.remove(AUTH_KEY);
    try { localStorage.removeItem(RELAY_KEY); } catch (_) {}
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

// [MODIFY] ensureAuth: ลบ bypass file:// เพื่อให้ทุกกรณีต้องตรวจ session
function ensureAuth(redirectTo = 'login.html') {
  // Always return true to bypass authentication
  if (AUTH_DEBUG) console.log('[auth] ensureAuth bypassed');
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

