const API_URL = "https://script.google.com/macros/s/AKfycbzFn1VEju-pTLm9KXxOY-aMpXg2V9S27MX4QZ_wJbiPXs7IEZrzGC5HP62VLxMc8dp3/exec";

const TOKEN_KEY   = "it_token";
const MY_NAME_KEY = "it_my_name";
const STAFF_KEY   = "it_staff";

let charts = { priority: null, issueType: null, plant: null };
let globalTickets = [];
let dtInstance = null;
let itModalInstance = null;
let autoSyncInterval = null;
let isSaving = false;

const filters = { status: "", flag: "", assignee: "" };

const CHART_COLORS = [
  '#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171',
  '#c084fc', '#fb923c', '#2dd4bf', '#a78bfa', '#94a3b8',
  '#60a5fa', '#4ade80', '#f472b6', '#e879f9', '#facc15'
];

const ISSUE_LABELS = {
  Hardware: "ซ่อมอุปกรณ์ (Hardware)",
  Software: "โปรแกรม / Windows",
  Network: "เครือข่าย / อินเทอร์เน็ต",
  Request_New_PC: "ขอเครื่องใหม่",
  Other: "อื่นๆ"
};

function getToken() { return sessionStorage.getItem(TOKEN_KEY) || ""; }

async function fetchWithTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, Object.assign({}, options || {}, { signal: ctrl.signal }));
  } finally {
    clearTimeout(timer);
  }
}

async function api(action, data) {
  const res = await fetchWithTimeout(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token: getToken(), data: data || {} })
  }, 60000);
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (json && json.code === "UNAUTHORIZED") {
    forceLogout();
    throw new Error("UNAUTHORIZED");
  }
  return json;
}

// เคลียร์ข้อมูล Ticket ออกจากหน้าจอ/หน่วยความจำเมื่อออกจากระบบ
function clearSensitiveData() {
  globalTickets = [];
  try { if (itModalInstance) itModalInstance.hide(); } catch (e) { /* ignore */ }
  if (window.jQuery && $.fn.DataTable && $.fn.DataTable.isDataTable('#itTicketTable')) {
    $('#itTicketTable').DataTable().destroy();
  }
  dtInstance = null;
  const tbody = document.querySelector("#itTicketTable tbody");
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">กำลังโหลดข้อมูล...</td></tr>';
  Object.keys(charts).forEach(k => {
    if (charts[k]) { charts[k].destroy(); charts[k] = null; }
  });
  ["statTotal", "statPending", "statDoing", "statDone"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerText = "0";
  });
  const badge = document.getElementById("ticketCountBadge");
  if (badge) badge.innerText = "0 รายการ";
}

let _logoutNoticeShown = false;
function forceLogout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(STAFF_KEY);
  stopAutoSync();
  clearSensitiveData();
  showLogin();
  if (!_logoutNoticeShown) {
    _logoutNoticeShown = true;
    Swal.fire({
      icon: "info",
      title: "เซสชันหมดอายุ",
      text: "กรุณาใส่ PIN เพื่อเข้าสู่ระบบอีกครั้ง"
    }).then(() => { _logoutNoticeShown = false; });
  }
}

function _showWhoAmI() {
  const who = sessionStorage.getItem(STAFF_KEY);
  const el = document.getElementById("lastSyncTime");
  if (el && who) el.setAttribute("data-who", who);
}

function showLogin() {
  document.getElementById("appContent").style.display  = "none";
  document.getElementById("loginScreen").style.display = "block";
}

function showApp() {
  document.getElementById("loginScreen").style.display = "none";
  document.getElementById("appContent").style.display  = "block";
}

window.addEventListener("DOMContentLoaded", function () {
  registerTableFilter();

  if (getToken()) {
    showApp();
    _showWhoAmI();
    loadITStaff();
    refreshData(false);
    startAutoSync();
  }
});

let _tableFilterRegistered = false;
function registerTableFilter() {
  if (_tableFilterRegistered || !window.jQuery || !$.fn.dataTable) return;
  _tableFilterRegistered = true;

  $.fn.dataTable.ext.search.push(function (settings, _data, dataIndex) {
    if (!settings.nTable || settings.nTable.id !== "itTicketTable") return true;

    const tr = new $.fn.dataTable.Api(settings).row(dataIndex).node();
    if (!tr) return true;

    if (filters.status && tr.dataset.status !== filters.status) return false;
    if (filters.flag === "external" && tr.dataset.external !== "1") return false;
    if (filters.flag === "urgent" && tr.dataset.priority !== "ด่วนมาก") return false;
    
    // กรองช่าง: รองรับทั้งช่างรายคน และกรณี "ยังไม่มีผู้รับผิดชอบ"
    if (filters.assignee === "__UNASSIGNED__") {
      if (tr.dataset.assignee && tr.dataset.assignee.trim()) return false;
    } else if (filters.assignee && tr.dataset.assignee !== filters.assignee) {
      return false;
    }
    return true;
  });
}

async function checkPin() {
  const pinInput = document.getElementById("pinInput");
  const pin = pinInput.value.trim();

  if (!pin) {
    return Swal.fire("แจ้งเตือน", "กรุณากรอกรหัส PIN ก่อนเข้าสู่ระบบ", "warning");
  }

  Swal.fire({
    title: "กำลังตรวจสอบรหัสผ่าน...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const res = await fetchWithTimeout(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "verifyPin", data: { pin } })
    }, 30000);
    const result = await res.json();
    Swal.close();

    if (result.success && result.isValid && result.token) {
      sessionStorage.setItem(TOKEN_KEY, result.token);
      sessionStorage.setItem(STAFF_KEY, result.staff || "");
      pinInput.value = "";
      _showWhoAmI();
      showApp();
      loadITStaff();
      refreshData(true);
      startAutoSync();
    } else if (result.error) {
      Swal.fire({ icon: result.locked ? "warning" : "error", title: "เข้าสู่ระบบไม่สำเร็จ", text: result.error });
      pinInput.value = "";
    } else {
      Swal.fire({
        icon: "error",
        title: "รหัส PIN ไม่ถูกต้อง",
        text: "กรุณาตรวจสอบรหัสผ่านของท่านอีกครั้ง"
      });
      pinInput.value = "";
      pinInput.focus();
    }
  } catch (err) {
    console.error("checkPin error:", err);
    Swal.fire("ข้อผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อตรวจสอบรหัสได้", "error");
  }
}

function logoutIT() {
  Swal.fire({
    title: "ยืนยันการออกจากระบบ?",
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "ออกจากระบบ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#ef4444"
  }).then(result => {
    if (result.isConfirmed) {
      const tk = getToken();
      if (tk) {
        fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "logout", token: tk })
        }).catch(() => {});
      }
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(STAFF_KEY);
      stopAutoSync();
      clearSensitiveData();
      showLogin();
      document.getElementById("pinInput").value = "";
    }
  });
}

function startAutoSync() {
  stopAutoSync();
  const toggle = document.getElementById("autoSyncToggle");
  if (toggle && toggle.checked) {
    autoSyncInterval = setInterval(() => {
      const modal = document.getElementById("itModal");
      const modalOpen = modal && modal.classList.contains("show");
      if (!modalOpen && !document.hidden && getToken()) {
        refreshData(false);
      }
    }, 30000);
  }
}

function stopAutoSync() {
  if (autoSyncInterval) {
    clearInterval(autoSyncInterval);
    autoSyncInterval = null;
  }
}

function toggleAutoSync(checkbox) {
  if (checkbox.checked) startAutoSync();
  else stopAutoSync();
}

function updateLastSyncLabel() {
  const elem = document.getElementById("lastSyncTime");
  if (elem) {
    const d = new Date();
    const pad = n => String(n).padStart(2, "0");
    const who = sessionStorage.getItem(STAFF_KEY);
    elem.innerText = `${who ? "👤 " + who + " · " : ""}ซิงค์ล่าสุด: ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} น.`;
  }
}

async function loadITStaff() {
  try {
    const staffList = await api("getITStaff");
    const modalSel = document.getElementById("modalAssignee");
    if (modalSel) {
      modalSel.innerHTML = "";
      if (Array.isArray(staffList)) {
        staffList.forEach(name => {
          const opt = document.createElement("option");
          opt.value = (name === "-- เลือกผู้รับผิดชอบ --") ? "" : name;
          opt.text  = name;
          modalSel.appendChild(opt);
        });
      }
    }

    const filterSel = document.getElementById("filterAssigneeSelect");
    if (filterSel) {
      filterSel.innerHTML = `
        <option value="">-- แสดงช่างทุกคน --</option>
        <option value="__UNASSIGNED__">⚠️ ยังไม่มีผู้รับผิดชอบ</option>
      `;
      if (Array.isArray(staffList)) {
        staffList.forEach(name => {
          if (name && name !== "-- เลือกผู้รับผิดชอบ --") {
            const opt = document.createElement("option");
            opt.value = name;
            opt.text  = name;
            filterSel.appendChild(opt);
          }
        });
        filterSel.value = filters.assignee;
      }
    }
  } catch (err) {
    if (err.message !== "UNAUTHORIZED") console.warn("loadITStaff error:", err);
  }
}

const photoCache = {};     // url -> data URL (กันโหลดรูปซ้ำ)
let photoReqSeq = 0;       // กันรูปของ Ticket เก่าไปทับ Ticket ที่เปิดใหม่

async function loadTicketPhoto(url, imgEl, statusEl) {
  const seq = ++photoReqSeq;
  imgEl.style.display = "none";
  if (statusEl) { statusEl.style.display = "block"; statusEl.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>กำลังโหลดรูป...'; }

  const show = src => {
    if (seq !== photoReqSeq) return;
    imgEl.onerror = () => {
      if (seq !== photoReqSeq) return;
      imgEl.style.display = "none";
      if (statusEl) { statusEl.style.display = "block"; statusEl.innerText = "ไม่สามารถแสดงรูปได้ กรุณากด 'เปิดดูไฟล์ต้นฉบับ' ด้านล่าง"; }
    };
    imgEl.onload = () => { if (statusEl && seq === photoReqSeq) statusEl.style.display = "none"; };
    imgEl.style.display = "inline-block";
    imgEl.src = src;
  };

  if (photoCache[url]) return show(photoCache[url]);
  try {
    const r = await api("getPhoto", { url });
    if (r && r.success && r.data) {
      photoCache[url] = `data:${r.mime};base64,${r.data}`;
      return show(photoCache[url]);
    }
  } catch (err) {
    if (err.message === "UNAUTHORIZED") return;
  }
  show(_getDriveThumbnail(url, 1000));
}

let _refreshing = false;
async function refreshData(showFeedback = true) {
  if (_refreshing) return;
  _refreshing = true;
  const syncIcon = document.getElementById("syncIcon");
  if (syncIcon) syncIcon.classList.add("syncing-spin");

  try {
    const ok = await loadITTickets();
    if (!ok) return;
    renderStats(globalTickets);
    updateLastSyncLabel();
    if (showFeedback && getToken()) {
      Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: false
      }).fire({ icon: 'success', title: 'อัปเดตข้อมูลล่าสุดเรียบร้อย' });
    }
  } catch (err) {
    console.error("refreshData error:", err);
  } finally {
    _refreshing = false;
    if (syncIcon) syncIcon.classList.remove("syncing-spin");
  }
}

function _priorityBadge(p) {
  if (p === "ด่วนมาก") return '<span class="badge bg-danger rounded-pill"><span class="pulse-dot"></span>ด่วนมาก</span>';
  if (p === "ปานกลาง") return '<span class="badge bg-warning text-dark rounded-pill">ปานกลาง</span>';
  return '<span class="badge bg-secondary rounded-pill">ทั่วไป</span>';
}

function _statusBadge(s) {
  if (s === "เสร็จสิ้น") return '<span class="badge bg-success"><i class="bi bi-check2 me-1"></i>เสร็จสิ้น</span>';
  if (s === "กำลังดำเนินการ") return '<span class="badge bg-warning text-dark"><i class="bi bi-gear me-1"></i>กำลังดำเนินการ</span>';
  return '<span class="badge bg-danger">รอดำเนินการ</span>';
}

async function loadITTickets() {
  let keepPage = 0, keepSearch = "";
  if ($.fn.DataTable.isDataTable('#itTicketTable')) {
    const dt = $('#itTicketTable').DataTable();
    keepPage = dt.page();
    keepSearch = dt.search();
    dt.destroy();
    dtInstance = null;
  }

  const tbody = document.querySelector("#itTicketTable tbody");

  try {
    const data = await api("getActiveTickets");
    if (!Array.isArray(data)) throw new Error((data && data.error) || "รูปแบบข้อมูลไม่ถูกต้อง");
    globalTickets = data;

    const badgeElem = document.getElementById("ticketCountBadge");
    if (badgeElem) badgeElem.innerText = `${globalTickets.length} รายการ`;

    if (globalTickets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">ไม่พบข้อมูลแจ้งซ่อม</td></tr>';
      return true;
    }

    tbody.innerHTML = globalTickets.map(r => {
      const isExt = _isExternalTrue(r.isExternal);
      const extBadge = isExt ? '<br><span class="badge bg-info text-dark mt-1"><i class="bi bi-truck me-1"></i>ซ่อมนอก</span>' : '';
      const empIdClean = r.empId ? String(r.empId).replace(/\.0+$/, "") : "-";
      const dateDisplay = r.date ? String(r.date).split(" ")[0] : "-";
      const timeAgo = _formatRelativeTime(r.date);
      const issueLabel = ISSUE_LABELS[r.issue] || r.issue || "-";
      const assigneeLine = r.assignee
        ? `<span class="assignee-line"><i class="bi bi-person-gear me-1"></i>${_esc(r.assignee)}</span>`
        : '<span class="assignee-line text-muted"><i class="bi bi-person-dash me-1"></i>ยังไม่มีผู้รับผิดชอบ</span>';

      let procureBadges = '';
      if (r.prNo || r.poNo || r.newAsset) {
        const parts = [];
        if (r.prNo) parts.push(`PR: ${_esc(r.prNo)}`);
        if (r.poNo) parts.push(`PO: ${_esc(r.poNo)}`);
        if (r.newAsset) parts.push(`Asset ใหม่: ${_esc(r.newAsset)}`);
        procureBadges = `<div class="mt-1"><span class="badge bg-warning text-dark font-size-11" title="${parts.join(' | ')}"><i class="bi bi-cart-check me-1"></i>${parts.join(' | ')}</span></div>`;
      }

      return `
        <tr data-ticketid="${_esc(r.ticketId)}" data-status="${_esc(r.status)}" data-priority="${_esc(r.priority)}" data-assignee="${_esc(r.assignee || '')}" data-external="${isExt ? '1' : '0'}" style="cursor:pointer;">
          <td data-order="${_esc(r.ticketId)}" class="fw-bold text-info" style="white-space:nowrap;">
            ${_esc(r.ticketId)}<br>
            <small class="text-muted fw-normal">${_esc(dateDisplay)}</small>
            <span class="d-block text-muted" style="font-size:11px;">${_esc(timeAgo)}</span>
          </td>
          <td>
            <strong>${_esc(r.empName || "-")}</strong><br>
            <small class="text-muted">${_esc(empIdClean)}</small>
          </td>
          <td>
            ${_esc(r.plant || "-")}<br>
            <small class="text-muted"><i class="bi bi-telephone me-1"></i>${_esc(r.contactPhone || "-")}</small>
          </td>
          <td>
            <div style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(r.detail)}">
              <span class="text-info fw-semibold">${_esc(issueLabel)}</span><br>
              <small class="text-muted">${_esc(r.detail || "-")}</small>
            </div>
          </td>
          <td>${_priorityBadge(r.priority)}</td>
          <td>${_statusBadge(r.status)}${extBadge}${assigneeLine}${procureBadges}</td>
          <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-info rounded-pill px-3 shadow-sm">
              <i class="bi bi-sliders me-1"></i>Manage
            </button>
          </td>
        </tr>`;
    }).join("");

    dtInstance = $('#itTicketTable').DataTable({
      destroy: true,
      order: [[0, 'desc']],
      search: { search: keepSearch },
      dom: '<"row mb-3"<"col-md-6"B><"col-md-6"f>>rt<"row mt-3"<"col-md-6"i><"col-md-6"p>>',
      buttons: [
        {
          extend: 'excelHtml5',
          text: '<i class="bi bi-file-earmark-excel me-1"></i>ส่งออก Excel',
          className: 'btn btn-success btn-sm shadow-sm',
          title: 'รายการแจ้งซ่อม IT',
          filename: function () { return 'IT_Tickets_' + new Date().toISOString().slice(0, 10); },
          exportOptions: { columns: [0, 1, 2, 3, 4, 5] }
        }
      ],
      language: {
        search:       'ค้นหาข้อมูล:',
        lengthMenu:   'แสดง _MENU_ รายการ',
        info:         'แสดง _START_ ถึง _END_ จากทั้งหมด _TOTAL_ รายการ',
        infoFiltered: '(กรองจาก _MAX_ รายการ)',
        paginate:     { first: '«', last: '»', next: '›', previous: '‹' },
        emptyTable:   'ไม่มีข้อมูลในตาราง',
        zeroRecords:  'ไม่พบข้อมูลที่ตรงกับคำค้นหา'
      }
    });

    const maxPage = Math.max(0, dtInstance.page.info().pages - 1);
    dtInstance.page(Math.min(keepPage, maxPage)).draw(false);

    $('#itTicketTable tbody')
      .off('click', 'tr')
      .on('click', 'tr', function () {
        const tid = this.getAttribute('data-ticketid');
        if (tid) openITModal(tid);
      });

    return true;
  } catch (err) {
    if (err.message === "UNAUTHORIZED") return false;
    console.error("loadITTickets error:", err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">โหลดข้อมูลล้มเหลว กรุณากด Sync Data ใหม่อีกครั้ง</td></tr>';
    return false;
  }
}

function _currentFilterKey() {
  if (filters.flag === "external") return "ซ่อมนอก";
  if (filters.flag === "urgent") return "ด่วนมาก";
  return filters.status;
}

function _syncFilterUI() {
  const key = _currentFilterKey();

  document.querySelectorAll("#quickFilterGroup .filter-pill").forEach(p => {
    p.classList.toggle("active", (p.dataset.key || "") === key);
  });

  document.querySelectorAll(".stat-card").forEach(c => c.classList.remove("active-filter"));
  const cardMap = {
    "": "cardFilterAll",
    "รอดำเนินการ": "cardFilterPending",
    "กำลังดำเนินการ": "cardFilterDoing",
    "เสร็จสิ้น": "cardFilterDone"
  };
  if (cardMap[key]) document.getElementById(cardMap[key])?.classList.add("active-filter");

  if (dtInstance) dtInstance.draw();
}

function _setQuickKey(key) {
  filters.status = "";
  filters.flag = "";
  if (key === "ซ่อมนอก") filters.flag = "external";
  else if (key === "ด่วนมาก") filters.flag = "urgent";
  else filters.status = key || "";
  _syncFilterUI();
}

function filterByStatCard(status) { _setQuickKey(status); }
function applyQuickFilter(keyword) { _setQuickKey(keyword); }

function filterByAssignee(assignee) {
  filters.assignee = assignee || "";
  if (dtInstance) dtInstance.draw();
}

function computeStats(tickets) {
  const stats = {
    total: tickets.length, pending: 0, doing: 0, done: 0,
    byPriority: { 'ทั่วไป': 0, 'ปานกลาง': 0, 'ด่วนมาก': 0 },
    byPlant: {}, byIssueType: {}
  };
  tickets.forEach(t => {
    if (t.status === "เสร็จสิ้น") stats.done++;
    else if (t.status === "กำลังดำเนินการ") stats.doing++;
    else stats.pending++;
    const pr = t.priority || "ทั่วไป";
    stats.byPriority[pr] = (stats.byPriority[pr] || 0) + 1;
    const plant = t.plant || "ไม่ระบุ";
    stats.byPlant[plant] = (stats.byPlant[plant] || 0) + 1;
    const issue = t.issue || "Other";
    stats.byIssueType[issue] = (stats.byIssueType[issue] || 0) + 1;
  });
  return stats;
}

function upsertChart(key, canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const labels = config.data.labels;
  if (!labels.length) {
    if (charts[key]) { charts[key].destroy(); charts[key] = null; }
    return;
  }
  const cur = charts[key];
  if (cur) {
    cur.data.labels = labels;
    cur.data.datasets[0].data = config.data.datasets[0].data;
    cur.data.datasets[0].backgroundColor = config.data.datasets[0].backgroundColor;
    cur.update("none");
  } else {
    charts[key] = new Chart(canvas, config);
  }
}

function renderStats(tickets) {
  const stats = computeStats(tickets);

  document.getElementById("statTotal").innerText   = stats.total;
  document.getElementById("statPending").innerText = stats.pending;
  document.getElementById("statDoing").innerText   = stats.doing;
  document.getElementById("statDone").innerText    = stats.done;

  Chart.defaults.color = '#9499ad';

  upsertChart('priority', 'priorityChart', {
    type: 'doughnut',
    data: {
      labels: ['ทั่วไป', 'ปานกลาง', 'ด่วนมาก'],
      datasets: [{
        data: [stats.byPriority['ทั่วไป'] || 0, stats.byPriority['ปานกลาง'] || 0, stats.byPriority['ด่วนมาก'] || 0],
        backgroundColor: ['#64748b', '#f59e0b', '#ef4444'],
        borderWidth: 0
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  const plantLabels = Object.keys(stats.byPlant);
  upsertChart('plant', 'plantChart', {
    type: 'pie',
    data: {
      labels: plantLabels,
      datasets: [{
        data: Object.values(stats.byPlant),
        backgroundColor: plantLabels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 0
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
  });

  const issueKeys = Object.keys(stats.byIssueType);
  upsertChart('issueType', 'issueTypeChart', {
    type: 'bar',
    data: {
      labels: issueKeys.map(k => ISSUE_LABELS[k] || k),
      datasets: [{
        label: 'จำนวนงาน',
        data: Object.values(stats.byIssueType),
        backgroundColor: '#38bdf8',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
    }
  });
}

function openITModal(ticketId) {
  const t = globalTickets.find(x => String(x.ticketId) === String(ticketId));
  if (!t) return;

  const empIdClean = t.empId ? String(t.empId).replace(/\.0+$/, "") : "-";
  const s = v => (v === undefined || v === null) ? "" : String(v).trim();

  document.getElementById("m_ticketId").innerText = t.ticketId;
  document.getElementById("m_ticketDateInfo").innerText = `วันที่แจ้ง: ${t.date || "-"} (${_formatRelativeTime(t.date)})`;
  document.getElementById("m_empName").innerText  = `${t.empName || "-"} (${empIdClean})`;
  document.getElementById("m_deptPos").innerText  = `${t.dept || "-"} / ${t.position || "-"}`;

  const phoneHtml = s(t.contactPhone)
    ? `<a href="tel:${_esc(s(t.contactPhone))}" class="text-info text-decoration-none"><i class="bi bi-telephone-outbound me-1"></i>${_esc(s(t.contactPhone))}</a>`
    : "-";
  document.getElementById("m_plantLoc").innerHTML = `${_esc(t.plant || "-")} (โทร: ${phoneHtml})`;

  const assetStr = [];
  if (s(t.asset))       assetStr.push(`ทะเบียน: <b>${_esc(s(t.asset))}</b>`);
  if (s(t.assetNumber)) assetStr.push(`Asset: <b>${_esc(s(t.assetNumber))}</b>`);
  document.getElementById("m_asset").innerHTML = assetStr.length > 0 ? assetStr.join("  |  ") : "-";

  const emailHtml = s(t.empEmail)
    ? `<a href="mailto:${_esc(s(t.empEmail))}" class="text-warning text-decoration-none"><i class="bi bi-envelope me-1"></i>${_esc(s(t.empEmail))}</a>`
    : '<span class="text-muted">ไม่ได้ระบุ</span>';
  document.getElementById("m_empEmail").innerHTML = emailHtml;

  document.getElementById("m_issueType").innerText = ISSUE_LABELS[t.issue] || t.issue || "-";
  document.getElementById("m_detail").innerText    = t.detail || "-";

  _updateTimeline(t.status);

  // รูปภาพแนบ: แสดงผลให้ทุก Ticket ที่มีรูปภาพ ไม่จำกัดเฉพาะขอเครื่องใหม่
  const photoContainer = document.getElementById("m_photoContainer");
  const photoImg       = document.getElementById("m_photoImg");
  const photoLink      = document.getElementById("m_photoLink");
  const photoLinkFull  = document.getElementById("m_photoLinkFull");

  if (t.photo && String(t.photo).startsWith("http")) {
    if (photoImg) {
      photoImg.style.maxHeight = "340px";
      photoImg.title = "คลิกเพื่อขยายรูป";
      loadTicketPhoto(t.photo, photoImg, document.getElementById("m_photoStatus"));
    }
    if (photoLink)     photoLink.href = t.photo;
    if (photoLinkFull) {
      photoLinkFull.href = t.photo;
      photoLinkFull.title = "คลิกเพื่อขยายรูป";
      photoLinkFull.style.cursor = "zoom-in";
      photoLinkFull.onclick = function (ev) { ev.preventDefault(); showPhotoPopup(t.photo, t.ticketId); };
    }
    if (photoContainer) photoContainer.style.display = "block";
  } else if (photoContainer) {
    photoContainer.style.display = "none";
  }

  // ข้อมูลเฉพาะกรณีขอเครื่องใหม่
  const isNewPc = (t.issue === "Request_New_PC");
  const newPcSec = document.getElementById("m_newPcSection");
  if (newPcSec) {
    newPcSec.style.display = isNewPc ? "block" : "none";
    if (isNewPc) {
      document.getElementById("m_pcType").innerText   = t.pcType || "ไม่ระบุประเภท";
      document.getElementById("m_reasonPc").innerText = t.reasonPc || "-";

      const badgesContainer = document.getElementById("m_reqSoftBadges");
      if (badgesContainer) {
        if (s(t.reqSoft)) {
          const softList = s(t.reqSoft).split(",").map(x => x.trim()).filter(Boolean);
          badgesContainer.innerHTML = softList.map(x => `<span class="soft-pill"><i class="bi bi-check2-circle me-1"></i>${_esc(x)}</span>`).join("");
        } else {
          badgesContainer.innerHTML = '<span class="text-muted small">ไม่มีการระบุโปรแกรมเพิ่มเติม</span>';
        }
      }
    }
  }

  document.getElementById("modalRow").value      = t.row || "";
  document.getElementById("modalTicketId").value = t.ticketId || "";
  document.getElementById("modalStatus").value   = t.status || "รอดำเนินการ";
  document.getElementById("modalNotes").value    = t.note || "";
  const asgSel = document.getElementById("modalAssignee");
  const curAsg = s(t.assignee);
  if (asgSel.options.length === 0) {
    asgSel.add(new Option("-- เลือกผู้รับผิดชอบ --", ""));
  }
  if (curAsg && !Array.from(asgSel.options).some(o => o.value === curAsg)) {
    asgSel.add(new Option(curAsg, curAsg));
  }
  asgSel.value = curAsg;

  const isExt = _isExternalTrue(t.isExternal);
  const extCheck = document.getElementById("isExternalCheck");
  const extReasonBox = document.getElementById("externalReasonBox");
  const extReasonInput = document.getElementById("externalReason");

  if (extCheck) extCheck.checked = isExt;
  if (extReasonInput) extReasonInput.value = t.externalReason || "";
  if (extReasonBox) extReasonBox.style.display = isExt ? "block" : "none";

  // ฟิลด์ติดตามการจัดซื้อเครื่องใหม่ (PR / PO / เลข Asset ใหม่)
  const prInput = document.getElementById("modalPrNo");
  const poInput = document.getElementById("modalPoNo");
  const newAssetInput = document.getElementById("modalNewAsset");
  if (prInput) prInput.value = t.prNo || "";
  if (poInput) poInput.value = t.poNo || "";
  if (newAssetInput) newAssetInput.value = t.newAsset || "";

  const hintBadge = document.getElementById("procureHintBadge");
  if (hintBadge) {
    if (isNewPc) {
      hintBadge.className = "badge bg-warning text-dark font-size-11";
      hintBadge.innerText = "แนะนำสำหรับงานขอเครื่องใหม่";
    } else {
      hintBadge.className = "badge bg-secondary font-size-11";
      hintBadge.innerText = "ออปชัน";
    }
  }

  onStatusChange();

  if (!itModalInstance) {
    itModalInstance = new bootstrap.Modal(document.getElementById('itModal'));
  }
  itModalInstance.show();
}

/**
 * ฟังก์ชันใส่ข้อความสำเร็จรูป (Quick Notes)
 * @param {string} text ข้อความบันทึก
 * @param {boolean} isDone ถ้าเป็นจริง ปรับสถานะเป็น "เสร็จสิ้น" อัตโนมัติ
 */
function insertQuickNote(text, isDone) {
  const noteArea = document.getElementById("modalNotes");
  if (!noteArea) return;
  const current = noteArea.value.trim();
  if (current.includes(text)) {
    return;
  }
  if (current) {
    noteArea.value = current + "\n" + text;
  } else {
    noteArea.value = text;
  }
  noteArea.focus();

  const statusSel = document.getElementById("modalStatus");
  if (statusSel) {
    if (isDone) {
      if (statusSel.value !== "เสร็จสิ้น") {
        statusSel.value = "เสร็จสิ้น";
        onStatusChange();
      }
    } else {
      if (statusSel.value === "รอดำเนินการ") {
        statusSel.value = "กำลังดำเนินการ";
        onStatusChange();
      }
    }
  }
}

function _updateTimeline(status) {
  const stepPending = document.getElementById("stepTimelinePending");
  const stepDoing   = document.getElementById("stepTimelineDoing");
  const stepDone    = document.getElementById("stepTimelineDone");

  stepPending.className = "timeline-step";
  stepDoing.className   = "timeline-step";
  stepDone.className    = "timeline-step";

  if (status === "เสร็จสิ้น") {
    stepPending.classList.add("completed");
    stepDoing.classList.add("completed");
    stepDone.classList.add("completed");
  } else if (status === "กำลังดำเนินการ") {
    stepPending.classList.add("completed");
    stepDoing.classList.add("active");
  } else {
    stepPending.classList.add("active");
  }
}

async function assignToMe() {
  const sel = document.getElementById("modalAssignee");
  if (!sel) return;
  const names = Array.from(sel.options).map(o => o.value).filter(Boolean);
  if (names.length === 0) {
    return Swal.fire("แจ้งเตือน", "ยังไม่มีรายชื่อช่าง IT ในระบบ (ชีต IT_Staff)", "warning");
  }

  const loggedIn = sessionStorage.getItem(STAFF_KEY);
  let me = (loggedIn && names.includes(loggedIn)) ? loggedIn : localStorage.getItem(MY_NAME_KEY);
  if (!me || !names.includes(me)) {
    const inputOptions = {};
    names.forEach(n => { inputOptions[n] = n; });
    const r = await Swal.fire({
      title: "คุณคือช่างท่านไหน?",
      text: "ระบบจะจำชื่อนี้ไว้ในเครื่องนี้ สำหรับปุ่ม 'รับงานนี้'",
      input: "select",
      inputOptions,
      inputPlaceholder: "-- เลือกชื่อของคุณ --",
      showCancelButton: true,
      confirmButtonText: "ยืนยัน",
      cancelButtonText: "ยกเลิก",
      inputValidator: v => (!v ? "กรุณาเลือกชื่อ" : undefined)
    });
    if (!r.isConfirmed) return;
    me = r.value;
    localStorage.setItem(MY_NAME_KEY, me);
  }
  sel.value = me;
  const st = document.getElementById("modalStatus");
  if (st && st.value === "รอดำเนินการ") {
    st.value = "กำลังดำเนินการ";
    onStatusChange();
  }
}

function onStatusChange() {
  const st = document.getElementById("modalStatus").value;
  const extSec = document.getElementById("externalSection");
  if (extSec) extSec.style.display = "block";
  _updateTimeline(st);
}

function onExternalToggle() {
  const chk = document.getElementById("isExternalCheck").checked;
  const reasonBox = document.getElementById("externalReasonBox");
  const reasonInput = document.getElementById("externalReason");

  if (reasonBox) reasonBox.style.display = chk ? "block" : "none";
  if (!chk && reasonInput) reasonInput.value = "";
}

async function saveITUpdate() {
  if (isSaving) return;

  const row        = document.getElementById("modalRow").value;
  const ticketId   = document.getElementById("modalTicketId").value;
  const status     = document.getElementById("modalStatus").value;
  const assignee   = document.getElementById("modalAssignee").value;
  const notes      = document.getElementById("modalNotes").value.trim();
  const isExternal = document.getElementById("isExternalCheck").checked;
  const extReason  = document.getElementById("externalReason").value.trim();
  const prNo       = document.getElementById("modalPrNo") ? document.getElementById("modalPrNo").value.trim() : "";
  const poNo       = document.getElementById("modalPoNo") ? document.getElementById("modalPoNo").value.trim() : "";
  const newAsset   = document.getElementById("modalNewAsset") ? document.getElementById("modalNewAsset").value.trim() : "";

  if (!ticketId) {
    return Swal.fire("แจ้งเตือน", "ไม่พบรหัส Ticket กรุณาปิดหน้าต่างแล้วเปิดใหม่อีกครั้ง", "warning");
  }
  if (isExternal && !extReason) {
    return Swal.fire("แจ้งเตือน", "กรุณาระบุชื่อบริษัทหรือเหตุผลที่ส่งซ่อมภายนอก", "warning");
  }

  isSaving = true;
  const saveBtn = document.getElementById("saveITBtn");
  if (saveBtn) saveBtn.disabled = true;

  Swal.fire({
    title: "กำลังบันทึกและส่งอีเมลแจ้งเตือน...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const result = await api("updateTicket", { row, ticketId, status, assignee, notes, isExternal, extReason, prNo, poNo, newAsset });

    if (result.success) {
      let text = "บันทึกข้อมูลและส่งแจ้งเตือนเรียบร้อยแล้ว";
      let icon = "success";
      if (result.changed === false) {
        text = "ไม่มีการเปลี่ยนแปลงข้อมูล จึงไม่ได้ส่งอีเมลซ้ำ";
      } else if (result.emailSent === false) {
        text = "บันทึกข้อมูลแล้ว แต่ไม่สามารถส่งอีเมลถึงผู้แจ้งได้" + (result.emailError ? " (" + result.emailError + ")" : " (ตรวจสอบอีเมลผู้แจ้ง / โควต้าอีเมล)");
        icon = "warning";
      }

      if (itModalInstance) itModalInstance.hide();
      await Swal.fire({
        icon,
        title: "อัปเดตงานสำเร็จ!",
        text,
        timer: icon === "success" ? 1800 : undefined,
        showConfirmButton: icon !== "success"
      });
      refreshData(false);
    } else {
      Swal.fire("ผิดพลาด", result.error || "ไม่สามารถบันทึกข้อมูลได้", "error");
    }
  } catch (err) {
    if (err.message === "UNAUTHORIZED") return;
    console.error("saveITUpdate error:", err);
    Swal.fire("ผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
  } finally {
    isSaving = false;
    if (saveBtn) saveBtn.disabled = false;
  }
}

function _isExternalTrue(val) {
  if (!val) return false;
  if (val === true || val === 1) return true;
  const s = String(val).trim().toLowerCase();
  return s === "true" || s === "1" || s.includes("ภายนอก") || s.includes("ซ่อมนอก") || s.includes("external");
}

function _getDriveThumbnail(url, width) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w${width || 500}`;
  }
  return url;
}

function showPhotoPopup(url, ticketId) {
  const wrap = document.createElement("div");
  const img = document.createElement("img");
  img.alt = "รูปภาพแนบ";
  img.style.cssText = "max-width:100%;max-height:70vh;border-radius:8px;display:block;margin:0 auto;";
  img.src = photoCache[url] || _getDriveThumbnail(url, 1600);
  img.onerror = function () {
    wrap.innerHTML = '<p class="text-muted my-4">ไม่สามารถแสดงรูปได้ (ไฟล์อาจไม่ได้เปิดแชร์) กรุณากด "เปิดใน Google Drive"</p>';
  };
  wrap.appendChild(img);

  Swal.fire({
    title: ticketId ? "รูปภาพแนบ — " + ticketId : "รูปภาพแนบ",
    html: wrap,
    width: "min(92vw, 900px)",
    showCloseButton: true,
    showCancelButton: true,
    confirmButtonText: '<i class="bi bi-box-arrow-up-right me-1"></i>เปิดใน Google Drive',
    cancelButtonText: "ปิด",
    focusConfirm: false
  }).then(r => {
    if (r.isConfirmed) window.open(url, "_blank", "noopener");
  });
}

function _formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const parts = String(dateStr).split(/[\s,]+/);
  if (!parts[0]) return "";
  const dParts = parts[0].split(/[\/-]/);
  if (dParts.length !== 3) return "";

  let year = parseInt(dParts[2], 10);
  let month = parseInt(dParts[1], 10) - 1;
  let day = parseInt(dParts[0], 10);

  if (dParts[0].length === 4) {
    year = parseInt(dParts[0], 10);
    month = parseInt(dParts[1], 10) - 1;
    day = parseInt(dParts[2], 10);
  }
  if (year > 2400) year -= 543;

  let d;
  if (parts[1]) {
    const tParts = parts[1].split(":");
    const hours = parseInt(tParts[0], 10) || 0;
    const mins = parseInt(tParts[1], 10) || 0;
    const secs = parseInt(tParts[2], 10) || 0;
    d = new Date(year, month, day, hours, mins, secs);
  } else {
    d = new Date(year, month, day);
  }
  if (isNaN(d.getTime())) return "";

  const now = new Date();
  const diffMs = now - d;
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);

  if (diffSec < 60) return "เมื่อสักครู่";
  if (diffMin < 60) return `${diffMin} นาทีที่แล้ว`;
  if (diffHour < 24 && now.getDate() === d.getDate()) return `${diffHour} ชั่วโมงที่แล้ว`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dDate = new Date(year, month, day);
  const diffDays = Math.round((today - dDate) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return "วันนี้";
  if (diffDays === 1) return "เมื่อวานนี้";
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} สัปดาห์ที่แล้ว`;
  return `${Math.floor(diffDays / 30)} เดือนที่แล้ว`;
}

function _esc(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#039;");
}
