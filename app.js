const API_URL = "https://script.google.com/macros/s/AKfycbxwRlbSo_k9_HThI_P4jbWUpJ43dIsJ9GH8GzCU0X-BwdyHjXvXublUZaX9-4fuDucI/exec";

let allEmployees = [];

// ════════════════════════════════════════════════════════════
//  📦 รายการโปรแกรมแยกตามประเภทเครื่อง (display-only)
// ════════════════════════════════════════════════════════════
const SOFTWARE_LIST = {
  office: [
    { icon: "📝", name: "Microsoft Office" },
    { icon: "📄", name: "Adobe Acrobat Reader" },
    { icon: "💚", name: "LINE" },
    { icon: "🗜️", name: "SAP" },
    { icon: "🛡️", name: "Prosoft" },
    { icon: "🔒", name: "VPN Client" },
    { icon: "🖥️", name: "AnyDesk / Remote" },
  ],
  engineering: [
    { icon: "📐", name: "G-Star/AutoCAD" },
    { icon: "🔩", name: "Solid Edge/SolidWorks" },
    { icon: "📝", name: "Microsoft Office" },
    { icon: "📄", name: "Adobe Acrobat X Pro" },
    { icon: "💚", name: "LINE" },
    { icon: "🗜️", name: "SAP" },
    { icon: "🛡️", name: "Prosoft" },
    { icon: "🔒", name: "VPN Client" },
    { icon: "🖥️", name: "AnyDesk / Remote" },
  ],
};

// ════════════════════════════════════════════════════════════
//  🚀 Init
// ════════════════════════════════════════════════════════════
window.onload = async function () {
  try {
    const res = await fetch(API_URL + "?action=getEmployees");
    allEmployees = await res.json();
    document.getElementById('loadingOverlay').style.display = 'none';
  } catch (err) {
    Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
    document.getElementById('loadingOverlay').style.display = 'none';
  }
};

// ════════════════════════════════════════════════════════════
//  🗂️ Tab switching
// ════════════════════════════════════════════════════════════
function switchTab(tabId, el) {
  document.querySelectorAll('.section-div').forEach(d => d.classList.remove('active-section'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById(tabId).classList.add('active-section');
  el.classList.add('active');
}

// ════════════════════════════════════════════════════════════
//  🔍 Employee Autocomplete
// ════════════════════════════════════════════════════════════
document.getElementById('searchEmpInput').addEventListener('input', function () {
  let val = this.value.toLowerCase().trim(), list = document.getElementById('autocompleteList');
  list.innerHTML = '';
  if (!val) { list.style.display = 'none'; return; }

  let matches = allEmployees
    .filter(e => e.id.toLowerCase().includes(val) || e.name.toLowerCase().includes(val))
    .slice(0, 15);

  if (matches.length === 0) {
    list.innerHTML = '<div class="list-group-item text-muted text-center py-3">ไม่พบพนักงานในระบบ</div>';
    list.style.display = 'block'; return;
  }

  matches.forEach(emp => {
    let item = document.createElement('a');
    item.className = 'list-group-item list-group-item-action py-2';
    let assetBadge = emp.assetTag ? ` <span class="badge bg-success" style="font-size:10px;">${_esc(emp.assetTag)}</span>` : '';
    item.innerHTML = `<span class="text-primary fw-bold">${_esc(emp.id)}</span> — ${_esc(emp.name)}${assetBadge}<br><small class="text-muted">${_esc(emp.position)} | ${_esc(emp.dept)}</small>`;
    item.addEventListener('click', () => { selectEmployee(emp); list.style.display = 'none'; });
    list.appendChild(item);
  });
  list.style.display = 'block';
});

function selectEmployee(emp) {
  document.getElementById('empId').value      = emp.id;
  document.getElementById('empName').value    = emp.name;
  document.getElementById('empDept').value    = emp.dept;
  document.getElementById('empPosition').value = emp.position;
  document.getElementById('empPlant').value   = emp.plant;
  document.getElementById('searchEmpInput').value = emp.name;

  document.getElementById('d_empId').innerText     = emp.id;
  document.getElementById('d_empName').innerText   = emp.name;
  document.getElementById('d_empPosDept').innerText = `${emp.position} / ${emp.dept}`;
  document.getElementById('d_empPlant').innerText  = emp.plant;
  document.getElementById('employeeInfoBox').style.display = 'block';

  // ✅ assetTag → เลขทะเบียน
  let assetInput = document.getElementById('assetTag');
  if (emp.assetTag && emp.assetTag.trim() !== '') {
    assetInput.value = emp.assetTag;
    document.getElementById('d_empAssetTag').innerText    = emp.assetTag;
    document.getElementById('d_assetTagWrap').style.display  = '';
    document.getElementById('assetAutoLabel').style.display  = '';
    document.getElementById('assetTagHint').style.display    = '';
    assetInput.classList.add('field-autofilled');
  } else {
    assetInput.value = '';
    document.getElementById('d_assetTagWrap').style.display  = 'none';
    document.getElementById('assetAutoLabel').style.display  = 'none';
    document.getElementById('assetTagHint').style.display    = 'none';
    assetInput.classList.remove('field-autofilled');
  }
  setTimeout(() => document.getElementById('empEmail').focus(), 50);
}

document.getElementById('assetTag').addEventListener('input', function () {
  this.classList.remove('field-autofilled');
});

// ใช้ pointerdown แทน click → ไม่ block native select picker บนมือถือ
document.addEventListener('pointerdown', e => {
  let input = document.getElementById('searchEmpInput'),
      list  = document.getElementById('autocompleteList');
  if (list.style.display === 'none') return;
  if (e.target !== input && !list.contains(e.target)) list.style.display = 'none';
});

// ════════════════════════════════════════════════════════════
//  🖥️ New PC Section — toggle
// ════════════════════════════════════════════════════════════
function toggleNewPcSection() {
  let isPC = document.getElementById('issueType').value === 'Request_New_PC';
  document.getElementById('newPcSection').style.display = isPC ? 'block' : 'none';
  document.getElementById('reasonNewPc').required = isPC;
  document.getElementById('pcTypeSelect').required = isPC;

  if (!isPC) {
    document.getElementById('pcTypeSelect').value = '';
    document.getElementById('softwareSection').style.display = 'none';
    document.getElementById('softwareGrid').innerHTML = '';
  }
}

// ════════════════════════════════════════════════════════════
//  🖥️ เมื่อเลือกประเภทเครื่อง → render software pills (display-only)
// ════════════════════════════════════════════════════════════
function onPcTypeChange() {
  const type    = document.getElementById('pcTypeSelect').value;
  const section = document.getElementById('softwareSection');
  const grid    = document.getElementById('softwareGrid');

  if (!type) {
    section.style.display = 'none';
    grid.innerHTML = '';
    return;
  }

  const list = SOFTWARE_LIST[type] || [];

  // ✅ render เป็น pill อ่านอย่างเดียว — ไม่มี checkbox
  grid.innerHTML = list.map(sw => `
    <span class="sw-pill">
      <span class="sw-icon">${sw.icon}</span>
      <span>${sw.name}</span>
    </span>
  `).join('');

  section.style.display = 'block';
}

/** รวบรวมรายชื่อโปรแกรมทั้งหมดของประเภทที่เลือก (ส่งไป backend) */
function getSelectedSoftware() {
  const type = document.getElementById('pcTypeSelect').value;
  if (!type) return '';
  const list = SOFTWARE_LIST[type] || [];
  return list.map(sw => sw.name).join(', ');
}

/** ฉลากประเภทเครื่อง */
function getPcTypeLabel() {
  const sel = document.getElementById('pcTypeSelect');
  return sel.options[sel.selectedIndex]?.text || '';
}

// ════════════════════════════════════════════════════════════
//  🔄 Submit Loading Overlay Helpers
// ════════════════════════════════════════════════════════════

/** เปิด overlay + reset ทุก step กลับเป็น pending */
function showSubmitOverlay(hasFile) {
  const overlay = document.getElementById('submitOverlay');
  overlay.classList.add('active');

  // reset all steps
  [1,2,3,4].forEach(n => _setStep(n, 'pending'));

  // ถ้าไม่มีไฟล์ → ซ่อน step อัปโหลดรูป
  document.getElementById('step2').style.display = hasFile ? 'flex' : 'none';
}

function hideSubmitOverlay() {
  document.getElementById('submitOverlay').classList.remove('active');
}

/**
 * อัปเดตสถานะ step
 * @param {number} n      - หมายเลข step (1-4)
 * @param {'pending'|'active'|'done'|'error'} state
 */
function _setStep(n, state) {
  const icon  = document.getElementById(`step${n}Icon`);
  const label = document.getElementById(`step${n}Label`);
  icon.className  = `step-icon ${state}`;
  label.className = `step-label ${state}`;

  if (state === 'active') {
    icon.innerHTML = '<div class="step-mini-spin"></div>';
  } else if (state === 'done') {
    icon.innerHTML = '<i class="bi bi-check-lg"></i>';
  } else if (state === 'error') {
    icon.innerHTML = '<i class="bi bi-x-lg"></i>';
  } else {
    icon.innerHTML = '<i class="bi bi-check-lg"></i>';
  }
}

// ════════════════════════════════════════════════════════════
//  📤 Submit
// ════════════════════════════════════════════════════════════
async function prepareSubmit() {
  if (!document.getElementById('empId').value.trim())
    return Swal.fire('ข้อมูลไม่ครบ', 'เลือกพนักงานก่อนครับ', 'warning');

  let emailVal = document.getElementById('empEmail').value.trim();
  if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal))
    return Swal.fire('ผิดพลาด', 'กรอกอีเมลให้ถูกต้อง', 'warning');

  if (!document.getElementById('itForm').checkValidity())
    return document.getElementById('itForm').reportValidity();

  let issueType = document.getElementById('issueType').value;
  let fileInput = document.getElementById('oldPcPhoto');

  if (issueType === 'Request_New_PC') {
    if (fileInput.files.length === 0)
      return Swal.fire('ข้อมูลไม่ครบ', 'แนบรูปภาพด้วยครับ', 'warning');
    if (!document.getElementById('pcTypeSelect').value)
      return Swal.fire('ข้อมูลไม่ครบ', 'กรุณาเลือกประเภทเครื่องด้วยครับ', 'warning');
  }

  const hasFile = issueType === 'Request_New_PC' && fileInput.files.length > 0;

  // ── disable ปุ่ม + เปิด overlay ──
  let btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> กำลังบันทึก...';
  showSubmitOverlay(hasFile);

  // ── Step 1: ตรวจสอบข้อมูล ──
  _setStep(1, 'active');
  await _delay(400);

  const selectedSoftware = getSelectedSoftware();
  const pcTypeLabel      = getPcTypeLabel();

  let formData = {
    empId:            document.getElementById('empId').value,
    empName:          document.getElementById('empName').value,
    empDept:          document.getElementById('empDept').value,
    empPosition:      document.getElementById('empPosition').value,
    empPlant:         document.getElementById('empPlant').value,
    empEmail:         emailVal,
    contactPhone:     document.getElementById('contactPhone').value,
    assetTag:         document.getElementById('assetTag').value,
    assetNumber:      document.getElementById('assetNumber').value,
    priority:         document.getElementById('priority').value,
    issueType:        issueType,
    issueDetail:      document.getElementById('issueDetail').value,
    reasonNewPc:      document.getElementById('reasonNewPc').value,
    pcType:           pcTypeLabel,
    requiredSoftware: selectedSoftware,
    fileName: '', mimeType: '', fileData: ''
  };

  _setStep(1, 'done');

  // ── Step 2: อ่านไฟล์รูป (ถ้ามี) ──
  if (hasFile) {
    _setStep(2, 'active');
    try {
      const fileResult = await _readFileAsBase64(fileInput.files[0]);
      formData.fileData = fileResult.data;
      formData.fileName = fileInput.files[0].name;
      formData.mimeType = fileInput.files[0].type;
      _setStep(2, 'done');
    } catch(err) {
      _setStep(2, 'error');
      hideSubmitOverlay();
      Swal.fire('ผิดพลาด', 'อ่านไฟล์รูปไม่ได้', 'error');
      resetBtn();
      return;
    }
  }

  // ── Step 3 & 4: ส่งข้อมูล ──
  await sendData(formData);
}

/** อ่านไฟล์เป็น Promise */
function _readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve({ data: e.target.result.split(',')[1] });
    reader.onerror = () => reject(new Error('read error'));
    reader.readAsDataURL(file);
  });
}

/** หน่วง ms */
function _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sendData(formData) {
  // ── Step 3: บันทึก Ticket ──
  _setStep(3, 'active');
  try {
    const res    = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "saveTicket", data: formData })
    });
    const result = await res.json();

    if (result.success) {
      _setStep(3, 'done');

      // ── Step 4: ส่งอีเมล (simulate — backend ทำเอง) ──
      _setStep(4, 'active');
      await _delay(700);
      _setStep(4, 'done');

      await _delay(400);
      hideSubmitOverlay();

      Swal.fire({
        icon: 'success',
        title: 'บันทึกสำเร็จ! 🎉',
        html: `Ticket ID: <b class="text-primary">${result.ticketId}</b><br>
               <small class="text-muted">แจ้งเตือนไปที่ ${_esc(formData.empEmail)}</small>`,
        confirmButtonText: 'รับทราบ'
      });
      resetForm();
    } else {
      _setStep(3, 'error');
      await _delay(300);
      hideSubmitOverlay();
      Swal.fire('เกิดข้อผิดพลาด', result.error || 'ไม่สามารถบันทึกได้', 'error');
      resetBtn();
    }
  } catch (err) {
    _setStep(3, 'error');
    await _delay(300);
    hideSubmitOverlay();
    Swal.fire('ผิดพลาด', 'เซิร์ฟเวอร์ขัดข้อง กรุณาลองใหม่อีกครั้ง', 'error');
    resetBtn();
  }
}

function resetForm() {
  document.getElementById('itForm').reset();
  document.getElementById('employeeInfoBox').style.display = 'none';
  document.getElementById('softwareSection').style.display = 'none';
  document.getElementById('softwareGrid').innerHTML = '';
  toggleNewPcSection();
  resetBtn();
}

function resetBtn() {
  let btn = document.getElementById('submitBtn');
  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-send-fill"></i> ยืนยันการส่งข้อมูล';
}

// ════════════════════════════════════════════════════════════
//  📋 Track Tickets
// ════════════════════════════════════════════════════════════
async function loadMyTickets() {
  let empId = document.getElementById('trackEmpId').value.trim();
  if (!empId) return Swal.fire('แจ้งเตือน', 'กรอกรหัสพนักงาน', 'warning');

  let tbody = document.querySelector('#myTicketTable tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">กำลังโหลด...</td></tr>';

  try {
    const res  = await fetch(`${API_URL}?action=getTickets&empId=${empId}`);
    const data = await res.json();
    tbody.innerHTML = '';

    if (data.length === 0)
      return (tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">ไม่พบประวัติ</td></tr>');

    const statusMap = {
      'เสร็จสิ้น':        'bg-success',
      'กำลังดำเนินการ':   'bg-warning text-dark',
      'รอดำเนินการ':       'bg-secondary'
    };
    data.forEach(r => {
      let extCell = r.isExternal ? '<span class="badge bg-info text-dark">แจ้งซ่อมนอก</span>' : '—';
      tbody.innerHTML += `
        <tr>
          <td class="fw-bold text-primary" style="white-space:nowrap;">${_esc(r.ticketId)}</td>
          <td style="white-space:nowrap;">${r.date.split(' ')[0]}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(r.issue)}</td>
          <td><span class="badge ${statusMap[r.status]}">${_esc(r.status)}</span></td>
          <td class="d-none d-md-table-cell">${_esc(r.assignee || '—')}</td>
          <td class="d-none d-sm-table-cell">${extCell}</td>
          <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${_esc(r.itNote || '—')}</td>
        </tr>`;
    });
  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">โหลดผิดพลาด</td></tr>';
  }
}

// ════════════════════════════════════════════════════════════
//  🛡️ XSS Escape
// ════════════════════════════════════════════════════════════
function _esc(str) {
  return str
    ? String(str)
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
    : '';
}