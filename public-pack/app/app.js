// =================== État global ===================
const state = {
  token: localStorage.getItem('tlm_token') || null,
  me: null,               // /me payload (user, org, plan, subscription)
  devices: new Map(),     // id -> device
  latest:  new Map(),     // id -> derniers points telemetry (array)
  alerts:  [],            // alertes non acquittées
  socket:  null,
  currentDeviceId: null,
  chart: null,
  selectedMetric: null,
};

// =================== Helpers ===================
const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('fr-FR');
}
function fmtRelative(ts) {
  if (!ts) return 'jamais';
  const delta = Date.now() - ts;
  if (delta < 60_000)        return 'à l\'instant';
  if (delta < 3_600_000)     return `il y a ${Math.floor(delta/60_000)} min`;
  if (delta < 86_400_000)    return `il y a ${Math.floor(delta/3_600_000)} h`;
  return `il y a ${Math.floor(delta/86_400_000)} j`;
}
function statusClass(d) {
  if (d.status === 'online' && d.last_seen && Date.now() - d.last_seen < 120_000) return 'online';
  if (d.last_seen && Date.now() - d.last_seen < 600_000) return 'stale';
  return 'offline';
}

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers['Authorization'] = `Bearer ${state.token}`;
  const res = await fetch(`/api${path}`, { ...opts, headers });
  if (res.status === 401) { logout(); throw new Error('Non autorisé'); }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erreur' }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// =================== Login / Logout ===================
function showLogin() {
  $('#login').classList.remove('hidden');
  $('#app').classList.add('hidden');
}
function showApp() {
  $('#login').classList.add('hidden');
  $('#app').classList.remove('hidden');
}
function logout() {
  state.token = null;
  localStorage.removeItem('tlm_token');
  if (state.socket) { state.socket.disconnect(); state.socket = null; }
  showLogin();
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#loginError').classList.add('hidden');
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: $('#email').value, password: $('#password').value }),
    });
    const data = await r.json();
    if (!r.ok || !data.token) throw new Error(data.error || 'Identifiants invalides');
    state.token = data.token;
    localStorage.setItem('tlm_token', data.token);
    await boot();
  } catch (err) {
    $('#loginError').textContent = err.message;
    $('#loginError').classList.remove('hidden');
  }
});

$('#logoutBtn').addEventListener('click', logout);

// =================== Devices ===================
async function loadDevices() {
  const devices = await api('/devices');
  state.devices.clear();
  for (const d of devices) state.devices.set(d.id, d);
  renderDevices();
  renderKpis();
}

function renderDevices() {
  const q = ($('#search').value || '').toLowerCase().trim();
  const grid = $('#devicesGrid');
  const empty = $('#emptyState');
  const list = [...state.devices.values()].filter(d => {
    if (!q) return true;
    return (d.name || '').toLowerCase().includes(q)
        || (d.id || '').toLowerCase().includes(q)
        || (d.location || '').toLowerCase().includes(q);
  });
  grid.innerHTML = '';
  if (list.length === 0) { empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');

  for (const d of list) {
    const cls = statusClass(d);
    const last = state.latest.get(d.id);
    const metricsHtml = last ? renderMiniMetrics(last) : '<span class="text-slate-400 text-xs">Aucune donnée</span>';
    const card = document.createElement('div');
    card.className = 'bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition cursor-pointer';
    card.innerHTML = `
      <div class="flex items-start justify-between mb-2">
        <div>
          <div class="flex items-center gap-2">
            <span class="pulse-dot ${cls}"></span>
            <h3 class="font-semibold">${escapeHtml(d.name || d.id)}</h3>
          </div>
          <div class="text-xs text-slate-500 mt-0.5">${escapeHtml(d.location || '—')}</div>
        </div>
        <span class="text-xs px-2 py-0.5 rounded-full ${
          d.machine_type ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
        }">${escapeHtml(d.machine_type || 'machine')}</span>
      </div>
      <div class="grid grid-cols-2 gap-2 mt-3">${metricsHtml}</div>
      <div class="text-xs text-slate-400 mt-3">Vu ${fmtRelative(d.last_seen)}</div>
    `;
    card.addEventListener('click', () => openDeviceDetail(d.id));
    grid.appendChild(card);
  }
}

function renderMiniMetrics(point) {
  // Affiche jusqu'à 4 métriques numériques en mini-cards
  const entries = Object.entries(point).filter(([k, v]) =>
    !['device_id', 'ts'].includes(k) && (typeof v === 'number' || typeof v === 'boolean')
  ).slice(0, 4);
  if (entries.length === 0) return '<span class="text-slate-400 text-xs col-span-2">Pas de métrique numérique</span>';
  return entries.map(([k, v]) => `
    <div class="bg-slate-50 rounded-lg px-2 py-1">
      <div class="text-[10px] text-slate-500 uppercase truncate">${escapeHtml(k)}</div>
      <div class="font-semibold text-sm">${typeof v === 'boolean' ? (v ? '✓' : '✗') : v}</div>
    </div>
  `).join('');
}

function renderKpis() {
  const all = [...state.devices.values()];
  const online = all.filter(d => statusClass(d) === 'online').length;
  $('#kpiTotal').textContent   = all.length;
  $('#kpiOnline').textContent  = online;
  $('#kpiOffline').textContent = all.length - online;
  $('#kpiAlerts').textContent  = state.alerts.length;
  if (state.alerts.length > 0) {
    $('#alertCount').textContent = state.alerts.length;
    $('#alertCount').classList.remove('hidden');
  } else {
    $('#alertCount').classList.add('hidden');
  }
}

// =================== Device Detail ===================
async function openDeviceDetail(id) {
  state.currentDeviceId = id;
  const d = await api(`/devices/${id}`);
  $('#dmName').textContent = d.name || d.id;
  $('#dmMeta').textContent = [d.machine_type, d.location].filter(Boolean).join(' • ') || '—';
  $('#dmId').textContent   = d.id;
  $('#dmStatus').textContent   = d.status === 'online' ? 'En ligne' : 'Hors ligne';
  $('#dmStatusDot').className = `pulse-dot ${statusClass(d)}`;
  $('#dmLastSeen').textContent = `(vu ${fmtRelative(d.last_seen)})`;
  $('#dmEditName').value      = d.name || '';
  $('#dmEditType').value      = d.machine_type || '';
  $('#dmEditLocation').value  = d.location || '';

  const since = Date.now() - 24 * 3600 * 1000;
  const points = await api(`/devices/${id}/telemetry?since=${since}`);
  const events = await api(`/devices/${id}/events?limit=30`);

  renderDetailMetrics(points);
  renderEventsList(events);
  $('#detailModal').classList.remove('hidden');
}

function renderDetailMetrics(points) {
  const metrics = collectMetrics(points);
  // Mini-cards (dernière valeur)
  const last = points[points.length - 1] || {};
  const mc = $('#dmMetrics');
  mc.innerHTML = '';
  for (const m of metrics) {
    const v = last[m];
    const el = document.createElement('div');
    el.className = 'bg-slate-50 rounded-xl p-3';
    el.innerHTML = `
      <div class="text-[10px] text-slate-500 uppercase">${escapeHtml(m)}</div>
      <div class="text-xl font-bold mt-1">${v != null ? (typeof v === 'boolean' ? (v?'✓':'✗') : v) : '—'}</div>
    `;
    mc.appendChild(el);
  }
  // Sélecteur métrique pour le graphique
  const sel = $('#dmMetricSelect');
  const numericMetrics = metrics.filter(m =>
    points.some(p => typeof p[m] === 'number')
  );
  sel.innerHTML = numericMetrics.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  if (numericMetrics.length === 0) {
    drawChart([], []);
    return;
  }
  state.selectedMetric = numericMetrics[0];
  sel.value = state.selectedMetric;
  drawChartFromPoints(points, state.selectedMetric);
  sel.onchange = () => {
    state.selectedMetric = sel.value;
    drawChartFromPoints(points, state.selectedMetric);
  };
}

function collectMetrics(points) {
  const set = new Set();
  for (const p of points) {
    for (const k of Object.keys(p)) {
      if (!['device_id', 'ts'].includes(k)) set.add(k);
    }
  }
  return [...set];
}

function drawChartFromPoints(points, metric) {
  const labels = points.map(p => new Date(p.ts).toLocaleTimeString('fr-FR'));
  const data   = points.map(p => typeof p[metric] === 'number' ? p[metric] : null);
  drawChart(labels, data);
}

function drawChart(labels, data) {
  const ctx = document.getElementById('dmChart').getContext('2d');
  if (state.chart) state.chart.destroy();
  state.chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: state.selectedMetric || '', data, borderColor: '#2563eb',
      backgroundColor: 'rgba(37,99,235,0.1)', tension: 0.25, fill: true, pointRadius: 0 }] },
    options: { responsive: true, scales: { x: { ticks: { maxTicksLimit: 8 } } } },
  });
}

function renderEventsList(events) {
  const el = $('#dmEvents');
  if (events.length === 0) { el.innerHTML = '<div class="text-sm text-slate-500">Aucun évènement.</div>'; return; }
  el.innerHTML = events.map(ev => {
    const color = ev.level === 'error' ? 'bg-red-50 text-red-700 border-red-200'
                : ev.level === 'warn'  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                       : 'bg-slate-50 text-slate-700 border-slate-200';
    return `
      <div class="border ${color} rounded-lg px-3 py-2">
        <div class="flex items-center justify-between">
          <div class="text-xs font-mono">${escapeHtml(ev.code || ev.level)}</div>
          <div class="text-xs text-slate-500">${fmtTime(ev.ts)}</div>
        </div>
        <div class="text-sm mt-1">${escapeHtml(ev.message || '')}</div>
      </div>
    `;
  }).join('');
}

$('#dmClose').addEventListener('click', () => {
  $('#detailModal').classList.add('hidden');
  state.currentDeviceId = null;
  if (state.chart) { state.chart.destroy(); state.chart = null; }
});

$('#dmEditForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentDeviceId) return;
  await api(`/devices/${state.currentDeviceId}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: $('#dmEditName').value,
      machine_type: $('#dmEditType').value,
      location: $('#dmEditLocation').value,
    }),
  });
  await loadDevices();
  alert('Machine mise à jour.');
});

$('#dmDelete').addEventListener('click', async () => {
  if (!state.currentDeviceId) return;
  if (!confirm('Supprimer cette machine et tout son historique ?')) return;
  await api(`/devices/${state.currentDeviceId}`, { method: 'DELETE' });
  $('#detailModal').classList.add('hidden');
  state.currentDeviceId = null;
  await loadDevices();
});

$('#dmCmdForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.currentDeviceId) return;
  let params = {};
  const raw = $('#dmCmdParams').value.trim();
  if (raw) {
    try { params = JSON.parse(raw); }
    catch { alert('Paramètres JSON invalides'); return; }
  }
  await api(`/devices/${state.currentDeviceId}/cmd`, {
    method: 'POST',
    body: JSON.stringify({ cmd: $('#dmCmdName').value, params }),
  });
  $('#dmCmdName').value = ''; $('#dmCmdParams').value = '';
  alert('Commande envoyée.');
});

// =================== Alerts ===================
async function loadAlerts() {
  state.alerts = await api('/events?limit=100');
  renderAlerts();
  renderKpis();
}

function renderAlerts() {
  const el = $('#alertsList');
  if (state.alerts.length === 0) {
    el.innerHTML = '<div class="p-6 text-center text-sm text-slate-500">Aucune alerte active.</div>';
    return;
  }
  el.innerHTML = state.alerts.map(ev => {
    const color = ev.level === 'error' ? 'border-l-red-500'
                : ev.level === 'warn'  ? 'border-l-amber-500'
                                       : 'border-l-slate-400';
    return `
      <div class="p-4 border-l-4 ${color}">
        <div class="flex items-start justify-between">
          <div class="min-w-0">
            <div class="font-semibold text-sm truncate">${escapeHtml(ev.device_name || ev.device_id)}</div>
            <div class="text-xs text-slate-500">${escapeHtml(ev.code || ev.level)} • ${fmtTime(ev.ts)}</div>
            <div class="text-sm mt-1">${escapeHtml(ev.message || '')}</div>
          </div>
          <button class="text-xs text-slate-500 hover:text-slate-900 ml-2" data-ack="${ev.id}">Acquitter</button>
        </div>
      </div>
    `;
  }).join('');
  $$('#alertsList button[data-ack]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api(`/events/${btn.dataset.ack}/ack`, { method: 'POST' });
      await loadAlerts();
    });
  });
}

$('#alertsBtn').addEventListener('click', () => $('#alertsDrawer').classList.remove('hidden'));
$('#alertsClose').addEventListener('click', () => $('#alertsDrawer').classList.add('hidden'));

// =================== Socket.io ===================
function connectSocket() {
  state.socket = io({ auth: { token: state.token } });
  state.socket.on('connect', () => $('#connStatus').textContent = '🟢 En ligne');
  state.socket.on('disconnect', () => $('#connStatus').textContent = '🔴 Déconnecté');

  state.socket.on('telemetry', (msg) => {
    state.latest.set(msg.device_id, msg);
    // Re-fetch device si nouveau
    if (!state.devices.has(msg.device_id)) {
      loadDevices();
    } else {
      // Mise à jour silencieuse last_seen
      const d = state.devices.get(msg.device_id);
      d.last_seen = msg.ts; d.status = 'online';
      renderDevices();
      renderKpis();
    }
  });

  state.socket.on('status', (msg) => {
    const d = state.devices.get(msg.device_id);
    if (d) { d.status = msg.status; renderDevices(); renderKpis(); }
  });

  state.socket.on('event', (ev) => {
    state.alerts.unshift(ev);
    renderAlerts();
    renderKpis();
  });
}

// =================== Search ===================
$('#search').addEventListener('input', renderDevices);

// =================== Chat IA ===================
async function askAI(question, history = []) {
  try {
    return await api('/ai/chat', { method: 'POST', body: JSON.stringify({ question, history }) });
  } catch (e) {
    return { answer: "Erreur de communication avec l'assistant : " + e.message, source: 'error' };
  }
}

// Bouton "Demander à l'IA" (à brancher sur ton bouton header)
window.openAIChat = function () {
  const modal = document.getElementById('aiChatModal');
  if (modal) modal.classList.remove('hidden');
};
window.sendAIQuestion = async function (input) {
  const log = document.getElementById('aiChatLog');
  if (!log) return;
  log.innerHTML += `<div class="text-right my-2"><span class="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-3 py-2 inline-block text-sm">${escapeHtml(input)}</span></div>`;
  log.innerHTML += `<div class="text-left my-2 ai-pending"><span class="bg-slate-100 rounded-2xl rounded-tl-sm px-3 py-2 inline-block text-sm">…</span></div>`;
  const r = await askAI(input);
  log.querySelector('.ai-pending').remove();
  log.innerHTML += `<div class="text-left my-2"><span class="bg-slate-100 rounded-2xl rounded-tl-sm px-3 py-2 inline-block text-sm whitespace-pre-line">${escapeHtml(r.answer)}</span></div>`;
  log.scrollTop = log.scrollHeight;
};

// =================== Stripe Connect (marketplace) ===================
window.startConnectOnboarding = async function () {
  try {
    const r = await api('/connect/account', { method: 'POST', body: '{}' });
    if (r.onboarding_url) window.location.href = r.onboarding_url;
  } catch (e) { alert('Erreur Connect : ' + e.message); }
};

window.openStripeConnectDashboard = async function () {
  try {
    const r = await api('/connect/login-link', { method: 'POST', body: '{}' });
    if (r.url) window.open(r.url, '_blank');
  } catch (e) { alert(e.message); }
};

// =================== Plans + Stripe ===================
async function loadMe() {
  state.me = await api('/me');
  renderMe();
}

function renderMe() {
  if (!state.me) return;
  const { org, plan, subscription, device_count } = state.me;
  // Badge plan
  const badge = $('#planBadge');
  if (badge) badge.textContent = plan.name + ` (${device_count}/${org.max_devices})`;
  $('#billingBtn').classList.remove('hidden');

  // Snippet config ESP32
  const snippet = `#define DEVICE_ID         "machine-001"           // unique !
#define MQTT_HOST         "${location.hostname}"
#define MQTT_PORT         1883
#define MQTT_USERNAME     "device"
#define MQTT_PASSWORD     "${org.device_token}"`;
  const snippetEl = document.getElementById('configSnippet');
  if (snippetEl) snippetEl.textContent = snippet;

  // Bandeau trial / past_due
  const banner = $('#trialBanner');
  if (org.plan === 'trial') {
    const daysLeft = Math.max(0, Math.ceil((org.trial_ends_at - Date.now()) / 86400000));
    $('#trialText').textContent = daysLeft > 0
      ? `Essai gratuit — ${daysLeft} jour${daysLeft > 1 ? 's' : ''} restant${daysLeft > 1 ? 's' : ''}`
      : 'Essai terminé';
    $('#trialSub').textContent = `Tu peux ajouter jusqu'à ${org.max_devices} machines pendant l'essai.`;
    banner.classList.remove('hidden');
  } else if (subscription && subscription.status === 'past_due') {
    $('#trialText').textContent = 'Paiement en échec';
    $('#trialSub').textContent = 'Mets à jour ta carte pour continuer.';
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

async function openUpgradeModal() {
  const data = await fetch('/api/plans').then(r => r.json());
  const container = $('#plansContainer');
  const currentPlan = state.me ? state.me.org.plan : 'trial';
  container.innerHTML = data.plans
    .filter(p => p.id !== 'trial')
    .map(p => `
      <div class="border-2 ${p.popular ? 'border-blue-500 shadow-lg' : 'border-slate-200'} rounded-xl p-5 relative">
        ${p.popular ? '<div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full">POPULAIRE</div>' : ''}
        <h4 class="font-bold text-xl">${escapeHtml(p.name)}</h4>
        <div class="mt-2"><span class="text-3xl font-bold">${p.price_month_eur}€</span><span class="text-slate-500 text-sm">/mois</span></div>
        <ul class="mt-4 space-y-1 text-sm text-slate-700">
          ${p.features.map(f => `<li>✓ ${escapeHtml(f)}</li>`).join('')}
        </ul>
        <button class="mt-5 w-full ${currentPlan === p.id ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : (p.popular ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-800 hover:bg-slate-900')} text-white font-medium py-2 rounded-lg" ${currentPlan === p.id ? 'disabled' : `data-plan="${p.id}"`}>
          ${currentPlan === p.id ? 'Plan actuel' : 'Choisir'}
        </button>
      </div>
    `).join('');
  if (!data.stripe_enabled) {
    container.insertAdjacentHTML('beforeend',
      '<div class="md:col-span-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">⚠️ Stripe n\'est pas encore configuré. Suis le guide <code>docs/STRIPE.md</code>.</div>');
  }
  container.querySelectorAll('button[data-plan]').forEach(btn => {
    btn.addEventListener('click', () => startCheckout(btn.dataset.plan));
  });
  $('#upgradeModal').classList.remove('hidden');
}

async function startCheckout(plan) {
  try {
    const r = await api('/stripe/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
    if (r.url) window.location.href = r.url;
  } catch (e) { alert('Erreur Stripe : ' + e.message); }
}

async function openBillingPortal() {
  try {
    const r = await api('/stripe/portal', { method: 'POST', body: '{}' });
    if (r.url) window.location.href = r.url;
  } catch (e) {
    // Pas encore d'abonnement → ouvre modal upgrade
    openUpgradeModal();
  }
}

$('#upgradeBtn').addEventListener('click', openUpgradeModal);
$('#upgradeClose').addEventListener('click', () => $('#upgradeModal').classList.add('hidden'));
$('#billingBtn').addEventListener('click', openBillingPortal);

// =================== Boot ===================
async function boot() {
  showApp();
  try {
    await loadMe();
    await loadDevices();
    await loadAlerts();
    connectSocket();
    setInterval(renderDevices, 30_000);
    // Si on revient d'un Checkout Stripe, recharge /me pour avoir le nouveau plan
    if (new URLSearchParams(location.search).get('checkout') === 'success') {
      setTimeout(loadMe, 2000);
      history.replaceState({}, '', '/app/');
    }
  } catch (e) {
    console.error(e);
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Démarrage
if (state.token) boot(); else showLogin();
