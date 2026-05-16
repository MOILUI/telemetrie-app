'use strict';

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'telemetry.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// =========================================================
// SCHEMA MULTI-TENANT
//
// • organizations : un client = une org (avec son abonnement)
// • users         : utilisateurs rattachés à une org
// • devices       : machines, rattachées à une org
// • telemetry     : données (scopées implicitement par device → org)
// • events        : alertes (idem)
// • commands      : commandes envoyées aux machines
// • subscriptions : état Stripe (1 row par org)
// =========================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS organizations (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    device_token  TEXT NOT NULL UNIQUE,  -- mot de passe MQTT propre à l'org
    plan          TEXT DEFAULT 'trial',  -- trial / starter / pro / business / canceled
    max_devices   INTEGER DEFAULT 3,     -- quota selon le plan
    trial_ends_at INTEGER,
    created_at    INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    org_id        TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'owner',  -- owner / admin / viewer / superadmin
    created_at    INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS devices (
    id            TEXT PRIMARY KEY,
    org_id        TEXT NOT NULL,
    name          TEXT NOT NULL,
    machine_type  TEXT,
    location      TEXT,
    status        TEXT DEFAULT 'offline',
    last_seen     INTEGER,
    metadata_json TEXT,
    created_at    INTEGER NOT NULL,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_devices_org ON devices(org_id);

  CREATE TABLE IF NOT EXISTS telemetry (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  TEXT NOT NULL,
    ts         INTEGER NOT NULL,
    payload    TEXT NOT NULL,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_telemetry_device_ts ON telemetry(device_id, ts DESC);

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  TEXT NOT NULL,
    ts         INTEGER NOT NULL,
    level      TEXT NOT NULL,
    code       TEXT,
    message    TEXT,
    acked      INTEGER DEFAULT 0,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_events_device_ts ON events(device_id, ts DESC);

  CREATE TABLE IF NOT EXISTS commands (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id  TEXT NOT NULL,
    ts         INTEGER NOT NULL,
    cmd        TEXT NOT NULL,
    params     TEXT,
    status     TEXT DEFAULT 'pending',
    response   TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    org_id            TEXT PRIMARY KEY,
    stripe_customer   TEXT,
    stripe_sub_id     TEXT,
    status            TEXT,        -- active / trialing / past_due / canceled
    current_period_end INTEGER,
    updated_at        INTEGER,
    FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
  );
`);

// =========================================================
// Prepared statements
// =========================================================
const stmts = {
  // -- organizations --
  createOrg: db.prepare(`
    INSERT INTO organizations (id, name, device_token, plan, max_devices, trial_ends_at, created_at)
    VALUES (?, ?, ?, 'trial', 3, ?, ?)
  `),
  getOrg: db.prepare(`SELECT * FROM organizations WHERE id = ?`),
  getOrgByToken: db.prepare(`SELECT * FROM organizations WHERE device_token = ?`),
  updateOrgPlan: db.prepare(`UPDATE organizations SET plan = ?, max_devices = ? WHERE id = ?`),
  listOrgs: db.prepare(`SELECT * FROM organizations ORDER BY created_at DESC`),

  // -- users --
  createUser: db.prepare(`
    INSERT INTO users (id, org_id, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  getUserByEmail: db.prepare(`SELECT * FROM users WHERE email = ?`),
  getUserById: db.prepare(`SELECT * FROM users WHERE id = ?`),

  // -- devices --
  upsertDeviceOrg: db.prepare(`
    INSERT INTO devices (id, org_id, name, machine_type, location, status, last_seen, metadata_json, created_at)
    VALUES (@id, @org_id, @name, @machine_type, @location, @status, @last_seen, @metadata_json, @created_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      machine_type = excluded.machine_type,
      location = excluded.location
  `),
  ensureDeviceForOrg: db.prepare(`
    INSERT INTO devices (id, org_id, name, machine_type, location, status, last_seen, metadata_json, created_at)
    VALUES (?, ?, ?, NULL, NULL, 'online', ?, NULL, ?)
    ON CONFLICT(id) DO UPDATE SET status = 'online', last_seen = excluded.last_seen
  `),
  touchDevice: db.prepare(`UPDATE devices SET status = ?, last_seen = ? WHERE id = ?`),
  getDevice: db.prepare(`SELECT * FROM devices WHERE id = ?`),
  getDeviceForOrg: db.prepare(`SELECT * FROM devices WHERE id = ? AND org_id = ?`),
  listDevicesForOrg: db.prepare(`SELECT * FROM devices WHERE org_id = ? ORDER BY last_seen DESC`),
  countDevicesForOrg: db.prepare(`SELECT COUNT(*) AS n FROM devices WHERE org_id = ?`),
  deleteDevice: db.prepare(`DELETE FROM devices WHERE id = ? AND org_id = ?`),

  // -- telemetry --
  insertTelemetry: db.prepare(`INSERT INTO telemetry (device_id, ts, payload) VALUES (?, ?, ?)`),
  recentTelemetry: db.prepare(`SELECT ts, payload FROM telemetry WHERE device_id = ? ORDER BY ts DESC LIMIT ?`),
  telemetrySince:  db.prepare(`SELECT ts, payload FROM telemetry WHERE device_id = ? AND ts >= ? ORDER BY ts ASC`),

  // -- events --
  insertEvent: db.prepare(`INSERT INTO events (device_id, ts, level, code, message) VALUES (?, ?, ?, ?, ?)`),
  recentEvents: db.prepare(`SELECT * FROM events WHERE device_id = ? ORDER BY ts DESC LIMIT ?`),
  unackedEventsForOrg: db.prepare(`
    SELECT e.*, d.name AS device_name FROM events e
    JOIN devices d ON d.id = e.device_id
    WHERE e.acked = 0 AND d.org_id = ?
    ORDER BY e.ts DESC LIMIT ?
  `),
  ackEvent: db.prepare(`UPDATE events SET acked = 1 WHERE id = ?`),
  getEventWithOrg: db.prepare(`
    SELECT e.*, d.org_id FROM events e JOIN devices d ON d.id = e.device_id WHERE e.id = ?
  `),

  // -- commands --
  insertCommand: db.prepare(`INSERT INTO commands (device_id, ts, cmd, params) VALUES (?, ?, ?, ?)`),
  updateCommand: db.prepare(`UPDATE commands SET status = ?, response = ? WHERE id = ?`),

  // -- subscriptions --
  upsertSubscription: db.prepare(`
    INSERT INTO subscriptions (org_id, stripe_customer, stripe_sub_id, status, current_period_end, updated_at)
    VALUES (@org_id, @stripe_customer, @stripe_sub_id, @status, @current_period_end, @updated_at)
    ON CONFLICT(org_id) DO UPDATE SET
      stripe_customer = excluded.stripe_customer,
      stripe_sub_id = excluded.stripe_sub_id,
      status = excluded.status,
      current_period_end = excluded.current_period_end,
      updated_at = excluded.updated_at
  `),
  getSubscription: db.prepare(`SELECT * FROM subscriptions WHERE org_id = ?`),
  getOrgByStripeCustomer: db.prepare(`
    SELECT o.* FROM organizations o
    JOIN subscriptions s ON s.org_id = o.id
    WHERE s.stripe_customer = ?
  `),
};

module.exports = { db, stmts };
