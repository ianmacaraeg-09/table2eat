/* Table2Eat — Staff Portal: Supabase Auth gate, bookings tracker, inventory manager */
(function () {
  /* ================= AUTH ================= */
  const loginScreen = document.getElementById('loginScreen');
  const dashboardShell = document.getElementById('dashboardShell');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');

  /* ================= HORA WIDGET ================= */
  /* getAccessToken() has to be synchronous (the widget calls it inline
     while building each request), but sb.auth.getSession() is async -
     so the current token is cached here and kept fresh via
     onAuthStateChange rather than re-awaited on every message. */
  let horaAccessToken = null;
  sb.auth.onAuthStateChange((_event, session) => {
    horaAccessToken = session?.access_token || null;
  });

  let horaWidgetInitialized = false;
  function initHoraWidgetOnce() {
    if (horaWidgetInitialized) return;
    horaWidgetInitialized = true;
    initAgentWidget({
      agentName: 'Hora',
      // Local dev endpoint for now - swap for the real tunnel URL once
      // Hora's Table2Eat instance is actually hosted somewhere reachable.
      endpoint: 'http://127.0.0.1:8813/chat',
      enabled: true,
      surface: 'admin',
      getAccessToken: () => horaAccessToken
    });
  }

  async function showDashboard(email) {
    loginScreen.style.display = 'none';
    dashboardShell.style.display = 'flex';
    document.getElementById('sidebarUser').textContent = email || 'Staff';
    await Promise.all([renderBookings(), renderInventory()]);
    initHoraWidgetOnce();
  }

  function showLogin() {
    loginScreen.style.display = 'flex';
    dashboardShell.style.display = 'none';
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-pass').value;
    const submitBtn = loginForm.querySelector('button[type="submit"]');

    loginError.classList.remove('show');
    submitBtn.disabled = true;

    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    submitBtn.disabled = false;

    if (error) {
      loginError.textContent = error.message || 'Incorrect email or password.';
      loginError.classList.add('show');
      return;
    }
    await showDashboard(data.user?.email);
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => {
    await sb.auth.signOut();
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

  const receiptUrlCache = new Map();
  async function getReceiptUrl(path) {
    if (!path) return '';
    if (receiptUrlCache.has(path)) return receiptUrlCache.get(path);
    const { data, error } = await sb.storage.from('receipts').createSignedUrl(path, 3600);
    const url = error ? '' : data.signedUrl;
    receiptUrlCache.set(path, url);
    return url;
  }

  async function getBookings() {
    const { data, error } = await sb.from('bookings').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Failed to load bookings:', error); return []; }
    return data;
  }
  async function getInventory() {
    const { data, error } = await sb.from('inventory').select('*').order('created_at', { ascending: false });
    if (error) { console.error('Failed to load inventory:', error); return []; }
    return data;
  }

  /* ================= BOOKINGS VIEW ================= */
  let bookingFilter = 'all';
  const bookingsTbody = document.getElementById('bookingsTbody');

  document.querySelectorAll('#bookingFilters button').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('#bookingFilters button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    bookingFilter = btn.dataset.filter;
    renderBookings();
  }));

  const statusLabels = { pending: 'pending', confirmed: 'confirmed', declined: 'declined', awaiting_payment: 'awaiting payment', payment_failed: 'payment failed' };

  async function renderBookings() {
    const all = await getBookings();
    const list = bookingFilter === 'all' ? all : all.filter(b => b.status === bookingFilter);

    document.getElementById('statTotal').textContent = all.length;
    document.getElementById('statPending').textContent = all.filter(b => b.status === 'pending').length;
    document.getElementById('statConfirmed').textContent = all.filter(b => b.status === 'confirmed').length;
    document.getElementById('statRevenue').textContent = money(all.filter(b => b.status === 'confirmed').reduce((s,b) => s + Number(b.fee||0), 0));

    if (!list.length) {
      bookingsTbody.innerHTML = `<tr class="empty-row"><td colspan="8">No ${bookingFilter === 'all' ? '' : statusLabels[bookingFilter] + ' '}bookings yet.</td></tr>`;
      return;
    }

    const thumbUrls = await Promise.all(list.map(b => b.receipt_path ? getReceiptUrl(b.receipt_path) : Promise.resolve('')));

    bookingsTbody.innerHTML = list.map((b, i) => `
      <tr data-id="${b.id}">
        <td class="cell-ref">${b.ref}</td>
        <td>${escapeHtml(b.name)}<div class="cell-sub">${escapeHtml(b.phone)}</div></td>
        <td>${prettyDate(b.date)}<div class="cell-sub">${b.time}</div></td>
        <td>${b.party} guest${b.party>1?'s':''}</td>
        <td>${money(b.fee)}</td>
        <td>
          ${b.payment_method === 'paymongo'
            ? `<span class="cell-sub">Paid via PayMongo</span>`
            : `<button class="thumb-btn" data-view-receipt="${b.id}"><img src="${thumbUrls[i]}" alt="Receipt for ${b.ref}"></button>`}
        </td>
        <td><span class="badge ${b.status}">${statusLabels[b.status] || b.status}</span></td>
        <td>
          <div class="row-actions">
            ${b.status === 'pending' ? `
              <button class="icon-btn confirm" title="Confirm" data-action="confirm" data-id="${b.id}">✓</button>
              <button class="icon-btn decline" title="Decline" data-action="decline" data-id="${b.id}">✕</button>
            ` : b.receipt_path ? `<button class="icon-btn" title="View" data-view-receipt="${b.id}">👁</button>` : ''}
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

  async function setBookingStatus(id, status) {
    const { error } = await sb.from('bookings').update({ status }).eq('id', id);
    if (error) { console.error('Failed to update booking:', error); return; }
    await renderBookings();
    closeModal('receiptModal');
  }

  /* ---- receipt modal ---- */
  const receiptModal = document.getElementById('receiptModal');
  async function openReceiptModal(id) {
    const all = await getBookings();
    const b = all.find(x => x.id === id);
    if (!b) return;
    document.getElementById('receiptModalImg').src = await getReceiptUrl(b.receipt_path);
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

  async function renderInventory() {
    const items = await getInventory();
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

  inventoryTbody.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-delete]');
    if (editBtn) openItemModal(editBtn.dataset.edit);
    if (delBtn) {
      if (confirm('Remove this item from inventory?')) {
        const { error } = await sb.from('inventory').delete().eq('id', delBtn.dataset.delete);
        if (error) { console.error('Failed to delete item:', error); return; }
        await renderInventory();
      }
    }
  });

  /* ---- item add/edit modal ---- */
  const itemModal = document.getElementById('itemModal');
  const itemForm = document.getElementById('itemForm');

  document.getElementById('addItemBtn').addEventListener('click', () => openItemModal(null));

  async function openItemModal(id) {
    const item = id ? (await getInventory()).find(i => i.id === id) : null;
    document.getElementById('itemModalTitle').textContent = item ? 'Edit Item' : 'Add Item';
    document.getElementById('item-id').value = item ? item.id : '';
    document.getElementById('item-name').value = item ? item.name : '';
    document.getElementById('item-category').value = item ? item.category : 'Produce';
    document.getElementById('item-unit').value = item ? item.unit : '';
    document.getElementById('item-qty').value = item ? item.qty : '';
    document.getElementById('item-reorder').value = item ? item.reorder : '';
    openModal('itemModal');
  }

  itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('item-id').value;
    const payload = {
      name: document.getElementById('item-name').value.trim(),
      category: document.getElementById('item-category').value,
      unit: document.getElementById('item-unit').value.trim(),
      qty: Number(document.getElementById('item-qty').value),
      reorder: Number(document.getElementById('item-reorder').value),
    };
    const { error } = id
      ? await sb.from('inventory').update(payload).eq('id', id)
      : await sb.from('inventory').insert(payload);
    if (error) { console.error('Failed to save item:', error); return; }
    await renderInventory();
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
  (async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (session) await showDashboard(session.user.email); else showLogin();
  })();
})();
