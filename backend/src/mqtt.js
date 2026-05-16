'use strict';

const net = require('net');
const Aedes = require('aedes');
const { stmts } = require('./db');

/**
 * Broker MQTT multi-tenant.
 *
 * Authentification :
 *   - 'admin' avec ADMIN_DEVICE_TOKEN : accès total (broker interne)
 *   - tout autre client : mot de passe = device_token de son organisation.
 *     Le client est tagué avec orgId pour valider toutes ses publications.
 *
 * Topics : tlm/<deviceId>/<channel>
 *   channels : data | event | status | ack  (device → serveur)
 *              cmd                          (serveur → device)
 */
function startMqttBroker({ port, adminToken, callbacks, logger }) {
  const aedes = new Aedes();

  aedes.authenticate = function (client, username, password, done) {
    const pass = password ? password.toString() : '';
    if (username === 'admin' && pass === adminToken) {
      client.isAdmin = true;
      return done(null, true);
    }
    // Recherche org par device_token
    const org = stmts.getOrgByToken.get(pass);
    if (!org) {
      const err = new Error('Auth refusée');
      err.returnCode = 4;
      return done(err, false);
    }
    client.isAdmin = false;
    client.orgId = org.id;
    return done(null, true);
  };

  aedes.authorizePublish = function (client, packet, done) {
    if (client && client.isAdmin) return done(null);
    const topic = packet.topic || '';
    const parts = topic.split('/');
    if (parts.length !== 3 || parts[0] !== 'tlm') {
      return done(new Error('Topic invalide'));
    }
    // Vérifie que le device appartient bien à l'org du client (ou est nouveau)
    const deviceId = parts[1];
    const dev = stmts.getDevice.get(deviceId);
    if (dev && dev.org_id !== client.orgId) {
      return done(new Error('Device d\'une autre organisation'));
    }
    return done(null);
  };

  aedes.authorizeSubscribe = function (client, sub, done) {
    if (client && client.isAdmin) return done(null, sub);
    const topic = sub.topic || '';
    if (!topic.startsWith('tlm/') || !topic.endsWith('/cmd')) {
      return done(new Error('Abonnement non autorisé'));
    }
    // Vérifie ownership
    const parts = topic.split('/');
    const dev = stmts.getDevice.get(parts[1]);
    if (dev && dev.org_id !== client.orgId) {
      return done(new Error('Device d\'une autre organisation'));
    }
    return done(null, sub);
  };

  aedes.on('publish', (packet, client) => {
    if (!client) return; // messages internes du broker
    const topic = packet.topic || '';
    const parts = topic.split('/');
    if (parts.length !== 3 || parts[0] !== 'tlm') return;
    const deviceId = parts[1];
    const channel = parts[2];
    const raw = packet.payload ? packet.payload.toString() : '';
    const orgId = client.orgId;
    if (!orgId) return;

    let parsed = null;
    try { parsed = JSON.parse(raw); } catch (_) { /* non-JSON */ }

    try {
      if (channel === 'data' && parsed) callbacks.onTelemetry(orgId, deviceId, parsed);
      else if (channel === 'event' && parsed) callbacks.onEvent(orgId, deviceId, parsed);
      else if (channel === 'status') callbacks.onStatus(orgId, deviceId, raw);
      else if (channel === 'ack' && parsed) callbacks.onAck(orgId, deviceId, parsed);
    } catch (err) {
      logger && logger.error('Erreur traitement publish:', err);
    }
  });

  aedes.on('clientReady', (client) => {
    logger && logger.info(`MQTT connect : ${client.id} (org=${client.orgId || 'admin'})`);
  });
  aedes.on('clientDisconnect', (client) => {
    logger && logger.info(`MQTT disconnect : ${client.id}`);
  });

  const server = net.createServer(aedes.handle);
  server.on('error', (err) => {
    // Sur les PaaS (Railway, Heroku, Render), seul le port HTTP est exposé.
    // Le broker MQTT ne pourra pas écouter — on log mais on ne crash pas.
    logger && logger.warn(`Broker MQTT indisponible (port ${port}) : ${err.code || err.message}`);
    logger && logger.warn('Le serveur HTTP continue. Pour activer MQTT, déploie sur VPS Hetzner.');
  });
  server.listen(port, () => {
    logger && logger.info(`Broker MQTT démarré sur le port ${port}`);
  });

  function publishCommand(deviceId, cmd, params) {
    const topic = `tlm/${deviceId}/cmd`;
    const payload = JSON.stringify({ cmd, params, ts: Date.now() });
    aedes.publish({ topic, payload, qos: 1, retain: false }, () => {});
  }

  return { aedes, server, publishCommand };
}

module.exports = { startMqttBroker };
