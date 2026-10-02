
const API_URL = "https://script.google.com/macros/s/AKfycbyv3PxHFJPv_BigI_ejkfRj6UVg21xw_oFTBbLYzfcoRUwY1zavlBnTxbZ0REt6tY_h/exec";

let allEmployees = [];
let activeAutocompleteIndex = -1;

const SOFTWARE_LIST = {
  office: [
    { icon: "📝", name: "Microsoft Office" },
    { icon: "📄", name: "Adobe Acrobat Reader" },
    { icon: "💚", name: "LINE" },
    { icon: "🗜️", name: "SAP" },
    { icon: "🛡️", name: "Prosoft" },
    { icon: "🔒", name: "VPN Client" },
    { icon: "🖥️", name: "AnyDesk / Remote" }
  ],
  engineering: [
    { icon: "📐", name: "G-Star CAD" },
    { icon: "🔩", name: "Solid Edge" },
    { icon: "📝", name: "Microsoft Office" },
    { icon: "📄", name: "Adobe Acrobat Pro" },
    { icon: "💚", name: "LINE" },
    { icon: "🗜️", name: "SAP" },
    { icon: "🛡️", name: "Prosoft" },
    { icon: "🔒", name: "VPN Client" },
    { icon: "🖥️", name: "AnyDesk / Remote" }
  ]
};

window.addEventListener("DOMContentLoaded", async function () {
  try {
    const res = await fetch(API_URL + "?action=getEmployees");
    if (!res.ok) throw new Error("HTTP error " + res.status);
    allEmployees = await res.json();
    if (!Array.isArray(allEmployees)) allEmployees = [];
  } catch (err) {
    console.error("โหลดข้อมูลพนักงานไม่สำเร็จ:", err);
    Swal.fire({
      icon: "warning",
      title: "การเชื่อมต่อฐานข้อมูลล่าช้า",
      text: "ระบบไม่สามารถดึงรายชื่อพนักงานได้ในขณะนี้ แต่ท่านยังสามารถกรอกข้อมูลได้ตามปกติ",
      confirmButtonText: "ตกลง"
    });
  } finally {
    const overlay = document.getElementById("loadingOverlay");
    if (overlay) overlay.style.display = "none";
  }
});

// ════════════════════════════════════════════════════════════
//  🗂️ สลับแท็บ (Tab Switching)
// ════════════════════════════════════════════════════════════
function switchTab(tabId, el) {
  document.querySelectorAll(".section-div").forEach(d => d.classList.remove("active-section"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  
  const target = document.getElementById(tabId);
  if (target) target.classList.add("active-section");
  if (el) el.classList.add("active");
}

// ════════════════════════════════════════════════════════════
//  🔍 ค้นหาพนักงาน (Autocomplete)
// ════════════════════════════════════════════════════════════
const searchInput = document.getElementById("searchEmpInput");
const autocompleteList = document.getElementById("autocompleteList");

if (searchInput) {
  searchInput.addEventListener("input", function () {
    const val = this.value.toLowerCase().trim();
    autocompleteList.innerHTML = "";
    activeAutocompleteIndex = -1;

    const clearBtn = document.getElementById("clearEmpBtn");
    if (clearBtn) clearBtn.style.display = val ? "inline-block" : "none";

    if (!val) {
      autocompleteList.style.display = "none";
      return;
    }

    const matches = allEmployees
      .filter(e => String(e.id).toLowerCase().includes(val) || String(e.name).toLowerCase().includes(val))
      .slice(0, 15);

    if (matches.length === 0) {
      autocompleteList.innerHTML = '<div class="list-group-item text-muted text-center py-3">ไม่พบข้อมูลพนักงาน</div>';
      autocompleteList.style.display = "block";
      return;
    }

    matches.forEach((emp, index) => {
      const item = document.createElement("a");
      item.className = "list-group-item list-group-item-action py-2";
      item.dataset.index = index;

      const assetBadge = emp.assetTag
        ? ` <span class="badge bg-success ms-1" style="font-size:10px;"><i class="bi bi-upc-scan"></i> ${_esc(emp.assetTag)}</span>`
        : "";

      item.innerHTML = `
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <span class="text-primary fw-bold">${_esc(emp.id)}</span> — <strong>${_esc(emp.name)}</strong>${assetBadge}
            <br><small class="text-muted">${_esc(emp.position)} | ${_esc(emp.dept)} (${_esc(emp.plant)})</small>
          </div>
          <i class="bi bi-chevron-right text-muted small"></i>
        </div>
      `;

      item.addEventListener("click", () => {
        selectEmployee(emp);
        autocompleteList.style.display = "none";
      });

      autocompleteList.appendChild(item);
    });

    autocompleteList.style.display = "block";
  });

  // รองรับคีย์บอร์ด Up / Down / Enter / Esc
  searchInput.addEventListener("keydown", function (e) {
    const items = autocompleteList.querySelectorAll(".list-group-item-action");
    if (!items.length || autocompleteList.style.display === "none") return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeAutocompleteIndex = (activeAutocompleteIndex + 1) % items.length;
      _highlightItem(items);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeAutocompleteIndex = (activeAutocompleteIndex - 1 + items.length) % items.length;
      _highlightItem(items);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeAutocompleteIndex >= 0 && activeAutocompleteIndex < items.length) {
        items[activeAutocompleteIndex].click();
      }
    } else if (e.key === "Escape") {
      autocompleteList.style.display = "none";
    }
  });
}

function _highlightItem(items) {
  items.forEach((it, idx) => {
    it.classList.toggle("active", idx === activeAutocompleteIndex);
    if (idx === activeAutocompleteIndex) it.scrollIntoView({ block: "nearest" });
  });
}

function selectEmployee(emp) {
  document.getElementById("empId").value       = emp.id;
  document.getElementById("empName").value     = emp.name;
  document.getElementById("empDept").value     = emp.dept;
  document.getElementById("empPosition").value = emp.position;
  document.getElementById("empPlant").value    = emp.plant;
  document.getElementById("searchEmpInput").value = `${emp.id} — ${emp.name}`;

  document.getElementById("d_empId").innerText      = emp.id;
  document.getElementById("d_empName").innerText    = emp.name;
  document.getElementById("d_empPosDept").innerText = `${emp.position} / ${emp.dept}`;
  document.getElementById("d_empPlant").innerText   = emp.plant;
  document.getElementById("employeeInfoBox").style.display = "block";

  const clearBtn = document.getElementById("clearEmpBtn");
  if (clearBtn) clearBtn.style.display = "inline-block";

  // ดึงเลขทะเบียนอัตโนมัติถ้ามี
  const assetInput = document.getElementById("assetTag");
  const dAssetWrap = document.getElementById("d_assetTagWrap");
  const autoLabel  = document.getElementById("assetAutoLabel");
  const hintLabel  = document.getElementById("assetTagHint");

  if (emp.assetTag && emp.assetTag.trim() !== "") {
    assetInput.value = emp.assetTag.trim();
    document.getElementById("d_empAssetTag").innerText = emp.assetTag.trim();
    if (dAssetWrap) dAssetWrap.style.display = "";
    if (autoLabel)  autoLabel.style.display  = "";
    if (hintLabel)  hintLabel.style.display  = "";
    assetInput.classList.add("field-autofilled");
  } else {
    assetInput.value = "";
    if (dAssetWrap) dAssetWrap.style.display = "none";
    if (autoLabel)  autoLabel.style.display  = "none";
    if (hintLabel)  hintLabel.style.display  = "none";
    assetInput.classList.remove("field-autofilled");
  }

  // ดึงอีเมลอัตโนมัติถ้ามี
  const emailInput = document.getElementById("empEmail");
  if (emp.email && emp.email.trim() !== "") {
    emailInput.value = emp.email.trim();
  }

  setTimeout(() => {
    if (!emailInput.value) emailInput.focus();
    else document.getElementById("contactPhone").focus();
  }, 100);
}

function clearSelectedEmployee() {
  document.getElementById("empId").value       = "";
  document.getElementById("empName").value     = "";
  document.getElementById("empDept").value     = "";
  document.getElementById("empPosition").value = "";
  document.getElementById("empPlant").value    = "";
  document.getElementById("searchEmpInput").value = "";
  document.getElementById("employeeInfoBox").style.display = "none";
  
  const clearBtn = document.getElementById("clearEmpBtn");
  if (clearBtn) clearBtn.style.display = "none";

  const assetInput = document.getElementById("assetTag");
  assetInput.value = "";
  assetInput.classList.remove("field-autofilled");
  document.getElementById("d_assetTagWrap").style.display = "none";
  document.getElementById("assetAutoLabel").style.display = "none";
  document.getElementById("assetTagHint").style.display = "none";

  document.getElementById("searchEmpInput").focus();
}

// ตรวจสอบเมื่อมีการแก้ไขเลขทะเบียนด้วยตนเอง
const assetTagElem = document.getElementById("assetTag");
if (assetTagElem) {
  assetTagElem.addEventListener("input", function () {
    this.classList.remove("field-autofilled");
    const autoLabel = document.getElementById("assetAutoLabel");
    if (autoLabel) autoLabel.style.display = "none";
  });
}

// ปิด Autocomplete เมื่อคลิกภายนอก
document.addEventListener("pointerdown", function (e) {
  const input = document.getElementById("searchEmpInput");
  const list  = document.getElementById("autocompleteList");
  if (!list || list.style.display === "none") return;
  if (e.target !== input && !list.contains(e.target)) {
    list.style.display = "none";
  }
});

// ════════════════════════════════════════════════════════════
//  🖥️ New PC Section — เปิด/ปิดการขอเครื่องใหม่
// ════════════════════════════════════════════════════════════
function toggleNewPcSection() {
  const isPC = document.getElementById("issueType").value === "Request_New_PC";
  const sec  = document.getElementById("newPcSection");
  if (sec) sec.style.display = isPC ? "block" : "none";

  const pcSelect = document.getElementById("pcTypeSelect");
  if (pcSelect) pcSelect.required = isPC;

  if (!isPC) {
    if (pcSelect) pcSelect.value = "";
    const softSec = document.getElementById("softwareSection");
    if (softSec) softSec.style.display = "none";
    const softGrid = document.getElementById("softwareGrid");
    if (softGrid) softGrid.innerHTML = "";
    
    // รีเซ็ตรูปภาพ
    const fileInput = document.getElementById("oldPcPhoto");
    if (fileInput) fileInput.value = "";
    const previewBox = document.getElementById("photoPreviewBox");
    if (previewBox) previewBox.style.display = "none";
    const note = document.getElementById("photoSizeNote");
    if (note) note.innerText = "";
  }
}

function onPcTypeChange() {
  const type    = document.getElementById("pcTypeSelect").value;
  const section = document.getElementById("softwareSection");
  const grid    = document.getElementById("softwareGrid");

  if (!type) {
    if (section) section.style.display = "none";
    if (grid) grid.innerHTML = "";
    return;
  }

  const list = SOFTWARE_LIST[type] || [];
  if (grid) {
    grid.innerHTML = list.map(sw => `
      <span class="sw-pill">
        <span>${sw.icon}</span>
        <span>${_esc(sw.name)}</span>
      </span>
    `).join("");
  }

  if (section) section.style.display = "block";
}

function previewSelectedPhoto(input) {
  const previewBox = document.getElementById("photoPreviewBox");
  const previewImg = document.getElementById("photoPreviewImg");
  const note       = document.getElementById("photoSizeNote");

  if (!input.files || input.files.length === 0) {
    if (previewBox) previewBox.style.display = "none";
    if (note) note.innerText = "";
    return;
  }

  const file = input.files[0];
  const sizeMB = file.size / (1024 * 1024);

  // เช็คขนาดไฟล์ (ไม่เกิน 10 MB)
  if (sizeMB > 10) {
    Swal.fire({
      icon: "error",
      title: "ไฟล์รูปภาพมีขนาดใหญ่เกินไป",
      text: `ขนาดรูปภาพคือ ${sizeMB.toFixed(1)} MB กรุณาเลือกรูปภาพขนาดไม่เกิน 10 MB`
    });
    input.value = "";
    if (previewBox) previewBox.style.display = "none";
    if (note) note.innerText = "";
    return;
  }

  if (note) {
    note.innerText = `ขนาดไฟล์: ${sizeMB < 1 ? (file.size / 1024).toFixed(0) + " KB" : sizeMB.toFixed(1) + " MB"}`;
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    if (previewImg) previewImg.src = e.target.result;
    if (previewBox) previewBox.style.display = "block";
  };
  reader.readAsDataURL(file);
}

function getSelectedSoftware() {
  const type = document.getElementById("pcTypeSelect").value;
  if (!type) return "";
  const list = SOFTWARE_LIST[type] || [];
  return list.map(sw => sw.name).join(", ");
}

function getPcTypeLabel() {
  const sel = document.getElementById("pcTypeSelect");
  if (!sel || sel.selectedIndex < 0) return "";
  return sel.options[sel.selectedIndex]?.text || "";
}

// ════════════════════════════════════════════════════════════
//  🔄 Multi-Step Loading Overlay
// ════════════════════════════════════════════════════════════
function showSubmitOverlay(hasFile) {
  const overlay = document.getElementById("submitOverlay");
  overlay.classList.add("active");
  [1, 2, 3, 4].forEach(n => _setStep(n, "pending"));
  document.getElementById("step2").style.display = hasFile ? "flex" : "none";
}

function hideSubmitOverlay() {
  const overlay = document.getElementById("submitOverlay");
  if (overlay) overlay.classList.remove("active");
}

function _setStep(n, state) {
  const icon  = document.getElementById(`step${n}Icon`);
  const label = document.getElementById(`step${n}Label`);
  if (!icon || !label) return;

  icon.className  = `step-icon ${state}`;
  label.className = `step-label ${state}`;

  if (state === "active") {
    icon.innerHTML = '<div class="step-mini-spin"></div>';
  } else if (state === "done") {
    icon.innerHTML = '<i class="bi bi-check-lg"></i>';
  } else if (state === "error") {
    icon.innerHTML = '<i class="bi bi-x-lg"></i>';
  } else {
    icon.innerHTML = '<i class="bi bi-check-lg"></i>';
  }
}

function _delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ════════════════════════════════════════════════════════════
//  📤 ส่งข้อมูลแจ้งซ่อม (Submit)
// ════════════════════════════════════════════════════════════
async function prepareSubmit() {
  const empId = document.getElementById("empId").value.trim();
  if (!empId) {
    return Swal.fire({
      icon: "warning",
      title: "ข้อมูลไม่ครบถ้วน",
      text: "กรุณาค้นหาและเลือกพนักงานผู้แจ้งก่อนครับ"
    });
  }

  const emailVal = document.getElementById("empEmail").value.trim();
  if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
    return Swal.fire({
      icon: "warning",
      title: "อีเมลไม่ถูกต้อง",
      text: "กรุณากรอกอีเมลที่ถูกต้องเพื่อให้ระบบส่งแจ้งเตือนสถานะได้"
    });
  }

  const itForm = document.getElementById("itForm");
  if (!itForm.checkValidity()) {
    return itForm.reportValidity();
  }

  const issueType = document.getElementById("issueType").value;
  const fileInput = document.getElementById("oldPcPhoto");

  if (issueType === "Request_New_PC") {
    if (!fileInput.files || fileInput.files.length === 0) {
      return Swal.fire({
        icon: "warning",
        title: "กรุณาแนบรูปภาพ",
        text: "กรณีขอเครื่องใหม่ จำเป็นต้องแนบรูปถ่ายเครื่องเก่าด้วยครับ"
      });
    }
    if (!document.getElementById("pcTypeSelect").value) {
      return Swal.fire({
        icon: "warning",
        title: "กรุณาเลือกประเภทเครื่อง",
        text: "กรุณาระบุประเภทเครื่องที่ต้องการ (Office หรือ Engineering)"
      });
    }
  }

  const hasFile = issueType === "Request_New_PC" && fileInput.files && fileInput.files.length > 0;

  // ปิดปุ่มส่ง & เปิด Loading Overlay
  const btn = document.getElementById("submitBtn");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status"></span>กำลังดำเนินการ...';
  showSubmitOverlay(hasFile);

  // ── Step 1: ตรวจสอบข้อมูล ──
  _setStep(1, "active");
  await _delay(350);

  const formData = {
    empId:            empId,
    empName:          document.getElementById("empName").value,
    empDept:          document.getElementById("empDept").value,
    empPosition:      document.getElementById("empPosition").value,
    empPlant:         document.getElementById("empPlant").value,
    empEmail:         emailVal,
    contactPhone:     document.getElementById("contactPhone").value.trim(),
    assetTag:         document.getElementById("assetTag").value.trim(),
    assetNumber:      document.getElementById("assetNumber").value.trim(),
    priority:         document.getElementById("priority").value,
    issueType:        issueType,
    issueDetail:      document.getElementById("issueDetail").value.trim(),
    reasonNewPc:      document.getElementById("reasonNewPc").value.trim(),
    pcType:           getPcTypeLabel(),
    requiredSoftware: getSelectedSoftware(),
    fileName: "", mimeType: "", fileData: ""
  };
  _setStep(1, "done");

  // ── Step 2: อัปโหลดรูปภาพ ──
  if (hasFile) {
    _setStep(2, "active");
    try {
      const file = fileInput.files[0];
      const base64Data = await _readFileAsBase64(file);
      formData.fileData = base64Data;
      formData.fileName = file.name;
      formData.mimeType = file.type || "image/jpeg";
      _setStep(2, "done");
    } catch (err) {
      _setStep(2, "error");
      hideSubmitOverlay();
      resetBtn();
      return Swal.fire("ข้อผิดพลาด", "ไม่สามารถอ่านไฟล์รูปภาพได้ กรุณาลองใหม่อีกครั้ง", "error");
    }
  }

  // ── Step 3 & 4: บันทึกลง Sheet และส่งอีเมล ──
  await sendData(formData);
}

function _readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => {
      const res = e.target.result;
      const base64 = res.indexOf(",") !== -1 ? res.split(",")[1] : res;
      resolve(base64);
    };
    reader.onerror = err => reject(err);
    reader.readAsDataURL(file);
  });
}

async function sendData(formData) {
  _setStep(3, "active");
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "saveTicket", data: formData })
    });

    const result = await res.json();

    if (result.success) {
      _setStep(3, "done");

      // ── Step 4: ส่งแจ้งเตือน ──
      _setStep(4, "active");
      await _delay(500);
      _setStep(4, "done");
      await _delay(300);

      hideSubmitOverlay();

      Swal.fire({
        icon: "success",
        title: "บันทึกข้อมูลสำเร็จ! 🎉",
        html: `
          <div class="my-3">
            <div class="fs-5">หมายเลข Ticket ID</div>
            <div class="fs-3 fw-bold text-primary mt-1">${_esc(result.ticketId)}</div>
          </div>
          <p class="text-muted small">
            ระบบได้บันทึกข้อมูลเรียบร้อยแล้ว และส่งข้อความแจ้งเตือนไปยังช่าง IT เรียบร้อยแล้ว<br>
            ท่านสามารถใช้รหัสพนักงานในการติดตามสถานะได้ตลอดเวลา
          </p>
        `,
        confirmButtonText: "ตกลง"
      });

      resetForm();
    } else {
      _setStep(3, "error");
      await _delay(300);
      hideSubmitOverlay();
      Swal.fire("เกิดข้อผิดพลาด", result.error || "ไม่สามารถบันทึกข้อมูลได้", "error");
      resetBtn();
    }
  } catch (err) {
    _setStep(3, "error");
    await _delay(300);
    hideSubmitOverlay();
    console.error("sendData error:", err);
    Swal.fire("ข้อผิดพลาดของระบบ", "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง", "error");
    resetBtn();
  }
}

function resetForm() {
  document.getElementById("itForm").reset();
  clearSelectedEmployee();

  document.getElementById("employeeInfoBox").style.display = "none";
  document.getElementById("softwareSection").style.display = "none";
  document.getElementById("softwareGrid").innerHTML = "";

  const previewBox = document.getElementById("photoPreviewBox");
  if (previewBox) previewBox.style.display = "none";
  const note = document.getElementById("photoSizeNote");
  if (note) note.innerText = "";

  toggleNewPcSection();
  resetBtn();
}

function resetBtn() {
  const btn = document.getElementById("submitBtn");
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-send-fill me-2"></i>ยืนยันการส่งข้อมูล';
  }
}

// ════════════════════════════════════════════════════════════
//  📋 ติดตามสถานะ Ticket (Track Tickets)
// ════════════════════════════════════════════════════════════
async function loadMyTickets() {
  const input = document.getElementById("trackEmpId");
  const rawId = input ? input.value.trim() : "";
  const empId = rawId.replace(/\.0$/, "");

  if (!empId) {
    return Swal.fire("แจ้งเตือน", "กรุณากรอกรหัสพนักงานก่อนค้นหา", "warning");
  }

  const tbody = document.querySelector("#myTicketTable tbody");
  tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm me-2"></div>กำลังค้นหาประวัติการแจ้งซ่อม...</td></tr>';

  try {
    const res  = await fetch(`${API_URL}?action=getTickets&empId=${encodeURIComponent(empId)}`);
    const data = await res.json();
    tbody.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted py-5">
            <i class="bi bi-inbox fs-2 d-block mb-2 opacity-50"></i>
            ไม่พบประวัติการแจ้งซ่อมสำหรับรหัสพนักงาน <b>${_esc(empId)}</b>
          </td>
        </tr>`;
      return;
    }

    const statusBadgeMap = {
      "เสร็จสิ้น":      '<span class="badge bg-success">เสร็จสิ้น</span>',
      "กำลังดำเนินการ": '<span class="badge bg-warning text-dark">กำลังดำเนินการ</span>',
      "รอดำเนินการ":    '<span class="badge bg-danger">รอดำเนินการ</span>'
    };

    data.forEach(r => {
      const isExt = _isExternalTrue(r.isExternal);
      const extBadge = isExt ? '<span class="badge bg-info text-dark">ซ่อมนอก</span>' : '—';
      const badge = statusBadgeMap[r.status] || `<span class="badge bg-secondary">${_esc(r.status || "ไม่ระบุ")}</span>`;
      const dateDisplay = r.date ? String(r.date).split(" ")[0] : "—";

      tbody.innerHTML += `
        <tr>
          <td class="fw-bold text-primary" style="white-space:nowrap;">${_esc(r.ticketId)}</td>
          <td style="white-space:nowrap;">${_esc(dateDisplay)}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(r.issue)}">
            ${_esc(r.issue || "—")}
          </td>
          <td>${badge}</td>
          <td class="d-none d-md-table-cell">${_esc(r.assignee || "—")}</td>
          <td class="d-none d-sm-table-cell text-center">${extBadge}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${_esc(r.itNote)}">
            ${_esc(r.itNote || "—")}
          </td>
        </tr>`;
    });
  } catch (err) {
    console.error("loadMyTickets error:", err);
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger py-4">เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง</td></tr>';
  }
}

// ════════════════════════════════════════════════════════════
//  🛡️ Helper Functions
// ════════════════════════════════════════════════════════════
function _isExternalTrue(val) {
  if (!val) return false;
  if (val === true || val === 1) return true;
  const s = String(val).trim().toLowerCase();
  return s === "true" || s === "1" || s.includes("ภายนอก") || s.includes("ซ่อมนอก") || s.includes("external");
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