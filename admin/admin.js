/* Table2Eat — Staff Portal: auth gate, bookings tracker, inventory manager */
(function () {
  const BOOKINGS_KEY = 'table2eat_bookings';
  const INVENTORY_KEY = 'table2eat_inventory';
  const SESSION_KEY = 't2e_admin_session';
  const CREDENTIALS = { user: 'admin', pass: 'table2eat' };

  /* ================= SEED DATA (first run only) ================= */
  function seedIfEmpty() {
    if (!localStorage.getItem(BOOKINGS_KEY)) {
      const sample = [
        {
          id: 'bk_seed1', ref: 'T2E-102934', name: 'Renee Alvarado', phone: '0917 200 3344',
          email: 'renee.a@example.com', date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          time: '7:00 PM', party: 2, notes: 'Anniversary dinner, window seat if possible.',
          fee: 300, receiptDataUrl: SAMPLE_RECEIPT, receiptName: 'gcash_receipt.jpg',
          status: 'pending', createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'bk_seed2', ref: 'T2E-559201', name: 'Marco Tan', phone: '0928 774 1120',
          email: 'marco.tan@example.com', date: new Date().toISOString().split('T')[0],
          time: '12:00 PM', party: 4, notes: '',
          fee: 400, receiptDataUrl: SAMPLE_RECEIPT, receiptName: 'maya_receipt.jpg',
          status: 'confirmed', createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: 'bk_seed3', ref: 'T2E-778345', name: 'Dani Perez', phone: '0906 552 8890',
          email: 'dani.p@example.com', date: new Date().toISOString().split('T')[0],
          time: '6:00 PM', party: 6, notes: 'Celebrating a promotion 🎉',
          fee: 500, receiptDataUrl: SAMPLE_RECEIPT, receiptName: 'gcash_receipt.jpg',
          status: 'declined', createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ];
      localStorage.setItem(BOOKINGS_KEY, JSON.stringify(sample));
    }
    if (!localStorage.getItem(INVENTORY_KEY)) {
      const sample = [
        { id: 'iv1', name: 'Salmon Fillet', category: 'Meat & Seafood', unit: 'kg', qty: 8, reorder: 5 },
        { id: 'iv2', name: 'Duck Breast', category: 'Meat & Seafood', unit: 'pcs', qty: 3, reorder: 6 },
        { id: 'iv3', name: 'Baby Spinach', category: 'Produce', unit: 'kg', qty: 2, reorder: 3 },
        { id: 'iv4', name: 'Heirloom Tomatoes', category: 'Produce', unit: 'kg', qty: 0, reorder: 4 },
        { id: 'iv5', name: 'Tagliatelle Pasta', category: 'Dry Goods', unit: 'kg', qty: 12, reorder: 5 },
        { id: 'iv6', name: 'Heavy Cream', category: 'Dairy', unit: 'L', qty: 6, reorder: 4 },
        { id: 'iv7', name: 'Sparkling Water', category: 'Beverage', unit: 'bottles', qty: 40, reorder: 20 },
        { id: 'iv8', name: 'House Red Wine', category: 'Bar', unit: 'bottles', qty: 5, reorder: 8 },
      ];
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(sample));
    }
  }

  const SAMPLE_RECEIPT_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='560'><rect width='400' height='560' fill='#253626'/><rect x='30' y='40' width='340' height='480' rx='16' fill='#FFFDF7'/><text x='200' y='100' font-family='Georgia,serif' font-size='26' text-anchor='middle' fill='#253626'>GCash</text><text x='200' y='150' font-family='Arial' font-size='14' text-anchor='middle' fill='#4A4234'>Payment Successful</text><text x='200' y='230' font-family='Georgia,serif' font-size='40' text-anchor='middle' fill='#253626'>P400.00</text><text x='200' y='300' font-family='Arial' font-size='12' text-anchor='middle' fill='#4A4234'>To: TABLE2EAT BISTRO</text><text x='200' y='324' font-family='Arial' font-size='12' text-anchor='middle' fill='#4A4234'>Ref No. 7729 4831 0192</text><line x1='60' y1='370' x2='340' y2='370' stroke='#E4D8BE' stroke-width='2'/><text x='200' y='400' font-family='Arial' font-size='11' text-anchor='middle' fill='#8A9A78'>Sandbox demo receipt — not a real transaction</text></svg>`;
  const SAMPLE_RECEIPT = 'data:image/svg+xml;utf8,' + encodeURIComponent(SAMPLE_RECEIPT_SVG);

  /* ================= AUTH ================= */
  const loginScreen = document.getElementById('loginScreen');
  const dashboardShell = document.getElementById('dashboardShell');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  function isLoggedIn() { return sessionStorage.getItem(SESSION_KEY) === '1'; }

  function showDashboard() {
    loginScreen.style.display = 'none';
    dashboardShell.style.display = 'flex';
    seedIfEmpty();
    renderBookings();
    renderInventory();
  }

  function showLogin() {
    loginScreen.style.display = 'flex';
    dashboardShell.style.display = 'none';
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;
    if (u === CREDENTIALS.user && p === CREDENTIALS.pass) {
      sessionStorage.setItem(SESSION_KEY, '1');
      loginError.classList.remove('show');
      showDashboard();
    } else {
      loginError.classList.add('show');
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  });

  /* ================= SIDEBAR NAV ================= */
  const navButtons = document.querySelectorAll('.sidebar-nav .nav-item');
  const views = document.querySelectorAll('.view');
  navButtons.forEach(btn => btn.addEventListener('click', () => {
    navButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.dataset.view;
    views.forEach(v => v.classList.toggle('active', v.id === 'view-' + target));
    document.getElementById('sidebar').classList.remove('open');
  }));

  ['menuBtn', 'menuBtn2'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
  });

  /* ================= HELPERS ================= */
  function money(n) { return '₱' + Number(n).toLocaleString(); }
  function prettyDate(iso) {
    return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function getBookings() { return JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]'); }
  function setBookings(list) { localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list)); }
  function getInventory() { return JSON.parse(localStorage.getItem(INVENTORY_KEY) || '[]'); }
  function setInventory(list) { localStorage.setItem(INVENTORY_KEY, JSON.stringify(list)); }

  /* ================= BOOKINGS VIEW ================= */
  let bookingFilter = 'all';
  const bookingsTbody = document.getElementById('bookingsTbody');

  document.querySelectorAll('#bookingFilters button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#bookingFilters button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    bookingFilter = btn.dataset.filter;
    renderBookings();
  }));

  function renderBookings() {
    const all = getBookings();
    const list = bookingFilter === 'all' ? all : all.filter(b => b.status === bookingFilter);

    document.getElementById('statTotal').textContent = all.length;
    document.getElementById('statPending').textContent = all.filter(b => b.status === 'pending').length;
    document.getElementById('statConfirmed').textContent = all.filter(b => b.status === 'confirmed').length;
    document.getElementById('statRevenue').textContent = money(all.filter(b => b.status === 'confirmed').reduce((s,b) => s + Number(b.fee||0), 0));

    if (!list.length) {
      bookingsTbody.innerHTML = `<tr class="empty-row"><td colspan="8">No ${bookingFilter === 'all' ? '' : bookingFilter + ' '}bookings yet.</td></tr>`;
      return;
    }

    bookingsTbody.innerHTML = list.map(b => `
      <tr data-id="${b.id}">
        <td class="cell-ref">${b.ref}</td>
        <td>${escapeHtml(b.name)}<div class="cell-sub">${escapeHtml(b.phone)}</div></td>
        <td>${prettyDate(b.date)}<div class="cell-sub">${b.time}</div></td>
        <td>${b.party} guest${b.party>1?'s':''}</td>
        <td>${money(b.fee)}</td>
        <td>
          <button class="thumb-btn" data-view-receipt="${b.id}"><img src="${b.receiptDataUrl}" alt="Receipt for ${b.ref}"></button>
        </td>
        <td><span class="badge ${b.status}">${b.status}</span></td>
        <td>
          <div class="row-actions">
            ${b.status === 'pending' ? `
              <button class="icon-btn confirm" title="Confirm" data-action="confirm" data-id="${b.id}">✓</button>
              <button class="icon-btn decline" title="Decline" data-action="decline" data-id="${b.id}">✕</button>
            ` : `<button class="icon-btn" title="View" data-view-receipt="${b.id}">👁</button>`}
          </div>
        </td>
      </tr>
    `).join('');
  }

  bookingsTbody.addEventListener('click', (e) => {
    const viewBtn = e.target.closest('[data-view-receipt]');
    const actionBtn = e.target.closest('[data-action]');
    if (viewBtn) openReceiptModal(viewBtn.dataset.viewReceipt);
    if (actionBtn) setBookingStatus(actionBtn.dataset.id, actionBtn.dataset.action === 'confirm' ? 'confirmed' : 'declined');
  });

  function setBookingStatus(id, status) {
    const list = getBookings();
    const b = list.find(x => x.id === id);
    if (b) b.status = status;
    setBookings(list);
    renderBookings();
    closeModal('receiptModal');
  }

  /* ---- receipt modal ---- */
  const receiptModal = document.getElementById('receiptModal');
  function openReceiptModal(id) {
    const b = getBookings().find(x => x.id === id);
    if (!b) return;
    document.getElementById('receiptModalImg').src = b.receiptDataUrl;
    document.getElementById('receiptModalMeta').innerHTML = `
      <strong>${escapeHtml(b.name)}</strong> — ${b.ref}<br>
      ${prettyDate(b.date)}, ${b.time} · ${b.party} guest${b.party>1?'s':''} · ${money(b.fee)}
      ${b.notes ? `<br><em>"${escapeHtml(b.notes)}"</em>` : ''}
    `;
    const actions = document.getElementById('receiptModalActions');
    actions.innerHTML = b.status === 'pending' ? `
      <button class="btn btn-outline" data-action="decline" data-id="${b.id}">Decline</button>
      <button class="btn btn-primary" data-action="confirm" data-id="${b.id}">Confirm Booking</button>
    ` : '';
    openModal('receiptModal');
  }
  receiptModal.addEventListener('click', (e) => {
    const actionBtn = e.target.closest('[data-action]');
    if (actionBtn) setBookingStatus(actionBtn.dataset.id, actionBtn.dataset.action === 'confirm' ? 'confirmed' : 'declined');
  });

  /* ================= INVENTORY VIEW ================= */
  const inventoryTbody = document.getElementById('inventoryTbody');

  function invStatus(item) {
    if (Number(item.qty) <= 0) return 'out';
    if (Number(item.qty) <= Number(item.reorder)) return 'low';
    return 'instock';
  }
  function invStatusLabel(s) { return s === 'out' ? 'Out of Stock' : s === 'low' ? 'Low Stock' : 'In Stock'; }

  function renderInventory() {
    const items = getInventory();
    document.getElementById('invTotal').textContent = items.length;
    document.getElementById('invLow').textContent = items.filter(i => invStatus(i) === 'low').length;
    document.getElementById('invOut').textContent = items.filter(i => invStatus(i) === 'out').length;
    document.getElementById('invCats').textContent = new Set(items.map(i => i.category)).size;

    if (!items.length) {
      inventoryTbody.innerHTML = `<tr class="empty-row"><td colspan="6">No inventory items yet.</td></tr>`;
      return;
    }

    inventoryTbody.innerHTML = items.map(i => {
      const s = invStatus(i);
      return `
      <tr data-id="${i.id}">
        <td><strong>${escapeHtml(i.name)}</strong></td>
        <td class="cell-sub">${escapeHtml(i.category)}</td>
        <td>${i.qty} ${escapeHtml(i.unit)}</td>
        <td class="cell-sub">${i.reorder} ${escapeHtml(i.unit)}</td>
        <td><span class="badge ${s}">${invStatusLabel(s)}</span></td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="Edit" data-edit="${i.id}">✎</button>
            <button class="icon-btn danger" title="Delete" data-delete="${i.id}">🗑</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  inventoryTbody.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-delete]');
    if (editBtn) openItemModal(editBtn.dataset.edit);
    if (delBtn) {
      if (confirm('Remove this item from inventory?')) {
        setInventory(getInventory().filter(i => i.id !== delBtn.dataset.delete));
        renderInventory();
      }
    }
  });

  /* ---- item add/edit modal ---- */
  const itemModal = document.getElementById('itemModal');
  const itemForm = document.getElementById('itemForm');

  document.getElementById('addItemBtn').addEventListener('click', () => openItemModal(null));

  function openItemModal(id) {
    const item = id ? getInventory().find(i => i.id === id) : null;
    document.getElementById('itemModalTitle').textContent = item ? 'Edit Item' : 'Add Item';
    document.getElementById('item-id').value = item ? item.id : '';
    document.getElementById('item-name').value = item ? item.name : '';
    document.getElementById('item-category').value = item ? item.category : 'Produce';
    document.getElementById('item-unit').value = item ? item.unit : '';
    document.getElementById('item-qty').value = item ? item.qty : '';
    document.getElementById('item-reorder').value = item ? item.reorder : '';
    openModal('itemModal');
  }

  itemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const payload = {
      name: document.getElementById('item-name').value.trim(),
      category: document.getElementById('item-category').value,
      unit: document.getElementById('item-unit').value.trim(),
      qty: Number(document.getElementById('item-qty').value),
      reorder: Number(document.getElementById('item-reorder').value),
    };
    const list = getInventory();
    if (id) {
      const item = list.find(i => i.id === id);
      Object.assign(item, payload);
    } else {
      list.unshift({ id: 'iv_' + Date.now(), ...payload });
    }
    setInventory(list);
    renderInventory();
    closeModal('itemModal');
  });

  /* ================= MODAL UTIL ================= */
  function openModal(id) { document.getElementById(id).classList.add('is-open'); }
  function closeModal(id) { document.getElementById(id).classList.remove('is-open'); }
  document.querySelectorAll('[data-close-modal]').forEach(el => el.addEventListener('click', () => {
    el.closest('.modal-overlay').classList.remove('is-open');
  }));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.is-open').forEach(m => m.classList.remove('is-open'));
  });

  /* ================= INIT ================= */
  if (isLoggedIn()) showDashboard(); else showLogin();
})();
