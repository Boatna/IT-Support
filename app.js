const API_URL = "https://script.google.com/macros/s/AKfycbxwRlbSo_k9_HThI_P4jbWUpJ43dIsJ9GH8GzCU0X-BwdyHjXvXublUZaX9-4fuDucI/exec";

let allEmployees = [];

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

function switchTab(tabId, el) {
  document.querySelectorAll('.section-div').forEach(d => d.classList.remove('active-section'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  document.getElementById(tabId).classList.add('active-section');
  el.classList.add('active');
}

document.getElementById('searchEmpInput').addEventListener('input', function () {
  let val = this.value.toLowerCase().trim(), list = document.getElementById('autocompleteList');
  list.innerHTML = '';
  if (!val) { list.style.display = 'none'; return; }

  let matches = allEmployees.filter(e => e.id.toLowerCase().includes(val) || e.name.toLowerCase().includes(val)).slice(0, 15);
  if (matches.length === 0) {
    list.innerHTML = '<div class="list-group-item text-muted text-center py-3">ไม่พบพนักงานในระบบ</div>';
    list.style.display = 'block'; return;
  }

  matches.forEach(emp => {
    let item = document.createElement('a'); item.className = 'list-group-item list-group-item-action py-2';
    let assetBadge = emp.assetTag ? ` <span class="badge bg-success" style="font-size:10px;">${_esc(emp.assetTag)}</span>` : '';
    item.innerHTML = `<span class="text-primary fw-bold">${_esc(emp.id)}</span> — ${_esc(emp.name)}${assetBadge}<br><small class="text-muted">${_esc(emp.position)} | ${_esc(emp.dept)}</small>`;
    item.addEventListener('click', () => { selectEmployee(emp); list.style.display = 'none'; });
    list.appendChild(item);
  });
  list.style.display = 'block';
});

function selectEmployee(emp) {
  document.getElementById('empId').value = emp.id; document.getElementById('empName').value = emp.name; document.getElementById('empDept').value = emp.dept;
  document.getElementById('empPosition').value = emp.position; document.getElementById('empPlant').value = emp.plant; document.getElementById('searchEmpInput').value = emp.name;
  document.getElementById('d_empId').innerText = emp.id; document.getElementById('d_empName').innerText = emp.name; document.getElementById('d_empPosDept').innerText = `${emp.position} / ${emp.dept}`;
  document.getElementById('d_empPlant').innerText = emp.plant; document.getElementById('employeeInfoBox').style.display = 'block';

  let assetInput = document.getElementById('assetTag');
  if (emp.assetTag && emp.assetTag.trim() !== '') {
    assetInput.value = emp.assetTag; document.getElementById('d_empAssetTag').innerText = emp.assetTag;
    document.getElementById('d_assetTagWrap').style.display = ''; document.getElementById('assetAutoLabel').style.display = '';
    document.getElementById('assetTagHint').style.display = ''; assetInput.classList.add('field-autofilled');
  } else {
    assetInput.value = ''; document.getElementById('d_assetTagWrap').style.display = 'none';
    document.getElementById('assetAutoLabel').style.display = 'none'; document.getElementById('assetTagHint').style.display = 'none';
    assetInput.classList.remove('field-autofilled');
  }
  setTimeout(() => document.getElementById('empEmail').focus(), 50);
}

document.getElementById('assetTag').addEventListener('input', function () { this.classList.remove('field-autofilled'); });
document.addEventListener('click', e => { let input = document.getElementById('searchEmpInput'), list = document.getElementById('autocompleteList'); if (e.target !== input && !list.contains(e.target)) list.style.display = 'none'; });

function toggleNewPcSection() {
  let isPC = document.getElementById('issueType').value === 'Request_New_PC';
  document.getElementById('newPcSection').style.display = isPC ? 'block' : 'none';
  document.getElementById('reasonNewPc').required = isPC;
}

async function prepareSubmit() {
  if (!document.getElementById('empId').value.trim()) return Swal.fire('ข้อมูลไม่ครบ', 'เลือกพนักงานก่อนครับ', 'warning');
  let emailVal = document.getElementById('empEmail').value.trim();
  if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) return Swal.fire('ผิดพลาด', 'กรอกอีเมลให้ถูกต้อง', 'warning');
  if (!document.getElementById('itForm').checkValidity()) return document.getElementById('itForm').reportValidity();

  let issueType = document.getElementById('issueType').value, fileInput = document.getElementById('oldPcPhoto');
  if (issueType === 'Request_New_PC' && fileInput.files.length === 0) return Swal.fire('ข้อมูลไม่ครบ', 'แนบรูปภาพด้วยครับ', 'warning');

  let btn = document.getElementById('submitBtn'); btn.disabled = true; btn.innerHTML = 'กำลังประมวลผล...';

  let formData = {
    empId: document.getElementById('empId').value, empName: document.getElementById('empName').value, empDept: document.getElementById('empDept').value,
    empPosition: document.getElementById('empPosition').value, empPlant: document.getElementById('empPlant').value, empEmail: emailVal,
    contactPhone: document.getElementById('contactPhone').value, assetTag: document.getElementById('assetTag').value, priority: document.getElementById('priority').value,
    issueType: issueType, issueDetail: document.getElementById('issueDetail').value, reasonNewPc: document.getElementById('reasonNewPc').value,
    requiredSoftware: document.getElementById('requiredSoftware').value, fileName: '', mimeType: '', fileData: ''
  };

  if (issueType === 'Request_New_PC' && fileInput.files.length > 0) {
    let reader = new FileReader();
    reader.onload = function(e) { formData.fileData = e.target.result.split(',')[1]; formData.fileName = fileInput.files[0].name; formData.mimeType = fileInput.files[0].type; sendData(formData); };
    reader.onerror = () => { Swal.fire('ผิดพลาด', 'อ่านไฟล์ไม่ได้', 'error'); resetBtn(); };
    reader.readAsDataURL(fileInput.files[0]);
  } else sendData(formData);
}

async function sendData(formData) {
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "saveTicket", data: formData }) });
    const result = await res.json();
    if (result.success) { Swal.fire('สำเร็จ! 🎉', `Ticket ID: <b>${result.ticketId}</b><br><small>แจ้งเตือนไปที่ ${_esc(formData.empEmail)}</small>`, 'success'); resetForm(); }
    else { Swal.fire('เกิดข้อผิดพลาด', result.error, 'error'); resetBtn(); }
  } catch (err) { Swal.fire('ผิดพลาด', 'เซิร์ฟเวอร์ขัดข้อง', 'error'); resetBtn(); }
}

function resetForm() { document.getElementById('itForm').reset(); document.getElementById('employeeInfoBox').style.display = 'none'; toggleNewPcSection(); resetBtn(); }
function resetBtn() { let btn = document.getElementById('submitBtn'); btn.disabled = false; btn.innerHTML = '<i class="bi bi-send-fill"></i> ยืนยันการส่งข้อมูล'; }

async function loadMyTickets() {
  let empId = document.getElementById('trackEmpId').value.trim(); if (!empId) return Swal.fire('แจ้งเตือน', 'กรอกรหัสพนักงาน', 'warning');
  let tbody = document.querySelector('#myTicketTable tbody'); tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">กำลังโหลด...</td></tr>';
  try {
    const res = await fetch(`${API_URL}?action=getTickets&empId=${empId}`); const data = await res.json();
    tbody.innerHTML = ''; if (data.length === 0) return tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4">ไม่พบประวัติ</td></tr>';
    const statusMap = { 'เสร็จสิ้น': 'bg-success', 'กำลังดำเนินการ': 'bg-warning text-dark', 'รอดำเนินการ': 'bg-secondary' };
    data.forEach(r => {
      let extCell = r.isExternal ? '<span class="badge bg-info text-dark">แจ้งซ่อมนอก</span>' : '—';
      tbody.innerHTML += `<tr><td class="fw-bold text-primary">${_esc(r.ticketId)}</td><td>${r.date.split(' ')[0]}</td><td>${_esc(r.issue)}</td><td><span class="badge ${statusMap[r.status]}">${_esc(r.status)}</span></td><td>${_esc(r.assignee || '—')}</td><td>${extCell}</td><td>${_esc(r.itNote || '—')}</td></tr>`;
    });
  } catch (err) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">โหลดผิดพลาด</td></tr>'; }
}
function _esc(str) { return str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }