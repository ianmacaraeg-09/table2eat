/* Table2Eat — booking flow: morph modal, multi-step wizard, QR pay, localStorage */
(function () {
  const FEE_BASE = 300;
  const FEE_PER_EXTRA_GUEST = 50; // beyond 2 guests

  const overlay   = document.getElementById('bookingOverlay');
  const backdrop  = document.getElementById('bookingBackdrop');
  const panel     = document.getElementById('bookingPanel');
  const closeBtn  = document.getElementById('bookingCloseBtn');
  const steps     = [...document.querySelectorAll('.booking-step')];
  const dots      = [...document.querySelectorAll('.step-dot')];
  const labels    = [...document.querySelectorAll('.step-labels span')];

  let state = { step: 1, ref: null, fee: FEE_BASE, receiptDataUrl: null, receiptName: null };
  let qr = null;

  /* ---------------- helpers ---------------- */
  function genRef() {
    const n = Math.floor(100000 + Math.random() * 900000);
    return `T2E-${n}`;
  }

  function showStep(n) {
    const current = steps.find(s => s.classList.contains('active'));
    const next = steps.find(s => Number(s.dataset.step) === n);
    if (!next || next === current) return;

    if (current) {
      gsap.to(current, { opacity: 0, y: -14, duration: .28, ease: 'power2.in', onComplete() {
        current.classList.remove('active');
        next.classList.add('active');
        gsap.fromTo(next, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .4, ease: 'expo.out' });
      }});
    } else {
      next.classList.add('active');
    }

    dots.forEach(d => {
      const ds = Number(d.dataset.step);
      d.classList.toggle('done', ds < n);
      d.classList.toggle('active', ds <= n);
    });
    labels.forEach(l => l.classList.toggle('active', Number(l.dataset.label) === n));
    state.step = n;
  }

  function resetWizard() {
    state = { step: 1, ref: null, fee: FEE_BASE, receiptDataUrl: null, receiptName: null };
    document.getElementById('step1').reset();
    ['f-name','f-phone','f-email','f-date','f-time','f-party'].forEach(id =>
      document.getElementById(id).classList.remove('has-error'));
    document.getElementById('uploadPreview').classList.remove('show');
    document.getElementById('uploadError').style.display = 'none';
    document.getElementById('uploadInput').value = '';
    steps.forEach(s => s.classList.remove('active'));
    document.getElementById('step1').classList.add('active');
    dots.forEach((d,i) => { d.classList.toggle('active', i===0); d.classList.remove('done'); });
    labels.forEach((l,i) => l.classList.toggle('active', i===0));
  }

  /* ---------------- morph open / close ---------------- */
  function open(triggerEl) {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    const panelRect = panel.getBoundingClientRect();
    const btnRect = triggerEl ? triggerEl.getBoundingClientRect() : null;
    const originX = btnRect ? (btnRect.left + btnRect.width/2) - (panelRect.left + panelRect.width/2) : 0;
    const originY = btnRect ? (btnRect.top + btnRect.height/2) - (panelRect.top + panelRect.height/2) : 40;
    const originScale = btnRect ? Math.max(btnRect.width / panelRect.width, .08) : .3;

    gsap.set(backdrop, { opacity: 0 });
    gsap.set(panel, { x: originX, y: originY, scale: originScale, opacity: 0, borderRadius: '999px', transformOrigin: 'center center' });

    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .to(backdrop, { opacity: 1, duration: .5 }, 0)
      .to(panel, { x: 0, y: 0, scale: 1, opacity: 1, borderRadius: '32px', duration: .85 }, 0);
  }

  function close() {
    const tl = gsap.timeline({ onComplete() {
      overlay.classList.remove('is-open');
      overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      resetWizard();
    }});
    tl.to(panel, { scale: .92, y: 20, opacity: 0, duration: .35, ease: 'power2.in' }, 0)
      .to(backdrop, { opacity: 0, duration: .35 }, 0);
  }

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('is-open')) close(); });

  /* ---------------- step 1: details ---------------- */
  const form1 = document.getElementById('step1');
  const fields = {
    name:  { el: document.getElementById('bk-name'),  wrap: document.getElementById('f-name'),  test: v => v.trim().length > 1 },
    phone: { el: document.getElementById('bk-phone'), wrap: document.getElementById('f-phone'), test: v => /^[\d+()\s-]{7,15}$/.test(v.trim()) },
    email: { el: document.getElementById('bk-email'), wrap: document.getElementById('f-email'), test: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
    date:  { el: document.getElementById('bk-date'),  wrap: document.getElementById('f-date'),  test: v => !!v },
    time:  { el: document.getElementById('bk-time'),  wrap: document.getElementById('f-time'),  test: v => !!v },
    party: { el: document.getElementById('bk-party'), wrap: document.getElementById('f-party'), test: v => !!v },
  };
  // default date = today, min = today
  const todayISO = new Date().toISOString().split('T')[0];
  fields.date.el.min = todayISO;

  form1.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    Object.values(fields).forEach(f => {
      const ok = f.test(f.el.value);
      f.wrap.classList.toggle('has-error', !ok);
      if (!ok) valid = false;
    });
    if (!valid) {
      const firstError = form1.querySelector('.has-error');
      firstError?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    const party = Number(fields.party.el.value);
    state.fee = FEE_BASE + Math.max(0, party - 2) * FEE_PER_EXTRA_GUEST;
    state.ref = genRef();
    state.details = {
      name: fields.name.el.value.trim(),
      phone: fields.phone.el.value.trim(),
      email: fields.email.el.value.trim(),
      date: fields.date.el.value,
      time: fields.time.el.value,
      party,
      notes: document.getElementById('bk-notes').value.trim(),
    };

    renderSummary();
    renderQR();
    showStep(2);
  });

  function renderSummary() {
    const d = state.details;
    const prettyDate = new Date(d.date + 'T00:00:00').toLocaleDateString(undefined, { weekday:'long', month:'long', day:'numeric' });
    document.getElementById('summaryCard').innerHTML = `
      <div class="summary-row"><span>Name</span><span>${escapeHtml(d.name)}</span></div>
      <div class="summary-row"><span>Date &amp; Time</span><span>${prettyDate}, ${d.time}</span></div>
      <div class="summary-row"><span>Party Size</span><span>${d.party} guest${d.party>1?'s':''}</span></div>
      <div class="summary-row total"><span>Reservation Fee</span><span>₱${state.fee}</span></div>
    `;
  }

  function renderQR() {
    const holder = document.getElementById('qrcode-canvas');
    holder.innerHTML = '';
    document.getElementById('payAmount').textContent = state.fee;
    document.getElementById('payRef').textContent = state.ref;
    const payload = `TABLE2EAT|REF:${state.ref}|AMOUNT:${state.fee}|NAME:${state.details.name}`;
    if (window.QRCode) {
      new QRCode(holder, { text: payload, width: 176, height: 176, colorDark: '#253626', colorLight: '#FFFDF7', correctLevel: QRCode.CorrectLevel.M });
    } else {
      holder.textContent = 'QR unavailable — reference: ' + state.ref;
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* ---------------- step nav (back / next generic) ---------------- */
  document.querySelectorAll('[data-back]').forEach(btn =>
    btn.addEventListener('click', () => showStep(Number(btn.dataset.back))));
  document.querySelectorAll('[data-next]').forEach(btn =>
    btn.addEventListener('click', () => showStep(Number(btn.dataset.next))));

  /* ---------------- step 3: upload ---------------- */
  const uploadZone   = document.getElementById('uploadZone');
  const uploadInput  = document.getElementById('uploadInput');
  const uploadPrev   = document.getElementById('uploadPreview');
  const uploadImg    = document.getElementById('uploadPreviewImg');
  const uploadName   = document.getElementById('uploadPreviewName');
  const uploadError  = document.getElementById('uploadError');
  const removeBtn    = document.getElementById('uploadRemoveBtn');

  ['dragenter','dragover'].forEach(evt => uploadZone.addEventListener(evt, e => { e.preventDefault(); uploadZone.classList.add('dragover'); }));
  ['dragleave','drop'].forEach(evt => uploadZone.addEventListener(evt, e => { e.preventDefault(); uploadZone.classList.remove('dragover'); }));
  uploadZone.addEventListener('drop', e => {
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });
  uploadInput.addEventListener('change', () => {
    const file = uploadInput.files?.[0];
    if (file) handleFile(file);
  });
  removeBtn.addEventListener('click', () => {
    state.receiptDataUrl = null; state.receiptName = null;
    uploadInput.value = '';
    uploadPrev.classList.remove('show');
  });

  function handleFile(file) {
    if (!file.type.startsWith('image/')) { showUploadError('Please upload an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { showUploadError('File is too large — max 5MB.'); return; }
    uploadError.style.display = 'none';

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        // downscale to keep localStorage lean
        const maxW = 800;
        const scale = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', .82);
        state.receiptDataUrl = dataUrl;
        state.receiptName = file.name;
        uploadImg.src = dataUrl;
        uploadName.textContent = file.name;
        uploadPrev.classList.add('show');
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }

  function showUploadError(msg) {
    uploadError.textContent = msg;
    uploadError.style.display = 'block';
  }

  /* ---------------- step 3 -> submit ---------------- */
  document.getElementById('submitBookingBtn').addEventListener('click', () => {
    if (!state.receiptDataUrl) { showUploadError('Please upload your payment screenshot before submitting.'); return; }

    const booking = {
      id: 'bk_' + Date.now(),
      ref: state.ref,
      ...state.details,
      fee: state.fee,
      receiptDataUrl: state.receiptDataUrl,
      receiptName: state.receiptName,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const KEY = 'table2eat_bookings';
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    list.unshift(booking);
    localStorage.setItem(KEY, JSON.stringify(list));

    document.getElementById('confirmRef').textContent = state.ref;
    showStep(4);

    // draw the checkmark
    requestAnimationFrame(() => {
      gsap.fromTo('#checkPath', { strokeDashoffset: 48 }, { strokeDashoffset: 0, duration: .7, delay: .25, ease: 'power2.out' });
      gsap.fromTo('.confirm-check', { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'back.out(2)' });
    });
  });

  document.getElementById('doneBtn').addEventListener('click', close);

  window.Table2EatBooking = { open, close };
})();
