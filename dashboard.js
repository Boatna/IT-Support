const API_URL = "https://script.google.com/macros/s/AKfycbyv3PxHFJPv_BigI_ejkfRj6UVg21xw_oFTBbLYzfcoRUwY1zavlBnTxbZ0REt6tY_h/exec";

let charts = { priority: null, issueType: null, plant: null };
let globalTickets = [];
let dtInstance = null;
let itModalInstance = null;
let autoSyncInterval = null;

const CHART_COLORS = [
  '#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171',
  '#c084fc', '#fb923c', '#2dd4bf', '#a78bfa', '#94a3b8',
  '#60a5fa', '#4ade80', '#f472b6', '#e879f9', '#facc15'
];

window.addEventListener("DOMContentLoaded", function () {
  if (sessionStorage.getItem("it_logged_in") === "true") {
    document.getElementById("loginScreen").style.display = "none";
    document.getElementById("appContent").style.display  = "block";
    loadITStaff();
    refreshData(false);
    startAutoSync();
  }
});

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
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "verifyPin", data: { pin } })
    });

    const result = await res.json();
    Swal.close();

    if (result.success && result.isValid) {
      sessionStorage.setItem("it_logged_in", "true");
      document.getElementById("loginScreen").style.display = "none";
      document.getElementById("appContent").style.display  = "block";
      loadITStaff();
      refreshData(true);
      startAutoSync();
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
      sessionStorage.removeItem("it_logged_in");
      stopAutoSync();
      document.getElementById("appContent").style.display  = "none";
      document.getElementById("loginScreen").style.display = "block";
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
      if (!modal || !modal.classList.contains("show")) {
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
  if (checkbox.checked) {
    startAutoSync();
  } else {
    stopAutoSync();
  }
}

function updateLastSyncLabel() {
  const elem = document.getElementById("lastSyncTime");
  if (elem) {
    const now = new Date();
    const timeStr = Utilities_formatTime(now);
    elem.innerText = `ซิงค์ล่าสุด: ${timeStr} น.`;
  }
}

function Utilities_formatTime(d) {
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function loadITStaff() {
  try {
    const res = await fetch(`${API_URL}?action=getITStaff`);
    const staffList = await res.json();
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
      filterSel.innerHTML = '<option value="">-- แสดงช่างทุกคน --</option>';
      if (Array.isArray(staffList)) {
        staffList.forEach(name => {
          if (name && name !== "-- เลือกผู้รับผิดชอบ --") {
            const opt = document.createElement("option");
            opt.value = name;
            opt.text  = name;
            filterSel.appendChild(opt);
          }
        });
      }
    }
  } catch (err) {
    console.warn("loadITStaff error:", err);
  }
}

async function refreshData(showFeedback = true) {
  const syncIcon = document.getElementById("syncIcon");
  if (syncIcon) syncIcon.classList.add("syncing-spin");

  try {
    await Promise.all([loadStats(), loadITTickets()]);
    updateLastSyncLabel();
    if (showFeedback) {
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 1500,
        timerProgressBar: false
      });
      Toast.fire({ icon: 'success', title: 'อัปเดตข้อมูลล่าสุดเรียบร้อย' });
    }
  } catch (err) {
    console.error("refreshData error:", err);
  } finally {
    if (syncIcon) syncIcon.classList.remove("syncing-spin");
  }
}

async function loadITTickets() {
  if ($.fn.DataTable.isDataTable('#itTicketTable')) {
    $('#itTicketTable').DataTable().destroy();
    dtInstance = null;
  }

  const tbody = document.querySelector("#itTicketTable tbody");

  try {
    const res = await fetch(`${API_URL}?action=getActiveTickets`);
    globalTickets = await res.json();

    if (!Array.isArray(globalTickets)) globalTickets = [];

    const badgeElem = document.getElementById("ticketCountBadge");
    if (badgeElem) badgeElem.innerText = `${globalTickets.length} รายการ`;

    if (globalTickets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">ไม่พบข้อมูลแจ้งซ่อม</td></tr>';
      return;
    }

    const rows = globalTickets.map(r => {
      let badgePrio = '<span class="badge bg-secondary rounded-pill">ทั่วไป</span>';
      if (r.priority === "ด่วนมาก") {
        badgePrio = '<span class="badge bg-danger rounded-pill"><span class="pulse-dot"></span>ด่วนมาก</span>';
      } else if (r.priority === "ปานกลาง") {
        badgePrio = '<span class="badge bg-warning text-dark rounded-pill">ปานกลาง</span>';
      }
      let badgeStat = '<span class="badge bg-danger">รอดำเนินการ</span>';
      if (r.status === "เสร็จสิ้น") {
        badgeStat = '<span class="badge bg-success"><i class="bi bi-check2 me-1"></i>เสร็จสิ้น</span>';
      } else if (r.status === "กำลังดำเนินการ") {
        badgeStat = '<span class="badge bg-warning text-dark"><i class="bi bi-gear me-1"></i>กำลังดำเนินการ</span>';
      }

      const isExt = _isExternalTrue(r.isExternal);
      const extBadge = isExt ? '<br><span class="badge bg-info text-dark mt-1"><i class="bi bi-truck me-1"></i>ซ่อมนอก</span>' : '';

      const empIdClean = r.empId ? String(r.empId).replace(/\.0$/, "") : "-";
      const dateDisplay = r.date ? String(r.date).split(" ")[0] : "-";
      const timeAgo = _formatRelativeTime(r.date);

      return `
        <tr data-ticketid="${_esc(r.ticketId)}" data-status="${_esc(r.status)}" data-priority="${_esc(r.priority)}" data-assignee="${_esc(r.assignee || '')}">
          <td class="fw-bold text-info" style="white-space:nowrap;">
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
              <span class="text-info fw-semibold">${_esc(r.issue || "-")}</span><br>
              <small class="text-muted">${_esc(r.detail || "-")}</small>
            </div>
          </td>
          <td>${badgePrio}</td>
          <td>${badgeStat}${extBadge}</td>
          <td class="text-center">
            <button type="button" class="btn btn-sm btn-outline-info rounded-pill px-3 shadow-sm" onclick="openITModal('${_esc(r.ticketId)}')">
              <i class="bi bi-sliders me-1"></i>Manage
            </button>
          </td>
        </tr>`;
    });

    tbody.innerHTML = rows.join("");
    dtInstance = $('#itTicketTable').DataTable({
      destroy: true,
      order: [[0, 'desc']],
      dom: '<"row mb-3"<"col-md-6"B><"col-md-6"f>>rt<"row mt-3"<"col-md-6"i><"col-md-6"p>>',
      buttons: [
        {
          extend: 'excelHtml5',
          text: '<i class="bi bi-file-earmark-excel me-1"></i>ส่งออก Excel',
          className: 'btn btn-success btn-sm shadow-sm'
        }
      ],
      language: {
        search:       'ค้นหาข้อมูล:',
        lengthMenu:   'แสดง _MENU_ รายการ',
        info:         'แสดง _START_ ถึง _END_ จากทั้งหมด _TOTAL_ รายการ',
        paginate:     { first: '«', last: '»', next: '›', previous: '‹' },
        emptyTable:   'ไม่มีข้อมูลในตาราง',
        zeroRecords:  'ไม่พบข้อมูลที่ตรงกับคำค้นหา'
      }
    });

    $('#itTicketTable tbody')
      .off('click', 'tr')
      .on('click', 'tr', function (e) {
        if ($(e.target).closest('button').length) return;
        const tid = $(this).data('ticketid');
        if (tid) openITModal(String(tid));
      });
    if (currentFilterStatus) {
      dtInstance.search(currentFilterStatus).draw();
    }

  } catch (err) {
    console.error("loadITTickets error:", err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">โหลดข้อมูลล้มเหลว กรุณากด Sync Data ใหม่อีกครั้ง</td></tr>';
  }
}

function filterByStatCard(status) {
  currentFilterStatus = status;
  document.querySelectorAll(".stat-card").forEach(c => c.classList.remove("active-filter"));
  if (status === "") {
    document.getElementById("cardFilterAll")?.classList.add("active-filter");
  } else if (status === "รอดำเนินการ") {
    document.getElementById("cardFilterPending")?.classList.add("active-filter");
  } else if (status === "กำลังดำเนินการ") {
    document.getElementById("cardFilterDoing")?.classList.add("active-filter");
  } else if (status === "เสร็จสิ้น") {
    document.getElementById("cardFilterDone")?.classList.add("active-filter");
  }

  document.querySelectorAll("#quickFilterGroup .filter-pill").forEach(p => {
    p.classList.toggle("active", p.innerText.includes(status) || (status === "" && p.innerText === "ทั้งหมด"));
  });

  if (dtInstance) {
    dtInstance.search(status).draw();
  }
}

function applyQuickFilter(keyword, pillElem) {
  currentFilterStatus = keyword;
  document.querySelectorAll("#quickFilterGroup .filter-pill").forEach(p => p.classList.remove("active"));
  if (pillElem) pillElem.classList.add("active");
  document.querySelectorAll(".stat-card").forEach(c => c.classList.remove("active-filter"));
  if (keyword === "") document.getElementById("cardFilterAll")?.classList.add("active-filter");
  else if (keyword === "รอดำเนินการ") document.getElementById("cardFilterPending")?.classList.add("active-filter");
  else if (keyword === "กำลังดำเนินการ") document.getElementById("cardFilterDoing")?.classList.add("active-filter");
  else if (keyword === "เสร็จสิ้น") document.getElementById("cardFilterDone")?.classList.add("active-filter");

  if (dtInstance) {
    dtInstance.search(keyword).draw();
  }
}

function filterByAssignee(assignee) {
  if (dtInstance) {
    dtInstance.search(assignee).draw();
  }
}

async function loadStats() {
  try {
    const res   = await fetch(`${API_URL}?action=getStats`);
    const stats = await res.json();

    document.getElementById("statTotal").innerText   = stats.total   ?? 0;
    document.getElementById("statPending").innerText = stats.pending ?? 0;
    document.getElementById("statDoing").innerText   = stats.doing   ?? 0;
    document.getElementById("statDone").innerText    = stats.done    ?? 0;

    Chart.defaults.color = '#9499ad';
    Object.keys(charts).forEach(k => {
      if (charts[k]) { charts[k].destroy(); charts[k] = null; }
    });

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
          backgroundColor: ['#64748b', '#f59e0b', '#ef4444'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    if (stats.byPlant && Object.keys(stats.byPlant).length > 0) {
      const plantLabels = Object.keys(stats.byPlant);
      const plantColors = plantLabels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);
      charts.plant = new Chart(document.getElementById('plantChart'), {
        type: 'pie',
        data: {
          labels: plantLabels,
          datasets: [{
            data: Object.values(stats.byPlant),
            backgroundColor: plantColors,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }

    if (stats.byIssueType && Object.keys(stats.byIssueType).length > 0) {
      charts.issueType = new Chart(document.getElementById('issueTypeChart'), {
        type: 'bar',
        data: {
          labels: Object.keys(stats.byIssueType),
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
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }

  } catch (err) {
    console.error("loadStats error:", err);
  }
}

function openITModal(ticketId) {
  const t = globalTickets.find(x => x.ticketId === ticketId);
  if (!t) return;

  const empIdClean = t.empId ? String(t.empId).replace(/\.0$/, "") : "-";

  document.getElementById("m_ticketId").innerText = t.ticketId;
  document.getElementById("m_ticketDateInfo").innerText = `วันที่แจ้ง: ${t.date || "-"} (${_formatRelativeTime(t.date)})`;
  document.getElementById("m_empName").innerText  = `${t.empName || "-"} (${empIdClean})`;
  document.getElementById("m_deptPos").innerText  = `${t.dept || "-"} / ${t.position || "-"}`;

  const phoneHtml = t.contactPhone
    ? `<a href="tel:${_esc(t.contactPhone)}" class="text-info text-decoration-none"><i class="bi bi-telephone-outbound me-1"></i>${_esc(t.contactPhone)}</a>`
    : "-";
  document.getElementById("m_plantLoc").innerHTML = `${_esc(t.plant || "-")} (โทร: ${phoneHtml})`;
  let assetStr = [];
  if (t.asset && t.asset.trim())             assetStr.push(`ทะเบียน: <b>${_esc(t.asset.trim())}</b>`);
  if (t.assetNumber && t.assetNumber.trim()) assetStr.push(`Asset: <b>${_esc(t.assetNumber.trim())}</b>`);
  document.getElementById("m_asset").innerHTML = assetStr.length > 0 ? assetStr.join("  |  ") : "-";

  const emailHtml = (t.empEmail && t.empEmail.trim())
    ? `<a href="mailto:${_esc(t.empEmail.trim())}" class="text-warning text-decoration-none"><i class="bi bi-envelope me-1"></i>${_esc(t.empEmail.trim())}</a>`
    : '<span class="text-muted">ไม่ได้ระบุ</span>';
  document.getElementById("m_empEmail").innerHTML = emailHtml;

  document.getElementById("m_issueType").innerText = t.issue || "-";
  document.getElementById("m_detail").innerText    = t.detail || "-";

  _updateTimeline(t.status);

  const isNewPc = (t.issue === "Request_New_PC");
  const newPcSec = document.getElementById("m_newPcSection");
  if (newPcSec) {
    newPcSec.style.display = isNewPc ? "block" : "none";
    if (isNewPc) {
      document.getElementById("m_pcType").innerText   = t.pcType || "ไม่ระบุประเภท";
      document.getElementById("m_reasonPc").innerText = t.reasonPc || "-";

      const badgesContainer = document.getElementById("m_reqSoftBadges");
      if (badgesContainer) {
        if (t.reqSoft && t.reqSoft.trim()) {
          const softList = t.reqSoft.split(",").map(s => s.trim()).filter(Boolean);
          badgesContainer.innerHTML = softList.map(s => `<span class="soft-pill"><i class="bi bi-check2-circle me-1"></i>${_esc(s)}</span>`).join("");
        } else {
          badgesContainer.innerHTML = '<span class="text-muted small">ไม่มีการระบุโปรแกรมเพิ่มเติม</span>';
        }
      }

      const photoContainer = document.getElementById("m_photoContainer");
      const photoImg       = document.getElementById("m_photoImg");
      const photoLink      = document.getElementById("m_photoLink");
      const photoLinkFull  = document.getElementById("m_photoLinkFull");

      if (t.photo && String(t.photo).startsWith("http")) {
        const thumbUrl = _getDriveThumbnail(t.photo);
        if (photoImg)      photoImg.src = thumbUrl;
        if (photoLink)     photoLink.href = t.photo;
        if (photoLinkFull) photoLinkFull.href = t.photo;
        if (photoContainer) photoContainer.style.display = "block";
      } else {
        if (photoContainer) photoContainer.style.display = "none";
      }
    }
  }

  document.getElementById("modalRow").value      = t.row || "";
  document.getElementById("modalStatus").value   = t.status || "รอดำเนินการ";
  document.getElementById("modalNotes").value    = t.note || "";
  document.getElementById("modalAssignee").value = t.assignee || "";

  const isExt = _isExternalTrue(t.isExternal);
  const extCheck = document.getElementById("isExternalCheck");
  const extReasonBox = document.getElementById("externalReasonBox");
  const extReasonInput = document.getElementById("externalReason");

  if (extCheck) extCheck.checked = isExt;
  if (extReasonInput) extReasonInput.value = t.externalReason || "";
  if (extReasonBox) extReasonBox.style.display = isExt ? "block" : "none";

  onStatusChange();

  if (!itModalInstance) {
    itModalInstance = new bootstrap.Modal(document.getElementById('itModal'));
  }
  itModalInstance.show();
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

function assignToMe() {
  const sel = document.getElementById("modalAssignee");
  if (!sel || sel.options.length <= 1) return;
  sel.selectedIndex = 1;
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
  const row        = document.getElementById("modalRow").value;
  const status     = document.getElementById("modalStatus").value;
  const assignee   = document.getElementById("modalAssignee").value;
  const notes      = document.getElementById("modalNotes").value.trim();
  const isExternal = document.getElementById("isExternalCheck").checked;
  const extReason  = document.getElementById("externalReason").value.trim();

  if (isExternal && !extReason) {
    return Swal.fire("แจ้งเตือน", "กรุณาระบุชื่อบริษัทหรือเหตุผลที่ส่งซ่อมภายนอก", "warning");
  }

  if (status === "เสร็จสิ้น" && !notes) {
    const confirm = await Swal.fire({
      title: "ยังไม่ได้ระบุบันทึกการแก้ไข",
      text: "ต้องการบันทึกสถานะ 'เสร็จสิ้น' โดยไม่ระบุรายละเอียดการซ่อมหรือไม่?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "บันทึกเลย",
      cancelButtonText: "กลับไปพิมพ์บันทึก"
    });
    if (!confirm.isConfirmed) return;
  }

  Swal.fire({
    title: "กำลังบันทึกและส่งอีเมลแจ้งเตือน...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading()
  });

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "updateTicket",
        data: { row, status, assignee, notes, isExternal, extReason }
      })
    });

    const result = await res.json();

    if (result.success) {
      Swal.fire({
        icon: "success",
        title: "อัปเดตงานสำเร็จ!",
        text: "บันทึกข้อมูลและส่งแจ้งเตือนเรียบร้อยแล้ว",
        timer: 1600,
        showConfirmButton: false
      });

      if (itModalInstance) itModalInstance.hide();
      refreshData(false);
    } else {
      Swal.fire("ผิดพลาด", result.error || "ไม่สามารถบันทึกข้อมูลได้", "error");
    }
  } catch (err) {
    console.error("saveITUpdate error:", err);
    Swal.fire("ผิดพลาด", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้", "error");
  }
}

function _isExternalTrue(val) {
  if (!val) return false;
  if (val === true || val === 1) return true;
  const s = String(val).trim().toLowerCase();
  return s === "true" || s === "1" || s.includes("ภายนอก") || s.includes("ซ่อมนอก") || s.includes("external");
}

function _getDriveThumbnail(url) {
  if (!url) return "";
  const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w500`;
  }
  return url;
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

  const d = new Date(year, month, day);
  const now = new Date();
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

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