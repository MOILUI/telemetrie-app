# 🏗️ Architecture

## Vue d'ensemble

```
┌───────────────┐    4G/LTE    ┌──────────────────────────────┐
│  ESP32 +      │ ───────────► │      Raspberry Pi            │
│  SIM7600      │   MQTT/TCP   │  ┌────────────────────────┐  │
│  (machine)    │              │  │  Broker MQTT (aedes)   │  │
└───────────────┘              │  │  port 1883             │  │
                               │  └────────┬───────────────┘  │
                               │           │                  │
                               │  ┌────────▼───────────────┐  │
                               │  │  Backend Node.js       │  │
                               │  │  • SQLite (historique) │  │
                               │  │  • API REST (Express)  │  │
                               │  │  • WebSocket (live)    │  │
                               │  │  • JWT auth            │  │
                               │  └────────┬───────────────┘  │
                               │           │ HTTP/WS          │
                               │  ┌────────▼───────────────┐  │
                               │  │  Dashboard web         │  │
                               │  │  (HTML + Tailwind +    │  │
                               │  │   Chart.js + Socket.io)│  │
                               │  └────────────────────────┘  │
                               └──────────────────────────────┘
                                          ▲
                                          │ HTTPS
                                          │
                                  ┌───────┴────────┐
                                  │  Navigateur    │
                                  │  (admin)       │
                                  └────────────────┘
```

## Topics MQTT

| Topic                  | Direction      | Format JSON       | Usage                              |
|------------------------|----------------|-------------------|------------------------------------|
| `tlm/<id>/data`        | device → broker| `{"ts","pulses",…}` | Télémétrie périodique             |
| `tlm/<id>/event`       | device → broker| `{"level","code","message"}` | Alertes / erreurs / info  |
| `tlm/<id>/status`      | device → broker| `"online"` / `"offline"` (LWT) | État de connexion       |
| `tlm/<id>/ack`         | device → broker| `{"status","message"}` | Réponse à une commande         |
| `tlm/<id>/cmd`         | broker → device| `{"cmd","params","ts"}` | Commande à distance           |

## Schéma de la base SQLite

### `devices`
| Colonne        | Type    | Description                            |
|----------------|---------|----------------------------------------|
| id             | TEXT PK | Identifiant unique (= DEVICE_ID)       |
| name           | TEXT    | Nom lisible                            |
| machine_type   | TEXT    | espresso / vending / generic / …       |
| location       | TEXT    | Adresse, salle, etc.                   |
| status         | TEXT    | `online` / `offline`                   |
| last_seen      | INTEGER | Timestamp ms du dernier message        |
| metadata_json  | TEXT    | Métadonnées libres                     |
| created_at     | INTEGER | Timestamp ms de création               |

### `telemetry`
| Colonne   | Type            | Description                                |
|-----------|-----------------|--------------------------------------------|
| id        | INTEGER PK      | Auto-incrément                             |
| device_id | TEXT FK         | Référence vers `devices.id`                |
| ts        | INTEGER         | Timestamp ms                               |
| payload   | TEXT (JSON)     | Tout le JSON envoyé par l'ESP32            |

### `events`
| Colonne   | Type     | Description                          |
|-----------|----------|--------------------------------------|
| id        | INTEGER PK | Auto-incrément                     |
| device_id | TEXT FK    | Référence machine                  |
| ts        | INTEGER    | Timestamp ms                       |
| level     | TEXT       | `info` / `warn` / `error`          |
| code      | TEXT       | Code court (ex: `boot`, `temp_high`)|
| message   | TEXT       | Message libre                      |
| acked     | INTEGER    | 0 = non acquitté, 1 = acquitté     |

### `commands`
Trace toutes les commandes envoyées et leurs réponses.

## API REST

Toutes les routes sous `/api/*` nécessitent un header `Authorization: Bearer <jwt>`,
sauf `POST /api/login` et `GET /api/health`.

| Méthode | Endpoint                          | Description                              |
|---------|-----------------------------------|------------------------------------------|
| POST    | `/api/login`                      | `{username,password}` → `{token}`        |
| GET     | `/api/health`                     | Liveness check                           |
| GET     | `/api/devices`                    | Liste toutes les machines                |
| GET     | `/api/devices/:id`                | Détail d'une machine                     |
| PUT     | `/api/devices/:id`                | Met à jour nom / type / lieu             |
| DELETE  | `/api/devices/:id`                | Supprime la machine et tout son historique|
| GET     | `/api/devices/:id/telemetry`      | `?since=<ms>` ou `?limit=N`              |
| GET     | `/api/devices/:id/events`         | Évènements de la machine                 |
| GET     | `/api/events`                     | Alertes globales non acquittées          |
| POST    | `/api/events/:id/ack`             | Acquitter une alerte                     |
| POST    | `/api/devices/:id/cmd`            | `{cmd,params}` → envoie commande MQTT    |

## WebSocket (Socket.io)

Le dashboard se connecte en WS au backend (avec son JWT) et reçoit ces évènements :

- `telemetry` — nouveau point de télémétrie
- `event` — nouvelle alerte / évènement
- `status` — changement de statut online/offline
- `ack` — réponse de commande

## Sécurité (niveau actuel et améliorations)

| Niveau                  | Implémenté                       | À ajouter pour la prod                       |
|-------------------------|----------------------------------|----------------------------------------------|
| Auth dashboard          | ✅ JWT                           |                                              |
| Auth MQTT (devices)     | ✅ Mot de passe partagé          | 🔒 Certificats X.509 par device              |
| Chiffrement transit     | ❌ Plaintext MQTT                | 🔒 TLS sur port 8883                         |
| Chiffrement dashboard   | ❌ HTTP                          | 🔒 HTTPS via Caddy / Nginx + Let's Encrypt   |
| Réseau                  | Port ouvert                      | 🔒 VPN (Tailscale) ou tunnel Cloudflare      |

## Roadmap d'évolutions possibles

- 📈 **Agrégation** : stocker des moyennes horaires/journalières pour réduire la BDD
- 📊 **Exports CSV** des données par machine
- 🔔 **Notifications** push (email, SMS via Twilio, Telegram)
- 🗺️ **Carte** des machines (Leaflet) — chaque ESP32 envoie sa position GPS via le SIM7600
- 🆕 **OTA** : mise à jour à distance du firmware ESP32 via HTTP
- 👥 **Multi-utilisateurs** avec rôles (admin / opérateur / lecture seule)
- 📱 **PWA** : dashboard installable sur smartphone
- 🤖 **Règles d'alerte** custom (ex: température > 80°C pendant 5 min → email)
