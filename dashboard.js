const API_URL = "https://script.google.com/macros/s/AKfycbynnqb_VtOh783A2d9_5TLkySHepKGcstRrnkZpCcjpdHECdNg1oPgFlKu2p0pCRJXI/exec";

let charts = { priority: null, issueType: null, plant: null };
let globalTickets = [];
let dtInstance = null;
let itModalInstance = null;

// ════════════════════════════════════════════════════════════
//  🎨 Dynamic color palette
// ════════════════════════════════════════════════════════════
const CHART_COLORS = [
  '#1e88e5','#8e24aa','#00897b','#fb8c00','#e53935',
  '#43a047','#f4511e','#00acc1','#6d4c41','#546e7a',
  '#5e35b1','#039be5','#d81b60','#00b0ff','#ffd600'
];

/**
 * FIX: ตรวจสอบค่า isExternal ให้ถูกต้อง
 * ป้องกันกรณีที่ column มีชื่อ assignee หลุดเข้ามาแทน TRUE/FALSE (bug ข้อมูลเก่า)
 */
function _isExternalTrue(val) {
  return (val === true || val === 'true' || val === 'TRUE' || val === '1' || val === 1);
}

// ════════════════════════════════════════════════════════════
//  🔐 PIN Login
// ════════════════════════════════════════════════════════════
async function checkPin() {
  let pin = document.getElementById("pinInput").value.trim();
  if (!pin) return Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสผ่าน', 'warning');
  Swal.fire({ title: 'กำลังตรวจสอบ...', didOpen: () => Swal.showLoading() });
  try {
    let res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "verifyPin", data: { pin } })
    });
    let result = await res.json();
    if (result.success && result.isValid) {
      Swal.close();
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("appContent").style.display  = "block";
      loadITStaff();
      refreshData();
    } else {
      Swal.fire({ title: 'รหัสผ่านไม่ถูกต้อง', icon: 'error' });
      document.getElementById("pinInput").value = "";
    }
  } catch (err) {
    Swal.fire('ผิดพลาด', 'เชื่อมต่อระบบไม่ได้', 'error');
  }
}

// ════════════════════════════════════════════════════════════
//  👥 โหลดรายชื่อช่าง IT
// ════════════════════════════════════════════════════════════
async function loadITStaff() {
  try {
    let res      = await fetch(`${API_URL}?action=getITStaff`);
    let staffList = await res.json();
    let sel = document.getElementById("modalAssignee");
    sel.innerHTML = "";
    staffList.forEach(name => {
      let opt   = document.createElement("option");
      opt.value = (name === "-- เลือกผู้รับผิดชอบ --") ? "" : name;
      opt.text  = name;
      sel.appendChild(opt);
    });
  } catch (err) { /* silent */ }
}

// ════════════════════════════════════════════════════════════
//  🔄 Refresh
// ════════════════════════════════════════════════════════════
function refreshData() { loadStats(); loadITTickets(); }

// ════════════════════════════════════════════════════════════
//  📋 โหลดตาราง Ticket
// ════════════════════════════════════════════════════════════
async function loadITTickets() {
  if ($.fn.DataTable.isDataTable('#itTicketTable')) {
    $('#itTicketTable').DataTable().destroy(true);
    dtInstance = null;
  }
  document.querySelector('#itTicketTable tbody').innerHTML =
    '<tr><td colspan="7" class="text-center py-5">กำลังโหลดข้อมูล...</td></tr>';

  try {
    let res = await fetch(`${API_URL}?action=getActiveTickets`);
    globalTickets = await res.json();

    let rows;
    if (!Array.isArray(globalTickets) || globalTickets.length === 0) {
      rows = ['<tr><td colspan="7" class="text-center py-4">ไม่มีข้อมูล</td></tr>'];
    } else {
      rows = globalTickets.map(r => {

        // ── Priority badge ──
        let badgePrio =
          r.priority === 'ด่วนมาก'  ? '<span class="badge bg-danger rounded-pill">ด่วนมาก</span>'  :
          r.priority === 'ปานกลาง' ? '<span class="badge bg-warning text-dark rounded-pill">ปานกลาง</span>' :
                                      '<span class="badge bg-secondary rounded-pill">ทั่วไป</span>';

        // ── Status badge ──
        let badgeStat =
          r.status === 'เสร็จสิ้น'      ? '<span class="badge bg-success">เสร็จสิ้น</span>'           :
          r.status === 'กำลังดำเนินการ' ? '<span class="badge bg-warning text-dark">กำลังดำเนินการ</span>' :
                                           '<span class="badge bg-danger">รอดำเนินการ</span>';

        // FIX: ตรวจ isExternal ด้วย _isExternalTrue() เท่านั้น
        let extBadge = _isExternalTrue(r.isExternal)
          ? '<br><span class="badge bg-info mt-1">ซ่อมนอก</span>'
          : '';

        // FIX: ตัด .0 ออกจาก empId
        let empIdDisplay = r.empId ? String(r.empId).replace(/\.0$/, '') : '-';

        return `<tr data-ticketid="${_esc(r.ticketId)}" style="cursor:pointer;">
          <td class="fw-bold text-info">${_esc(r.ticketId)}<br>
            <small class="text-muted fw-normal">${r.date ? r.date.split(' ')[0] : '-'}</small>
          </td>
          <td>${_esc(r.empName)}<br><small class="text-muted">${_esc(empIdDisplay)}</small></td>
          <td>${_esc(r.plant)}<br><small class="text-muted">${_esc(r.contactPhone)}</small></td>
          <td>
            <div style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              <b>${_esc(r.issue)}</b><br>
              <small class="text-muted">${_esc(r.detail)}</small>
            </div>
          </td>
          <td>${badgePrio}</td>
          <td>${badgeStat}${extBadge}</td>
          <td class="text-center">
            <button class="btn btn-sm btn-outline-info rounded-pill px-3">Manage</button>
          </td>
        </tr>`;
      });
    }

    document.querySelector('#itTicketTable tbody').innerHTML = rows.join('');

    dtInstance = $('#itTicketTable').DataTable({
      destroy: true,
      dom: '<"row mb-3"<"col-md-6"B><"col-md-6"f>>rt<"row mt-3"<"col-md-6"i><"col-md-6"p>>',
      buttons: [{ extend: 'excelHtml5', text: 'โหลด Excel', className: 'btn btn-success btn-sm' }],
      language: {
        search:       'ค้นหา:',
        lengthMenu:   'แสดง _MENU_ รายการ',
        info:         'แสดง _START_ - _END_ จาก _TOTAL_ รายการ',
        paginate:     { first: '«', last: '»', next: '›', previous: '‹' },
        emptyTable:   'ไม่มีข้อมูล',
        zeroRecords:  'ไม่พบข้อมูลที่ค้นหา'
      }
    });

    $('#itTicketTable tbody')
      .off('click', 'tr')
      .on('click', 'tr', function () {
        let tid = $(this).data('ticketid');
        if (tid) openITModal(String(tid));
      });

  } catch (err) {
    document.querySelector('#itTicketTable tbody').innerHTML =
      '<tr><td colspan="7" class="text-center text-danger py-5">โหลดข้อมูลล้มเหลว กรุณากด Sync ใหม่</td></tr>';
    console.error('loadITTickets error:', err);
  }
}

// ════════════════════════════════════════════════════════════
//  📊 Stats + Charts
// ════════════════════════════════════════════════════════════
async function loadStats() {
  try {
    let res   = await fetch(`${API_URL}?action=getStats`);
    let stats = await res.json();

    document.getElementById("statTotal").innerText   = stats.total   ?? 0;
    document.getElementById("statPending").innerText = stats.pending ?? 0;
    document.getElementById("statDoing").innerText   = stats.doing   ?? 0;
    document.getElementById("statDone").innerText    = stats.done    ?? 0;

    Chart.defaults.color = '#9a9a9a';

    // destroy เก่าก่อน
    Object.keys(charts).forEach(k => {
      if (charts[k]) { charts[k].destroy(); charts[k] = null; }
    });

    // ── Priority Doughnut ── FIX: || 0 ป้องกัน undefined
    charts.priority = new Chart(document.getElementById('priorityChart'), {
      type: 'doughnut',
      data: {
        labels: ['ทั่วไป', 'ปานกลาง', 'ด่วนมาก'],
        datasets: [{
          data: [
            (stats.byPriority?.['ทั่วไป'])  || 0,
            (stats.byPriority?.['ปานกลาง']) || 0,
            (stats.byPriority?.['ด่วนมาก']) || 0
          ],
          backgroundColor: ['#6c757d', '#ffb300', '#ef5350'],
          borderWidth: 0
        }]
      },
      options: { plugins: { legend: { position: 'bottom' } } }
    });

    // ── Plant Pie ── FIX: dynamic colors
    if (stats.byPlant && Object.keys(stats.byPlant).length > 0) {
      let plantLabels = Object.keys(stats.byPlant);
      let plantColors = plantLabels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
      charts.plant = new Chart(document.getElementById('plantChart'), {
        type: 'pie',
        data: {
          labels: plantLabels,
          datasets: [{ data: Object.values(stats.byPlant), backgroundColor: plantColors, borderWidth: 0 }]
        },
        options: { plugins: { legend: { position: 'bottom' } } }
      });
    }

    // ── Issue Type Bar ──
    if (stats.byIssueType && Object.keys(stats.byIssueType).length > 0) {
      charts.issueType = new Chart(document.getElementById('issueTypeChart'), {
        type: 'bar',
        data: {
          labels: Object.keys(stats.byIssueType),
          datasets: [{
            label: 'Tickets',
            data: Object.values(stats.byIssueType),
            backgroundColor: '#42a5f5',
            borderRadius: 4
          }]
        },
        options: {
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
      });
    }

  } catch (err) {
    console.error('loadStats error:', err);
  }
}

// ════════════════════════════════════════════════════════════
//  🖊️ Modal จัดการ Ticket
// ════════════════════════════════════════════════════════════
function openITModal(ticketId) {
  let t = globalTickets.find(x => x.ticketId === ticketId);
  if (!t) return;

  // FIX: ตัด .0 จาก empId
  let empIdClean = t.empId ? String(t.empId).replace(/\.0$/, '') : '-';

  document.getElementById("m_ticketId").innerText  = t.ticketId;
  document.getElementById("m_empName").innerText   = `${t.empName} (${empIdClean})`;
  document.getElementById("m_deptPos").innerText   = `${t.dept || '-'} / ${t.position || '-'}`;
  document.getElementById("m_plantLoc").innerText  = `${t.plant || '-'} / โทร: ${t.contactPhone || '-'}`;
  document.getElementById("m_asset").innerText     = t.asset    || "-";
  document.getElementById("m_empEmail").innerText  = t.empEmail || "-";
  document.getElementById("m_issueType").innerText = t.issue;
  document.getElementById("m_detail").innerText    = t.detail;

  let isNewPc = (t.issue === "Request_New_PC");
  document.getElementById("m_newPcSection").style.display = isNewPc ? "block" : "none";
  if (isNewPc) {
    document.getElementById("m_reasonPc").innerText = t.reasonPc || '-';
    document.getElementById("m_reqSoft").innerText  = t.reqSoft  || '-';
    let photoLink = document.getElementById("m_photoLink");
    if (t.photo) { photoLink.style.display = "inline-block"; photoLink.href = t.photo; }
    else           photoLink.style.display = "none";
  }

  document.getElementById("modalRow").value      = t.row      || '';
  document.getElementById("modalStatus").value   = t.status   || "รอดำเนินการ";
  document.getElementById("modalNotes").value    = t.note     || "";
  document.getElementById("modalAssignee").value = t.assignee || "";

  // FIX: ใช้ _isExternalTrue() + ป้องกัน .trim() crash
  let isExt = _isExternalTrue(t.isExternal);
  document.getElementById("isExternalCheck").checked     = isExt;
  document.getElementById("externalReason").value        = t.externalReason ? String(t.externalReason) : "";
  document.getElementById("externalReasonBox").style.display = isExt ? "block" : "none";

  onStatusChange();

  if (!itModalInstance) {
    itModalInstance = new bootstrap.Modal(document.getElementById('itModal'));
  }
  itModalInstance.show();
}

// ════════════════════════════════════════════════════════════
//  ⚙️ Status / External toggle
// ════════════════════════════════════════════════════════════
function onStatusChange() {
  let st = document.getElementById("modalStatus").value;
  let extSec = document.getElementById("externalSection");
  if (st === "กำลังดำเนินการ") {
    extSec.style.display = "block";
  } else {
    extSec.style.display = "none";
    document.getElementById("isExternalCheck").checked      = false;
    document.getElementById("externalReasonBox").style.display = "none";
    document.getElementById("externalReason").value         = "";
  }
}

function onExternalToggle() {
  let chk = document.getElementById("isExternalCheck").checked;
  document.getElementById("externalReasonBox").style.display = chk ? "block" : "none";
  if (!chk) document.getElementById("externalReason").value = "";
}

// ════════════════════════════════════════════════════════════
//  💾 บันทึกการอัปเดต
// ════════════════════════════════════════════════════════════
async function saveITUpdate() {
  let row        = document.getElementById("modalRow").value;
  let status     = document.getElementById("modalStatus").value;
  let assignee   = document.getElementById("modalAssignee").value;
  let notes      = document.getElementById("modalNotes").value;
  let isExternal = document.getElementById("isExternalCheck").checked;
  let extReason  = document.getElementById("externalReason").value;

  if (isExternal && !extReason.trim()) {
    return Swal.fire('ผิดพลาด', 'กรอกรายละเอียดซ่อมภายนอก', 'warning');
  }
  Swal.fire({ title: 'บันทึก...', didOpen: () => Swal.showLoading() });
  try {
    let res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "updateTicket", data: { row, status, assignee, notes, isExternal, extReason } })
    });
    let result = await res.json();
    if (result.success) {
      Swal.fire({ title: 'อัปเดตสำเร็จ', icon: 'success', timer: 1500, showConfirmButton: false });
      itModalInstance.hide();
      refreshData();
    } else {
      Swal.fire('ผิดพลาด', result.error || 'ไม่สามารถบันทึกได้', 'error');
    }
  } catch (err) {
    Swal.fire('ผิดพลาด', 'เซิร์ฟเวอร์ขัดข้อง', 'error');
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