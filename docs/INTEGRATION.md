# 🤝 Intégration client — Comment tes clients connectent leur matériel

Ce guide est destiné aux **clients qui s'abonnent à ta plateforme** et veulent intégrer eux-mêmes leurs machines, ou aux **développeurs tiers** qui veulent exploiter l'API.

---

## 🎯 3 modes d'intégration

| Mode | Pour qui | Effort | Délai |
|------|----------|--------|-------|
| **Plug & Play** | Restaurateurs, gérants — pas de tech | Aucun (kit prêt) | 30 min |
| **Self-Service** | Maker, technicien | Flash firmware ESP32 | 1h |
| **API directe** | Développeur, intégrateur SI | Code custom (Python/Node/etc.) | Variable |

---

## 🟢 Mode 1 : Plug & Play (vendu par toi)

Tu vends à ton client un **kit pré-configuré** :
- ESP32 LilyGO + PCB
- Carte SIM 4G data
- Capteurs adaptés à sa machine
- Boîtier IP65

Le client n'a qu'à :
1. Brancher le 5V
2. Coller les capteurs (guide pas-à-pas fourni)
3. Sa machine apparaît dans son dashboard

**Aucune configuration logicielle de sa part**, le kit est pré-flashé avec son token unique.

---

## 🟡 Mode 2 : Self-Service (intégrateur avec son propre ESP32)

### Étape 1 — Création du compte

Le client va sur `https://app.telemetrie.fr/signup`, crée un compte (essai gratuit 14 jours), et arrive dans son dashboard.

### Étape 2 — Récupération du token

Dans son dashboard, il voit un bandeau **"🔑 Connecter un nouvel ESP32"** qui affiche :

```cpp
#define DEVICE_ID         "machine-001"           // unique par machine
#define MQTT_HOST         "mqtt.telemetrie.fr"
#define MQTT_PORT         1883
#define MQTT_USERNAME     "device"
#define MQTT_PASSWORD     "tok_a8f3...d72b_unique_par_org"   // ← son token perso
```

### Étape 3 — Téléchargement du firmware

Bouton **"📥 Télécharger le firmware"** → un ZIP contenant :
- `telemetry_esp32.ino` (firmware Arduino prêt)
- `config.h` (auto-rempli avec son token)
- `README.md` (installation Arduino IDE)
- Bibliothèques nécessaires (TinyGSM, PubSubClient, ArduinoJson)

### Étape 4 — Flash

- Ouvre dans Arduino IDE
- Choisit son ESP32 (ESP32 Dev Module, port USB)
- Upload (5 min première fois)
- Branche capteurs selon `WIRING.md`

### Étape 5 — Auto-discovery

Dès que l'ESP32 envoie son premier message MQTT, **la machine apparaît automatiquement** dans le dashboard du client avec son `DEVICE_ID` comme nom (qu'il peut renommer).

### 💡 Plug additionnel

Si le client a déjà un capteur particulier (différent de notre kit standard), il peut :
- Modifier `publishTelemetry()` dans le firmware → ajouter ses propres champs JSON
- Ses champs apparaissent **automatiquement** dans le dashboard comme nouvelles métriques (le système est schema-less)

Exemple : un client ajoute un capteur de pH :
```cpp
doc["ph"] = analogRead(34) * 14.0 / 4095;
```
→ dans son dashboard, une nouvelle métrique "ph" apparaît avec graphiques temps réel.

---

## 🔵 Mode 3 : API directe (intégrateurs SI, gros clients)

### Authentification

Toutes les requêtes utilisent un **Bearer token** dans le header :

```http
Authorization: Bearer sk_live_a8f3...d72b
```

Génère des clés depuis le **portail développeur** (`/app/#developer`). Tu peux créer :
- 🔓 **Clé live** (production, read+write)
- 👀 **Clé read-only** (à donner à des outils externes en sécurité)
- 🧪 **Clé sandbox** (environnement de test, ne touche pas la prod)

### Endpoints principaux

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| `GET` | `/v1/devices` | Liste toutes tes machines |
| `GET` | `/v1/devices/:id` | Détail d'une machine |
| `POST` | `/v1/devices` | Crée une machine (avant le 1er envoi) |
| `PUT` | `/v1/devices/:id` | Met à jour métadonnées (nom, lieu, type) |
| `DELETE` | `/v1/devices/:id` | Supprime la machine et son historique |
| `GET` | `/v1/devices/:id/telemetry?since=<ts>` | Historique télémétrie |
| `GET` | `/v1/devices/:id/events` | Historique évènements/alertes |
| `POST` | `/v1/devices/:id/telemetry` | Push un point de télémétrie (sans MQTT) |
| `POST` | `/v1/devices/:id/cmd` | Envoie une commande à la machine |
| `GET` | `/v1/events?level=error&since=<ts>` | Alertes filtrées |
| `POST` | `/v1/events/:id/ack` | Acquitter une alerte |

### Exemples

#### cURL — récupérer toutes les machines

```bash
curl https://api.telemetrie.fr/v1/devices \
  -H "Authorization: Bearer sk_live_a8f3...d72b"
```

#### Python — pousser de la télémétrie depuis un Raspberry Pi

```python
import requests, time

API = "https://api.telemetrie.fr/v1"
TOKEN = "sk_live_a8f3...d72b"

while True:
    payload = {
        "ts": int(time.time() * 1000),
        "temperature": 23.5,
        "humidity": 45,
        "stock_pct": 78,
    }
    r = requests.post(
        f"{API}/devices/mon-frigo-01/telemetry",
        headers={"Authorization": f"Bearer {TOKEN}"},
        json=payload,
    )
    print(r.status_code, r.text)
    time.sleep(60)
```

#### Node.js — écouter les alertes via webhook

Configure un webhook dans `/app/#developer` → URL `https://mon-erp.com/webhook`.

```javascript
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook', (req, res) => {
  const ev = req.body;
  // Vérifier la signature HMAC (recommandé)
  if (!verifySignature(req.headers['x-telemetrie-signature'], req.rawBody)) {
    return res.status(401).end();
  }
  if (ev.type === 'alert.critical') {
    console.log('Alerte critique:', ev.data);
    // Envoyer SMS / créer ticket Jira / etc.
  }
  res.json({ ok: true });
});

app.listen(3000);
```

#### Arduino — envoyer depuis n'importe quel ESP32 (sans notre firmware)

```cpp
#include <WiFi.h>
#include <PubSubClient.h>

WiFiClient w;
PubSubClient client(w);

void setup() {
  WiFi.begin("MonWiFi", "motdepasse");
  client.setServer("mqtt.telemetrie.fr", 1883);
  client.connect("ma-machine-001", "device", "tok_a8f3...d72b");
}

void loop() {
  String json = "{\"ts\":" + String(millis()) + ",\"temp\":" + String(getTemp()) + "}";
  client.publish("tlm/ma-machine-001/data", json.c_str());
  delay(60000);
}
```

#### Modbus / OPC-UA → notre plateforme

Pour les machines industrielles avec automate existant, on fournit une **passerelle Node.js** open source :

```bash
npm install -g @telemetrie/modbus-bridge

telemetrie-modbus \
  --plc-host 192.168.1.50 \
  --plc-port 502 \
  --device-id ligne-1 \
  --token tok_a8f3...
```

La passerelle interroge l'automate Schneider/Siemens en Modbus TCP et pousse les données vers la plateforme.

---

## 🪝 Webhooks (réception d'évènements)

### Types d'évènements

| Type | Quand il déclenche |
|------|--------------------|
| `device.online` / `device.offline` | Changement statut |
| `telemetry.received` | Nouvelle donnée (verbeux, optionnel) |
| `alert.created` | Nouvelle alerte |
| `alert.critical` | Alerte de niveau critique |
| `sale.completed` | Vente détectée (machines avec MDB) |
| `stock.low` | Stock < seuil |
| `command.acked` | ACK d'une commande |
| `subscription.updated` | Changement de plan |

### Format payload

```json
{
  "id": "evt_a8b3c7d2",
  "type": "alert.critical",
  "created_at": 1715680800123,
  "data": {
    "device_id": "frigo-marseille-03",
    "level": "error",
    "code": "temp_high",
    "message": "Température frigo 12°C",
    "machine_name": "Frigo Restaurant Le Phare"
  }
}
```

### Sécurité (signature HMAC)

Chaque payload est signé avec ton secret webhook. Vérifie avec :

```javascript
const crypto = require('crypto');
function verifySignature(header, rawBody, secret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
}
```

### Retry

Si ton endpoint renvoie autre que 2xx, on retente avec backoff exponentiel : 1min, 5min, 30min, 1h, 6h, 24h. Au bout de 5 échecs, le webhook est suspendu et on t'envoie un email.

---

## 🔐 Sécurité & limites

### Rate limits

- **API REST** : 1000 req/min par clé (suffisant pour 99% des cas)
- **MQTT** : pas de limite sur les publications, mais 60s de keepalive recommandé
- **Webhooks** : pas de limite sortante, mais on coupe si ton endpoint répond > 30s

### Chiffrement

- API REST : HTTPS uniquement (TLS 1.2+)
- MQTT : par défaut port 1883 (TCP), recommandé port 8883 (TLS) en production
- Webhooks : HTTPS obligatoire

### Stockage / RGPD

- Données stockées en Europe (France, OVH/Scaleway)
- Pas de transfert hors UE
- Suppression sur demande sous 30 jours
- DPA disponible pour signature

---

## 🎓 Mode "white-label" (revente)

Si tu veux **revendre ta plateforme sous ta propre marque** :

- Plan Enterprise (contact)
- Sous-domaine custom (`telemetrie.tonentreprise.com`)
- Logo, couleurs, emails personnalisés
- Multi-organisations sous ton compte master
- Pricing custom pour tes sous-clients

---

## 📞 Support

- 📚 Docs complètes : <https://docs.telemetrie.fr>
- 💬 Slack communauté : <https://slack.telemetrie.fr>
- 📧 Support : `support@telemetrie.fr`
- 🐛 Bugs : GitHub Issues (clients Pro+)
