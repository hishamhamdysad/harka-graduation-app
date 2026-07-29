// --- STATE & INITIALIZATION ---
let bookings = [];
let savedNumbers = [];
let pendingPhoto = null;
let pendingScreenshot = null;

const API_BASE = '/api';

const el = (id) => document.getElementById(id);
const formPanel = el('formPanel');
const toggleFormBtn = el('toggleFormBtn');
const bookingForm = el('bookingForm');
const ticketGrid = el('ticketGrid');
const modalOverlay = el('modalOverlay');
const toast = el('toast');

// --- TOAST UTILITY ---
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// --- API FETCH HELPERS ---
async function fetchBookings() {
  try {
    const res = await fetch(`${API_BASE}/bookings`);
    if (res.ok) {
      const data = await res.json();
      bookings = data.data || [];
    }
  } catch (err) {
    console.warn('Backend not available, using localStorage fallback');
    const local = localStorage.getItem('harka_bookings');
    bookings = local ? JSON.parse(local) : [];
  }
  updateDeptFilterOptions();
  renderAll();
}

async function fetchSavedNumbers() {
  try {
    const res = await fetch(`${API_BASE}/transfer-numbers`);
    if (res.ok) {
      const data = await res.json();
      savedNumbers = data.data || [];
    }
  } catch (err) {
    const local = localStorage.getItem('harka_transfer_numbers');
    savedNumbers = local ? JSON.parse(local) : [];
  }
  populateTransferNumberSelect();
  renderSavedNumbersList();
}

async function saveBookingToApi(data, editId) {
  try {
    const url = editId ? `${API_BASE}/bookings/${editId}` : `${API_BASE}/bookings`;
    const method = editId ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to save');
  } catch (err) {
    // LocalStorage fallback
    if (editId) {
      const idx = bookings.findIndex(b => b.id === editId);
      if (idx !== -1) bookings[idx] = { ...bookings[idx], ...data };
    } else {
      bookings.unshift({ id: Date.now().toString(), createdAt: new Date().toISOString(), ...data });
    }
    localStorage.setItem('harka_bookings', JSON.stringify(bookings));
  }
  await fetchBookings();
}

async function deleteBookingFromApi(id) {
  try {
    await fetch(`${API_BASE}/bookings/${id}`, { method: 'DELETE' });
  } catch (err) {
    bookings = bookings.filter(b => b.id !== id);
    localStorage.setItem('harka_bookings', JSON.stringify(bookings));
  }
  await fetchBookings();
}

async function addTransferNumberToApi(numData) {
  try {
    const res = await fetch(`${API_BASE}/transfer-numbers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(numData)
    });
    if (!res.ok) throw new Error('Failed to add number');
  } catch (err) {
    savedNumbers.unshift({ id: Date.now().toString(), ...numData });
    localStorage.setItem('harka_transfer_numbers', JSON.stringify(savedNumbers));
  }
  await fetchSavedNumbers();
}

async function deleteTransferNumberFromApi(id) {
  try {
    await fetch(`${API_BASE}/transfer-numbers/${id}`, { method: 'DELETE' });
  } catch (err) {
    savedNumbers = savedNumbers.filter(n => n.id !== id);
    localStorage.setItem('harka_transfer_numbers', JSON.stringify(savedNumbers));
  }
  await fetchSavedNumbers();
}

// --- POPULATE TRANSFER NUMBERS DROPDOWN ---
function populateTransferNumberSelect() {
  const select = el('transferNumberSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="">-- اختر من أرقامك المحول عليها --</option>`;

  savedNumbers.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.number;
    opt.textContent = `${n.number} - ${n.name} (${n.type})`;
    opt.dataset.type = n.type;
    select.appendChild(opt);
  });

  const customOpt = document.createElement('option');
  customOpt.value = '__CUSTOM__';
  customOpt.textContent = '➕ أدخل رقم آخر (مخصص)...';
  select.appendChild(customOpt);

  select.value = currentVal;
}

// Listen to select changes to update transfer type automatically or show custom field
el('transferNumberSelect').addEventListener('change', (e) => {
  const val = e.target.value;
  const customContainer = el('customNumberContainer');
  const customInput = el('customTransferNumber');

  if (val === '__CUSTOM__') {
    customContainer.style.display = 'block';
    customInput.required = true;
  } else {
    customContainer.style.display = 'none';
    customInput.required = false;

    // Auto-fill Transfer Type if found in saved numbers
    const selectedNumObj = savedNumbers.find(n => n.number === val);
    if (selectedNumObj && selectedNumObj.type) {
      el('transferType').value = selectedNumObj.type;
    }
  }
});

// --- DEPARTMENTS FILTER OPTIONS ---
function updateDeptFilterOptions() {
  const select = el('filterDept');
  if (!select) return;

  const depts = Array.from(new Set(bookings.map(b => (b.department || '').trim()).filter(Boolean)));
  const currentVal = select.value;

  select.innerHTML = `<option value="">جميع الأقسام (${depts.length})</option>`;
  depts.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = d;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

// --- IMAGE RESIZING & HANDLERS ---
function resizeImage(file, maxDim) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

el('photoBox').addEventListener('click', () => el('photoInput').click());
el('screenshotBox').addEventListener('click', () => el('screenshotInput').click());

el('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    pendingPhoto = await resizeImage(file, 500);
    el('photoBox').innerHTML = `<img src="${pendingPhoto}"><span>تم اختيار صورة الطالب</span>`;
  } catch (err) { showToast('حصل خطأ في اختيار الصورة'); }
});

el('screenshotInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    pendingScreenshot = await resizeImage(file, 600);
    el('screenshotBox').innerHTML = `<img src="${pendingScreenshot}"><span>تم اختيار صورة السكرين شوت</span>`;
  } catch (err) { showToast('حصل خطأ في اختيار الصورة'); }
});

// --- FORM CONTROLS ---
function resetForm() {
  bookingForm.reset();
  el('editId').value = '';
  pendingPhoto = null;
  pendingScreenshot = null;
  el('photoBox').innerHTML = '<span id="photoLabel">📷 اضغط لاختيار صورة الطالب</span>';
  el('screenshotBox').innerHTML = '<span id="screenshotLabel">🧾 اختر صورة سكرين شوت التحويل</span>';
  el('customNumberContainer').style.display = 'none';
  el('customTransferNumber').required = false;
  el('formTitle').textContent = 'بيانات الحجز الجديدة';
  el('saveBtn').textContent = 'حفظ الحجز';
}

toggleFormBtn.addEventListener('click', () => {
  const isOpen = formPanel.classList.contains('open');
  if (isOpen) {
    formPanel.classList.remove('open');
  } else {
    resetForm();
    formPanel.classList.add('open');
    formPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
});

el('cancelFormBtn').addEventListener('click', () => {
  formPanel.classList.remove('open');
});

// SUBMIT BOOKING FORM
bookingForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const editId = el('editId').value;

  if (!pendingPhoto && !editId) {
    showToast('من فضلك اختر صورة البانر للطالب');
    return;
  }

  // Determine transfer number
  const selectVal = el('transferNumberSelect').value;
  let finalTransferNum = selectVal;
  if (selectVal === '__CUSTOM__') {
    finalTransferNum = el('customTransferNumber').value.trim();
  }

  if (!finalTransferNum) {
    showToast('برجاء تحديد أو إدخال الرقم المحول عليه');
    return;
  }

  const existing = editId ? bookings.find(b => b.id === editId) : null;

  const data = {
    shieldName: el('shieldName').value.trim(),
    sashName: el('sashName').value.trim(),
    tagName: el('tagName').value.trim(),
    department: el('department').value.trim(),
    companions: parseInt(el('companions').value || '0', 10),
    photo: pendingPhoto || (existing ? existing.photo : null),
    transferNumber: finalTransferNum,
    transferType: el('transferType').value,
    paymentStatus: el('paymentStatus').value,
    screenshot: pendingScreenshot || (existing ? existing.screenshot : null),
    notes: el('notes').value.trim(),
  };

  await saveBookingToApi(data, editId);
  showToast(editId ? 'تم تحديث الحجز بنجاح' : 'تم حفظ الحجز بنجاح');
  formPanel.classList.remove('open');
  resetForm();
});

// --- SAVED NUMBERS FORM ---
el('addNumberForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const number = el('newNumValue').value.trim();
  const name = el('newNumName').value.trim();
  const type = el('newNumType').value;

  if (!number || !name) {
    showToast('يرجى كتابة كافة البيانات المطلوب');
    return;
  }

  await addTransferNumberToApi({ number, name, type });
  el('addNumberForm').reset();
  showToast('تمت إضافة رقم التحويل بنجاح');
});

function renderSavedNumbersList() {
  const container = el('savedNumbersList');
  if (!container) return;

  if (savedNumbers.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 30px;">
        <div>مفيش أرقام تحويل مسجلة لسه، ضيف أول رقم فوق</div>
      </div>`;
    return;
  }

  container.innerHTML = savedNumbers.map(n => `
    <div class="saved-num-card">
      <div>
        <div class="num-val">${escapeHtml(n.number)}</div>
        <div class="num-name">${escapeHtml(n.name)}</div>
      </div>
      <div class="num-bottom">
        <span class="num-type-tag">${escapeHtml(n.type)}</span>
        <button class="btn btn-danger" style="padding: 4px 10px; font-size: 12px;" onclick="deleteNumber('${n.id}')">حذف</button>
      </div>
    </div>
  `).join('');
}

async function deleteNumber(id) {
  if (confirm('هل أنت تأكد من حذف رقم التحويل ده؟')) {
    await deleteTransferNumberFromApi(id);
    showToast('تم حذف الرقم');
  }
}

// --- RENDERING TICKET GRID & STATS ---
function renderStats() {
  el('statCount').textContent = bookings.length;
  const totalCompanions = bookings.reduce((sum, b) => sum + (parseInt(b.companions) || 0), 0);
  el('statCompanions').textContent = totalCompanions;
  const paidCount = bookings.filter(b => b.paymentStatus === 'كامل').length;
  el('statPaid').textContent = paidCount;
}

function renderGrid() {
  const query = el('searchInput').value.trim().toLowerCase();
  const selectedDept = el('filterDept').value;

  const filtered = bookings.filter(b => {
    const matchQuery = !query ||
      (b.shieldName || '').toLowerCase().includes(query) ||
      (b.sashName || '').toLowerCase().includes(query) ||
      (b.tagName || '').toLowerCase().includes(query) ||
      (b.department || '').toLowerCase().includes(query) ||
      (b.transferNumber || '').toLowerCase().includes(query);

    const matchDept = !selectedDept || b.department === selectedDept;

    return matchQuery && matchDept;
  });

  if (filtered.length === 0) {
    ticketGrid.innerHTML = `
      <div class="empty-state">
        <div class="icon">🎓</div>
        <div>${bookings.length === 0 ? 'لسه مفيش حجوزات مسجلة، اضغط على "+ حجز جديد"' : 'لا يوجد حجوزات مطابقة للبحث'}</div>
      </div>`;
    return;
  }

  ticketGrid.innerHTML = filtered.map(b => `
    <div class="ticket" data-id="${b.id}">
      <div class="ticket-top">
        ${b.photo ? `<img class="ticket-photo" src="${b.photo}" alt="صورة ${escapeHtml(b.shieldName)}">` : `<div class="ticket-photo placeholder">🎓</div>`}
        <div class="ticket-names">
          <div class="primary heading-font">${escapeHtml(b.shieldName)}</div>
          <span class="dept">${escapeHtml(b.department)}</span>
        </div>
      </div>
      <div class="perforation"></div>
      <div class="ticket-bottom">
        <div class="stub-item">المرافقين: <b>${b.companions}</b> | 💳 <b>${escapeHtml(b.transferNumber)}</b></div>
        <div class="status-ribbon ${b.paymentStatus === 'كامل' ? 'status-full' : 'status-partial'}">${escapeHtml(b.paymentStatus)}</div>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('.ticket').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
}

// --- RENDER DASHBOARD ANALYTICS ---
function renderDashboard() {
  const totalBookings = bookings.length;
  const totalCompanions = bookings.reduce((sum, b) => sum + (parseInt(b.companions) || 0), 0);
  const paidFull = bookings.filter(b => b.paymentStatus === 'كامل').length;

  el('dashTotalBookings').textContent = totalBookings;
  el('dashTotalCompanions').textContent = totalCompanions;

  // Department Statistics calculation
  const deptMap = {};
  bookings.forEach(b => {
    const dept = (b.department || 'غير محدد').trim();
    if (!deptMap[dept]) {
      deptMap[dept] = { name: dept, count: 0, companions: 0, paidFull: 0, transferNumbers: {} };
    }
    deptMap[dept].count += 1;
    deptMap[dept].companions += (parseInt(b.companions) || 0);
    if (b.paymentStatus === 'كامل') deptMap[dept].paidFull += 1;

    if (b.transferNumber) {
      deptMap[dept].transferNumbers[b.transferNumber] = (deptMap[dept].transferNumbers[b.transferNumber] || 0) + 1;
    }
  });

  const depts = Object.values(deptMap).sort((a, b) => b.count - a.count);
  el('dashTotalDepts').textContent = depts.length;
  el('dashPaidPercentage').textContent = totalBookings > 0 ? `${Math.round((paidFull / totalBookings) * 100)}%` : '0%';

  // Render Department Breakdown Cards
  const deptContainer = el('deptBreakdownList');
  if (depts.length === 0) {
    deptContainer.innerHTML = '<div class="empty-state" style="padding: 20px;">مفيش بيانات أقسام لسه</div>';
  } else {
    deptContainer.innerHTML = depts.map(d => {
      const percentage = totalBookings > 0 ? Math.round((d.count / totalBookings) * 100) : 0;
      const transferStr = Object.entries(d.transferNumbers)
        .map(([num, cnt]) => `<b>${num}</b> (${cnt})`)
        .join(', ');

      return `
        <div class="dept-item">
          <div class="dept-item-top">
            <div class="dept-name">🏛️ ${escapeHtml(d.name)}</div>
            <div class="dept-badges">
              <span class="badge-chip badge-bookings">${d.count} حجز (${percentage}%)</span>
              <span class="badge-chip badge-companions">👥 ${d.companions} مرافق</span>
            </div>
          </div>
          <div class="dept-progress-bg">
            <div class="dept-progress-fill" style="width: ${percentage}%;"></div>
          </div>
          <div class="dept-meta-row">
            <span>دفع كامل: <b>${d.paidFull} من ${d.count}</b></span>
            <span>الأرقام المستخدمة: ${transferStr || 'لا يوجد'}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Number Usage Statistics
  const numUsageMap = {};
  bookings.forEach(b => {
    if (b.transferNumber) {
      numUsageMap[b.transferNumber] = (numUsageMap[b.transferNumber] || 0) + 1;
    }
  });

  const numContainer = el('numberUsageList');
  const numEntries = Object.entries(numUsageMap).sort((a, b) => b[1] - a[1]);

  if (numEntries.length === 0) {
    numContainer.innerHTML = '<div class="empty-state" style="padding: 20px;">مفيش أرقام مستخدمة لسه</div>';
  } else {
    numContainer.innerHTML = numEntries.map(([num, count]) => {
      const numObj = savedNumbers.find(n => n.number === num);
      const name = numObj ? numObj.name : 'رقم مخصص';
      return `
        <div class="num-usage-item">
          <div class="num-usage-info">
            <b>💳 ${escapeHtml(num)}</b>
            <div>${escapeHtml(name)}</div>
          </div>
          <div class="num-usage-count">${count} حجز</div>
        </div>
      `;
    }).join('');
  }
}

function renderAll() {
  renderStats();
  renderGrid();
  renderDashboard();
  renderSavedNumbersList();
}

// --- EXPORT TO EXCEL ---
el('exportExcelTopBtn').addEventListener('click', async () => {
  showToast('جاري تحضير ملف الإكسيل...');
  try {
    // Try backend export first
    window.location.href = `${API_BASE}/export/excel`;
  } catch (err) {
    // Client-side Fallback using SheetJS library
    if (window.XLSX && bookings.length > 0) {
      const data = bookings.map((b, i) => ({
        'م': i + 1,
        'الاسم على الدرع': b.shieldName || '',
        'الاسم على الوشاح': b.sashName || '',
        'الاسم على التاج': b.tagName || '',
        'القسم': b.department || '',
        'عدد المرافقين الإضافيين': b.companions || 0,
        'الرقم المحول عليه': b.transferNumber || '',
        'نوع التحويل': b.transferType || '',
        'حالة الدفع': b.paymentStatus || '',
        'الملاحظات': b.notes || ''
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الحجوزات');
      XLSX.writeFile(wb, `Harka_Bookings_${Date.now()}.xlsx`);
      showToast('تم تصدير ملف الإكسيل بنجاح');
    } else {
      showToast('تعذر تصدير الملف');
    }
  }
});

// --- MODAL DETAILED VIEW ---
function openModal(id) {
  const b = bookings.find(x => x.id === id);
  if (!b) return;

  el('modalContent').innerHTML = `
    <h2>${escapeHtml(b.shieldName)}</h2>
    <div class="modal-sub">تفاصيل حجز التخرج الكاملة</div>
    <div class="detail-grid">
      <div class="detail-item"><div class="k">الاسم على الدرع</div><div class="v">${escapeHtml(b.shieldName)}</div></div>
      <div class="detail-item"><div class="k">الاسم على الوشاح</div><div class="v">${escapeHtml(b.sashName)}</div></div>
      <div class="detail-item"><div class="k">الاسم على تاج الاسم</div><div class="v">${escapeHtml(b.tagName)}</div></div>
      <div class="detail-item"><div class="k">القسم / الكلية</div><div class="v">${escapeHtml(b.department)}</div></div>
      <div class="detail-item"><div class="k">عدد المرافقين الإضافيين</div><div class="v">${b.companions}</div></div>
      <div class="detail-item"><div class="k">الرقم المحول عليه</div><div class="v">${escapeHtml(b.transferNumber)}</div></div>
      <div class="detail-item"><div class="k">نوع التحويل</div><div class="v">${escapeHtml(b.transferType)}</div></div>
      <div class="detail-item"><div class="k">حالة الدفع</div><div class="v">${escapeHtml(b.paymentStatus)}</div></div>
      ${b.notes ? `<div class="detail-item full"><div class="k">ملاحظات</div><div class="v" style="font-weight:400;">${escapeHtml(b.notes)}</div></div>` : ''}
      ${b.screenshot ? `<div class="detail-item full"><div class="k">سكرين شوت التحويل</div><img class="screenshot-preview" src="${b.screenshot}"></div>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn btn-sage" id="editBtn">تعديل الحجز</button>
      <button class="btn btn-danger" id="deleteBtn">حذف الحجز</button>
    </div>
  `;
  modalOverlay.classList.add('open');

  el('editBtn').addEventListener('click', () => {
    modalOverlay.classList.remove('open');
    populateFormForEdit(b);
  });

  el('deleteBtn').addEventListener('click', async () => {
    if (confirm('هل أنت متأكد من رغبتك في حذف هذا الحجز نهائياً؟')) {
      await deleteBookingFromApi(id);
      modalOverlay.classList.remove('open');
      showToast('تم حذف الحجز');
    }
  });
}

function populateFormForEdit(b) {
  resetForm();
  el('editId').value = b.id;
  el('shieldName').value = b.shieldName || '';
  el('sashName').value = b.sashName || '';
  el('tagName').value = b.tagName || '';
  el('department').value = b.department || '';
  el('companions').value = b.companions || 0;

  // Transfer Number select matching
  const matchingSaved = savedNumbers.find(n => n.number === b.transferNumber);
  if (matchingSaved) {
    el('transferNumberSelect').value = b.transferNumber;
  } else {
    el('transferNumberSelect').value = '__CUSTOM__';
    el('customNumberContainer').style.display = 'block';
    el('customTransferNumber').value = b.transferNumber || '';
  }

  el('transferType').value = b.transferType || '';
  el('paymentStatus').value = b.paymentStatus || '';
  el('notes').value = b.notes || '';

  if (b.photo) {
    el('photoBox').innerHTML = `<img src="${b.photo}"><span>الصورة الحالية (اضغط للتغيير)</span>`;
  }
  if (b.screenshot) {
    el('screenshotBox').innerHTML = `<img src="${b.screenshot}"><span>السكرين شوت الحالي (اضغط للتغيير)</span>`;
  }

  el('formTitle').textContent = 'تعديل بيانات الحجز';
  el('saveBtn').textContent = 'حفظ التعديلات';

  // Switch to bookings tab if not active
  document.querySelector('[data-tab="tab-bookings"]').click();
  formPanel.classList.add('open');
  formPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// --- EVENT LISTENERS FOR TABS & SEARCH ---
document.querySelectorAll('.nav-tab').forEach(tabBtn => {
  tabBtn.addEventListener('click', () => {
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    tabBtn.classList.add('active');
    const target = tabBtn.dataset.tab;
    el(target).classList.add('active');

    if (target === 'tab-dashboard') renderDashboard();
    if (target === 'tab-numbers') renderSavedNumbersList();
  });
});

el('searchInput').addEventListener('input', renderGrid);
el('filterDept').addEventListener('change', renderGrid);

el('modalCloseBtn').addEventListener('click', () => modalOverlay.classList.remove('open'));
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) modalOverlay.classList.remove('open'); });

// --- INITIALIZE APP ---
async function initApp() {
  await fetchSavedNumbers();
  await fetchBookings();
}

initApp();
