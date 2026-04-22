const API_URL = "https://script.google.com/macros/s/AKfycbxwRlbSo_k9_HThI_P4jbWUpJ43dIsJ9GH8GzCU0X-BwdyHjXvXublUZaX9-4fuDucI/exec";

let charts = { priority: null, issueType: null, plant: null };
let globalTickets = [];
let dtInstance = null;
let itModalInstance = null;

async function checkPin() {
  let pin = document.getElementById("pinInput").value.trim();
  if (!pin) return Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสผ่าน', 'warning');
  Swal.fire({ title: 'กำลังตรวจสอบ...', didOpen: () => Swal.showLoading() });
  try {
    let res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "verifyPin", data: { pin: pin } }) });
    let result = await res.json();
    if (result.success && result.isValid) {
      Swal.close(); document.getElementById("loginScreen").style.display = "none"; document.getElementById("appContent").style.display = "block";
      loadITStaff(); refreshData();
    } else { Swal.fire({ title: 'รหัสผ่านไม่ถูกต้อง', icon: 'error' }); document.getElementById("pinInput").value = ""; }
  } catch (err) { Swal.fire('ผิดพลาด', 'เชื่อมต่อระบบไม่ได้', 'error'); }
}

async function loadITStaff() {
  try {
    let res = await fetch(`${API_URL}?action=getITStaff`), staffList = await res.json(), sel = document.getElementById("modalAssignee");
    sel.innerHTML = ""; staffList.forEach(name => { let opt = document.createElement("option"); opt.value = name === "-- เลือกผู้รับผิดชอบ --" ? "" : name; opt.text = name; sel.appendChild(opt); });
  } catch (err) {}
}

function refreshData() { loadStats(); loadITTickets(); }

async function loadITTickets() {
  if ($.fn.DataTable.isDataTable('#itTicketTable')) { $('#itTicketTable').DataTable().destroy(true); dtInstance = null; }
  document.querySelector('#itTicketTable tbody').innerHTML = '<tr><td colspan="7" class="text-center py-5">กำลังโหลดข้อมูล...</td></tr>';
  try {
    let res = await fetch(`${API_URL}?action=getActiveTickets`); globalTickets = await res.json();
    let rows = globalTickets.length === 0 ? ['<tr><td colspan="7" class="text-center py-4">ไม่มีข้อมูล</td></tr>'] : globalTickets.map(r => {
      let badgePrio = r.priority === 'ด่วนมาก' ? '<span class="badge bg-danger rounded-pill">ด่วนมาก</span>' : (r.priority === 'ปานกลาง' ? '<span class="badge bg-warning text-dark rounded-pill">ปานกลาง</span>' : '<span class="badge bg-secondary rounded-pill">ทั่วไป</span>');
      let badgeStat = r.status === 'เสร็จสิ้น' ? '<span class="badge bg-success">เสร็จสิ้น</span>' : (r.status === 'กำลังดำเนินการ' ? '<span class="badge bg-warning text-dark">กำลังดำเนินการ</span>' : '<span class="badge bg-danger">รอดำเนินการ</span>');
      return `<tr data-ticketid="${_esc(r.ticketId)}" style="cursor:pointer;">
        <td class="fw-bold text-info">${_esc(r.ticketId)}<br><small class="text-muted fw-normal">${r.date ? r.date.split(" ")[0] : '-'}</small></td>
        <td>${_esc(r.empName)}<br><small class="text-muted">${_esc(r.empId)}</small></td>
        <td>${_esc(r.plant)}<br><small class="text-muted">${_esc(r.contactPhone)}</small></td>
        <td><div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><b>${_esc(r.issue)}</b><br><small class="text-muted">${_esc(r.detail)}</small></div></td>
        <td>${badgePrio}</td><td>${badgeStat}${r.isExternal ? '<br><span class="badge bg-info mt-1">ซ่อมนอก</span>' : ''}</td>
        <td class="text-center"><button class="btn btn-sm btn-outline-info rounded-pill px-3">Manage</button></td>
      </tr>`;
    });
    document.querySelector('#itTicketTable tbody').innerHTML = rows.join('');
    dtInstance = $('#itTicketTable').DataTable({ destroy: true, dom: '<"row mb-3"<"col-md-6"B><"col-md-6"f>>rt<"row mt-3"<"col-md-6"i><"col-md-6"p>>', buttons: [{ extend: 'excelHtml5', text: 'โหลด Excel', className: 'btn btn-success btn-sm' }] });
    $('#itTicketTable tbody').off('click', 'tr').on('click', 'tr', function () { let tid = $(this).data('ticketid'); if (tid) openITModal(String(tid)); });
  } catch (err) {}
}

async function loadStats() {
  try {
    let res = await fetch(`${API_URL}?action=getStats`), stats = await res.json();
    document.getElementById("statTotal").innerText = stats.total; document.getElementById("statPending").innerText = stats.pending;
    document.getElementById("statDoing").innerText = stats.doing; document.getElementById("statDone").innerText = stats.done;
    Chart.defaults.color = '#9a9a9a'; Object.values(charts).forEach(c => { if (c) c.destroy(); });
    charts.priority = new Chart(document.getElementById('priorityChart'), { type: 'doughnut', data: { labels: ['ทั่วไป', 'ปานกลาง', 'ด่วนมาก'], datasets: [{ data: [stats.byPriority['ทั่วไป'], stats.byPriority['ปานกลาง'], stats.byPriority['ด่วนมาก']], backgroundColor: ['#6c757d', '#ffb300', '#ef5350'], borderWidth: 0 }] } });
    charts.plant = new Chart(document.getElementById('plantChart'), { type: 'pie', data: { labels: Object.keys(stats.byPlant), datasets: [{ data: Object.values(stats.byPlant), backgroundColor: ['#1e88e5', '#8e24aa', '#00897b', '#fb8c00'], borderWidth: 0 }] } });
    charts.issueType = new Chart(document.getElementById('issueTypeChart'), { type: 'bar', data: { labels: Object.keys(stats.byIssueType), datasets: [{ label: 'Tickets', data: Object.values(stats.byIssueType), backgroundColor: '#42a5f5', borderRadius: 4 }] } });
  } catch(err) {}
}

function openITModal(ticketId) {
  var t = globalTickets.find(x => x.ticketId === ticketId); if (!t) return;
  document.getElementById("m_ticketId").innerText = t.ticketId; document.getElementById("m_empName").innerText = `${t.empName} (${t.empId})`;
  document.getElementById("m_deptPos").innerText = `${t.dept} / ${t.position}`; document.getElementById("m_plantLoc").innerText = `${t.plant} / โทร: ${t.contactPhone}`;
  document.getElementById("m_asset").innerText = t.asset || "-"; document.getElementById("m_empEmail").innerText = t.empEmail || "-";
  document.getElementById("m_issueType").innerText = t.issue; document.getElementById("m_detail").innerText = t.detail;

  var isNewPc = t.issue === "Request_New_PC"; document.getElementById("m_newPcSection").style.display = isNewPc ? "block" : "none";
  if (isNewPc) { document.getElementById("m_reasonPc").innerText = t.reasonPc; document.getElementById("m_reqSoft").innerText = t.reqSoft; var photoLink = document.getElementById("m_photoLink"); if (t.photo) { photoLink.style.display = "inline-block"; photoLink.href = t.photo; } else photoLink.style.display = "none"; }
  
  document.getElementById("modalRow").value = t.row; document.getElementById("modalStatus").value = t.status || "รอดำเนินการ"; document.getElementById("modalNotes").value = t.note || "";
  document.getElementById("modalAssignee").value = t.assignee || "";
  
  var isExt = !!(t.isExternal && t.isExternal.trim() !== ""); document.getElementById("isExternalCheck").checked = isExt;
  document.getElementById("externalReason").value = t.externalReason || ""; document.getElementById("externalReasonBox").style.display = isExt ? "block" : "none";
  
  onStatusChange();
  if (!itModalInstance) itModalInstance = new bootstrap.Modal(document.getElementById('itModal')); itModalInstance.show();
}

function onStatusChange() {
  var st = document.getElementById("modalStatus").value, extSec = document.getElementById("externalSection");
  if (st === "กำลังดำเนินการ") extSec.style.display = "block"; else { extSec.style.display = "none"; document.getElementById("isExternalCheck").checked = false; document.getElementById("externalReasonBox").style.display = "none"; document.getElementById("externalReason").value = ""; }
}
function onExternalToggle() { var chk = document.getElementById("isExternalCheck").checked; document.getElementById("externalReasonBox").style.display = chk ? "block" : "none"; if (!chk) document.getElementById("externalReason").value = ""; }

async function saveITUpdate() {
  var row = document.getElementById("modalRow").value, status = document.getElementById("modalStatus").value, assignee = document.getElementById("modalAssignee").value;
  var notes = document.getElementById("modalNotes").value, isExternal = document.getElementById("isExternalCheck").checked, extReason = document.getElementById("externalReason").value;
  if (isExternal && extReason.trim() === "") return Swal.fire('ผิดพลาด', 'กรอกรายละเอียดซ่อมภายนอก', 'warning');
  Swal.fire({ title: 'บันทึก...', didOpen: () => Swal.showLoading() });
  try {
    let res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "updateTicket", data: { row: row, status: status, assignee: assignee, notes: notes, isExternal: isExternal, extReason: extReason } }) });
    let result = await res.json();
    if (result.success) { Swal.fire({ title: 'อัปเดตสำเร็จ', icon: 'success', timer: 1500, showConfirmButton: false }); itModalInstance.hide(); refreshData(); }
  } catch (err) { Swal.fire('ผิดพลาด', 'เซิร์ฟเวอร์ขัดข้อง', 'error'); }
}
function _esc(str) { return str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }