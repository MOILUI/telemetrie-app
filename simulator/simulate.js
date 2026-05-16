'use strict';

/**
 * Simulateur d'ESP32 — publie des données réalistes pour 3 machines fictives.
 * Permet de tester le dashboard sans avoir le matériel.
 *
 * Usage :
 *   MQTT_HOST=localhost MQTT_TOKEN=esp32-secret-change-moi node simulate.js
 */

const mqtt = require('mqtt');

const MQTT_HOST  = process.env.MQTT_HOST  || 'localhost';
const MQTT_PORT  = parseInt(process.env.MQTT_PORT || '1883', 10);
const MQTT_TOKEN = process.env.MQTT_TOKEN || 'esp32-secret-change-moi';

// --- Définition des machines fictives ---
const machines = [
  {
    id: 'cafe-paris-01',
    label: '☕ Cafetière espresso (Paris)',
    state: {
      tasses: 142,
      temp_chaudiere: 92,
      pression_bar: 9.0,
      eau_litres: 3.2,
      grains_pct: 78,
      porte_ouverte: false,
    },
    tick(dt) {
      // Simule une consommation aléatoire de tasses
      if (Math.random() < 0.15) this.state.tasses++;
      // Température oscille autour de 92°C
      this.state.temp_chaudiere = round1(91 + Math.random() * 2);
      // Pression varie légèrement
      this.state.pression_bar = round1(8.5 + Math.random());
      // Eau diminue progressivement
      this.state.eau_litres = round1(Math.max(0.1, this.state.eau_litres - 0.005));
      if (this.state.eau_litres < 0.5 && !this._warnedEau) {
        this._warnedEau = true;
        this.fireEvent('warn', 'low_water', 'Niveau d\'eau bas');
      }
      // Grains baissent
      if (Math.random() < 0.3) this.state.grains_pct = Math.max(0, this.state.grains_pct - 1);
      if (this.state.grains_pct < 15 && !this._warnedGrains) {
        this._warnedGrains = true;
        this.fireEvent('error', 'no_beans', 'Plus de grains de café !');
      }
    },
    payload() {
      return {
        tasses: this.state.tasses,
        temp_chaudiere: this.state.temp_chaudiere,
        pression_bar: this.state.pression_bar,
        eau_litres: this.state.eau_litres,
        grains_pct: this.state.grains_pct,
        porte_ouverte: this.state.porte_ouverte,
        rssi: -65 + Math.floor(Math.random() * 10),
      };
    },
  },
  {
    id: 'vending-lyon-12',
    label: '🥤 Distributeur boissons (Lyon Part-Dieu)',
    state: {
      ventes_jour: 23,
      revenus_eur: 32.5,
      temp_frigo: 4,
      stock_pct: 64,
      monnayeur_eur: 156.30,
      porte_ouverte: false,
    },
    tick(dt) {
      // Ventes aléatoires
      if (Math.random() < 0.1) {
        this.state.ventes_jour++;
        this.state.revenus_eur = round1(this.state.revenus_eur + 1.5);
        this.state.monnayeur_eur = round1(this.state.monnayeur_eur + 1.5);
        this.state.stock_pct = Math.max(0, this.state.stock_pct - 1);
      }
      // Température frigo oscille entre 3 et 5°C
      this.state.temp_frigo = round1(3 + Math.random() * 2);
      // Risque d'alerte température
      if (Math.random() < 0.002 && !this._tempAlert) {
        this.state.temp_frigo = 12;
        this._tempAlert = true;
        this.fireEvent('error', 'temp_high', 'Température frigo trop élevée : 12°C');
      }
      // Stock bas
      if (this.state.stock_pct < 20 && !this._warnedStock) {
        this._warnedStock = true;
        this.fireEvent('warn', 'low_stock', 'Stock < 20%, prévoir réassort');
      }
    },
    payload() {
      return {
        ventes_jour: this.state.ventes_jour,
        revenus_eur: this.state.revenus_eur,
        temp_frigo: this.state.temp_frigo,
        stock_pct: this.state.stock_pct,
        monnayeur_eur: this.state.monnayeur_eur,
        porte_ouverte: this.state.porte_ouverte,
        rssi: -72 + Math.floor(Math.random() * 8),
      };
    },
  },
  {
    id: 'generic-marseille-07',
    label: '⚙️ Machine industrielle (Marseille)',
    state: {
      cycles: 1284,
      temp_moteur: 65,
      vibrations: 0.4,
      heures_marche: 412.5,
      digital_in: true,
    },
    tick(dt) {
      if (Math.random() < 0.4) this.state.cycles++;
      this.state.temp_moteur = round1(60 + Math.random() * 10);
      this.state.vibrations = round1(0.3 + Math.random() * 0.4);
      this.state.heures_marche = round1(this.state.heures_marche + 0.001);
      // Pic de vibrations occasionnel
      if (Math.random() < 0.005) {
        this.state.vibrations = round1(1.5 + Math.random());
        this.fireEvent('warn', 'high_vibration', `Vibrations anormales : ${this.state.vibrations} g`);
      }
    },
    payload() {
      return {
        cycles: this.state.cycles,
        temp_moteur: this.state.temp_moteur,
        vibrations: this.state.vibrations,
        heures_marche: this.state.heures_marche,
        digital_in: this.state.digital_in,
        rssi: -58 + Math.floor(Math.random() * 6),
      };
    },
  },
];

function round1(n) { return Math.round(n * 10) / 10; }

// --- Helper pour publier un évènement (alerte) ---
function addEventHelper(machine, client) {
  machine.fireEvent = function (level, code, message) {
    const topic = `tlm/${machine.id}/event`;
    const payload = JSON.stringify({ ts: Date.now(), level, code, message });
    client.publish(topic, payload, { qos: 1 });
    console.log(`  🔔 [${machine.id}] ${level.toUpperCase()} : ${message}`);
  };
}

// --- Connexion ---
const url = `mqtt://${MQTT_HOST}:${MQTT_PORT}`;
console.log(`\n📡 Simulateur de télémétrie\n`);
console.log(`Connexion à ${url} ...`);

const client = mqtt.connect(url, {
  username: 'device',
  password: MQTT_TOKEN,
  reconnectPeriod: 5000,
});

client.on('connect', () => {
  console.log(`✅ Connecté au broker MQTT`);
  console.log(`\nMachines simulées :`);
  for (const m of machines) {
    console.log(`  • ${m.id}  ${m.label}`);
  }
  console.log(`\n📊 Ouvre le dashboard : http://localhost:3000`);
  console.log(`   (login: admin / le mot de passe défini dans backend/.env)\n`);

  // Prépare le helper d'évènements et s'abonne aux commandes
  for (const m of machines) {
    addEventHelper(m, client);
    client.subscribe(`tlm/${m.id}/cmd`, { qos: 1 });
    // Annonce "online" (retained)
    client.publish(`tlm/${m.id}/status`, 'online', { retain: true });
    // Premier évènement = boot
    m.fireEvent('info', 'boot', 'Machine démarrée (simulateur)');
  }

  // Boucle de publication toutes les 10 secondes
  setInterval(() => {
    for (const m of machines) {
      m.tick(10);
      const payload = { ts: Date.now(), ...m.payload() };
      client.publish(`tlm/${m.id}/data`, JSON.stringify(payload), { qos: 0 });
    }
    process.stdout.write('.');
  }, 10_000);

  // Tick initial immédiat
  setTimeout(() => {
    for (const m of machines) {
      m.tick(0);
      const payload = { ts: Date.now(), ...m.payload() };
      client.publish(`tlm/${m.id}/data`, JSON.stringify(payload), { qos: 0 });
    }
    console.log(`✅ Premier envoi effectué — rafraîchis le dashboard.\n`);
  }, 1000);
});

client.on('message', (topic, raw) => {
  // Réception de commandes
  const parts = topic.split('/');
  if (parts.length !== 3 || parts[2] !== 'cmd') return;
  const deviceId = parts[1];
  const machine = machines.find(m => m.id === deviceId);
  if (!machine) return;

  let cmd = {};
  try { cmd = JSON.parse(raw.toString()); } catch (_) {}
  console.log(`\n📥 Commande reçue par ${deviceId} : ${cmd.cmd}`, cmd.params || '');

  // ACK
  const ackTopic = `tlm/${deviceId}/ack`;
  let status = 'done', message = '';
  if (cmd.cmd === 'ping') message = 'pong';
  else if (cmd.cmd === 'reboot') {
    message = 'reboot simulé';
    // Réinitialise quelques compteurs
    if (machine.state.tasses != null) machine.state.tasses = 0;
  }
  else if (cmd.cmd === 'reset_counter') {
    if (machine.state.tasses != null) machine.state.tasses = 0;
    if (machine.state.cycles != null) machine.state.cycles = 0;
    message = 'compteur remis à zéro';
  }
  else if (cmd.cmd === 'relay') {
    message = `relais ${cmd.params && cmd.params.on ? 'ON' : 'OFF'}`;
  }
  else {
    status = 'unknown';
    message = 'commande inconnue';
  }
  client.publish(ackTopic, JSON.stringify({ ts: Date.now(), status, message }));
  console.log(`  ↩️  ACK : ${status} — ${message}\n`);
});

client.on('error', (err) => {
  console.error('❌ Erreur MQTT :', err.message);
});

client.on('close', () => {
  console.log('⚠️  Déconnecté du broker (tentative de reconnexion...)');
});

process.on('SIGINT', () => {
  console.log('\n👋 Arrêt du simulateur — passage des machines en "offline"');
  for (const m of machines) {
    client.publish(`tlm/${m.id}/status`, 'offline', { retain: true });
  }
  setTimeout(() => process.exit(0), 500);
});
