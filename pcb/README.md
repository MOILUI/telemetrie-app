# 🔌 PCB Télémétrie — Carte d'interface ESP32

Ce dossier contient tout ce qu'il faut pour **faire fabriquer un PCB pro** qui simplifie le câblage de tes machines : tu colles ton ESP32 LilyGO T-SIM7600E sur la carte et toutes les entrées/sorties sont déjà routées avec borniers, protections, isolation galvanique.

---

## 🎯 Pourquoi un PCB plutôt que du câblage volant ?

| Câblage volant (proto)              | PCB pro                                            |
|--------------------------------------|----------------------------------------------------|
| 30-45 min de câblage par machine    | 5 min : on visse les fils dans les borniers         |
| Erreurs fréquentes                  | Erreur impossible (sérigraphie sur le PCB)         |
| Pas d'isolation galvanique          | Optocoupleurs, varistances, fusibles intégrés       |
| Aspect "bricolage"                  | Aspect pro pour vendre à des clients               |
| Coût matériel ~85€/machine          | Coût matériel ~95€/machine (PCB ~10€/u en série)    |

---

## 📋 Cahier des charges du PCB

Un PCB **shield** (carte fille) qui s'enfiche sur ta LilyGO T-SIM7600E et expose :

### Entrées
- **4 entrées numériques isolées** (optocoupleur PC817) — accepte 5-24V DC, parfait pour signaux industriels
- **1 entrée compteur d'impulsions rapide** (jusqu'à 10 kHz) — débitmètre, anémomètre…
- **2 entrées analogiques 0-10V** (pont diviseur) — capteurs industriels standards
- **2 entrées analogiques 4-20mA** (résistance 250Ω) — sondes pression / niveau pro
- **2 entrées OneWire** (DS18B20) — températures
- **1 entrée I²C** (avec connecteur Grove) — accéléromètre, baromètre, écran OLED…
- **1 entrée RS485** (transceiver MAX485) — pour cafetières/distributeurs pro avec port série

### Sorties
- **2 relais 10A 250V** isolés (avec varistance + diode flyback) — commande à distance
- **2 sorties open-collector** — pour piloter d'autres relais ou LEDs
- **1 sortie buzzer** — alarme sonore locale
- **1 LED RGB de statut** (WS2812B)

### Alimentation
- **Entrée 9-30V DC** (large plage, fonctionne sur batteries 12V, alim 24V industrielle, etc.)
- **Régulateur step-down LM2596** vers 5V/2A pour l'ESP32 + modem
- **Protection** : fusible polyfuse, varistance 30V, diode TVS

### Mécanique
- **Format : 100 × 80 mm** (entre dans un boîtier IP65 standard de 115×90 mm)
- **Fixations** : 4 trous M3 aux angles
- **Connecteurs** : borniers à vis Wago / Phoenix Contact 3.5mm (démontables sans tournevis)

---

## 📐 Schéma logique

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PCB Télémétrie v1.0                        │
│                                                                      │
│  ┌─[ 9-30V DC ]──→ Fuse ──→ TVS ──→ LM2596 ──→ 5V/2A ───┐           │
│  │                                                       │            │
│  │   ┌──────────────────────────────────────────────┐  │            │
│  │   │     LilyGO T-SIM7600E (ESP32 + 4G)           │←─┘            │
│  │   │     Antenne 4G externe via SMA              │                │
│  │   └──┬──────────────────────────────────────────┘                │
│  │      │ GPIOs                                                       │
│  │      ├──→ [4× Optos PC817] ──→ 4 entrées numériques 5-24V        │
│  │      ├──→ [HW pulse counter] ──→ Entrée compteur rapide          │
│  │      ├──→ [Pont diviseur] ──→ 2 entrées 0-10V                    │
│  │      ├──→ [Résistance 250Ω] ──→ 2 entrées 4-20mA                 │
│  │      ├──→ [Pull-up 4.7k] ──→ 2 connecteurs OneWire (DS18B20)     │
│  │      ├──→ [I²C 3.3V] ──→ Grove SCL/SDA                           │
│  │      ├──→ [MAX485] ──→ RS485 A/B                                 │
│  │      ├──→ [Driver relais] ──→ 2× Relais 10A 250V                 │
│  │      ├──→ [BC547 NPN] ──→ 2 sorties open-collector              │
│  │      ├──→ [PWM] ──→ Buzzer piezo                                │
│  │      └──→ [WS2812B] ──→ LED RGB statut                          │
│  └──────────────────────────────────────────────────────────────────┘
```

Le schéma détaillé est dans [`schematic.svg`](schematic.svg).

---

## 🛒 BOM (Bill of Materials) — par carte fabriquée

| Réf | Composant                              | Qté | Prix u | Total  | Achat                      |
|-----|----------------------------------------|-----|--------|--------|----------------------------|
| U1  | LilyGO T-SIM7600E (module externe)     | 1   | 50€    | 50€    | LilyGO / AliExpress        |
| U2  | LM2596 step-down 9-30V → 5V/2A         | 1   | 1,20€  | 1,20€  | LCSC C25446                |
| U3  | MAX485 transceiver RS485               | 1   | 0,30€  | 0,30€  | LCSC C8943                 |
| U4-7| PC817 optocoupleur                     | 4   | 0,10€  | 0,40€  | LCSC C7948                 |
| K1-2| Relais SRD-05VDC-SL-C 10A              | 2   | 0,60€  | 1,20€  | LCSC C2904                 |
| D1-2| Diode 1N4007 (flyback relais)          | 2   | 0,02€  | 0,04€  | LCSC C2128                 |
| Q1-2| BC547 NPN driver relais                | 2   | 0,03€  | 0,06€  | LCSC C2148                 |
| Q3-4| BC547 NPN open-collector               | 2   | 0,03€  | 0,06€  | LCSC C2148                 |
| VR1 | Varistance 30V (protection)            | 1   | 0,10€  | 0,10€  | LCSC                       |
| F1  | Polyfuse 1A reset                      | 1   | 0,15€  | 0,15€  | LCSC                       |
| D3  | TVS bidir SMBJ24CA                     | 1   | 0,10€  | 0,10€  | LCSC                       |
| LED1| WS2812B RGB                            | 1   | 0,15€  | 0,15€  | LCSC C114586               |
| BZ1 | Buzzer piezo 5V                        | 1   | 0,30€  | 0,30€  | LCSC                       |
| —   | Borniers vis 3.5mm 2-poles             | 10  | 0,15€  | 1,50€  | LCSC C72660                |
| —   | Borniers vis 3.5mm 3-poles             | 4   | 0,20€  | 0,80€  | LCSC                       |
| —   | Connecteur Grove 4-pin                 | 1   | 0,20€  | 0,20€  | LCSC                       |
| —   | Connecteur barrel jack 5.5×2.1mm       | 1   | 0,30€  | 0,30€  | LCSC                       |
| —   | Header femelle 2×16 (recevoir LilyGO)  | 2   | 0,30€  | 0,60€  | LCSC                       |
| —   | Résistances 1/4W (4.7k, 10k, 250Ω…)    | ~20 | 0,01€  | 0,20€  | LCSC                       |
| —   | Condensateurs (10µF, 100nF, 470µF…)    | ~10 | 0,05€  | 0,50€  | LCSC                       |
| —   | **PCB fabriqué** (100×80mm, 2 couches) | 1   | 5€     | 5€     | JLCPCB (5pcs minimum = 25€)|
| —   | Boîtier IP65 115×90×55                 | 1   | 10€    | 10€    | Amazon / Hammond           |
|     | **TOTAL par carte**                     |     |        | **~73€** *hors LilyGO*<br>**~123€** avec LilyGO | |

> 💡 **À l'échelle** (100 cartes) : descend à ~85€ tout compris grâce aux remises volume.

---

## 🏭 Fabrication

### Option A : JLCPCB (le plus simple, ~25€ pour 5 cartes)

1. Va sur <https://jlcpcb.com>
2. Crée un compte (gratuit)
3. Génère les fichiers **Gerber** depuis KiCad (`File → Plot → Gerber`)
4. Upload le zip dans JLCPCB
5. Paramètres : 2 layers, FR-4, 1.6mm, finition HASL, masque vert
6. Active **SMT Assembly** si tu veux qu'ils soudent les composants pour toi (+~50€ pour 5 cartes, mais énorme gain de temps)
7. Délai : 1 semaine en standard, 3 jours en express
8. Réception : tu reçois 5 cartes prêtes à monter

### Option B : PCBWay (qualité équivalente, parfois moins cher en volume)

Pareil sur <https://pcbway.com>.

### Option C : Aisler (européen, 1 semaine, support FR)

<https://aisler.net> — plus cher mais TVA déjà payée, pas de douane.

---

## 📦 Fichiers à fournir au fabricant

Quand tu auras finalisé le design dans KiCad, tu généreras :

| Fichier                  | Contenu                              |
|--------------------------|--------------------------------------|
| `*.zip` (Gerbers)         | Description des couches du PCB       |
| `BOM.csv`                 | Liste des composants                 |
| `CPL.csv` (Pick & Place)  | Position de chaque composant         |

JLCPCB / PCBWay acceptent tous les formats KiCad nativement.

---

## 🛠️ Workflow recommandé

Si tu veux faire le PCB toi-même (ou trouver un freelance pour) :

1. **Lis le `schematic.svg`** pour comprendre le circuit
2. **Embauche un freelance KiCad** sur Malt / Upwork / Fiverr (~300-500€ pour ce niveau de complexité, ~2 jours de travail)
3. Brief : "Refais ce schéma en KiCad, 2 couches, format 100×80mm, optimise pour SMT, prépare les fichiers JLCPCB"
4. Commande **5 prototypes** chez JLCPCB pour valider (~50€ avec SMT)
5. Une fois validé, commande la série (100 cartes = ~800€ tout compris)

> 💡 Si tu veux que je te rédige le brief exact pour le freelance, dis-le moi.

---

## 🔄 Évolutions futures (v2)

- **Ethernet PoE** intégré (alimentation par câble réseau)
- **GPS** intégré au PCB (pour véhicules / machines mobiles)
- **Mémoire flash externe** 16 Mo pour historique local en cas de coupure réseau
- **MQTT over TLS** pré-configuré avec certificats
- **Carte SIM intégrée** (mini-SIM soudée style M2M)

Voir [`schematic.svg`](schematic.svg) pour le schéma complet et [`enclosure-3d.md`](enclosure-3d.md) pour le boîtier 3D.
