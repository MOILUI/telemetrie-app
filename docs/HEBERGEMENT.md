# 🏗️ Hébergement — Guide complet

3 grandes familles d'hébergement, avec recommandations par phase de croissance.

---

## 🎯 TL;DR — Décision rapide

| Phase | Recommandation | Coût/mois | Pourquoi |
|---|---|---|---|
| **MVP / 0-10 clients** | **Hetzner CCX12** (VPS) | 14€ | Simple, puissant, en Allemagne (RGPD) |
| **10-100 clients** | **Hetzner CCX22** (VPS bigger) | 28€ | Largement suffisant |
| **100-1000 clients** | **Hetzner Cloud** (multi-VPS + load balancer) | 100€ | Redondance, scale horizontal |
| **1000+ clients** | **Scaleway** ou **AWS** managed | 500€+ | RDS, S3, CloudWatch |
| **Grands comptes** | **OVH dédié** ou **Cloud Souverain** (3DS Outscale) | 1000€+ | SLA, certif, conformité grand compte |

---

# 🇩🇪 Option 1 — VPS chez Hetzner (RECOMMANDÉ pour démarrer)

## Pourquoi Hetzner ?

- **Allemand** → RGPD compliant, datacenters Nuremberg + Helsinki + Falkenstein
- **Le moins cher du marché** : 8€/mois pour 4 vCPU, 8 Go RAM, 80 Go SSD
- Réseau ultra-rapide, IPv4/IPv6 inclus
- **Pas de frais cachés** (contrairement à AWS où chaque octet sortant est facturé)
- API complète pour automatisation

## Plans recommandés

| Modèle | vCPU | RAM | Disk | Prix/mois | Pour combien de clients |
|---|---|---|---|---|---|
| **CX22** | 2 | 4 Go | 40 Go | **4,15€** | Test / dev |
| **CX32** | 4 | 8 Go | 80 Go | **7,55€** | 0-50 clients |
| **CCX13** | 2 | 8 Go | 80 Go | **13,10€** | Recommandé MVP |
| **CCX23** | 4 | 16 Go | 160 Go | **26,20€** | 100-500 clients |
| **CCX33** | 8 | 32 Go | 240 Go | **52,40€** | 500-2000 clients |

> **Différence CX vs CCX :** CX = vCPU partagés (peut ralentir si voisin gourmand). CCX = vCPU **dédiés** (performance garantie). **Pour la prod, toujours CCX.**

## Setup étape par étape

```bash
# 1. Créer un compte sur https://hetzner.com/cloud
# 2. Créer un projet, puis un serveur :
#    - Image : Ubuntu 24.04
#    - Type : CCX13
#    - Datacenter : Nuremberg ou Falkenstein
#    - Réseau : IPv4 + IPv6
#    - SSH key : ajouter ta clé publique

# 3. Connexion
ssh root@<ip-du-serveur>

# 4. Lancer le script de setup (durcissement + Docker)
curl -fsSL https://raw.githubusercontent.com/ton-repo/telemetry-app/main/infra/setup-server.sh | bash

# 5. Cloner ton projet
cd /home/telemetry
git clone https://github.com/ton-repo/telemetry-app.git
cd telemetry-app

# 6. Configurer .env (Stripe, JWT, etc.)
cp backend/.env.example backend/.env
nano backend/.env

# 7. Démarrer
docker compose -f infra/docker-compose.prod.yml up -d

# 8. Vérifier
curl https://telemetrie-fr.com/api/health
```

**Délai total : 30 minutes.** Tu as une infra de production complète.

---

# 🇫🇷 Option 2 — VPS chez OVH / Scaleway (alternative française)

## OVHcloud

**Avantages :**
- Hébergeur français, datacenters à Roubaix, Strasbourg, Gravelines
- Certifications grandes entreprises (HDS, SecNumCloud bientôt)
- Plans "Public Cloud" avec instances Discovery à 3€/mois

**Inconvénients :**
- Interface moins moderne que Hetzner
- Plus cher à perf égale (~20% au-dessus)
- Historique de pannes (incendie SBG 2021)

**Plans :**
- **VPS Starter** : 4€/mois (1 vCPU, 2 Go RAM) — trop juste
- **VPS Comfort** : 12€/mois (2 vCPU, 4 Go) — équivalent Hetzner CX32 plus cher
- **Public Cloud B2-7** : 18€/mois (2 vCPU, 7 Go RAM, 50 Go) — solide

## Scaleway

**Avantages :**
- Hébergeur français, datacenters Paris + Amsterdam
- Plans "Instant" instantanés
- DevOps moderne (Terraform, k8s, etc.)

**Plans :**
- **DEV1-S** : 4€/mois (2 vCPU, 2 Go) — pour dev
- **PRO2-XS** : 13€/mois (2 vCPU, 8 Go) — équivalent CCX13
- **PRO2-S** : 26€/mois (3 vCPU, 16 Go) — solide MVP

**Quand préférer OVH/Scaleway plutôt qu'Hetzner :**
- Tu veux **insister sur "100% français"** dans ton marketing (gros clients publics, hôpitaux, etc.)
- Tu vises la certification **HDS** (Hébergeur Données Santé) ou **SecNumCloud**

---

# ☁️ Option 3 — PaaS (Plateforme-as-a-Service)

Pour ceux qui ne veulent **pas gérer de serveur**. On déploie son code Git, la plateforme s'occupe du reste.

## Railway.app

- $5/mois par service + usage
- Déploiement Git automatique
- Support PostgreSQL, Redis natif
- Bon pour Node.js + Python
- **Limite :** pas idéal pour MQTT (port non-HTTP)

## Fly.io

- Distribution globale (edge network)
- $5-30/mois selon usage
- Support TCP/UDP (donc MQTT OK)
- Excellente perf
- **Limite :** courbe d'apprentissage, facturation par usage moins prévisible

## Render

- $7/mois pour un service web
- PostgreSQL natif
- Auto-scaling
- Très simple
- **Limite :** prix monte vite

**Quand préférer un PaaS :**
- Tu détestes le sysadmin
- Tu veux scaler automatiquement sans réfléchir
- Tu acceptes de payer 2-3× plus qu'un VPS

**Quand fuir un PaaS :**
- Tu veux contrôler les coûts précisément
- Tu as besoin de MQTT broker self-hosted (compliqué sur PaaS)
- Tu veux pouvoir mettre la main sur le serveur (debug profond)

---

# 🌩️ Option 4 — Cloud managé (AWS, GCP, Azure)

Pour **plus tard**, quand tu auras 1000+ clients et besoin de redondance multi-régions, ou si un gros client l'exige.

## AWS

| Service | Usage | Coût indicatif |
|---|---|---|
| **EC2** (VM) | Backend Node.js | 30-100€/mois |
| **RDS** (SQL managé) | PostgreSQL | 30-200€/mois |
| **S3** | Backups | 5€/mois pour 500 Go |
| **CloudFront** | CDN | gratuit jusqu'à 1 To/mois |
| **IoT Core** | Broker MQTT managé | 0,15€/M messages |
| **SES** | Emails transactionnels | 0,10€/1000 emails |
| **Route53** | DNS | 0,50€/mois par domaine |

**Pour ton projet en AWS** : ~300-500€/mois pour 1000 clients, vs ~100€ chez Hetzner.

**Pourquoi quelqu'un choisirait AWS :**
- Tes clients sont des grands comptes qui exigent une infra "réputée"
- Tu vises le marché US plus tard
- Tu as besoin de services managés que Hetzner ne fournit pas (Lambda, Aurora, SageMaker)

## GCP / Azure

Équivalents AWS. **GCP** est souvent légèrement moins cher et préféré pour le ML. **Azure** dominante en France pour les boîtes Microsoft-friendly (banques, assurances).

---

# 🛡️ Option 5 — Cloud Souverain (clients grands comptes)

Pour les contrats avec administrations, hôpitaux, banques, défense.

## 3DS Outscale (Dassault)

- **Certifié SecNumCloud** (ANSSI)
- 100% français (Saint-Cloud)
- Compatible API AWS (migration facile)
- Prix : 2-3× Hetzner

## OVH SecNumCloud

- En cours de certification
- Avantage : prix raisonnable + français

## Cloud Temple

- Datacenters en France
- Spécialisé sur le secteur public

**Quand passer là-dessus :** quand un client te demande une **certification HDS** (santé) ou **SecNumCloud** dans son cahier des charges. Plus tôt = surcoût inutile.

---

# 🏠 Hébergement maison (auto-hébergement)

Pour les fanatiques ou les très petits volumes.

## Raspberry Pi 5 chez toi

- **Coût matos** : 80€ pour le Pi + 30€ pour SSD + 20€ pour alim
- **Coût récurrent** : ~2€/mois d'électricité
- **Connexion** : ton internet ADSL/Fibre

**Limites :**
- Coupure internet = service down pour tes clients
- IP publique probablement dynamique → DynDNS obligatoire
- Sécurité plus dure (tu exposes ton réseau perso)
- Pas pro pour des clients B2B

**Quand utiliser le Pi :**
- Phase 0 : tester avant de payer un VPS
- Faire la démo aux prospects
- Backup secondaire de tes vraies données

---

# 📊 Comparatif final

| Critère | Hetzner | OVH | Scaleway | AWS | Railway | 3DS Outscale |
|---|---|---|---|---|---|---|
| Prix MVP | 🟢 14€ | 🟡 12€ | 🟢 13€ | 🔴 80€ | 🟡 25€ | 🔴 60€ |
| RGPD | 🟢 EU | 🟢 FR | 🟢 FR | 🟡 EU possible | 🟡 US (filiales EU) | 🟢 FR cert |
| Simplicité | 🟢 Très simple | 🟡 Moyen | 🟢 Simple | 🔴 Complexe | 🟢 Trivial | 🟡 Moyen |
| Support MQTT | 🟢 Self-host OK | 🟢 OK | 🟢 OK | 🟢 IoT Core | 🟡 OK | 🟢 OK |
| Scale auto | ❌ Manuel | ❌ Manuel | 🟡 Possible | 🟢 Natif | 🟢 Natif | 🟡 |
| Certifications | ISO 27001 | ISO + HDS | ISO | Tout | ISO | HDS + SecNum |
| Pour qui | **MVP solo** | Boîtes FR | Devs FR | Grands comptes | Devs flemmards | Adm publique |

---

# 🚀 Chemin de migration recommandé

```
MOIS 1-6          MOIS 6-18           MOIS 18-36          MOIS 36+
Hetzner CCX13  →  Hetzner CCX23   →   Hetzner Cloud      →  Scaleway / AWS
  14€/mois         28€/mois            (3 VPS, LB, etc.)     selon client/clientèle
                                       ~150€/mois
```

À chaque palier, **tester en parallèle 1 semaine** avant de basculer. La migration Hetzner → AWS est faisable en 2-3 jours grâce à Docker.

---

# 🌐 DNS, domaine et email

## Domaine

- **OVH** : 8€/an .fr · 12€/an .com
- **Cloudflare Registrar** : prix coûtant (~10€/an) — recommandé
- **Namecheap** : 8-15€/an selon TLD

## DNS

- **Cloudflare (gratuit)** : meilleur DNS au monde, gratuit, anti-DDoS inclus, cache CDN
- → **À utiliser absolument, quel que soit ton hébergeur**

## Email pro

Tu DOIS avoir une adresse `contact@telemetrie-fr.com`, pas un `gmail.com` pour vendre du B2B.

| Service | Coût | Quand utiliser |
|---|---|---|
| **Zoho Mail** | Gratuit jusqu'à 5 boîtes (5 Go) | Démarrage |
| **Google Workspace** | 6€/utilisateur/mois | Pro, intégrations |
| **Microsoft 365** | 5€/u/mois | Si tu utilises Office |
| **Proton Mail** | 4€/u/mois | RGPD strict, anti-tracking |
| **Mailcow** (self) | 0€ (VPS dédié) | Geek avancé |

**Recommandation MVP :** Zoho Mail gratuit.

---

# 📦 Stockage backups

| Service | Prix | Pour quoi |
|---|---|---|
| **Backblaze B2** | $0,005/Go/mois | **Recommandé** (5€/mois pour 1 To) |
| **Hetzner Storage Box** | 3€/mois pour 100 Go | Si déjà chez Hetzner |
| **AWS S3 Glacier** | $0,004/Go/mois | Archives long terme |
| **OVH Cold Storage** | 0,002€/Go/mois | Très long terme FR |

---

# 🧮 Récap financier — Stack complète recommandée pour MVP

| Composant | Service | Coût/mois |
|---|---|---|
| Hébergement principal | Hetzner CCX13 | 14€ |
| Domaine | Cloudflare Registrar | 1€ |
| DNS + CDN | Cloudflare Free | 0€ |
| Email pro | Zoho Mail | 0€ |
| Backups | Backblaze B2 | 3€ |
| Monitoring | UptimeRobot + Sentry | 0€ |
| Status page | Uptime Kuma (self) | 0€ |
| **TOTAL** | | **18€/mois** |

> 18 €/mois pour faire tourner un SaaS qui peut encaisser plusieurs milliers d'euros. **C'est le meilleur ratio coût/valeur de toute l'histoire de l'IT.**

---

# ❓ FAQ hébergement

**Q : Pourquoi pas du serverless (Lambda, Cloudflare Workers) ?**
R : Tu pourrais ! Mais le MQTT broker self-hosted (Aedes) ne tourne pas en serverless. Si tu utilises AWS IoT Core, tu peux passer 100% serverless. Coût : ~50€/mois jusqu'à 1000 machines.

**Q : Mon serveur Hetzner peut-il tomber ?**
R : Oui, comme tout serveur. SLA Hetzner : 99% (= 7h de panne/an max). Pour aller au-delà, il faut **2 serveurs + load balancer + DB répliquée** = ~50€/mois. À faire à partir de 100 clients.

**Q : Et la 4G de mes ESP32 ? Comment ça impacte l'hébergement ?**
R : Chaque ESP32 envoie ~1-5 messages MQTT par minute. Un seul broker Aedes sur Hetzner CCX13 peut gérer **5000 ESP32 simultanés**. Largement assez.

**Q : Comment je migre si je veux changer ?**
R : `docker compose down` sur l'ancien → backup → `scp backup.db` sur le nouveau → `docker compose up` sur le nouveau → changer DNS → 5 min de downtime max.

**Q : Vous gérez l'hébergement vous-même ou je peux confier ça à quelqu'un ?**
R : Tu peux complètement déléguer pour ~200-500€/mois à un freelance DevOps. Mais avec Caddy + Docker + scripts fournis, c'est gérable seul (1h/mois de maintenance).

**Q : Mes données sont en sécurité ?**
R : Hetzner est ISO 27001 + GDPR. Données chiffrées au repos (volumes Hetzner). Backups chiffrés en plus côté nous. **Plus sûr qu'un Excel sur ton PC.**

---

# 🎯 Action plan

1. **Aujourd'hui** : créer un compte Hetzner (5 min)
2. **Demain** : créer un VPS CCX13, lancer `setup-server.sh` (30 min)
3. **Cette semaine** : déployer ton MVP avec `docker compose -f infra/docker-compose.prod.yml up -d` (1h)
4. **Avant le 1er client** : pointer ton domaine, tester HTTPS, faire 1 backup test (2h)

**Total** : 4h de travail réparti sur 1 semaine, pour 18€/mois ensuite.
