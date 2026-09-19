/* ============================================================
   Corner chat widget, Messenger-style: collapsed bubble that
   expands into a small panel. Ported from DOVA's own admin
   widget (same API contract: GET /health, POST /chat
   {message, session_id, surface?, access_token?} ->
   {reply, session_id}) — trimmed to drop the Eos-only animated
   avatar/TTS code paths, which Hora doesn't use here.

   For a disabled agent (no backend yet), the widget still shows
   so the page layout is consistent, but the input is disabled
   and it opens straight to a "coming soon" message.
   ============================================================ */

function initAgentWidget(config) {
  var agentName = config.agentName;
  var endpoint = config.endpoint;
  var enabled = !!config.enabled;
  var surface = config.surface;
  var getAccessToken = config.getAccessToken;
  var sessionKey = 't2e_' + agentName.toLowerCase() + '_session_id';

  var root = document.createElement('div');
  root.className = 'agent-widget';
  root.innerHTML =
    '<button class="agent-widget-bubble" aria-label="Open ' + agentName + ' chat">' +
      agentName.charAt(0) +
      '<span class="agent-widget-bubble-dot"></span>' +
    '</button>' +
    '<div class="agent-widget-panel">' +
      '<div class="agent-widget-header">' +
        '<span>' + agentName + '</span>' +
        '<span class="agent-widget-header-status"></span>' +
        '<button class="agent-widget-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="agent-widget-messages"></div>' +
      '<form class="agent-widget-form">' +
        '<input type="text" class="agent-widget-input" placeholder="Message ' + agentName + '&hellip;"' + (enabled ? '' : ' disabled') + '>' +
        '<button type="submit" class="agent-widget-send"' + (enabled ? '' : ' disabled') + ' aria-label="Send">&rarr;</button>' +
      '</form>' +
    '</div>';
  document.body.appendChild(root);

  var bubble = root.querySelector('.agent-widget-bubble');
  var dot = root.querySelector('.agent-widget-bubble-dot');
  var closeBtn = root.querySelector('.agent-widget-close');
  var statusEl = root.querySelector('.agent-widget-header-status');
  var messages = root.querySelector('.agent-widget-messages');
  var form = root.querySelector('.agent-widget-form');
  var input = root.querySelector('.agent-widget-input');

  function open() {
    root.classList.add('open');
    if (enabled) input.focus();
  }
  function close() { root.classList.remove('open'); }
  bubble.addEventListener('click', function () {
    root.classList.contains('open') ? close() : open();
  });
  closeBtn.addEventListener('click', close);

  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* Safe rendering: escape first, then re-introduce only **bold** and
     line breaks — never insert anything that wasn't just escaped. */
  function renderReplyText(text) {
    var safe = escapeHtml(text);
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
  }

  function addMessage(role, html) {
    var el = document.createElement('div');
    el.className = 'agent-widget-msg ' + role;
    el.innerHTML = html;
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }
  function addText(role, text) { return addMessage(role, escapeHtml(text)); }

  if (!enabled) {
    addText('assistant', agentName + " isn't wired up yet — coming soon.");
    return;
  }

  var sessionId = null;
  try { sessionId = sessionStorage.getItem(sessionKey); } catch (e) {}

  async function checkHealth() {
    try {
      var res = await fetch(endpoint.replace(/\/chat\/?$/, '') + '/health');
      return res.ok;
    } catch (e) {
      return false;
    }
  }
  checkHealth().then(function (ok) {
    dot.classList.toggle('live', ok);
    statusEl.textContent = ok ? 'Connected' : 'Offline';
  });

  addText('assistant', "Hi, I'm " + agentName + ". Ask me about bookings, revenue, availability, or say \"check pending receipts.\"");

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    addText('user', text);
    input.value = '';

    var typing = addMessage('assistant typing', '<span></span><span></span><span></span>');

    // Some tool calls (a receipt review does a Supabase fetch AND a vision
    // API call; a batch review of every pending booking does that once per
    // booking, server-side, in one request - measured ~12s/booking for
    // real) can genuinely take a while, especially under provider
    // queueing - a generous timeout so a slow-but-working request doesn't
    // get mistaken for a hang, while still resolving eventually instead of
    // leaving the UI stuck forever. 3 minutes comfortably covers a
    // realistic batch (~15 pending bookings) for a business this size.
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 180000);

    try {
      var payload = { message: text, session_id: sessionId };
      if (surface) payload.surface = surface;
      if (getAccessToken) {
        var token = getAccessToken();
        if (token) payload.access_token = token;
      }
      var res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      var data = await res.json();
      typing.remove();
      if (!res.ok) throw { httpError: true, message: data.error || ('Request failed (' + res.status + ')') };
      sessionId = data.session_id;
      try { sessionStorage.setItem(sessionKey, sessionId); } catch (e) {}
      addMessage('assistant', renderReplyText(data.reply));
      dot.classList.add('live');
      statusEl.textContent = 'Connected';
    } catch (err) {
      clearTimeout(timeoutId);
      typing.remove();
      // Three genuinely different failures, shown differently rather than
      // one generic "is it down?" message that made a real backend error
      // (or a slow-but-alive request) indistinguishable from an actual crash:
      if (err && err.httpError) {
        // A real response came back with a real error message - show it,
        // don't discard it. The backend is clearly reachable in this case.
        addText('error', String(err.message));
        dot.classList.add('live');
        statusEl.textContent = 'Connected';
      } else if (err && err.name === 'AbortError') {
        addText('error', agentName + ' is taking longer than usual to respond (3 min+) - a large batch review can take a while; it may still finish, try asking again in a moment.');
        dot.classList.add('live');
        statusEl.textContent = 'Slow';
      } else {
        addText('error', 'Could not reach ' + agentName + ' — is the backend running at ' + endpoint + '?');
        dot.classList.remove('live');
        statusEl.textContent = 'Offline';
      }
    }
  });
}
