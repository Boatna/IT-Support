const CONFIG = {
  SPREADSHEET_ID: '1ZadPpHc5EDoTu-JJBWcQk8JvfA582LELTkkyzszIV8U',

  SHEET_REQUESTS:  'IT_Requests',
  SHEET_EMPLOYEES: 'Employee_Data',
  SHEET_IT_STAFF:  'IT_Staff',

  IT_STAFF_DEFAULT: [
    { name: 'คุณ ปฏิพล พึ่งพังเทียม', pin: '1234', status: 'ใช้งาน', email: 'patipol.p@bitwise.co.th' },
    { name: 'คุณ สุภาวดี เสนาะเสียง', pin: '1234', status: 'ใช้งาน', email: 'supawadee.s@bitwise.co.th' }
  ],

  PHOTO_FOLDER_NAME: 'IT_Support_Photos',
  TIMEZONE:    'Asia/Bangkok',
  DATE_FORMAT: 'dd/MM/yyyy HH:mm:ss',
  TICKET_PREFIX: 'IT',
  TICKET_SEQ_DIGITS: 3,

  MAX_PHOTO_BYTES: 10 * 1024 * 1024,
  TOKEN_TTL_SEC:   6 * 60 * 60,
  MIN_PIN_LENGTH:  4,
  MAX_PIN_FAILS:   5,
  PIN_LOCK_SEC:    10 * 60,

  NOTIFY_EMAILS: ['patipol.p@bitwise.co.th', 'supawadee.s@bitwise.co.th'],

  SENDER_NAME: 'IT Support Helpdesk',
  DASHBOARD_URL: ''
};

const REQUEST_HEADERS = [
  'Ticket ID', 'วันที่แจ้ง', 'รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'ตำแหน่ง', 'Plant',
  'เบอร์ติดต่อ', 'เลขทะเบียน', 'เลข Asset', 'ระดับความด่วน', 'หมวดหมู่ปัญหา', 'รายละเอียดปัญหา',
  'เหตุผลที่ขอเครื่องใหม่', 'ประเภทเครื่อง', 'โปรแกรมที่ติดตั้ง', 'รูปภาพแนบ', 'สถานะ',
  'ผู้รับผิดชอบ', 'บันทึกการแก้ไข IT', 'แจ้งซ่อมภายนอก', 'รายละเอียดซ่อมภายนอก', 'อีเมลผู้แจ้ง',
  'เลขที่ PR', 'เลขที่ PO', 'เลข Asset ใหม่'
];

const COL = {
  TICKET_ID: 1, DATE: 2, EMP_ID: 3, EMP_NAME: 4, DEPT: 5, POSITION: 6, PLANT: 7,
  PHONE: 8, ASSET_TAG: 9, ASSET_NUMBER: 10, PRIORITY: 11, ISSUE_TYPE: 12, ISSUE_DETAIL: 13,
  REASON_NEW_PC: 14, PC_TYPE: 15, REQ_SOFTWARE: 16, PHOTO: 17, STATUS: 18,
  ASSIGNEE: 19, NOTE: 20, IS_EXTERNAL: 21, EXTERNAL_REASON: 22, EMP_EMAIL: 23,
  PR_NO: 24, PO_NO: 25, NEW_ASSET: 26
};

/**
 * ⚡ ฟังก์ชันหลักสำหรับกดปุ่ม "เรียกใช้" (Run) ใน Google Apps Script
 * จะทำการสร้างชีต ตรวจสอบคอลัมน์ A - Z (26 คอลัมน์) ใส่สีหัวตาราง ตรึงแถว และตั้งฟอร์แมตข้อมูลให้อัตโนมัติทั้งหมดทันที
 */
function setupSheet() {
  const ss = getSS_();
  console.log('🚀 เริ่มต้นการตั้งค่า Google Sheets สำหรับระบบ IT Support...');

  // ── 1. ตั้งค่าชีต IT_Requests (26 คอลัมน์ A - Z ครบถ้วน) ──
  let shReq = ss.getSheetByName(CONFIG.SHEET_REQUESTS);
  if (!shReq) {
    shReq = ss.insertSheet(CONFIG.SHEET_REQUESTS);
    console.log('✓ สร้างชีต ' + CONFIG.SHEET_REQUESTS + ' ใหม่เรียบร้อย');
  }
  // ตรวจสอบจำนวนคอลัมน์ให้มีอย่างน้อย 26 คอลัมน์ (A - Z)
  if (shReq.getMaxColumns() < REQUEST_HEADERS.length) {
    shReq.insertColumnsAfter(shReq.getMaxColumns(), REQUEST_HEADERS.length - shReq.getMaxColumns());
  }
  // เขียนหัวตารางคอลัมน์ 1 - 26
  safeSet_(shReq.getRange(1, 1, 1, REQUEST_HEADERS.length), [REQUEST_HEADERS]);

  // ตกแต่งหัวตาราง IT_Requests (สีน้ำเงินเข้ม Navy #1e3a8a, ตัวอักษรสีขาว หนา จัดกึ่งกลาง)
  const headerReq = shReq.getRange(1, 1, 1, REQUEST_HEADERS.length);
  styleHeader_(headerReq, '#1e3a8a');
  shReq.setRowHeight(1, 38);

  // ตั้ง Number Format คอลัมน์สำคัญ
  const maxRowsReq = Math.max(shReq.getMaxRows(), 50);
  shReq.getRange(2, COL.DATE, maxRowsReq - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  shReq.getRange(2, COL.EMP_ID, maxRowsReq - 1, 1).setNumberFormat('@'); // Plain text กันเลข 0 นำหน้าหาย
  shReq.getRange(2, COL.PHONE, maxRowsReq - 1, 1).setNumberFormat('@');
  setFormat_(shReq.getRange(2, COL.PR_NO, maxRowsReq - 1, 3), '@'); // PR, PO, New Asset
  console.log('✓ ชีต ' + CONFIG.SHEET_REQUESTS + ': ตั้งค่าหัวตาราง 26 คอลัมน์และฟอร์แมตข้อมูลเรียบร้อย');

  // ── 2. ตั้งค่าชีต IT_Staff (รายชื่อช่าง + PIN + อีเมลรับแจ้งเตือน) ──
  let shStaff = ss.getSheetByName(CONFIG.SHEET_IT_STAFF);
  if (!shStaff) {
    shStaff = ss.insertSheet(CONFIG.SHEET_IT_STAFF);
    console.log('✓ สร้างชีต ' + CONFIG.SHEET_IT_STAFF + ' ใหม่เรียบร้อย');
  }
  const staffHeaders = ['ชื่อ-นามสกุล', 'PIN (4-6 หลัก)', 'สถานะ', 'Email รับแจ้งเตือน'];
  const headerStaff = shStaff.getRange(1, 1, 1, staffHeaders.length);
  safeSet_(headerStaff, [staffHeaders]);
  styleHeader_(headerStaff, '#0f766e'); // สีเขียวเข้ม Teal
  shStaff.setRowHeight(1, 38);

  // ถ้ายังไม่มีข้อมูลช่าง ให้เติมค่าเริ่มต้นอัตโนมัติ
  if (shStaff.getLastRow() <= 1) {
    const defaultStaff = [
      ['คุณ ปฏิพล พึ่งพังเทียม', '1234', 'ใช้งาน', 'patipol.p@bitwise.co.th'],
      ['คุณ สุภาวดี เสนาะเสียง', '1234', 'ใช้งาน', 'supawadee.s@bitwise.co.th']
    ];
    const defRange = shStaff.getRange(2, 1, defaultStaff.length, 4);
    setFormat_(defRange, '@');
    safeSet_(defRange, defaultStaff);
    console.log('✓ ชีต ' + CONFIG.SHEET_IT_STAFF + ': เติมรายชื่อช่างและ PIN เริ่มต้นเรียบร้อย');
  } else {
    shStaff.getRange(2, 2, Math.max(shStaff.getMaxRows() - 1, 5), 1).setNumberFormat('@');
  }
  shStaff.setColumnWidth(1, 230);
  shStaff.setColumnWidth(2, 140);
  shStaff.setColumnWidth(3, 110);
  shStaff.setColumnWidth(4, 260);

  // ── 3. ตั้งค่าชีต Employee_Data (ฐานข้อมูลพนักงาน) ──
  let shEmp = ss.getSheetByName(CONFIG.SHEET_EMPLOYEES);
  if (!shEmp) {
    shEmp = ss.insertSheet(CONFIG.SHEET_EMPLOYEES);
    console.log('✓ สร้างชีต ' + CONFIG.SHEET_EMPLOYEES + ' ใหม่เรียบร้อย');
  }
  const empHeaders = ['รหัสพนักงาน', 'ชื่อ-นามสกุล', 'แผนก', 'ตำแหน่ง', 'Plant', 'เลขทะเบียน Asset', 'อีเมล', 'เบอร์โทร'];
  if (shEmp.getLastRow() === 0) {
    safeSet_(shEmp.getRange(1, 1, 1, empHeaders.length), [empHeaders]);
  }
  const headerEmp = shEmp.getRange(1, 1, 1, empHeaders.length);
  styleHeader_(headerEmp, '#334155'); // สีกรมท่าเทา Slate
  shEmp.setRowHeight(1, 38);
  // บังคับคอลัมน์รหัสพนักงานและเบอร์โทรให้เป็น Plain Text ป้องกันเลข 0 หาย
  const maxRowsEmp = Math.max(shEmp.getMaxRows(), 50);
  shEmp.getRange(2, 1, maxRowsEmp - 1, 1).setNumberFormat('@');
  // หาคอลัมน์ "เบอร์โทร" จากชื่อหัวตารางจริง (ชีตของคุณอยู่คอลัมน์ G ไม่ใช่ H)
  const empHead = shEmp.getRange(1, 1, 1, Math.max(shEmp.getLastColumn(), 1)).getValues()[0];
  const phoneIdx = empHead.map(normHeader_).indexOf(normHeader_('เบอร์โทร'));
  shEmp.getRange(2, phoneIdx > -1 ? phoneIdx + 1 : 8, maxRowsEmp - 1, 1).setNumberFormat('@');
  console.log('✓ ชีต ' + CONFIG.SHEET_EMPLOYEES + ': ตั้งค่าฟอร์แมตรหัสพนักงานเป็นข้อความเรียบร้อย');

  SpreadsheetApp.flush();
  console.log('🎉 ตั้งค่า Google Sheets ทั้งหมดเสร็จสมบูรณ์ 100% พร้อมใช้งานทันที!');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ ตั้งค่าสำเร็จ!',
      'ระบบได้ตั้งค่าและจัดระเบียบชีตเรียบร้อยแล้ว:\n\n' +
      '1. IT_Requests: ครบ 26 คอลัมน์ (A - Z) สไตล์สีน้ำเงิน Navy\n' +
      '2. IT_Staff: สไตล์สีเขียว Teal พร้อม PIN เริ่มต้น\n' +
      '3. Employee_Data: สไตล์สี Slate ล็อกรหัสพนักงานเป็นข้อความ',
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  } catch (e) {
    // ป้องกัน error หากรันผ่าน Apps Script Console โดยตรง
  }
  return 'SUCCESS';
}

/**
 * เพิ่มเมนูพิเศษบนแถบเมนูด้านบนของ Google Sheet
 */
function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('🛠️ ระบบ IT Support')
      .addItem('⚡ ตั้งค่าชีตทั้งหมดอัตโนมัติ (Setup Sheets)', 'setupSheet')
      .addSeparator()
      .addItem('📋 ตรวจสอบสถานะระบบ (Test Setup)', 'testSetup')
      .addItem('✉️ ทดสอบระบบอีเมล (Test Email)', 'testEmail')
      .addToUi();
  } catch (e) {
    // ไม่มี UI ในกรณีเรียกผ่านเบื้องหลัง
  }
}

const STATUS = { PENDING: 'รอดำเนินการ', DOING: 'กำลังดำเนินการ', DONE: 'เสร็จสิ้น' };
const ALLOWED_STATUS   = [STATUS.PENDING, STATUS.DOING, STATUS.DONE];
const ALLOWED_PRIORITY = ['ทั่วไป', 'ปานกลาง', 'ด่วนมาก'];
const ALLOWED_ISSUE    = ['Hardware', 'Software', 'Network', 'Request_New_PC', 'Other'];
const ISSUE_LABELS = {
  Hardware: 'แจ้งซ่อมอุปกรณ์ (Hardware)',
  Software: 'ปัญหาโปรแกรม / Windows (Software)',
  Network: 'ระบบเครือข่าย / อินเทอร์เน็ต (Network)',
  Request_New_PC: 'ขอคอมพิวเตอร์ / โน๊ตบุ๊คใหม่',
  Other: 'อื่นๆ'
};

const EMP_ALIASES = {
  id:       ['รหัสพนักงาน', 'รหัส', 'empid', 'employeeid', 'id'],
  name:     ['ชื่อนามสกุล', 'ชื่อ', 'ชื่อพนักงาน', 'name', 'fullname'],
  dept:     ['แผนก', 'dept', 'department'],
  position: ['ตำแหน่ง', 'position', 'title'],
  plant:    ['plant', 'โรงงาน', 'สถานที่ทำงาน'],
  assetTag: ['เลขทะเบียน', 'เลขทะเบียนasset', 'เลขทะเบียนเครื่อง', 'assettag', 'asset'],
  email:    ['อีเมล', 'email', 'e-mail', 'mail'],
  phone:    ['เบอร์โทร', 'เบอร์โทรศัพท์', 'เบอร์ติดต่อ', 'phone', 'tel']
};

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    switch (p.action) {
      case 'getEmployees': return json_(readEmployees_());
      case 'getTickets':   return json_(getTicketsByEmp_(p.empId));
      case 'ping':         return json_({ ok: true, time: now_() });
      case 'getActiveTickets':
      case 'getStats':
      case 'getITStaff':
        return json_(unauthorized_());   // ต้องส่งผ่าน POST พร้อม token เท่านั้น
      default:
        return json_({ success: false, error: 'Unknown action' });
    }
  } catch (err) {
    return json_({ success: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = body.action;
    const data = body.data || {};

    // — Public actions —
    if (action === 'saveTicket') return json_(saveTicket_(data));
    if (action === 'verifyPin')  return json_(verifyPin_(data.pin));

    if (action === 'logout') {
      if (typeof body.token === 'string' && body.token) CacheService.getScriptCache().remove('tok_' + body.token);
      return json_({ success: true });
    }

    // — Protected actions (ต้องมี token จากการล็อกอินด้วย PIN) —
    if (!isValidToken_(body.token)) return json_(unauthorized_());

    switch (action) {
      case 'getActiveTickets': return json_(readRequests_().reverse());
      case 'getStats':         return json_(getStats_());
      case 'getITStaff':       return json_(readITStaff_());
      case 'getPhoto':         return json_(getPhoto_(data.url));
      case 'updateTicket':     return json_(updateTicket_(data));
      default:                 return json_({ success: false, error: 'Unknown action' });
    }
  } catch (err) {
    console.error(err);
    return json_({ success: false, error: String(err && err.message || err) });
  }
}

const STAFF_HEADERS = ['ชื่อช่าง', 'PIN', 'สถานะ', 'Email'];

function getStaffSheet_() {
  let sh = getSS_().getSheetByName(CONFIG.SHEET_IT_STAFF);
  if (!sh) {
    sh = getSS_().insertSheet(CONFIG.SHEET_IT_STAFF);
    const hdr = sh.getRange(1, 1, 1, STAFF_HEADERS.length);
    safeSet_(hdr, [STAFF_HEADERS]);
    safeFormat_(hdr, function (r) { r.setFontWeight('bold'); });
    const rows = CONFIG.IT_STAFF_DEFAULT.map(function (s) {
      return [s.name, s.pin || '', s.status || 'ใช้งาน', s.email || ''];
    });
    if (rows.length) {
      safeSet_(sh.getRange(2, 1, rows.length, STAFF_HEADERS.length), rows);
    }
    sh.getRange(1, 2, 200, 1).setNumberFormat('@');   // PIN เก็บเป็นข้อความ ป้องกันเลข 0 นำหน้าหาย
  }
  return sh;
}

function readStaffRecords_() {
  const sh = getStaffSheet_();
  const last = sh.getLastRow();
  if (last < 1) return [];
  const maxCols = Math.max(sh.getLastColumn(), 4);
  const vals = sh.getRange(1, 1, last, maxCols).getValues();
  if (/^(ชื่อ|ช่าง|name|staff)/i.test(str_(vals[0][0])) && str_(vals[0][0]).length < 20) vals.shift();
  const out = [];
  vals.forEach(function (r) {
    const name = str_(r[0]);
    if (!name) return;
    const st = str_(r[2]).toLowerCase();
    const inactive = st === 'ปิด' || st === 'ระงับ' || st === 'ไม่ใช้งาน' || st === 'inactive' || st === 'no' || st === 'n' || st === 'false' || st === '0';
    out.push({
      name: name,
      pin: str_(r[1]),
      active: !inactive,
      email: str_(r[3]).toLowerCase()
    });
  });
  return out;
}

function verifyPin_(pin) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(8000)) return { success: false, error: 'ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง' };
  try {
    return verifyPinCore_(pin);
  } finally {
    lock.releaseLock();
  }
}

function verifyPinCore_(pin) {
  const cache = CacheService.getScriptCache();
  const failKey = 'pin_fails';
  const fails = Number(cache.get(failKey) || 0);

  if (fails >= CONFIG.MAX_PIN_FAILS) {
    return { success: false, locked: true, error: 'ใส่ PIN ผิดเกินกำหนด กรุณารอ 10 นาทีแล้วลองใหม่' };
  }

  const input = str_(pin);
  const staff = readStaffRecords_().filter(function (x) { return x.active && x.pin.length >= CONFIG.MIN_PIN_LENGTH; });
  const legacyPin = str_(PropertiesService.getScriptProperties().getProperty('IT_PIN'));

  if (!staff.length && !legacyPin) {
    return { success: false, error: 'ยังไม่ได้ตั้ง PIN ในชีต ' + CONFIG.SHEET_IT_STAFF + ' (คอลัมน์ B) กรุณาให้ผู้ดูแลระบบตั้งค่า' };
  }

  let who = null;
  for (let i = 0; i < staff.length; i++) {
    if (safeEqual_(input, staff[i].pin)) { who = staff[i].name; break; }
  }
  if (who === null && legacyPin && safeEqual_(input, legacyPin)) who = '';

  if (who === null) {
    cache.put(failKey, String(fails + 1), CONFIG.PIN_LOCK_SEC);
    return { success: true, isValid: false };
  }
  cache.remove(failKey);
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  cache.put('tok_' + token, who || '-', CONFIG.TOKEN_TTL_SEC);
  return { success: true, isValid: true, token: token, staff: who };
}

function isValidToken_(token) {
  if (!token || typeof token !== 'string' || token.length < 40) return false;
  return CacheService.getScriptCache().get('tok_' + token) !== null;
}

function unauthorized_() {
  return { success: false, code: 'UNAUTHORIZED', error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' };
}

function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * ===== ตัวช่วยเขียนชีตแบบปลอดภัย =====
 * ถ้าชีตเป็น Table ของ Google Sheets (หรือมีโครงสร้างพิเศษ) การเขียน/จัดรูปแบบ
 * คร่อมหลายคอลัมน์ในคำสั่งเดียวจะ error "โปรดเลือกภายในคอลัมน์เดียวเพื่อดำเนินการระดับคอลัมน์"
 * ตัวช่วยเหล่านี้จึงลองแบบปกติก่อน ถ้า error จะวนทำทีละคอลัมน์แทน
 * (SpreadsheetApp.flush() ใช้บังคับให้ error ที่เลื่อนเวลาเกิดภายใน try ตรงนี้)
 */
function eachColumn_(range, fn) {
  const sh = range.getSheet();
  for (let j = 0; j < range.getNumColumns(); j++) {
    fn(sh.getRange(range.getRow(), range.getColumn() + j, range.getNumRows(), 1), j);
  }
}

function safeSet_(range, values) {
  try {
    range.setValues(values);
    SpreadsheetApp.flush();
  } catch (e) {
    eachColumn_(range, function (col, j) {
      col.setValues(values.map(function (r) { return [r[j]]; }));
    });
    SpreadsheetApp.flush();
  }
}

function safeFormat_(range, fn) {
  try {
    fn(range);
    SpreadsheetApp.flush();
  } catch (e) {
    eachColumn_(range, function (col) { fn(col); });
    SpreadsheetApp.flush();
  }
}

function setFormat_(range, fmt) {
  safeFormat_(range, function (r) { r.setNumberFormat(fmt); });
}

function setFormats_(range, formats2d) {
  try {
    range.setNumberFormats(formats2d);
    SpreadsheetApp.flush();
  } catch (e) {
    eachColumn_(range, function (col, j) {
      col.setNumberFormats(formats2d.map(function (r) { return [r[j]]; }));
    });
    SpreadsheetApp.flush();
  }
}

function styleHeader_(range, bg) {
  safeFormat_(range, function (r) {
    r.setBackground(bg).setFontColor('#ffffff').setFontWeight('bold')
     .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
}

function writeRequestHeader_(sh) {
  const r = sh.getRange(1, 1, 1, REQUEST_HEADERS.length);
  safeSet_(r, [REQUEST_HEADERS]);
  safeFormat_(r, function (x) { x.setFontWeight('bold'); });
}

let _ssCache_ = null;

function getSS_() {
  if (!_ssCache_) {
    _ssCache_ = CONFIG.SPREADSHEET_ID
      ? SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID)
      : SpreadsheetApp.getActiveSpreadsheet();
  }
  return _ssCache_;
}

function getSheetOrThrow_(name) {
  const sh = getSS_().getSheetByName(name);
  if (!sh) {
    const names = getSS_().getSheets().map(function (s) { return s.getName(); }).join(', ');
    throw new Error('ไม่พบชีตชื่อ "' + name + '" (ชีตที่มี: ' + names + ') — แก้ชื่อใน CONFIG');
  }
  return sh;
}

function getRequestSheet_() {
  let sh = getSS_().getSheetByName(CONFIG.SHEET_REQUESTS);
  if (!sh) sh = getSS_().insertSheet(CONFIG.SHEET_REQUESTS);
  if (sh.getMaxColumns() < REQUEST_HEADERS.length) {
    sh.insertColumnsAfter(sh.getMaxColumns(), REQUEST_HEADERS.length - sh.getMaxColumns());
  }
  if (sh.getLastRow() === 0) {
    writeRequestHeader_(sh);
  } else if (sh.getLastColumn() < REQUEST_HEADERS.length) {
    // ขยายหัวคอลัมน์อัตโนมัติหากชีตเดิมมีไม่ถึง 26 คอลัมน์ (เช่น เพิ่ม เลขที่ PR, เลขที่ PO, เลข Asset ใหม่)
    writeRequestHeader_(sh);
  }
  return sh;
}

function str_(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }
function normId_(v) { return str_(v).replace(/\.0+$/, ''); }
let _tzCache_ = null;
function tz_() {
  if (!_tzCache_) _tzCache_ = CONFIG.TIMEZONE || getSS_().getSpreadsheetTimeZone() || 'Asia/Bangkok';
  return _tzCache_;
}
function now_() { return Utilities.formatDate(new Date(), tz_(), CONFIG.DATE_FORMAT); }

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, tz_(), CONFIG.DATE_FORMAT);
  return str_(v);
}

function isTrueish_(v) {
  if (v === true) return true;
  const s = str_(v).toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s.indexOf('ภายนอก') > -1 || s.indexOf('ซ่อมนอก') > -1 || s.indexOf('external') > -1;
}

function normHeader_(h) {
  return str_(h).toLowerCase().replace(/[\s_\-\.]/g, '');
}

function readEmployees_() {
  const sh = getSheetOrThrow_(CONFIG.SHEET_EMPLOYEES);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = values[0].map(normHeader_);
  const find = function (aliases) {
    for (let i = 0; i < aliases.length; i++) {
      const idx = headers.indexOf(normHeader_(aliases[i]));
      if (idx > -1) return idx;
    }
    return -1;
  };
  const idx = {};
  Object.keys(EMP_ALIASES).forEach(function (k) { idx[k] = find(EMP_ALIASES[k]); });
  // ถ้าหาหัวคอลัมน์ไม่เจอ ใช้ลำดับมาตรฐาน: รหัส, ชื่อ, แผนก, ตำแหน่ง, Plant
  const fallback = { id: 0, name: 1, dept: 2, position: 3, plant: 4 };
  Object.keys(fallback).forEach(function (k) { if (idx[k] < 0) idx[k] = fallback[k]; });

  const get = function (row, k) { return idx[k] > -1 ? row[idx[k]] : ''; };
  const clean = function (v) { return str_(v).replace(/\s+/g, ' '); };
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const id = normId_(get(row, 'id'));
    // ข้ามแถวที่ไม่มีรหัส (ป้องกันแถวสูตรหรือช่องว่างท้ายชีต)
    if (!id || !clean(get(row, 'name'))) continue;
    out.push({
      id: id,
      name: clean(get(row, 'name')),
      dept: clean(get(row, 'dept')),
      position: clean(get(row, 'position')),
      plant: clean(get(row, 'plant')),
      assetTag: str_(get(row, 'assetTag')).toUpperCase(),
      email: str_(get(row, 'email')).toLowerCase(),
      phone: str_(get(row, 'phone'))
    });
  }
  return out;
}

function findEmployee_(empId, plantHint) {
  const id = normId_(empId);
  if (!id) return null;
  const matches = readEmployees_().filter(function (e) { return e.id === id; });
  if (!matches.length) return null;
  const hint = str_(plantHint).toLowerCase();
  if (hint) {
    for (let i = 0; i < matches.length; i++) if (matches[i].plant.toLowerCase() === hint) return matches[i];
  }
  return matches[0];
}

function readITStaff_() {
  const placeholder = '-- เลือกผู้รับผิดชอบ --';
  const names = [];
  const add = function (v) {
    const n = str_(v);
    if (n && n !== placeholder && names.indexOf(n) < 0) names.push(n);
  };
  readStaffRecords_().filter(function (x) { return x.active; }).forEach(function (x) { add(x.name); });
  readRequests_().forEach(function (t) { add(t.assignee); });
  return [placeholder].concat(names);
}

let _legacyOn_ = null;
function legacyEnabled_() {
  if (_legacyOn_ === null) {
    _legacyOn_ = PropertiesService.getScriptProperties().getProperty('LEGACY_MIGRATED') !== '1';
  }
  return _legacyOn_;
}

function mapRequestRow_(r, rowNum) {
  const c18 = str_(r[COL.STATUS - 1]);
  const c19 = str_(r[COL.ASSIGNEE - 1]);
  const c20 = str_(r[COL.NOTE - 1]);
  const c21 = str_(r[COL.IS_EXTERNAL - 1]);
  const legacy = legacyEnabled_() && ALLOWED_STATUS.indexOf(c20) > -1;
  const ext = isTrueish_(c21);
  return {
    row: rowNum,
    legacy: legacy,
    ticketId: str_(r[COL.TICKET_ID - 1]),
    date: fmtDate_(r[COL.DATE - 1]),
    empId: normId_(r[COL.EMP_ID - 1]),
    empName: str_(r[COL.EMP_NAME - 1]),
    dept: str_(r[COL.DEPT - 1]),
    position: str_(r[COL.POSITION - 1]),
    plant: str_(r[COL.PLANT - 1]),
    contactPhone: str_(r[COL.PHONE - 1]),
    asset: str_(r[COL.ASSET_TAG - 1]),
    assetNumber: str_(r[COL.ASSET_NUMBER - 1]),
    priority: str_(r[COL.PRIORITY - 1]) || 'ทั่วไป',
    issue: str_(r[COL.ISSUE_TYPE - 1]),
    detail: str_(r[COL.ISSUE_DETAIL - 1]),
    reasonPc: str_(r[COL.REASON_NEW_PC - 1]),
    pcType: str_(r[COL.PC_TYPE - 1]),
    reqSoft: str_(r[COL.REQ_SOFTWARE - 1]),
    photo: str_(r[COL.PHOTO - 1]),
    status: legacy ? c20 : (c18 || STATUS.PENDING),
    assignee: legacy ? ((c21 && !ext) ? c21 : c19) : c19,
    note: legacy ? '' : c20,
    isExternal: ext,
    externalReason: str_(r[COL.EXTERNAL_REASON - 1]),
    empEmail: str_(r[COL.EMP_EMAIL - 1]),
    prNo: str_(r[COL.PR_NO - 1]),
    poNo: str_(r[COL.PO_NO - 1]),
    newAsset: str_(r[COL.NEW_ASSET - 1])
  };
}

function readRequests_() {
  const sh = getRequestSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, REQUEST_HEADERS.length).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const t = mapRequestRow_(values[i], i + 2);
    if (t.ticketId) out.push(t);
  }
  return out;
}

function getTicketsByEmp_(empId) {
  const id = normId_(empId);
  if (!id) return [];
  return readRequests_()
    .filter(function (t) { return t.empId === id; })
    .reverse()
    .map(function (t) {
      return {
        ticketId: t.ticketId, date: t.date, issue: t.issue, status: t.status,
        assignee: t.assignee, isExternal: t.isExternal, itNote: t.note,
        prNo: t.prNo, poNo: t.poNo, newAsset: t.newAsset
      };
    });
}

function getStats_() {
  const all = readRequests_();
  const stats = {
    total: all.length, pending: 0, doing: 0, done: 0,
    byPriority: { 'ทั่วไป': 0, 'ปานกลาง': 0, 'ด่วนมาก': 0 },
    byPlant: {}, byIssueType: {}
  };
  all.forEach(function (t) {
    if (t.status === STATUS.DONE) stats.done++;
    else if (t.status === STATUS.DOING) stats.doing++;
    else stats.pending++;
    stats.byPriority[t.priority] = (stats.byPriority[t.priority] || 0) + 1;
    const plant = t.plant || 'ไม่ระบุ';
    stats.byPlant[plant] = (stats.byPlant[plant] || 0) + 1;
    const issue = t.issue || 'Other';
    stats.byIssueType[issue] = (stats.byIssueType[issue] || 0) + 1;
  });
  return stats;
}

function clip_(v, max) { return str_(v).substring(0, max); }

function normAsset_(v) {
  const a = str_(v).toUpperCase().replace(/\s+/g, '');
  return /^[-–—.]*$/.test(a) ? '' : a.substring(0, 100);
}

function rowFormats_() {
  const f = new Array(REQUEST_HEADERS.length).fill('@');
  f[COL.DATE - 1] = 'dd/MM/yyyy HH:mm:ss';
  f[COL.EMP_ID - 1] = '@';   // เก็บเป็นข้อความ ป้องกันรหัสพนักงานที่ขึ้นต้นด้วย 0 หาย และกันกลายเป็นทศนิยม .0
  return [f];
}

function nextRequestRow_(sh) {
  const last = sh.getLastRow();
  if (last < 2) return 2;
  const ids = sh.getRange(2, COL.TICKET_ID, last - 1, 1).getValues();
  let lastDataRow = 1;
  for (let i = ids.length - 1; i >= 0; i--) {
    if (str_(ids[i][0])) {
      lastDataRow = i + 2;
      break;
    }
  }
  return lastDataRow + 1;
}

function saveTicket_(d) {
  const empEmail = str_(d.empEmail).toLowerCase();
  if (!normId_(d.empId)) return { success: false, error: 'ไม่พบรหัสพนักงาน' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(empEmail)) return { success: false, error: 'อีเมลไม่ถูกต้อง' };
  
  const phone = str_(d.contactPhone);
  if (!/^[0-9+\-#\s()\/,.a-zA-Zก-๙]{2,40}$/.test(phone)) {
    return { success: false, error: 'เบอร์ติดต่อไม่ถูกต้อง' };
  }

  const issueType = str_(d.issueType);
  if (ALLOWED_ISSUE.indexOf(issueType) < 0) return { success: false, error: 'หมวดหมู่ปัญหาไม่ถูกต้อง' };
  const detail = clip_(d.issueDetail, 3000);
  if (!detail) return { success: false, error: 'กรุณาระบุรายละเอียดอาการ' };
  const priority = ALLOWED_PRIORITY.indexOf(str_(d.priority)) > -1 ? str_(d.priority) : 'ทั่วไป';

  const isNewPc = issueType === 'Request_New_PC';
  if (isNewPc) {
    if (!d.fileData) return { success: false, error: 'กรณีขอเครื่องใหม่ ต้องแนบรูปถ่ายเครื่องเก่า' };
    if (!str_(d.pcType)) return { success: false, error: 'กรุณาเลือกประเภทเครื่อง' };
  }

  const emp = findEmployee_(d.empId, d.empPlant);
  const empInfo = {
    id:       normId_(d.empId),
    name:     emp ? emp.name     : clip_(d.empName, 200),
    dept:     emp ? emp.dept     : clip_(d.empDept, 200),
    position: emp ? emp.position : clip_(d.empPosition, 200),
    plant:    emp ? emp.plant    : clip_(d.empPlant, 100)
  };

  if (d.confirmDuplicate !== true) {
    const open = readRequests_().filter(function (t) {
      return t.empId === empInfo.id && t.issue === issueType && t.status !== STATUS.DONE;
    });
    if (open.length) {
      return {
        success: false, code: 'DUPLICATE',
        existing: open.map(function (t) { return { ticketId: t.ticketId, date: t.date, status: t.status }; }),
        error: 'พบงานประเภทเดียวกันที่ยังไม่เสร็จของพนักงานคนนี้'
      };
    }
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: 'ระบบกำลังประมวลผลหลายรายการ กรุณาลองใหม่อีกครั้ง' };

  let ticketId, photoUrl = '', rowNum;
  try {
    const sh = getRequestSheet_();
    ticketId = nextTicketId_(sh);

    if (d.fileData) { // อนุญาตให้อัปโหลดรูปได้ทุกหมวดหมู่ (Hardware, Software, Network, Request_New_PC, Other)
      try {
        photoUrl = uploadPhoto_(ticketId, d);
      } catch (upErr) {
        if (isNewPc) return { success: false, error: 'อัปโหลดรูปไม่สำเร็จ: ' + upErr.message };
        console.warn('Upload skipped: ' + upErr.message);
      }
    }

    const assetTag = normAsset_(d.assetTag);
    const row = new Array(REQUEST_HEADERS.length).fill('');
    row[COL.TICKET_ID - 1] = ticketId;
    row[COL.DATE - 1] = new Date();
    row[COL.EMP_ID - 1] = empInfo.id;
    row[COL.EMP_NAME - 1] = empInfo.name;
    row[COL.DEPT - 1] = empInfo.dept;
    row[COL.POSITION - 1] = empInfo.position;
    row[COL.PLANT - 1] = empInfo.plant;
    row[COL.PHONE - 1] = phone;
    row[COL.ASSET_TAG - 1] = assetTag;
    row[COL.ASSET_NUMBER - 1] = clip_(d.assetNumber, 100);
    row[COL.PRIORITY - 1] = priority;
    row[COL.ISSUE_TYPE - 1] = issueType;
    row[COL.ISSUE_DETAIL - 1] = detail;
    row[COL.REASON_NEW_PC - 1] = isNewPc ? clip_(d.reasonNewPc, 2000) : '';
    row[COL.PC_TYPE - 1] = isNewPc ? clip_(d.pcType, 200) : '';
    row[COL.REQ_SOFTWARE - 1] = isNewPc ? clip_(d.requiredSoftware, 1000) : '';
    row[COL.PHOTO - 1] = photoUrl;
    row[COL.STATUS - 1] = STATUS.PENDING;
    row[COL.EMP_EMAIL - 1] = empEmail;

    rowNum = nextRequestRow_(sh);
    if (rowNum > sh.getMaxRows()) {
      sh.insertRowsAfter(sh.getMaxRows(), Math.max(50, rowNum - sh.getMaxRows()));
    }
    const range = sh.getRange(rowNum, 1, 1, REQUEST_HEADERS.length);
    setFormats_(range, rowFormats_());
    safeSet_(range, [row]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  let emailSent = false;
  try {
    emailSent = notifyITNewTicket_({
      ticketId: ticketId, empInfo: empInfo, empEmail: empEmail, phone: phone, priority: priority,
      issueType: issueType, detail: detail, assetTag: normAsset_(d.assetTag),
      assetNumber: clip_(d.assetNumber, 100), pcType: isNewPc ? clip_(d.pcType, 200) : '',
      reason: isNewPc ? clip_(d.reasonNewPc, 2000) : '', photoUrl: photoUrl
    });
  } catch (mailErr) {
    console.error('notifyIT failed: ' + mailErr + ' | โควต้าเหลือ: ' + safeQuota_());
  }

  return { success: true, ticketId: ticketId, emailSent: emailSent };
}

function nextTicketId_(sh) {
  const last = sh.getLastRow();
  let maxSeq = 0;
  if (last >= 2) {
    sh.getRange(2, COL.TICKET_ID, last - 1, 1).getValues().forEach(function (r) {
      const m = /(\d+)$/.exec(str_(r[0]));
      if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
    });
  }
  let seq = String(maxSeq + 1);
  while (seq.length < CONFIG.TICKET_SEQ_DIGITS) seq = '0' + seq;
  return CONFIG.TICKET_PREFIX + Utilities.formatDate(new Date(), tz_(), 'yyMMdd') + '-' + seq;
}

function uploadPhoto_(ticketId, d) {
  const mime = str_(d.mimeType) || 'image/jpeg';
  if (!/^image\//i.test(mime)) throw new Error('รองรับเฉพาะไฟล์รูปภาพ');
  const bytes = Utilities.base64Decode(String(d.fileData));
  if (bytes.length > CONFIG.MAX_PHOTO_BYTES) throw new Error('ไฟล์ใหญ่เกิน 10 MB');

  const safeName = str_(d.fileName).replace(/[^\w.\-ก-๙]+/g, '_').substring(0, 80) || 'photo.jpg';
  const blob = Utilities.newBlob(bytes, mime, ticketId + '_' + safeName);
  const file = getPhotoFolder_().createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    console.warn('setSharing failed (นโยบายองค์กรอาจจำกัดการแชร์): ' + e.message);
  }
  return file.getUrl();
}

function getPhoto_(url) {
  const u = str_(url);
  const m = /\/d\/([a-zA-Z0-9_-]+)/.exec(u) || /[?&]id=([a-zA-Z0-9_-]+)/.exec(u);
  if (!m) return { success: false, error: 'ลิงก์รูปไม่ถูกต้อง' };
  const id = m[1];

  const sh = getRequestSheet_();
  const last = sh.getLastRow();
  if (last < 2) return { success: false, error: 'ไม่พบรูป' };
  const known = sh.getRange(2, COL.PHOTO, last - 1, 1).getValues().some(function (r) {
    return str_(r[0]).indexOf(id) > -1;
  });
  if (!known) return { success: false, error: 'ไม่พบรูปนี้ในระบบ' };

  const blob = DriveApp.getFileById(id).getBlob();
  const mime = blob.getContentType() || '';
  if (!/^image\//i.test(mime)) return { success: false, error: 'ไฟล์ไม่ใช่รูปภาพ' };
  const bytes = blob.getBytes();
  if (bytes.length > 6 * 1024 * 1024) return { success: false, error: 'ไฟล์ใหญ่เกินไปสำหรับแสดงผลในหน้านี้' };
  return { success: true, mime: mime, data: Utilities.base64Encode(bytes) };
}

function getPhotoFolder_() {
  const it = DriveApp.getFoldersByName(CONFIG.PHOTO_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.PHOTO_FOLDER_NAME);
}

function updateTicket_(d) {
  const status = str_(d.status);
  if (ALLOWED_STATUS.indexOf(status) < 0) return { success: false, error: 'สถานะไม่ถูกต้อง' };
  const isExternal = d.isExternal === true || d.isExternal === 'true';
  const extReason = clip_(d.extReason, 1000);
  if (isExternal && !extReason) return { success: false, error: 'กรุณาระบุเหตุผลการส่งซ่อมภายนอก' };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return { success: false, error: 'ระบบไม่ว่าง กรุณาลองใหม่อีกครั้ง' };

  let before, after, rowNum;
  try {
    const sh = getRequestSheet_();
    rowNum = locateRow_(sh, d.row, d.ticketId);
    if (!rowNum) return { success: false, error: 'ไม่พบ Ticket นี้ (อาจถูกลบหรือแถวเปลี่ยนตำแหน่ง) กรุณากด Sync Data' };

    before = mapRequestRow_(sh.getRange(rowNum, 1, 1, REQUEST_HEADERS.length).getValues()[0], rowNum);

    const assignee = clip_(d.assignee, 200);
    let notes = clip_(d.notes, 3000);
    if (ALLOWED_STATUS.indexOf(notes) > -1) notes += '.';

    const range = sh.getRange(rowNum, COL.STATUS, 1, 5);
    setFormat_(range, '@');
    safeSet_(range, [[status, assignee, notes, isExternal ? 'ซ่อมภายนอก' : '', isExternal ? extReason : '']]);

    // อัปเดตข้อมูลจัดซื้อ (เลขที่ PR, เลขที่ PO, เลข Asset ใหม่) คอลัมน์ 24–26
    const prNo = clip_(d.prNo !== undefined ? d.prNo : before.prNo, 100);
    const poNo = clip_(d.poNo !== undefined ? d.poNo : before.poNo, 100);
    const newAsset = normAsset_(d.newAsset !== undefined ? d.newAsset : before.newAsset);
    const rangeProcure = sh.getRange(rowNum, COL.PR_NO, 1, 3);
    setFormat_(rangeProcure, '@');
    safeSet_(rangeProcure, [[prNo, poNo, newAsset]]);

    if (!before.empEmail && before.empId) {
      const emp = findEmployee_(before.empId, before.plant);
      if (emp && emp.email) {
        sh.getRange(rowNum, COL.EMP_EMAIL).setNumberFormat('@').setValue(emp.email);
      }
    }

    SpreadsheetApp.flush();
    after = mapRequestRow_(sh.getRange(rowNum, 1, 1, REQUEST_HEADERS.length).getValues()[0], rowNum);
  } finally {
    lock.releaseLock();
  }

  const changed = before.status !== after.status || before.note !== after.note ||
                  before.assignee !== after.assignee || before.isExternal !== after.isExternal ||
                  before.externalReason !== after.externalReason ||
                  before.prNo !== after.prNo || before.poNo !== after.poNo || before.newAsset !== after.newAsset;

  let emailSent = false, emailError = '';
  if (changed) {
    try {
      emailSent = notifyRequester_(after, before);
      if (!emailSent) emailError = 'อีเมลผู้แจ้งว่างหรือรูปแบบไม่ถูกต้อง';
    } catch (e) {
      emailError = String(e && e.message || e);
      console.error('notifyRequester failed: ' + emailError);
    }
  }
  return { success: true, changed: changed, emailSent: emailSent, emailError: emailError };
}

function locateRow_(sh, row, ticketId) {
  const tid = str_(ticketId);
  const last = sh.getLastRow();
  const r = parseInt(row, 10);
  if (r >= 2 && r <= last) {
    if (!tid || str_(sh.getRange(r, COL.TICKET_ID).getValue()) === tid) return r;
  }
  if (!tid || last < 2) return 0;
  const ids = sh.getRange(2, COL.TICKET_ID, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (str_(ids[i][0]) === tid) return i + 2;
  return 0;
}

function esc_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br>');
}

function emailLayout_(title, color, rows, footer) {
  const trs = rows.filter(function (r) { return r[1] !== '' && r[1] !== null && r[1] !== undefined; })
    .map(function (r) {
      return '<tr><td style="padding:8px 12px;color:#64748b;white-space:nowrap;vertical-align:top;border-bottom:1px solid #e2e8f0;">' +
        esc_(r[0]) + '</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">' +
        (r[2] ? r[1] : esc_(r[1])) + '</td></tr>';
    }).join('');
  return '<div style="font-family:Tahoma,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">' +
    '<div style="background:' + color + ';color:#fff;padding:16px 20px;font-size:18px;font-weight:bold;">' + esc_(title) + '</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:14px;">' + trs + '</table>' +
    '<div style="padding:12px 20px;font-size:12px;color:#94a3b8;background:#f8fafc;">' + esc_(footer) + '</div></div>';
}

function safeQuota_() {
  try { return MailApp.getRemainingDailyQuota(); } catch (e) { return '?'; }
}

function plainText_(title, rows, footer) {
  const lines = [title, ''];
  rows.forEach(function (r) {
    if (r[1] === '' || r[1] === null || r[1] === undefined) return;
    let v = String(r[1]);
    if (r[2]) {
      const m = /href="([^"]+)"/.exec(v);
      v = m ? m[1].replace(/&amp;/g, '&') : v.replace(/<[^>]+>/g, '');
    }
    lines.push(r[0] + ': ' + v);
  });
  lines.push('', footer);
  return lines.join('\n');
}

function getNotifyEmails_() {
  const isEmail = function (x) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); };
  const staffEmails = readStaffRecords_()
    .filter(function (x) { return x.active && isEmail(x.email); })
    .map(function (x) { return x.email; });
  if (staffEmails.length) return staffEmails;
  const fromConfig = (CONFIG.NOTIFY_EMAILS || []).map(str_).filter(isEmail);
  if (fromConfig.length) return fromConfig;
  const prop = PropertiesService.getScriptProperties().getProperty('IT_NOTIFY_EMAILS');
  let list = str_(prop).split(/[,;\s]+/).filter(isEmail);
  if (list.length) return list;
  const me = Session.getEffectiveUser().getEmail();
  return me ? [me] : [];
}

function notifyITNewTicket_(t) {
  const to = getNotifyEmails_();
  if (!to.length) return false;
  const e = t.empInfo;
  const prioColor = t.priority === 'ด่วนมาก' ? '#dc2626' : (t.priority === 'ปานกลาง' ? '#d97706' : '#2563eb');
  const rows = [
    ['Ticket ID', t.ticketId],
    ['ความด่วน', t.priority],
    ['ผู้แจ้ง', e.name + ' (' + e.id + ')'],
    ['แผนก / ตำแหน่ง', [e.dept, e.position].filter(Boolean).join(' / ')],
    ['Plant', e.plant],
    ['เบอร์ติดต่อ', t.phone],
    ['อีเมล', t.empEmail],
    ['เลขทะเบียน / Asset', [t.assetTag, t.assetNumber].filter(Boolean).join(' / ')],
    ['หมวดหมู่', ISSUE_LABELS[t.issueType] || t.issueType],
    ['รายละเอียด', t.detail],
    ['ประเภทเครื่องที่ขอ', t.pcType],
    ['เหตุผลขอเครื่องใหม่', t.reason]
  ];
  if (t.photoUrl) rows.push(['รูปภาพแนบ', '<a href="' + esc_(t.photoUrl) + '">เปิดดูรูปภาพ</a>', true]);
  if (CONFIG.DASHBOARD_URL) rows.push(['Dashboard', '<a href="' + esc_(CONFIG.DASHBOARD_URL) + '">เปิด IT Control Center</a>', true]);

  const title = 'มีงานแจ้งซ่อมใหม่ ' + t.ticketId;
  const footer = 'อีเมลนี้ส่งอัตโนมัติจากระบบ IT Support Helpdesk';
  MailApp.sendEmail({
    to: to.join(','),
    replyTo: t.empEmail,
    subject: '[IT Support] 🆕 ' + t.ticketId + ' — ' + (ISSUE_LABELS[t.issueType] || t.issueType) + ' (' + t.priority + ')',
    body: plainText_(title, rows, footer),
    htmlBody: emailLayout_(title, prioColor, rows, footer),
    name: CONFIG.SENDER_NAME
  });
  return true;
}

function notifyRequester_(t, before) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.empEmail)) return false;
  const color = t.status === STATUS.DONE ? '#16a34a' : (t.status === STATUS.DOING ? '#d97706' : '#2563eb');
  const rows = [
    ['Ticket ID', t.ticketId],
    ['สถานะปัจจุบัน', t.status + (before.status !== t.status ? '  (เดิม: ' + before.status + ')' : '')],
    ['ผู้รับผิดชอบ', t.assignee || 'ทีมงาน IT'],
    ['ปัญหาที่แจ้ง', ISSUE_LABELS[t.issue] || t.issue],
    ['บันทึกจากทีม IT', t.note || '-'],
    ['ส่งซ่อมภายนอก', t.isExternal ? (t.externalReason || 'ใช่') : '']
  ];
  if (t.prNo) rows.push(['เลขที่ PR', t.prNo]);
  if (t.poNo) rows.push(['เลขที่ PO', t.poNo]);
  if (t.newAsset) rows.push(['เลข Asset เครื่องใหม่', t.newAsset]);
  const title = 'อัปเดตสถานะงานแจ้งซ่อม ' + t.ticketId;
  const footer = 'อีเมลนี้ส่งอัตโนมัติ กรุณาอย่าตอบกลับ หากมีข้อสงสัยติดต่อฝ่าย IT โดยตรง';
  MailApp.sendEmail({
    to: t.empEmail,
    subject: '[IT Support] อัปเดตงาน ' + t.ticketId + ' — ' + t.status,
    body: plainText_(title, rows, footer),
    htmlBody: emailLayout_(title, color, rows, footer),
    name: CONFIG.SENDER_NAME,
    noReply: true
  });
  return true;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

const PC_TYPE_LABELS_GS = {
  office: 'Office (สำนักงานทั่วไป)',
  engineering: 'Engineering (วิศวกรรม / ออกแบบ)'
};

function inferPcType_(software) {
  const sw = str_(software);
  if (!sw) return '';
  if (/solid\s*ed|g-?star|auto\s*cad/i.test(sw)) return PC_TYPE_LABELS_GS.engineering;
  if (/microsoft office/i.test(sw) && /prosoft/i.test(sw)) return PC_TYPE_LABELS_GS.office;
  return '';
}

function disableLegacyMode() {
  PropertiesService.getScriptProperties().setProperty('LEGACY_MIGRATED', '1');
  console.log('ปิดโหมดอ่านข้อมูลแบบเก่าแล้ว');
}

function migrateLegacyDryRun() { return migrateLegacy_(false); }
function migrateLegacyApply()  { return migrateLegacy_(true); }

function migrateLegacy_(apply) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('ระบบไม่ว่าง ลองใหม่อีกครั้ง');
  try {
    const sh = getRequestSheet_();
    const last = sh.getLastRow();
    if (last < 2) { console.log('ไม่มีข้อมูลให้ซ่อม'); return {}; }
    const values = sh.getRange(2, 1, last - 1, REQUEST_HEADERS.length).getValues();

    const changes = [];
    const summary = { statusFixed: 0, phoneFixed: 0, pcTypeInferred: 0, emailLowered: 0, emailFilled: 0, assetCleaned: 0, assetSuspicious: [] };
    const push = function (row, col, value, why) { changes.push({ row: row, col: col, value: value, why: why }); };

    values.forEach(function (r, i) {
      const rowNum = i + 2;
      const t = mapRequestRow_(r, rowNum);
      if (!t.ticketId) return;
      if (t.legacy) {
        push(rowNum, COL.STATUS, t.status, t.ticketId + ' สถานะ: "' + str_(r[COL.STATUS - 1]) + '" → "' + t.status + '"');
        push(rowNum, COL.ASSIGNEE, t.assignee, t.ticketId + ' ผู้รับผิดชอบ → "' + t.assignee + '"');
        push(rowNum, COL.NOTE, '', t.ticketId + ' ล้างค่าที่ผิดคอลัมน์ (บันทึกการแก้ไข IT)');
        push(rowNum, COL.IS_EXTERNAL, t.isExternal ? 'ซ่อมภายนอก' : '', t.ticketId + ' ล้างค่าที่ผิดคอลัมน์ (แจ้งซ่อมภายนอก)');
        summary.statusFixed++;
      }

      const ph = r[COL.PHONE - 1];
      if (typeof ph === 'number' && /^[6-9]\d{8}$/.test(String(ph))) {
        push(rowNum, COL.PHONE, '0' + ph, t.ticketId + ' เบอร์ ' + ph + ' → 0' + ph);
        summary.phoneFixed++;
      }

      if (t.issue === 'Request_New_PC' && !t.pcType) {
        const guess = inferPcType_(t.reqSoft);
        if (guess) { push(rowNum, COL.PC_TYPE, guess, t.ticketId + ' ประเภทเครื่อง → ' + guess); summary.pcTypeInferred++; }
      }

      if (t.empEmail && t.empEmail !== t.empEmail.toLowerCase()) {
        push(rowNum, COL.EMP_EMAIL, t.empEmail.toLowerCase(), t.ticketId + ' อีเมล → ' + t.empEmail.toLowerCase());
        summary.emailLowered++;
      } else if (!t.empEmail && t.empId) {
        const emp = findEmployee_(t.empId, t.plant);
        if (emp && emp.email) {
          push(rowNum, COL.EMP_EMAIL, emp.email.toLowerCase(), t.ticketId + ' เติมอีเมลจากฐานพนักงาน → ' + emp.email.toLowerCase());
          summary.emailFilled++;
        }
      }

      const rawAsset = str_(r[COL.ASSET_TAG - 1]);
      if (rawAsset) {
        const na = normAsset_(rawAsset);
        if (na !== rawAsset) { push(rowNum, COL.ASSET_TAG, na, t.ticketId + ' เลขทะเบียน "' + rawAsset + '" → "' + na + '"'); summary.assetCleaned++; }
        if (na && !/^IE-IT-PC-[A-Z]?\d{2,4}$/.test(na)) summary.assetSuspicious.push(t.ticketId + ' : ' + na);
      }
    });

    console.log('— ' + (apply ? 'APPLY' : 'DRY RUN') + ' — จะแก้ทั้งหมด ' + changes.length + ' เซลล์');
    changes.forEach(function (c) { console.log('แถว ' + c.row + ' | ' + c.why); });
    console.log('สรุป: ' + JSON.stringify(summary));
    if (summary.assetSuspicious.length) console.log('⚠️ เลขทะเบียนผิดรูปแบบ (ต้องตรวจเอง): ' + summary.assetSuspicious.join(' ; '));

    if (!apply) { console.log('ยังไม่ได้แก้ข้อมูลจริง — ตรวจรายการแล้วรัน migrateLegacyApply()'); return summary; }

    const stamp = Utilities.formatDate(new Date(), tz_(), 'yyyyMMdd_HHmm');
    sh.copyTo(getSS_()).setName('IT_Requests_backup_' + stamp);

    changes.forEach(function (c) {
      sh.getRange(c.row, c.col).setNumberFormat('@').setValue(c.value);
    });
    sh.getRange(2, COL.DATE, last - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().setProperty('LEGACY_MIGRATED', '1');
    console.log('✅ แก้เสร็จ และสำรองไว้ที่ชีต IT_Requests_backup_' + stamp + ' (ปิดโหมดอ่านข้อมูลแบบเก่าแล้ว)');
    return summary;
  } finally {
    lock.releaseLock();
  }
}

function testEmail(requesterEmail) {
  const to = getNotifyEmails_();
  console.log('ผู้รับอีเมลแจ้งทีม IT: ' + (to.length ? to.join(', ') : '(ไม่มี!)'));
  console.log('ส่งจากบัญชี: ' + Session.getEffectiveUser().getEmail() + ' | โควต้าอีเมลที่เหลือวันนี้: ' + safeQuota_());
  console.log('DASHBOARD_URL: ' + (CONFIG.DASHBOARD_URL || '(ว่าง — อีเมลทีม IT จะไม่มีลิงก์ Dashboard)'));
  if (!to.length) throw new Error('ไม่มีผู้รับอีเมล ตรวจสอบชีต IT_Staff หรือตั้ง Script Property IT_NOTIFY_EMAILS');

  const r1 = notifyITNewTicket_({
    ticketId: 'TEST-000', empInfo: { id: '0000000', name: 'ทดสอบ ระบบอีเมล', dept: 'IT', position: 'Tester', plant: 'Test Plant' },
    empEmail: to[0], phone: '000', priority: 'ปานกลาง', issueType: 'Hardware',
    detail: 'อีเมลทดสอบจากฟังก์ชัน testEmail()', assetTag: 'IE-IT-PC-N000', assetNumber: '', pcType: '', reason: '', photoUrl: ''
  });
  console.log('1) อีเมลแจ้งทีม IT: ' + (r1 ? 'ส่งสำเร็จ' : 'ไม่ได้ส่ง'));

  const target = str_(requesterEmail) || to[0];
  const r2 = notifyRequester_(
    { ticketId: 'TEST-000', status: STATUS.DOING, assignee: 'ทดสอบ', issue: 'Hardware', note: 'อีเมลทดสอบถึงผู้แจ้ง', isExternal: false, externalReason: '', empEmail: target },
    { status: STATUS.PENDING }
  );
  console.log('2) อีเมลแจ้งผู้ขอ → ' + target + ': ' + (r2 ? 'ส่งสำเร็จ' : 'ไม่ได้ส่ง (อีเมลไม่ถูกต้อง)'));
  console.log('โควต้าที่เหลือหลังทดสอบ: ' + safeQuota_() + ' — ตรวจกล่องจดหมาย (และ Spam) ว่าได้รับ 2 ฉบับ');
}

function testSetup() {
  const log = function (m) { console.log(m); };
  const props = PropertiesService.getScriptProperties();
  const staffRecs = readStaffRecords_();
  const withPin = staffRecs.filter(function (x) { return x.active && x.pin.length >= CONFIG.MIN_PIN_LENGTH; });
  log('ช่างในชีต ' + CONFIG.SHEET_IT_STAFF + ': ' + staffRecs.length + ' คน | มี PIN ใช้งานได้: ' + withPin.length + ' คน');
  staffRecs.forEach(function (x) {
    const emailInfo = x.email ? (' | อีเมล: ' + x.email) : ' | ⚠️ ยังไม่มีอีเมลรับแจ้งเตือน';
    if (x.active && x.pin.length < CONFIG.MIN_PIN_LENGTH) {
      log('  ⚠️ ' + x.name + ' — ยังไม่มี PIN หรือสั้นกว่า ' + CONFIG.MIN_PIN_LENGTH + ' ตัวอักษร' + emailInfo);
    } else {
      log('  ✓ ' + x.name + ' (PIN พร้อมใช้งาน)' + emailInfo);
    }
  });
  const pinSeen = {};
  withPin.forEach(function (x) { (pinSeen[x.pin] = pinSeen[x.pin] || []).push(x.name); });
  Object.keys(pinSeen).forEach(function (p) { if (pinSeen[p].length > 1) log('  ❌ PIN ซ้ำกัน: ' + pinSeen[p].join(', ') + ' — ต้องแก้'); });

  log('Legacy mode: ' + (legacyEnabled_() ? 'ยังเปิดอยู่ (รัน migrateLegacyDryRun/Apply เพื่อปิด)' : 'ปิดแล้ว'));
  log('PIN กลางแบบเดิม (Script Property IT_PIN): ' + (props.getProperty('IT_PIN') ? 'ยังตั้งอยู่' : 'ไม่ได้ตั้ง'));
  log('ผู้รับอีเมลแจ้งเตือนทีม IT: ' + getNotifyEmails_().join(', '));
  log('ชีตที่พบ: ' + getSS_().getSheets().map(function (s) { return s.getName(); }).join(', '));
  log('Time zone: ' + tz_());

  const emps = readEmployees_();
  log('พนักงาน (เฉพาะแถวที่มีรหัส): ' + emps.length + ' คน' + (emps[0] ? ' | ตัวอย่าง: ' + JSON.stringify(emps[0]) : ''));

  log('รายชื่อช่างที่แสดงใน Dashboard: ' + JSON.stringify(readITStaff_()));
  const reqs = readRequests_();
  log('IT_Requests ทั้งหมด: ' + reqs.length + ' Ticket');
  const shReq = getRequestSheet_();
  log('แถวถัดไปที่จะเขียน Ticket ใหม่: แถวที่ ' + nextRequestRow_(shReq));
  log('Ticket ID ถัดไปจะเป็น: ' + nextTicketId_(shReq));
  log('โฟลเดอร์รูป: ' + getPhotoFolder_().getUrl());
  log('MailApp โควต้าที่เหลือวันนี้: ' + MailApp.getRemainingDailyQuota());
  log('DASHBOARD_URL: ' + (CONFIG.DASHBOARD_URL || '(ว่าง — แนะนำใส่ URL Dashboard ใน CONFIG เพื่อให้มีลิงก์ในอีเมล)'));
}