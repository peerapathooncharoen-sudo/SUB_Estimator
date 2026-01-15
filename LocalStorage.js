const STORAGE_KEY = 'sub_estimations_v1';

// load/save raw storage
function loadRawStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('loadRawStorage parse error', e);
    return null;
  }
}

// write raw value to localStorage
function saveRawStorage(value) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error('saveRawStorage error', e);
    return false;
  }
}

// session user
function getCurrentUsername() {
  try {
    const key = (window.AUTH_KEY || 'sub_app_user_v1');
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && s.username ? String(s.username) : null;
  } catch (e) {
    return null;
  }
}

// FIX: ensure storage structure (fill missing array slots correctly)
function ensureStorageObject() {
  const raw = loadRawStorage();
  if (!raw) {
    const obj = { users: {}, currentUser: null };
    saveRawStorage(obj);
    return obj;
  }
  // if legacy array, convert to object with guest key
  if (Array.isArray(raw)) {
    const obj = { users: { guest: raw }, currentUser: null };
    saveRawStorage(obj);
    return obj;
  }
  if (typeof raw === 'object' && raw !== null) {
    if (!raw.users || typeof raw.users !== 'object') raw.users = {};
    if (!('currentUser' in raw)) raw.currentUser = null;
    Object.keys(raw.users).forEach(u => {
      if (!Array.isArray(raw.users[u])) raw.users[u] = [];
    });
    saveRawStorage(raw);
    return raw;
  }
  const obj2 = { users: {}, currentUser: null };
  saveRawStorage(obj2);
  return obj2;
}

// read list for active user
function getSavedListFromStorage() {
  const raw = loadRawStorage();
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'object') {
    const user = getCurrentUsername() || raw.currentUser || 'guest';
    if (!raw.users) return [];
    const list = raw.users[user];
    return Array.isArray(list) ? list : [];
  }
  return [];
}

// FIX: save entry (call renderSavedList after save)
function saveToLocalStorage(entry) {
  try {
    let raw = loadRawStorage();
    // migrate legacy array -> object
    if (Array.isArray(raw) || raw === null) {
      const arr = Array.isArray(raw) ? raw : [];
      const obj = { users: { guest: arr }, currentUser: null };
      raw = obj;
    }
    // now raw is expected to be object
    if (!raw.users || typeof raw.users !== 'object') raw.users = {};

    const user = getCurrentUsername() || raw.currentUser || 'guest';

    // IMPORTANT: ensure the user's slot is an array (coerce malformed values)
    if (!Array.isArray(raw.users[user])) {
      // if there is an object (old/malformed), try to convert to array of values, otherwise reset to []
      if (raw.users[user] && typeof raw.users[user] === 'object') {
        try {
          // if it's an object with numeric keys, convert to array
          const maybeArr = Object.keys(raw.users[user])
            .sort((a,b)=>Number(a)-Number(b))
            .map(k => raw.users[user][k])
            .filter(Boolean);
          raw.users[user] = Array.isArray(maybeArr) ? maybeArr : [];
        } catch (e) {
          raw.users[user] = [];
        }
      } else {
        raw.users[user] = [];
      }
    }

    const resolvedId = entry._id || entry.timestamp || ('id_' + Date.now());
    entry._id = String(resolvedId);
    if (!entry.timestamp) entry.timestamp = Date.now();
    raw.users[user].unshift(entry);
    raw.currentUser = user;
    saveRawStorage(raw);
    // update UI
    try { renderSavedList(); } catch (e) { /* ignore */ }
    console.log('LocalStorage: saved entry for', user, entry._id);
    return true;
  } catch (e) {
    console.error('saveToLocalStorage error', e);
    return false;
  }
}

// delete entry by id (only in current user's list)
function deleteSavedEntry(id) {
  try {
    const raw = ensureStorageObject();
    const user = getCurrentUsername() || raw.currentUser || 'guest';
    if (!raw.users || !raw.users[user]) return false;
    raw.users[user] = raw.users[user].filter(it => String(it && it._id) !== String(id));
    saveRawStorage(raw);
    try { renderSavedList(); } catch (e) {}
    return true;
  } catch (e) {
    console.error('deleteSavedEntry error', e);
    return false;
  }
}

// find by id (in current user's list)
function findSavedById(id) {
  const list = getSavedListFromStorage();
  return list.find(it => String(it && it._id) === String(id));
}

// render list UI (same buttons: ดู / โหลด / ลบ)
function renderSavedList() {
  const container = document.getElementById('saved-list');
  if (!container) return;
  const list = getSavedListFromStorage();
  if (!list || list.length === 0) {
    container.innerHTML = '<div style="color:#666">ยังไม่มีข้อมูลที่บันทึกไว้</div>';
    return;
  }
  container.innerHTML = list.map(it => {
    const title = (it.wa || '-') + ' | ' + (it.dateOnly || '') + ' | ยอด:' + (it.totalPrice || it.unitPrice || '0.00');
    const safeTitle = escapeHtml(title);
    const idRaw = String(it._id || '');
    const idForHandler = idRaw.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `<div style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0">
      <div style="flex:1;font-size:13px">${safeTitle}</div>
      <div style="display:flex;gap:6px">
        <button type="button" onclick="openSaved('${idForHandler}')">ดู</button>
        <button type="button" onclick="loadSavedToForm('${idForHandler}')">โหลดเข้าแบบฟอร์ม</button>
        <button type="button" onclick="deleteSavedEntry('${idForHandler}')">ลบ</button>
      </div>
    </div>`;
  }).join('');
}

// preview renderer (kept similar to previous)
function renderSavedPreview(saved) {
  const out = document.getElementById('saved-output');
  if (!out) return;

  // use Index.html's renderItemsTable if present, otherwise provide fallback
  const renderItems = (typeof window.renderItemsTable === 'function')
    ? window.renderItemsTable
    : function(items){
      if (!items || items.length === 0) return '<div style="color:#666">ไม่มีรายการ</div>';
      const rows = items.map(r => `<tr>
        <td style="padding:6px;border:1px solid #ddd">${escapeHtml(r.no)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right">${escapeHtml(r.qty)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right">${escapeHtml(r.price)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:left;white-space:nowrap;overflow:visible">${escapeHtml(r.desc)}</td>
        <td style="padding:6px;border:1px solid #ddd;text-align:right">${escapeHtml(r.total)}</td>
      </tr>`).join('');
      return `<table class="pdf-items">
          <colgroup>
            <col style="width:7%">
            <col style="width:9%">
            <col style="width:11%">
            <col style="width:62%">
            <col style="width:12%">
          </colgroup>
          <thead>
        <tr>
          <th style="padding:6px;border:1px solid #ddd;background:#f6f6f6">No</th>
          <th style="padding:6px;border:1px solid #ddd;background:#f6f6f6">Qty</th>
          <th style="padding:6px;border:1px solid #ddd;background:#f6f6f6">Price</th>
          <th style="padding:6px;border:1px solid #ddd;background:#f6f6f6">Description</th>
          <th style="padding:6px;border:1px solid #ddd;background:#f6f6f6">Total</th>
        </tr>
      </thead><tbody>${rows}</tbody></table>`;
    };

  // [ADD] helpers + sums for Power/Control totals
  const money = (n) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
  const toNum = (s) => parseFloat(String(s || '').replace(/,/g, '')) || 0;
  const sumItems = (items) => (items || []).reduce((acc, r) => {
    if (!r) return acc;
    const t = r.total != null ? toNum(r.total) : (toNum(r.qty) * toNum(r.price));
    return acc + (t || 0);
  }, 0);
  const powerSum = sumItems(saved.power);
  const controlSum = sumItems(saved.control);

  // urgent saved value (separate)
  const urgentNum = (saved && saved.controlUrgentPriceNumeric !== undefined && saved.controlUrgentPriceNumeric !== null)
    ? Number(saved.controlUrgentPriceNumeric)
    : (saved && saved.controlUrgentPrice ? toNum(saved.controlUrgentPrice) : 0);
  const urgentDesc = saved && saved.controlUrgentDesc ? saved.controlUrgentDesc : '';

  // totals including urgent (per set)
  const totalPerSet = powerSum + controlSum + (urgentNum || 0);
  const sets = (saved.totalSet !== undefined && saved.totalSet !== null) ? Number(saved.totalSet) || 1 : 1;
  const totalAll = totalPerSet * sets;

  const html = `
    <style>
      /* compact symmetric gutter: 4mm top/bottom, 3mm left/right */
      .pdf-page { display:inline-block; width:297mm; min-width:297mm; height:auto; box-sizing:border-box; padding:4mm 3mm; margin:0; background:#fff; color:#111; font-size:11px; font-family:"Tahoma","Arial","Helvetica",sans-serif; line-height:1.05; }

      /* headings slightly smaller to save vertical space */
      .pdf-page h2 { font-size:16px; margin:2px 0 5px; font-weight:700; }
      .pdf-page h3 { font-size:12px; margin:4px 0 3px; font-weight:600; }

      .pdf-page .items-table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:10.5px; }
      /* reduced vertical padding for denser rows */
      .pdf-page .items-table th, .pdf-page .items-table td { padding:6px 5px; vertical-align:middle; }

      /* layout for side-by-side Power (left) / Control (right) for preview and export */
      .pdf-page .pc-row { display:flex; gap:12px; flex-wrap:nowrap; align-items:flex-start; }
      .pdf-page .pc-col {
        box-sizing: border-box;
        flex: 0 0 50%;       /* two equal columns */
        max-width: 50%;
        padding: 0 4px;      /* smaller inner gutter between columns */
      }
      /* ensure tables fill their column */
      .pdf-page .pc-col .pdf-items,
      .pdf-page .pc-col .items-table { width: 100%; box-sizing: border-box; }

      /* fallback: on narrow widths, stack columns */
      @media (max-width: 900px) {
        .pdf-page .pc-row { flex-wrap:wrap; }
        .pdf-page .pc-col { flex: 1 1 100%; max-width: 100%; padding: 0; }
      }

      /* lighter print-friendly borders */
      .pdf-items th,
      .pdf-items td {
        border: 0.12mm solid #444 !important;
        padding: 5px 5px;
        white-space: normal;
        word-break: break-word;
        text-align: center;
        vertical-align: middle;
      }
      /* signature table use same strong border */
      .pdf-page .sig-table td {
        border: 0.12mm solid #444 !important;
        padding: 8px 8px !important;
      }

      /* When exporting, add class .pdf-nowrap to force single-line cells and ensure border visibility */
      .pdf-page.pdf-nowrap th,
      .pdf-page.pdf-nowrap td {
        white-space: nowrap !important;
        overflow: visible !important;
        text-overflow: clip !important;
        /* avoid very thick border when nowrap is applied */
        border: 0.12mm solid #444 !important;
      }

      .pdf-items th:nth-child(4),
      .pdf-items td:nth-child(4) {
        text-align: left;
        white-space: nowrap;
        word-break: normal;
        overflow: visible;
      }
      /* ensure printed output uses exact colors and sizing */
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    </style>

    <!-- use an inline-block wrapper so the white background fits the content exactly -->
    <!-- inner wrapper matches A4 landscape width -->
    <div class="pdf-stage"><div class="pdf-page" style="display:inline-block;background:#fff;padding:6mm 4mm;color:#111;box-sizing:border-box;width:297mm;min-width:297mm;">
      <h2 style="margin:4px 0 6px">การประมาณราคาค่าแรง SUB</h2>
      <div style="height:1em"></div>
      <div style="display:flex;gap:12px;margin-bottom:8px;flex-wrap:wrap">
        <div style="min-width:180px"><strong>SUB:</strong> ${escapeHtml(saved.subName||'')}</div>
        <div style="min-width:120px"><strong>WA:</strong> ${escapeHtml(saved.wa||'')}</div>
        <div style="min-width:220px"><strong>Project:</strong> ${escapeHtml(saved.project||'')}</div>
        <div style="min-width:120px"><strong>Cubicle:</strong> ${escapeHtml(saved.cubicle||'')}</div>
        <div style="min-width:120px"><strong>Serial:</strong> ${escapeHtml(saved.serial||'')}</div>

      </div>

      <div class="pc-row" style="margin-top:8px">
        <div class="pc-col">
          <h3 style="margin:8px 0 4px">Power</h3>
          ${renderItems(saved.power)}
        </div>
        <div class="pc-col">
          <h3 style="margin:8px 0 4px">Control</h3>
          ${renderItems(saved.control)}
           ${ (urgentNum || urgentDesc) ? `<div style="margin-top:8px;padding:6px;border:1px dashed #ccc;background:#fafafa">
               <div style="font-weight:600;margin-bottom:4px">ค่าเร่งด่วน (Urgent)</div>
               <div style="display:flex;justify-content:space-between;gap:12px">
                 <div style="flex:1;text-align:left">${escapeHtml(urgentDesc || '-')}</div>
                 <div style="min-width:160px;text-align:right">${money(urgentNum)}</div>
               </div>
             </div>` : '' }
        </div>
      </div>

      <div style="margin-top:20px;text-align:right">
        <div>
          <strong>Power:</strong> ${money(powerSum)}
          <span style="margin-left:18px"><strong>Unit price (per set):</strong> ${money(totalPerSet)}</span>
        </div>
        <div>
          <strong>Control:</strong> ${money(controlSum)}
          <span style="margin-left:18px"><strong>Sets:</strong> ${escapeHtml(sets)}</span>
          <span style="margin-left:18px"><strong>Total:</strong> ${money(totalAll)}</span>
        </div>
        <div style="margin-top:6px;text-align:right;font-size:12px;color:#333;margin-bottom:12px">(${escapeHtml(numberToThaiText(totalAll || totalPerSet || '0.00'))})</div>

      <!-- signature table -->
    <table class="sig-table" style="width:100%;border-collapse:collapse;box-sizing:border-box;margin-top:12px;">
        <colgroup>
          <col style="width:25%"><col style="width:25%"><col style="width:25%"><col style="width:25%">
        </colgroup>
        <tbody>
          <tr>
            <td style="padding:12px;border:0.12mm solid #444;vertical-align:bottom;height:96px">
              <div style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;box-sizing:border-box">
                <div style="height:50px"></div>
                <div style="font-size:12px;color:#555;margin-top:14px">ผู้ตรวจรับงาน(SUB)<br></div>
                <div style="color:#666;font-size:12px;margin-top:6px">วันที่........./........./.........</div>
              </div>
            </td>
            <td style="padding:12px;border:0.12mm solid #444;vertical-align:bottom;height:96px">
              <div style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;box-sizing:border-box">
                <div style="height:50px"></div>
                <div style="font-size:12px;color:#555;margin-top:14px">หัวหน้าผู้ควบคุมงาน(ผู้ดูแลSUB)<br></div>
                <div style="color:#666;font-size:12px;margin-top:6px">วันที่........./........./.........</div>
              </div>
            </td>
            <td style="padding:12px;border:0.12mm solid #444;vertical-align:bottom;height:96px">
              <div style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;box-sizing:border-box">
                <div style="height:50px"></div>
                <div style="font-size:12px;color:#555;margin-top:14px">ผจก.แผนก/ฝ่ายผลิตงานไฟฟ้า<br></div>
                <div style="color:#666;font-size:12px;margin-top:6px">วันที่........./........./.........</div>
              </div>
            </td>
            <td style="padding:12px;border:0.12mm solid #444;vertical-align:bottom;height:96px">
              <div style="display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%;box-sizing:border-box">
                <div style="height:50px"></div>
                <div style="font-size:12px;color:#555;margin-top:14px">ผจก.แผนก/ฝ่ายวางแผน<br></div>
                <div style="color:#666;font-size:12px;margin-top:6px">วันที่........./........./.........</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <div style="color:#666;font-size:12px;margin-top:6px">FM-PMEP-010(01)
      <div style="color:#666;font-size:12px;margin-top:6px">เริ่มใช้ 14 มี.ค. 2568
      </div>
    </div></div>
  `;

  // collapse to a single line (remove extra whitespace/newlines)
  const singleLineHtml = html.replace(/\s+/g, ' ').trim(); 

  out.innerHTML = singleLineHtml;
  // remove any inline stage padding (Index.html originally had padding:16px inline)
  try { out.style.padding = '0px'; } catch (e) {}
  try { if (out.dataset) out.dataset.previewId = saved && saved._id ? saved._id : ''; } catch (e) {}
}

// open, load, helpers
function openSaved(id) {
  const it = findSavedById(id);
  if (!it) return alert('ไม่พบรายการที่เลือก');
  renderSavedPreview(it);
}

function loadSavedToForm(id) {
  const it = findSavedById(id);
  if (!it) return alert('ไม่พบรายการที่เลือก');
  document.getElementById('subName').value = it.subName || '';
  document.getElementById('wa').value = it.wa || '';
  document.getElementById('project').value = it.project || '';
  document.getElementById('cubicle').value = it.cubicle || '';
  document.getElementById('serial').value = it.serial || '';
  document.getElementById('total-set').value = it.totalSet || 1;

  // new: restore urgent inputs (if present in saved entry)
  try {
    const urgentPriceEl = document.getElementById('control-urgent-price');
    const urgentDescEl = document.getElementById('control-urgent-desc');
    if (urgentPriceEl) {
      const vNum = (it.controlUrgentPriceNumeric !== undefined && it.controlUrgentPriceNumeric !== null)
        ? it.controlUrgentPriceNumeric
        : (it.controlUrgentPrice ? parseFloat(String(it.controlUrgentPrice).replace(/,/g,'')) : 0);
      urgentPriceEl.value = isNaN(vNum) ? '' : String(vNum);
    }
    if (urgentDescEl) urgentDescEl.value = it.controlUrgentDesc || '';
  } catch (e) { console.warn('restore urgent inputs failed', e); }

  const pb = document.getElementById('power-table-body');
  const cb = document.getElementById('control-table-body');
  if (pb) pb.innerHTML = '';
  if (cb) cb.innerHTML = '';

  (it.power || []).forEach(r => addRow('power', { no: r.no, qty: r.qty, price: r.price, desc: r.desc }));
  (it.control || []).forEach(r => addRow('control', { no: r.no, qty: r.qty, price: r.price, desc: r.desc }));

  try { updateTotal('power'); updateTotal('control'); updateSummary(); } catch(e){}
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// small helpers
function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}

// convert number to Thai text (supports decimal up to 2 places for satang)
function numberToThaiText(val) {
  try {
    let num = parseFloat(String(val).replace(/,/g, '')) || 0;
    const units = ['ศูนย์','หนึ่ง','สอง','สาม','สี่','ห้า','หก','เจ็ด','แปด','เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

    function integerToText(n) {
      if (n === 0) return 'ศูนย์';
      let out = '';
      const s = String(n);
      const len = s.length;
      for (let i = 0; i < len; i++) {
        const digit = parseInt(s.charAt(i));
        const pos = len - i - 1;
        const posName = positions[pos % 6] || '';
        if (digit === 0) continue;
        if (pos === 1 && digit === 1) {
          out += 'สิบ';
        } else if (pos === 1 && digit === 2) {
          out += 'ยี่' + 'สิบ';
        } else if (pos === 0 && digit === 1 && len > 1) {
          out += 'เอ็ด';
        } else {
          out += units[digit] + posName;
        }
      }
      return out;
    }

    const baht = Math.floor(num);
    const satang = Math.round((num - baht) * 100);

    let result = '';
    // handle millions groups
    function groupConvert(n) {
      if (n < 1000000) return integerToText(n);
      const high = Math.floor(n / 1000000);
      const rest = n % 1000000;
      let r = '';
      r += integerToText(high) + 'ล้าน';
      if (rest > 0) r += integerToText(rest);
      return r;
    }

    result = groupConvert(baht) + ' บาท';
    if (satang === 0) result += 'ถ้วน';
    else result += groupConvert(satang) + ' สตางค์';
    return result;
  } catch (e) {
    return '' + val;
  }
}

// new helpers for clearing and reading latest entry
function clearSavedListForCurrentUser() {
  try {
    const raw = ensureStorageObject();
    const user = getCurrentUsername() || raw.currentUser || 'guest';
    if (!raw.users) raw.users = {};
    raw.users[user] = [];
    saveRawStorage(raw);
    try { renderSavedList(); } catch (e) {}
    console.log('LocalStorage: cleared entries for', user);
    return true;
  } catch (e) {
    console.error('clearSavedListForCurrentUser error', e);
    return false;
  }
}

function getLatestSavedEntry() {
  const list = getSavedListFromStorage();
  return Array.isArray(list) && list.length ? list[0] : null;
}

// auto render on load
document.addEventListener('DOMContentLoaded', () => {
  try { renderSavedList(); } catch (e) {}
});

// expose API (single block) - keep each binding only once
window.getSavedListFromStorage = getSavedListFromStorage;
window.saveToLocalStorage = saveToLocalStorage;
window.deleteSavedEntry = deleteSavedEntry;
window.findSavedById = findSavedById;
window.renderSavedList = renderSavedList;
window.renderSavedPreview = renderSavedPreview;
window.openSaved = openSaved;
window.loadSavedToForm = loadSavedToForm;
window.clearSavedListForCurrentUser = clearSavedListForCurrentUser;
window.getLatestSavedEntry = getLatestSavedEntry;

