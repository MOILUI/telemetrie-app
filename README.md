# 📡 Plateforme de télémétrie ESP32

Une solution complète pour superviser **n'importe quelle machine** (cafetières, distributeurs automatiques, frigos, équipements industriels…) à distance, avec :

- 🔌 **Firmware ESP32 + modem 4G** (SIM7600)
- 🖥️ **Backend tout-en-un** (broker MQTT + API + base de données SQLite) sur Raspberry Pi
- 📊 **Dashboard web temps réel** (statut, métriques, alertes, commandes à distance)
- 🐳 **Déploiement Docker** en une commande

Inspiré de **WhatsGPS, Vendon et Nayax**, mais sous ton contrôle total.

---

## 🗂️ Structure du projet

```
telemetry-app/
├── backend/         # Serveur Node.js (MQTT + API + WebSocket)
│   ├── src/
│   │   ├── server.js   # Point d'entrée
│   │   ├── mqtt.js     # Broker MQTT embarqué (aedes)
│   │   ├── db.js       # SQLite + schéma
│   │   └── auth.js     # JWT + login
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
├── dashboard/       # Interface web (HTML/JS/Tailwind/Chart.js)
│   ├── index.html
│   └── app.js
├── firmware/        # Firmware ESP32 (Arduino)
│   ├── telemetry_esp32.ino
│   └── config.h.example
├── docker-compose.yml
└── docs/            # Guides détaillés
    ├── INSTALLATION.md
    ├── ESP32_SETUP.md
    └── ARCHITECTURE.md
```

---

## ⚡ Démarrage rapide (3 étapes)

### 1️⃣ Déployer le backend sur Raspberry Pi

```bash
# Sur le Pi (Raspbian/Debian récent avec Docker installé)
git clone <ce-dépôt> telemetry-app
cd telemetry-app

# Copier et éditer la config
cp backend/.env.example backend/.env
nano backend/.env   # change ADMIN_PASSWORD, JWT_SECRET, DEVICE_TOKEN

# Lancer
docker compose up -d

# Vérifier
docker compose logs -f telemetry
```

Le dashboard est dispo sur `http://<ip-du-pi>:3000` (login : `admin` / le mot de passe défini dans `.env`).
Le broker MQTT écoute sur le port `1883`.

### 2️⃣ Configurer ton ESP32

```bash
cd firmware
cp config.h.example config.h
# Édite config.h : DEVICE_ID, MQTT_HOST (IP publique du Pi), APN de ta SIM, etc.
```

Puis ouvre `telemetry_esp32.ino` dans **Arduino IDE** ou **PlatformIO** et flash le sketch sur ton ESP32 + module SIM7600 (voir `docs/ESP32_SETUP.md`).

### 3️⃣ Brancher tes capteurs

Le firmware lit par défaut :
- Un **compteur d'impulsions** (débit, tasses, ventes…) sur GPIO 34
- Une **sonde de température DS18B20** (chaudière, frigo) sur GPIO 15
- Une **entrée numérique** (porte, panne) sur GPIO 32
- Une **entrée analogique** (pression, niveau) sur GPIO 35
- Un **relais** commandable à distance sur GPIO 13

Tous les pins sont dans `firmware/config.h` — modifie-les selon ta machine.

---

## 🔧 Que peux-tu superviser ?

| Type de machine     | Métriques typiques                                    |
|---------------------|--------------------------------------------------------|
| Machine à café      | Nb de tasses, température chaudière, pression, erreurs |
| Distributeur        | Ventes, stock, température frigo, ouvertures porte    |
| Pompe / vanne       | Débit, pression, état, alarmes                        |
| Frigo professionnel | Température, ouvertures porte, défrostage             |
| Équipement générique| Compteurs, températures, entrées/sorties              |

---

## 🛠️ Commandes à distance

Depuis le dashboard, tu peux envoyer ces commandes par défaut à un ESP32 :

| Commande         | Paramètres            | Effet                                       |
|------------------|-----------------------|---------------------------------------------|
| `ping`           | —                     | Vérifier que la machine répond              |
| `relay`          | `{"on": true/false}`  | Activer/désactiver le relais                |
| `reset_counter`  | —                     | Remettre le compteur d'impulsions à zéro    |
| `reboot`         | —                     | Redémarrer l'ESP32                          |

Tu peux étendre cette liste dans `firmware/telemetry_esp32.ino` (fonction `onMqttMessage`).

---

## 🔐 Sécurité

Avant la mise en production, **change ABSOLUMENT** dans `backend/.env` :
- `ADMIN_PASSWORD`
- `JWT_SECRET` (chaîne aléatoire longue)
- `DEVICE_TOKEN` (mot de passe que chaque ESP32 utilise pour se connecter)

Pour exposer le Pi sur internet de façon sécurisée :
- Mets le derrière un **reverse proxy HTTPS** (Caddy ou Nginx + Let's Encrypt)
- Idéalement, utilise **MQTT sur TLS** (port 8883) — non activé par défaut pour rester simple
- Ou installe **Tailscale / WireGuard** pour un VPN privé

Voir `docs/INSTALLATION.md` pour les détails.

---

## 📚 Documentation

- [`QUICKSTART_MAC.md`](QUICKSTART_MAC.md) — **tester en local en 10 min sans matériel**
- [`docs/INSTALLATION.md`](docs/INSTALLATION.md) — installation détaillée sur Raspberry Pi
- [`docs/ESP32_SETUP.md`](docs/ESP32_SETUP.md) — câblage, choix du module 4G, flash
- [`docs/WIRING.md`](docs/WIRING.md) — **comment raccorder l'ESP32 à une machine existante**
- [`docs/STRIPE.md`](docs/STRIPE.md) — **configurer le paiement par abonnement Stripe**
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — topics MQTT, schéma BDD, API

## 🌐 Site SaaS multi-tenant (v2)

Le projet contient aussi un **site web public** et un système de **paiement par abonnement Stripe** :
- `web/` — landing page marketing avec pricing
- Inscription, login, multi-tenant (chaque org isolée)
- Stripe Checkout, customer portal, webhooks
- 4 plans : Trial (gratuit 14j), Starter (19€), Pro (49€), Business (149€) — ajustables dans `backend/src/plans.js`

---

## 📝 Licence

MIT — utilise-le comme tu veux.
