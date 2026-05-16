'use strict';

require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const { Server: SocketIOServer } = require('socket.io');

const { db, stmts } = require('./db');
const { startMqttBroker } = require('./mqtt');
const { makeAuth } = require('./auth');
const { PLANS, planById } = require('./plans');
const { makeStripeRoutes } = require('./stripeRoutes');
const { makeAIRoutes } = require('./aiRoutes');
const { makeStripeConnectRoutes } = require('./stripeConnect');

// ----- Config -----
// Railway / Heroku injectent PORT automatiquement → on l'utilise en priorité
const HTTP_PORT     = parseInt(process.env.PORT || process.env.HTTP_PORT || '3000', 10);
const MQTT_PORT     = parseInt(process.env.MQTT_PORT || '1883', 10);
const JWT_SECRET    = process.env.JWT_SECRET   || 'change-me';
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL  || 'admin@example.com';
const ADMIN_PASSWORD= process.env.ADMIN_PASSWORD|| 'changeme';
const PUBLIC_URL    = process.env.PUBLIC_URL   || `http://localhost:${HTTP_PORT}`;
const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_PK     = process.env.STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_WHSEC  = process.env.STRIPE_WEBHOOK_SECRET || '';

const logger = {
  info:  (...a) => console.log('[INFO]',  new Date().toISOString(), ...a),
  warn:  (...a) => console.warn('[WARN]', new Date().toISOString(), ...a),
  error: (...a) => console.error('[ERR]', new Date().toISOString(), ...a),
};

const auth = makeAuth({ jwtSecret: JWT_SECRET });

// ----- Stripe (optionnel) -----
let stripe = null;
if (STRIPE_SECRET && !STRIPE_SECRET.startsWith('sk_test_REMPLACE') && !STRIPE_SECRET.startsWith('sk_live_REMPLACE')) {
  const Stripe = require('stripe');
  stripe = new Stripe(STRIPE_SECRET);
  logger.info(`Stripe activé (${STRIPE_SECRET.startsWith('sk_live') ? 'LIVE' : 'TEST'})`);
} else {
  logger.warn('Stripe non configuré — les paiements sont désactivés');
}

// ----- Seed superadmin global -----
(async () => {
  const existing = stmts.getUserByEmail.get(ADMIN_EMAIL);
  if (!existing) {
    const orgId = nanoid(12);
    const userId = nanoid(12);
    const now = Date.now();
    stmts.createOrg.run(orgId, 'Administration', nanoid(24), now + 99 * 365 * 24 * 3600 * 1000, now);
    const hash = await auth.hashPassword(ADMIN_PASSWORD);
    stmts.createUser.run(userId, orgId, ADMIN_EMAIL, hash, 'superadmin', now);
    logger.info(`Superadmin créé : ${ADMIN_EMAIL}`);
  }
})();

// =========================================================
// Express
// =========================================================
const app = express();
app.use(cors());

// IMPORTANT : le webhook Stripe a besoin du raw body, donc on monte
// les routes /api/stripe/webhook AVANT le express.json() global.
const stripeRouter = makeStripeRoutes({ stripe, publicUrl: PUBLIC_URL, webhookSecret: STRIPE_WHSEC });
app.post('/api/stripe/webhook',
  express.raw({ type: 'application/json' }),
  // On délègue au sous-router
  (req, res, next) => stripeRouter.handle(Object.assign(req, { url: '/webhook' }), res, next)
);

app.use(express.json({ limit: '256kb' }));

// ----- Statique -----
const webDir       = path.resolve(__dirname, '..', '..', 'web');             // landing publique
const dashboardDir = path.resolve(__dirname, '..', '..', 'dashboard');       // espace client
// IMPORTANT : on sert UNIQUEMENT demos-public/ en prod (la démo pro pour prospects)
// Les démos internes (apps mobiles, etc.) sont dans demos/ et ne sont PAS exposées
const demosDir     = path.resolve(__dirname, '..', '..', 'demos-public');
app.use('/', express.static(webDir));
app.use('/app', express.static(dashboardDir));
app.use('/demo', express.static(demosDir));      // URL plus jolie : /demo plutôt que /demos
app.use('/demos', express.static(demosDir));     // alias pour compat

// ----- API publique (pas d'auth) -----
app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now() }));
app.get('/api/plans', (req, res) => {
  res.json({
    plans: Object.values(PLANS),
    stripe_publishable_key: STRIPE_PK,
    stripe_enabled: !!stripe,
  });
});

// Sign up : crée org + user + abonnement trial
app.post('/api/signup', async (req, res) => {
  const { email, password, company } = req.body || {};
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email et mot de passe (8+ chars) requis' });
  }
  if (stmts.getUserByEmail.get(email.toLowerCase())) {
    return res.status(400).json({ error: 'Cet email est déjà utilisé' });
  }
  const orgId = nanoid(12);
  const userId = nanoid(12);
  const now = Date.now();
  const trialEnds = now + 14 * 24 * 3600 * 1000;
  const deviceToken = nanoid(24);
  stmts.createOrg.run(orgId, company || email, deviceToken, trialEnds, now);
  const hash = await auth.hashPassword(password);
  stmts.createUser.run(userId, orgId, email.toLowerCase(), hash, 'owner', now);
  const token = auth.signToken({ id: userId, email: email.toLowerCase(), org_id: orgId, role: 'owner' });
  res.json({ token, org_id: orgId, device_token: deviceToken });
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const u = email ? stmts.getUserByEmail.get(email.toLowerCase()) : null;
  if (!u || !(await auth.verifyPassword(password || '', u.password_hash))) {
    return res.status(401).json({ error: 'Identifiants invalides' });
  }
  const token = auth.signToken({ id: u.id, email: u.email, org_id: u.org_id, role: u.role });
  res.json({ token, role: u.role });
});

// =========================================================
// API protégée
// =========================================================
const api = express.Router();
api.use(auth.requireAuth);

// Stripe : checkout + portal (webhook déjà monté à part)
api.use('/stripe', stripeRouter);

// Chat IA Mistral
api.use('/ai', makeAIRoutes({ requireAuth: (req, res, next) => next() }));

// Stripe Connect (marketplace, optionnel)
api.use('/connect', makeStripeConnectRoutes({ stripe, publicUrl: PUBLIC_URL }));

api.get('/me', (req, res) => {
  const org = stmts.getOrg.get(req.user.org_id);
  const sub = stmts.getSubscription.get(req.user.org_id);
  const plan = planById(org ? org.plan : 'trial');
  const count = stmts.countDevicesForOrg.get(req.user.org_id).n;
  res.json({
    user: { id: req.user.id, email: req.user.email, role: req.user.role },
    org: org ? {
      id: org.id, name: org.name, plan: org.plan,
      max_devices: org.max_devices, trial_ends_at: org.trial_ends_at,
      device_token: org.device_token,
    } : null,
    plan,
    subscription: sub || null,
    device_count: count,
  });
});

api.get('/devices', (req, res) => {
  const devices = stmts.listDevicesForOrg.all(req.user.org_id);
  res.json(devices);
});

api.get('/devices/:id', (req, res) => {
  const d = stmts.getDeviceForOrg.get(req.params.id, req.user.org_id);
  if (!d) return res.status(404).json({ error: 'Device introuvable' });
  res.json(d);
});

api.put('/devices/:id', (req, res) => {
  const existing = stmts.getDeviceForOrg.get(req.params.id, req.user.org_id);
  if (!existing) return res.status(404).json({ error: 'Device introuvable' });
  const { name, machine_type, location } = req.body || {};
  stmts.upsertDeviceOrg.run({
    id: req.params.id,
    org_id: req.user.org_id,
    name: name || existing.name,
    machine_type: machine_type || existing.machine_type,
    location: location || existing.location,
    status: existing.status,
    last_seen: existing.last_seen,
    metadata_json: existing.metadata_json,
    created_at: existing.created_at,
  });
  res.json({ ok: true });
});

api.delete('/devices/:id', (req, res) => {
  const r = stmts.deleteDevice.run(req.params.id, req.user.org_id);
  res.json({ ok: r.changes > 0 });
});

api.get('/devices/:id/telemetry', (req, res) => {
  const d = stmts.getDeviceForOrg.get(req.params.id, req.user.org_id);
  if (!d) return res.status(404).json({ error: 'Device introuvable' });
  const limit = Math.min(parseInt(req.query.limit || '200', 10), 5000);
  const since = req.query.since ? parseInt(req.query.since, 10) : null;
  let rows;
  if (since) rows = stmts.telemetrySince.all(req.params.id, since);
  else { rows = stmts.recentTelemetry.all(req.params.id, limit); rows.reverse(); }
  res.json(rows.map(r => ({ ts: r.ts, ...safeJson(r.payload) })));
});

api.get('/devices/:id/events', (req, res) => {
  const d = stmts.getDeviceForOrg.get(req.params.id, req.user.org_id);
  if (!d) return res.status(404).json({ error: 'Device introuvable' });
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  res.json(stmts.recentEvents.all(req.params.id, limit));
});

api.get('/events', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 500);
  res.json(stmts.unackedEventsForOrg.all(req.user.org_id, limit));
});

api.post('/events/:id/ack', (req, res) => {
  const ev = stmts.getEventWithOrg.get(parseInt(req.params.id, 10));
  if (!ev || ev.org_id !== req.user.org_id) return res.status(404).json({ error: 'Évènement introuvable' });
  stmts.ackEvent.run(parseInt(req.params.id, 10));
  res.json({ ok: true });
});

api.post('/devices/:id/cmd', (req, res) => {
  const d = stmts.getDeviceForOrg.get(req.params.id, req.user.org_id);
  if (!d) return res.status(404).json({ error: 'Device introuvable' });
  const { cmd, params } = req.body || {};
  if (!cmd) return res.status(400).json({ error: 'cmd requis' });
  const info = stmts.insertCommand.run(req.params.id, Date.now(), cmd, JSON.stringify(params || {}));
  mqtt.publishCommand(req.params.id, cmd, params);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.use('/api', api);

// =========================================================
// HTTP + Socket.io
// =========================================================
const server = http.createServer(app);
const io = new SocketIOServer(server, { cors: { origin: '*' } });

io.use((socket, next) => {
  const token = socket.handshake.auth && socket.handshake.auth.token;
  if (!token) return next(new Error('Token requis'));
  const user = auth.verifyToken(token);
  if (!user) return next(new Error('Token invalide'));
  socket.user = user;
  // Rejoint la room de son org pour ne recevoir que ses données
  socket.join(`org:${user.org_id}`);
  next();
});

io.on('connection', (socket) => {
  logger.info(`WS connect : ${socket.user.email} (org=${socket.user.org_id})`);
});

function broadcastToOrg(orgId, event, payload) {
  io.to(`org:${orgId}`).emit(event, payload);
}

// =========================================================
// MQTT broker
// =========================================================
const ADMIN_DEVICE_TOKEN = process.env.ADMIN_DEVICE_TOKEN || 'admin-internal-' + nanoid(16);
const mqtt = startMqttBroker({
  port: MQTT_PORT,
  adminToken: ADMIN_DEVICE_TOKEN,
  logger,
  callbacks: {
    onTelemetry(orgId, deviceId, payload) {
      const ts = payload.ts || Date.now();
      // Quota : si l'org dépasse son quota, on ignore les nouveaux devices
      const existing = stmts.getDevice.get(deviceId);
      if (!existing) {
        const org = stmts.getOrg.get(orgId);
        const count = stmts.countDevicesForOrg.get(orgId).n;
        if (org && count >= org.max_devices) {
          logger.warn(`Org ${orgId} : quota atteint (${count}/${org.max_devices}), nouveau device ${deviceId} ignoré`);
          return;
        }
      }
      stmts.ensureDeviceForOrg.run(deviceId, orgId, deviceId, ts, ts);
      stmts.touchDevice.run('online', ts, deviceId);
      stmts.insertTelemetry.run(deviceId, ts, JSON.stringify(payload));
      broadcastToOrg(orgId, 'telemetry', { device_id: deviceId, ts, ...payload });
    },
    onEvent(orgId, deviceId, payload) {
      const ts = payload.ts || Date.now();
      const level = payload.level || 'info';
      const code = payload.code || null;
      const message = payload.message || '';
      stmts.ensureDeviceForOrg.run(deviceId, orgId, deviceId, ts, ts);
      const info = stmts.insertEvent.run(deviceId, ts, level, code, message);
      broadcastToOrg(orgId, 'event', { id: info.lastInsertRowid, device_id: deviceId, ts, level, code, message });
    },
    onStatus(orgId, deviceId, raw) {
      const status = (raw || '').toLowerCase().includes('off') ? 'offline' : 'online';
      const ts = Date.now();
      stmts.ensureDeviceForOrg.run(deviceId, orgId, deviceId, ts, ts);
      stmts.touchDevice.run(status, ts, deviceId);
      broadcastToOrg(orgId, 'status', { device_id: deviceId, status, ts });
    },
    onAck(orgId, deviceId, payload) {
      if (payload.id) stmts.updateCommand.run(payload.status || 'done', JSON.stringify(payload), payload.id);
      broadcastToOrg(orgId, 'ack', { device_id: deviceId, ...payload });
    },
  },
});

// =========================================================
// Lancement
// =========================================================
// Railway et tous les PaaS écoutent sur 0.0.0.0 (pas localhost)
server.listen(HTTP_PORT, '0.0.0.0', () => {
  logger.info(`Serveur HTTP en écoute sur le port ${HTTP_PORT}`);
  logger.info(`  • Site public  : ${PUBLIC_URL}/`);
  logger.info(`  • Démos        : ${PUBLIC_URL}/demos/`);
  logger.info(`  • Espace client: ${PUBLIC_URL}/app/`);
  logger.info(`  • Admin login  : ${ADMIN_EMAIL}`);
  logger.info(`  • Health check : ${PUBLIC_URL}/api/health`);
});

process.on('SIGINT',  () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

function safeJson(s) {
  try { return JSON.parse(s); } catch (_) { return {}; }
}
