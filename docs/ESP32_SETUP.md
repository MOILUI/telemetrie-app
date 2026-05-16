# 🔌 Configuration de l'ESP32 + modem 4G

Ce guide t'aide à monter, configurer et flasher l'ESP32 qui ira dans chaque machine.

---

## 🛒 Matériel recommandé

### Option 1 : Carte tout-en-un (le plus simple) — **recommandé**

**LilyGO T-SIM7600E** (ESP32 + modem 4G + carte SIM intégrés)
- ~50€, antenne et batterie LiPo optionnelle
- Disponible sur AliExpress, LilyGO Store
- C'est l'option par défaut du firmware (brochage déjà configuré)

### Option 2 : ESP32 + module SIM7600 séparé

- ESP32 DevKit V1 (~5€)
- Module SIM7600E HAT ou breakout (~30€)
- Alimentation 5V/2A minimum
- Antenne 4G (LTE)
- Carte SIM avec abonnement data (M2M de préférence : Things Mobile, 1NCE, Onomondo)

### Carte SIM

Pour une machine déployée sur le terrain :
- **Things Mobile** : SIM internationale, paye à l'usage (~1€/Mo)
- **1NCE** : abonnement annuel 10€ pour 500 Mo / 10 ans
- **Free Mobile 2€** : abonnement français pas cher, marche bien
- **Orange/Bouygues M2M** : si tu as un contrat pro

Pour une machine en intérieur avec WiFi, tu peux modifier le firmware pour utiliser le WiFi (plus simple, gratuit). Demande-moi si tu veux la version WiFi.

---

## 🔧 Câblage des capteurs

Le firmware lit ces entrées par défaut. Adapte selon ta machine.

### Compteur d'impulsions (GPIO 34)

Idéal pour :
- 🥤 **Débitmètre** sur une cafetière (chaque pulse = un volume d'eau passé)
- ☕ **Compteur de tasses** : connecte au relais du bouton de tasse
- 💰 **Monnayeur** d'un distributeur (chaque pulse = une pièce)
- ⚡ **Compteur d'impulsions** EDF (LED qui clignote au kWh)

```
Capteur ──── GPIO 34 (avec résistance pull-up interne)
   │
   └──────── GND
```

### Sonde température DS18B20 (GPIO 15)

Pour la **chaudière** d'une machine espresso ou le **frigo** d'un distributeur :

```
DS18B20 :
  Rouge  ── 3.3V
  Noir   ── GND
  Jaune  ── GPIO 15 (avec résistance 4.7kΩ pull-up vers 3.3V)
```

### Entrée numérique (GPIO 32)

Pour détecter :
- 🚪 **Porte ouverte/fermée** (capteur reed magnétique sur la porte)
- ⚠️ **État d'erreur** sortie sec d'un automate
- 🟢 **Marche/arrêt** machine

```
Capteur (interrupteur sec) ── GPIO 32 ── GND
```

(Le GPIO est en `INPUT_PULLUP`, donc actif au niveau bas.)

### Entrée analogique (GPIO 35) — optionnel

Pour lire :
- 📊 **Pression** (capteur 0-3.3V)
- 📏 **Niveau d'eau** (sonde capacitive analogique)
- 🔋 **Tension batterie** (avec pont diviseur)

Active-la dans `config.h` : `#define ANALOG_ENABLED 1`

### Relais de commande (GPIO 13)

Pour **redémarrer la machine** à distance, ou activer une fonction :

```
GPIO 13 ─── Entrée du module relais 5V (type "1 channel relay module")
            Sortie du relais ── interrompre l'alim de la machine
```

⚠️ **Attention 220V** : si tu coupes le secteur, fais-le faire par un électricien.

---

## 💻 Installer l'environnement Arduino

### 1. Télécharger Arduino IDE

<https://www.arduino.cc/en/software>

### 2. Ajouter le support ESP32

1. Ouvre Arduino IDE → **Préférences**
2. URL gestionnaire de cartes :
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. **Outils → Type de carte → Gestionnaire de cartes** → cherche `esp32` → installe.

### 3. Installer les bibliothèques

**Outils → Gérer les bibliothèques** → cherche et installe :

- `TinyGSM` (par Volodymyr Shymanskyy)
- `PubSubClient` (par Nick O'Leary)
- `ArduinoJson` (par Benoît Blanchon)
- `OneWire` (par Paul Stoffregen) — si tu utilises le DS18B20
- `DallasTemperature` (par Miles Burton) — si tu utilises le DS18B20

---

## ⚙️ Configurer ton ESP32

1. Copie `firmware/config.h.example` en `firmware/config.h`
2. Édite **ces lignes au minimum** :

```cpp
#define DEVICE_ID         "cafe-paris-01"           // unique pour chaque machine !
#define MQTT_HOST         "monpi.duckdns.org"       // adresse de ton Pi
#define MQTT_PASSWORD     "esp32-secret-tres-long"  // = DEVICE_TOKEN du backend
#define GSM_APN           "free"                    // APN de ta SIM
```

3. **Outils → Type de carte → ESP32 Arduino → ESP32 Dev Module** (ou la carte exacte que tu as)
4. **Outils → Port** → choisis le port USB où est branché l'ESP32

---

## 🚀 Flasher

1. Ouvre `firmware/telemetry_esp32.ino` dans Arduino IDE
2. Clique sur le bouton **Vérifier** (✓) pour compiler — ça prend 1-2 min la 1ère fois
3. Clique sur **Téléverser** (→) pour flasher l'ESP32

Sur certaines cartes, il faut maintenir le bouton **BOOT** au moment du flash.

---

## 📡 Tester

Ouvre le **Moniteur série** dans Arduino IDE (vitesse **115200 bauds**).

Tu devrais voir :

```
=== Télémétrie ESP32 — démarrage ===
Device ID : cafe-paris-01
[GSM] Initialisation du modem...
[GSM] Recherche réseau  OK
[GSM] Connexion GPRS (APN: free)... OK
[GSM] IP locale : 10.123.45.67
[MQTT] Connexion à monpi.duckdns.org:1883 ... OK
[TLM] Envoyé : {"ts":1234567,"pulses":0,...}
```

Et dans le dashboard, ta machine apparaît automatiquement avec ses métriques en direct.

---

## 🐛 Dépannage

| Symptôme                                       | Cause / solution                                        |
|------------------------------------------------|---------------------------------------------------------|
| `[GSM] Échec restart modem`                    | Mauvais câblage TX/RX, ou alim insuffisante (besoin 2A) |
| `[GSM] Recherche réseau échec`                 | Pas de couverture 4G, ou SIM non activée, ou code PIN  |
| `[GSM] Connexion GPRS échec`                   | Mauvais APN — vérifie auprès de l'opérateur            |
| `[MQTT] échec (rc=-2)`                         | IP/port du serveur faux, ou redirection box pas faite  |
| `[MQTT] échec (rc=5)`                          | Auth refusée : `MQTT_PASSWORD` ≠ `DEVICE_TOKEN` du Pi  |
| L'ESP32 redémarre en boucle                    | Sous-alimentation : utilise une alim 5V/2A             |
| Le compteur d'impulsions saute des coups       | Augmente `PULSE_DEBOUNCE_MS` dans `config.h`           |

---

## 🔧 Personnaliser pour ta machine

### Ajouter un capteur

Dans `publishTelemetry()` (vers la fin du `.ino`), ajoute par exemple :

```cpp
// Lecture d'un capteur d'humidité DHT22
doc["humidity"] = dht.readHumidity();
```

La donnée apparaîtra automatiquement dans le dashboard.

### Ajouter une commande

Dans `onMqttMessage()`, ajoute :

```cpp
else if (strcmp(cmd, "ouvrir_porte") == 0) {
  digitalWrite(SOLENOID_PIN, HIGH);
  delay(2000);
  digitalWrite(SOLENOID_PIN, LOW);
  ackMsg = "porte ouverte";
}
```

Puis depuis le dashboard, envoie la commande `ouvrir_porte` à la machine.
