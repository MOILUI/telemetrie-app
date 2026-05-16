# 🔌 Raccordement physique aux machines

Ce guide montre **comment brancher un ESP32 sur une machine existante**, sans l'abîmer, en privilégiant les méthodes **non-invasives** (qui ne modifient pas la machine).

> ⚠️ **Sécurité électrique** : ne touche JAMAIS au câblage 220V toi-même si tu n'es pas électricien. Toutes les méthodes ci-dessous fonctionnent en **basse tension** (3.3V / 5V) ou avec des **capteurs externes** non-invasifs.

---

## 🧰 Boîte à outils du déploiement

Pour chaque ESP32, prévois :

| Outil / pièce                                    | Usage                                                      |
|--------------------------------------------------|------------------------------------------------------------|
| **Multimètre** (20€ sur Amazon)                   | Vérifier tensions, continuité, repérer le bon signal       |
| **Câbles Dupont mâle-femelle** (5€/100)           | Connecter capteurs à l'ESP32                               |
| **Domino électrique** ou **Wago**                 | Connexions propres et démontables                          |
| **Boîtier IP65** (10€)                            | Protéger l'ESP32 + modem 4G dans la machine                |
| **Alimentation 5V/2A** USB-C                      | Souvent prise dispo dans la machine                        |
| **Adhésif double-face fort** (3M VHB)             | Fixer capteurs sans percer                                 |

---

## ☕ Cas 1 : Machine à café / espresso

### Méthode A (la plus facile) — Compter les tasses via la LED du bouton

**Principe** : la machine a un bouton "café" qui s'allume quand on appuie. On lit cette LED avec une **photorésistance (LDR)** ou un **phototransistor** collé devant la LED.

```
   ┌──────────────────────┐
   │  Machine à café      │
   │                      │
   │   [●] LED tasse      │
   │    │                 │
   └────┼─────────────────┘
        │
   ┌────▼──── LDR collée devant la LED avec adhésif noir
   │
   │  (R 10kΩ vers GND)
   │
   └───→ GPIO 34 de l'ESP32
```

**Avantages** : zéro modification de la machine, totalement réversible, marche sur 100% des cafetières avec LED.

**Côté firmware** : déclare `PULSE_INPUT_PIN 34` (déjà par défaut). Chaque allumage = +1 tasse.

### Méthode B — Compteur de débit d'eau (Hall)

**Principe** : on intercale un **débitmètre à effet Hall** (type YF-S201, ~5€) sur le tuyau d'arrivée d'eau. Il génère des impulsions proportionnelles au volume.

```
Arrivée eau ──┬── Débitmètre Hall ──── Machine à café
              │     │  │  │
              │   GND VCC SIGNAL
              │     │  │  │
              │     │  5V GPIO 34
              │     │
              └─────┴── à l'ESP32
```

⚠️ Demande à un plombier d'intercaler le débitmètre si tu n'es pas à l'aise — c'est un raccord 1/4" standard.

### Méthode C — Lire la sortie série de la machine (si pro)

Beaucoup de machines pro (La Marzocco, Eversys, WMF) ont un port **RS232 / RS485** qui sort déjà toutes les infos (tasses, erreurs, T°). On les raccorde à l'ESP32 via un **convertisseur MAX3232** ou **MAX485** (~3€).

Cette méthode donne **toutes les données** d'usine sans capteur. Si tu travailles avec ce type de machines, contacte-moi pour la version firmware adaptée.

### Température de la chaudière

Colle un **DS18B20 en sonde inox étanche** (3€ avec câble) contre le corps de la chaudière, avec de la pâte thermique. Connecte sur GPIO 15.

```
DS18B20 :
   Rouge ──── 3.3V
   Noir  ──── GND
   Jaune ──── GPIO 15 ──┬── 4.7kΩ ── 3.3V (pull-up)
```

---

## 🥤 Cas 2 : Distributeur automatique

### Compter les ventes via le monnayeur (méthode propre)

Tous les distributeurs ont un **protocole MDB** (Multi-Drop Bus) qui fait communiquer monnayeur ↔ contrôleur. C'est trop complexe pour cette doc, **mais il y a beaucoup plus simple** :

**Méthode "sortie produit"** : la trappe de sortie a un **micro-switch** qui se ferme quand un produit tombe. On le lit comme un compteur d'impulsions.

```
Trappe de sortie ── Micro-switch ── GPIO 34 (PULSE_INPUT_PIN)
                                  ── GND
```

Chaque produit livré = +1 sur le compteur.

### Température du frigo

Sonde **DS18B20 en câble long (3 m)** que tu passes par le joint de porte ou par un trou d'aération existant. Pas besoin de percer.

### Détection porte ouverte (anti-vol)

**Capteur reed magnétique** (2€) : un aimant collé sur la porte, le reed collé sur le châssis.

```
Aimant ──── (porte)
       ──── (proximité magnétique)
Reed   ──── (châssis) ── GPIO 32 ── GND
```

Quand porte ouverte, le contact s'ouvre → le firmware détecte un changement.

### Stock par référence (avancé)

Pour suivre le stock par référence, deux options :
1. **Estimation** : compteur de ventes total ÷ capacité = stock restant (suffisant pour la plupart des cas)
2. **Capteurs IR** par colonne (1€ chacun) collés derrière la dernière position de chaque rangée

---

## 🧊 Cas 3 : Frigo professionnel

Identique au distributeur : DS18B20 dans le frigo, reed sur la porte, optionnellement un **capteur de courant non-invasif** (clamp **ACS712** ou **SCT-013**, ~5€) sur le câble du compresseur pour détecter les cycles de défrostage.

---

## ⚡ Cas 4 : Machine industrielle / pompe / compresseur

### Compteur de cycles / heures de marche

**Pince ampèremétrique non-invasive** type **SCT-013-030** : se clipse autour du fil de phase sans coupure. Donne le courant consommé → marche/arrêt + estimation de puissance.

```
   Fil de phase de la machine
        │
       [SCT-013 clamp]
        │
        └─── Câble jack 3.5mm ── Module amplification ── GPIO 35 (ANALOG_INPUT_PIN)
```

Active `ANALOG_ENABLED 1` dans `config.h`.

### Vibrations (maintenance prédictive)

**Accéléromètre ADXL345** (3€, I2C). Code à ajouter au firmware si besoin (demande-moi une variante).

### Température moteur / palier

**DS18B20 collé** ou **PT100 + module MAX31865** pour les hautes températures (jusqu'à 850°C).

---

## 📐 Schéma de câblage standard (ESP32 LilyGO T-SIM7600E)

```
                   ┌─────────────────────────────────┐
                   │     LilyGO T-SIM7600E            │
                   │                                  │
                   │  ┌─ Antenne 4G (à l'extérieur)   │
                   │  │                              │
                   │  ├─ 3.3V ────┬─── DS18B20 (jaune)│
                   │  │           ├─── pull-up 4.7kΩ │
                   │  │           │                  │
                   │  ├─ GND  ────┴─── DS18B20 (noir)│
                   │  │                              │
   GPIO 15 ────────┼──────── DS18B20 (jaune)         │
   GPIO 34 ────────┼──────── Capteur impulsions      │
   GPIO 32 ────────┼──────── Capteur porte (reed)    │
   GPIO 13 ────────┼──────── Module relais (commande)│
   GPIO 35 ────────┼──────── Capteur analogique      │
                   │                                  │
                   │  ┌─ USB-C 5V (alim)             │
                   └──┴──────────────────────────────┘
```

---

## 🛠️ Procédure type d'installation sur une nouvelle machine (45 min)

1. **Identifier les points de mesure** (LED, micro-switch, sonde température)
2. **Tester avec le multimètre** que tu as bien identifié le bon signal
3. **Couper l'alimentation** de la machine (sécurité)
4. **Coller / clipper les capteurs** (jamais souder dans la machine)
5. **Passer les câbles** vers l'ESP32 dans son boîtier IP65 (idéalement à l'intérieur de la machine)
6. **Connecter l'ESP32 au 5V** (presque toutes les machines ont une prise dispo)
7. **Rallumer**, ouvrir le moniteur série (ou attendre 2 min) et vérifier dans le dashboard que la machine apparaît
8. **Renommer la machine** dans le dashboard (ex: "Café Place République")
9. **Calibrer** : faire 10 tasses / vendre 10 produits et vérifier que le compteur correspond

---

## 🚫 Ce qu'il NE FAUT PAS faire

- ❌ Souder directement sur la carte électronique de la machine (annule la garantie, risque court-circuit)
- ❌ Brancher l'ESP32 directement sur du 220V — toujours via une alim 5V certifiée
- ❌ Faire passer des câbles dans des zones chaudes (>60°C) sans gaine adaptée
- ❌ Laisser les câbles trainer — utilise des serre-câbles, fixe tout
- ❌ Oublier l'antenne 4G à l'intérieur d'une carcasse métallique — toujours **dépasser l'antenne à l'extérieur** ou utiliser une antenne déportée

---

## 💰 Coût type par machine (BOM)

| Pièce                                | Prix    |
|--------------------------------------|---------|
| LilyGO T-SIM7600E                     | 50€     |
| Antenne 4G externe                    | 5€      |
| Carte SIM (1NCE 10 ans)              | 10€     |
| Boîtier IP65                          | 10€     |
| DS18B20 sonde inox                    | 3€      |
| Reed switch ou LDR                    | 2€      |
| Câbles + connecteurs                  | 5€      |
| **TOTAL**                             | **~85€**|

À vendre en abonnement à 9€/mois, l'investissement matériel est remboursé en **10 mois**. Au-delà, marge nette.

---

## 🆘 Tu n'es pas sûr du raccordement ?

Pour une première installation, fais-toi accompagner par :
- Un **technicien d'entretien** de la marque de machine
- Un **électricien** pour les parties courant fort
- Un **maker / fablab** local pour le câblage capteurs

Une fois que tu as fait 2-3 installations, tu seras autonome.
