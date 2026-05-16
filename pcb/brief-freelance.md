# 📋 Brief freelance — Conception PCB Télémétrie

À copier-coller pour solliciter un électronicien freelance (Malt, Upwork, Fiverr, LinkedIn).

---

## Mission

Concevoir un PCB **shield d'interface industrielle** pour un module ESP32 + 4G (LilyGO T-SIM7600E), en vue de superviser à distance des machines (cafetières professionnelles, distributeurs automatiques, équipements industriels).

## Livrables attendus

1. **Schéma KiCad** (.kicad_sch) commenté
2. **PCB KiCad** (.kicad_pcb) routé, 2 couches, 100×80 mm
3. **Gerbers + drill files** prêts pour JLCPCB
4. **BOM** au format JLCPCB (avec LCSC part numbers)
5. **Pick & Place file** (.csv) pour SMT assembly
6. **Document de montage** (1 page PDF) avec sérigraphie et notes
7. **Modèle 3D** (.step) du PCB monté

## Spécifications techniques

### Alimentation
- Entrée **9-30V DC** via bornier à vis Phoenix 3.5mm 2-pôles
- Protection : **polyfuse 1A reset** + **TVS bidir SMBJ24CA** + **varistance 30V**
- Régulateur **LM2596 step-down → 5V/2A** vers le module ESP32

### Connectique au module LilyGO T-SIM7600E
- **2 headers femelles 2×16** à l'écartement standard de la carte LilyGO
- Hauteur du shield : 8mm sous le module (entretoises M2.5)
- Antenne 4G : passage libre, pas de gêne mécanique

### Entrées
- **4× entrées numériques optoisolées 5-24V DC** via PC817 → GPIO 32, 33, 25, 26
  - Bornier 2 pôles + résistance limitation 4.7kΩ côté entrée
  - Pull-up 10kΩ côté ESP32
- **1× entrée compteur d'impulsions** → GPIO 34, avec Schmitt trigger 74HC14 + filtre RC
- **2× entrées analogiques 0-10V** → GPIO 35, 39 via pont diviseur 22k/10k (vers 3.3V max)
- **2× entrées 4-20mA** → MCP3008 ADC SPI 10-bit, résistance shunt 250Ω
- **2× connecteurs OneWire** → GPIO 15, 14 avec pull-up 4.7kΩ vers 3.3V
- **1× connecteur Grove I²C** (4-pin) → GPIO 21 (SDA), 22 (SCL), 3.3V, GND
- **1× RS485** via MAX485 → GPIO 17 (TX), 16 (RX), GPIO 4 (DE/RE jumper-link)

### Sorties
- **2× relais SRD-05VDC-SL-C 10A 250V** sur GPIO 13, 12
  - Driver BC547 NPN + diode flyback 1N4007 + varistance 250V sur sortie
  - Bornier 3 pôles NO/NC/COM
- **2× sorties open-collector** BC547, 100mA max → GPIO 2, autre dispo
- **1× buzzer piezo 5V** PWM → GPIO 25 (ou re-mapper)
- **1× LED RGB WS2812B** → GPIO 27 (ou re-mapper, vérifier conflits)

### Mécanique
- **Format** : 100×80 mm rectangulaire
- **4 trous de fixation M3** aux 4 coins (placement standard pour boîtier Hammond 1554)
- **Tous les borniers sur les bords longs** pour câblage facile dans le boîtier
- **Sérigraphie claire** : nom de chaque entrée/sortie + plage de tension

### Routage / contraintes EMC
- **Plan de masse** continu sur la couche bottom
- **Séparation** des zones haute tension (relais 250V) et basse tension (logique)
- **Tracks 220V** : minimum 1mm de largeur, isolation 3mm entre pistes
- **Clearance 6mm** entre primaire et secondaire des optos
- **Pads** : optimisés pour pick-and-place LCSC standard

## Composants (préférence LCSC)

| Réf            | Composant                            | Quantité |
|----------------|--------------------------------------|----------|
| U2             | LM2596S-5.0 step-down                | 1        |
| U3             | MAX485ESA RS485 transceiver          | 1        |
| U4-7           | PC817 optocoupleur DIP-4 ou SOP-4    | 4        |
| U8             | MCP3008 ADC 8-channel SPI            | 1        |
| U9             | 74HC14 Schmitt trigger hex           | 1        |
| K1-K2          | SRD-05VDC-SL-C relais 10A            | 2        |
| Q1-Q4          | BC547 NPN (TO-92 ou SOT-23)          | 4        |
| D1-D2          | 1N4007 flyback                       | 2        |
| D3             | SMBJ24CA TVS bidir                   | 1        |
| F1             | Polyfuse 1A reset                    | 1        |
| VR1-VR3        | Varistance 250V (sur relais) + 30V (alim) | 3   |
| LED1           | WS2812B (SK6812 acceptable)          | 1        |
| BZ1            | Buzzer piezo 5V 12mm                 | 1        |
| —              | Borniers Phoenix 3.5mm (2 et 3 pôles) | 14+     |
| —              | Connecteur Grove 4-pin coudé         | 1        |
| —              | Headers femelles 2×16                | 2        |
| —              | R, C divers (1206 SMD préféré)       | ~50      |

## Contraintes économiques

- **Coût composants cible** : < 15€/u en série de 100
- **PCB JLCPCB** : exploiter au max les "basic parts" pour limiter le coût SMT assembly
- **Tous les composants doivent être stockés chez LCSC** au moment du design

## Calendrier

| Étape                          | Délai     |
|--------------------------------|-----------|
| Validation du schéma           | J+3       |
| Routage initial                | J+7       |
| Revue et corrections           | J+9       |
| Génération Gerbers + BOM       | J+10      |
| Production 5 prototypes JLCPCB | +1 sem.   |
| Tests + ajustements éventuels  | J+18      |
| Livraison finale               | J+21      |

## Budget

À discuter, ordre de grandeur attendu :
- **300-500€** pour un freelance européen expérimenté
- **150-300€** pour un freelance hors UE (Inde, Vietnam, Ukraine)
- **+50€** pour le passage de 5 prototypes JLCPCB

## Profil recherché

- 3+ ans d'expérience KiCad ou Altium
- Habitué aux PCBs industriels / IoT
- Connaissance des normes CE / EMC basique
- Familier avec JLCPCB / PCBWay (workflow Gerber + BOM + CPL)
- Bonus : expérience avec ESP32 / modules LilyGO

## Annexes fournies

- `schematic.svg` : schéma fonctionnel
- `README.md` : description complète du projet
- Spec firmware ESP32 (qui pilote la carte) si nécessaire

---

**Contact** : [ton email]
**Délai de réponse souhaité** : 48h pour un devis détaillé
