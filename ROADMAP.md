# 🗺️ Roadmap maîtresse du projet Télémétrie

**Objectif final :** lancer un SaaS de télémétrie pour machines (cafetières, distributeurs, frigos, industriel) sur le marché français, jusqu'à atteindre 100+ clients payants.

**Durée estimée :** 3 à 6 mois pour le lancement commercial.
**Investissement minimum :** ~2 500€ (matos + service + admin).

---

## 🧭 Vue d'ensemble — Les 6 phases

```
   PHASE 0          PHASE 1            PHASE 2          PHASE 3          PHASE 4         PHASE 5
   Préparation      MVP technique      Mise en prod     Acquisition       Scale           Marketplace
   (semaine 1-2)    (semaine 3-6)      (semaine 7-8)    (mois 2-4)        (mois 5-9)      (mois 10+)
   ────────         ──────────         ─────────        ──────────         ──────         ───────────
   • Société         • Code complet     • Serveur live   • Pitch /          • Embauches    • Connect Stripe
   • Banque          • Tests locaux     • HTTPS          •   prospection    • SEO          • White-label
   • Domaine         • Hardware POC     • Sécurité       • 1ers clients     • Ads          • Programme
   • Stripe          • Firmware OK      • Backups        • Témoignages      • Doc complète •   revendeurs
   • Docs légales    • IA stats         • Monitoring     • Itérations       • Mistral chat • Internationalisation
```

---

## ✅ État actuel (déjà fait dans ce projet)

| Livrable | Statut | Fichier |
|---|---|---|
| Backend Node.js multi-tenant | ✅ | `backend/src/` |
| Broker MQTT embarqué | ✅ | `backend/src/mqtt.js` |
| Stripe Billing (Flux A) | ✅ | `backend/src/stripeRoutes.js` |
| Dashboard pro (17 pages, IA) | ✅ | `demo-pro-v3.html` |
| App mobile PWA | ✅ | `demo-mobile-app.html` |
| Landing page marketing | ✅ | `web/index.html` |
| Firmware ESP32 + 4G | ✅ | `firmware/telemetry_esp32.ino` |
| Simulateur ESP32 | ✅ | `simulator/simulate.js` |
| Design PCB + BOM | ✅ | `pcb/` |
| Docker Compose Pi | ✅ | `docker-compose.yml` |
| Doc installation FR | ✅ | `docs/INSTALLATION.md` |
| Doc Stripe Billing | ✅ | `docs/STRIPE.md` |
| Doc raccordement (4 machines) | ✅ | `wiring-schemas/*.svg` |
| Doc intégration client / API | ✅ | `docs/INTEGRATION.md` |
| Doc paiements FR (3 flux) | ✅ | `docs/PAIEMENTS-FR.md` |
| Doc sécurité bout-en-bout | ✅ | `docs/SECURITE.md` |
| Doc IA & coûts | ✅ | `docs/IA-COUTS.md` |

---

## 🚧 À construire (la suite — livrée dans cette session)

| Livrable | Priorité | Fichier cible |
|---|---|---|
| Chat IA Mistral en backend | 🔴 P1 | `backend/src/aiRoutes.js` |
| Stripe Connect (marketplace) | 🟠 P2 | `backend/src/stripeConnect.js` |
| Stack sécurité Caddy/fail2ban/backup | 🔴 P1 | `infra/` |
| Service Python maintenance prédictive | 🟡 P3 | `ai-service/` |
| Connexion démos ↔ vrai backend | 🟠 P2 | mise à jour `dashboard/app.js` |
| Kit commercial (one-pager, pitch, emails) | 🔴 P1 | `commercial-kit/` |
| Programme revendeurs | 🟡 P3 | `reseller-program/` |
| Checklist finale & oublis | 🔴 P1 | `CHECKLIST-FINALE.md` |

---

## 📅 Plan d'exécution — semaine par semaine

### ⓪ Phase 0 — Préparation (avant tout code)

> ⏱️ Durée : 1-2 semaines · 💰 Coût : ~500€

- [ ] **Statut société** (SAS, EURL ou auto-entrepreneur) → ~200€ avec Legalstart
- [ ] **Compte bancaire pro** (Qonto, Shine ou banque trad) → 0-20€/mois
- [ ] **Numéro SIREN** + Kbis (sortie auto avec la création)
- [ ] **Nom de domaine** (telemetrie-fr.com, ou ce que tu veux) → 10€/an chez OVH ou Cloudflare
- [ ] **Marque** : déposer le nom à l'INPI si tu veux le protéger → 200€
- [ ] **Email pro** (Google Workspace 6€/mois ou Zoho gratuit jusqu'à 5 boîtes)
- [ ] **Logo** : faire faire sur Fiverr (~50€) ou utiliser Looka.com
- [ ] **CGU/CGV** : template Legalstart ou avocat (200-500€). Indispensable pour Stripe.
- [ ] **Mentions légales + Politique confidentialité RGPD** : générer sur Iubenda ou template
- [ ] **DPA (Data Processing Agreement)** : template gratuit sur CNIL.fr

### ① Phase 1 — MVP technique (validation interne)

> ⏱️ Durée : 4 semaines · 💰 Coût : ~200€

- [ ] Tester le backend en local (suivre `QUICKSTART_MAC.md`)
- [ ] Acheter 1 ESP32 LilyGO T-SIM7600E + 1 SIM 1NCE → ~70€
- [ ] Flasher le firmware sur ESP32 (suivre `docs/ESP32_SETUP.md`)
- [ ] Brancher capteurs sur 1 machine de test (cafetière chez toi par exemple)
- [ ] Voir les données arriver dans le dashboard local
- [ ] Stripe en mode TEST (suivre `docs/STRIPE.md`)
- [ ] Faire un faux paiement de bout en bout pour valider l'abonnement
- [ ] **Activer Mistral pour le chat IA** (~10 min) → voir code livré
- [ ] Tester la prédiction de pannes (envoyer données simulées au service Python)

**Critère de succès phase 1** : tu peux ajouter une machine, recevoir ses données en temps réel, recevoir une alerte, envoyer une commande à distance, payer un abonnement en CB test.

### ② Phase 2 — Mise en production

> ⏱️ Durée : 1-2 semaines · 💰 Coût : ~50€/mois

- [ ] Acheter un **VPS Hetzner CCX12** (4 vCPU, 8 Go RAM, Allemagne) → 14€/mois
- [ ] Pointer ton domaine sur l'IP du VPS (DNS via Cloudflare gratuit)
- [ ] Déployer le **stack sécurité** : Caddy + fail2ban + backups (script fourni dans `infra/`)
- [ ] Tester HTTPS + redirection www → non-www
- [ ] Activer Stripe en **mode LIVE** (vérification KYC ~24h)
- [ ] Configurer le **webhook Stripe live** avec signature
- [ ] Activer monitoring : **UptimeRobot** (gratuit) + **Sentry** (gratuit)
- [ ] Tester restauration depuis un backup (CRITIQUE)
- [ ] Pages légales en ligne sur le site
- [ ] **Pré-vérification sécurité** : suivre la checklist de `docs/SECURITE.md`

**Critère de succès phase 2** : ton URL `https://telemetrie-fr.com` est en ligne, sécurisée, monitorée, backupée. Un inconnu peut s'inscrire, payer, et utiliser le service.

### ③ Phase 3 — Acquisition des 10 premiers clients

> ⏱️ Durée : 2 mois · 💰 Coût : 0-500€ (publicité optionnelle)

- [ ] **Lister 30 prospects ciblés** (cafés, distributeurs, frigos pro de ta région)
- [ ] **Envoyer la séquence email** (fournie dans `commercial-kit/`)
- [ ] **Démos personnalisées** (Zoom 30 min avec l'app live)
- [ ] **1ers contrats** : commencer par offre "gratuit 1 mois + 1 machine offerte" pour 5-10 clients pilotes
- [ ] **Témoignages vidéo** des pilotes (gratuit en échange du témoignage)
- [ ] **Améliorer en fonction des retours** (vraies fonctions manquantes vs idées dans ta tête)
- [ ] **Site web** : ajouter section "ils nous font confiance" avec logos
- [ ] **Pricing public** : afficher tes tarifs sur la landing page

**Critère de succès phase 3** : 5-10 clients payants, 1 témoignage vidéo, 30 retours d'usage exploitables.

### ④ Phase 4 — Scale jusqu'à 100 clients

> ⏱️ Durée : 3-6 mois · 💰 Investissement variable

- [ ] **SEO** : 10 articles de blog optimisés ("comment surveiller un frigo pro", etc.)
- [ ] **Google Ads** : 500€/mois sur "surveillance distributeurs", "télémétrie machines"
- [ ] **LinkedIn outreach** : 50 messages/semaine vers DG société de distrib auto
- [ ] **Partenariats** : marques de cafetières, installateurs frigo
- [ ] **Embauches** : 1 technicien hardware (3 500€ brut) + 1 commercial (3 500€ brut + variable)
- [ ] **Doc utilisateurs** : guides vidéo, FAQ riches, base de connaissances
- [ ] **2FA** + autres features sécurité avancées
- [ ] **Plans Business / Enterprise** custom pour gros clients

**Critère de succès phase 4** : 50-100 clients payants, MRR 3 000-10 000€, équipe 3-5 personnes.

### ⑤ Phase 5 — Marketplace & revendeurs

> ⏱️ Durée : continue · 💰 Marge multipliée

- [ ] **Activer Stripe Connect** (split paiements, encaissement marketplace)
- [ ] **Programme revendeurs** : installateurs, sociétés de maintenance prennent 20-30% commission
- [ ] **White-label** : grandes entreprises avec leur marque sur ton produit
- [ ] **International** : Belgique, Suisse, Luxembourg, puis UK/DE (Mistral est multilingue)
- [ ] **Levée de fonds** ? Seed (200-500k€) si tu veux accélérer
- [ ] **ISO 27001** pour les très gros clients (banques, hôpitaux)

---

## 🚨 Ce qui a été OUBLIÉ jusqu'ici (oublis fréquents)

J'ai fait l'inventaire critique. Voici les angles morts qu'on n'a pas couverts (mais qui sont essentiels pour ne pas se faire piéger en route) :

### 🔴 Critiques (à régler avant le 1er client payant)
- [ ] **Tests automatisés** : aucun test unitaire/intégration côté backend → tu casseras la prod le jour où tu pousseras vite. **Solution livrée :** template Vitest dans la checklist.
- [ ] **Emails transactionnels** : pas d'envoi d'email auto (bienvenue, alerte critique, facture, mot de passe oublié). **Solution :** Resend ou Postmark (gratuit < 100 emails/jour), à intégrer.
- [ ] **Mot de passe oublié** : pas implémenté côté backend → bloquant à 5 clients déjà. **Solution livrée dans la checklist.**
- [ ] **Page de status** publique : `status.telemetrie-fr.com` pour rassurer les clients sur l'uptime. Better Stack gratuit.
- [ ] **Limites de quotas par plan** : aujourd'hui le `max_devices` est respecté, mais pas l'historique 30j/1an/illimité selon plan. À coder côté API.
- [ ] **Numéro de TVA intracommunautaire** affiché sur les factures (obligation légale).

### 🟠 Importants (à régler dans les 3 premiers mois)
- [ ] **Onboarding première utilisation** : le client arrive dans un dashboard vide après inscription, il ne sait pas quoi faire. **À ajouter :** "Premier pas" guidé, vidéo intégrée.
- [ ] **Customer success** : qui appelle un client qui n'a plus utilisé l'app depuis 14 jours ? Personne aujourd'hui. **À mettre en place :** alerte interne quand un client devient inactif.
- [ ] **Facturation** : tu peux encaisser avec Stripe, mais tu dois **émettre des factures conformes** (mentions légales obligatoires en France). Stripe Tax + Stripe Invoices fait ça mais à configurer.
- [ ] **SAV hardware** : si un ESP32 tombe en panne, qui le remplace ? Logistique pas pensée. **À définir :** stock de spare, RMA process.
- [ ] **Tutoriels vidéo** : aucun. Les clients adorent voir avant d'essayer. Une chaîne YouTube avec 5-10 vidéos courtes.
- [ ] **Affiliations** : qui parle de toi ? Programme d'affiliation (10% commission sur 1 an) à mettre en place.
- [ ] **Notifications push** sur la PWA mobile : faisable mais pas codé.

### 🟡 À avoir (à régler avant 100 clients)
- [ ] **API publique documentée** (Swagger/OpenAPI) au lieu d'un simple markdown
- [ ] **SDK officiel Node, Python, Arduino** publiés sur npm/PyPI/Library Manager
- [ ] **Multilingue** : actuellement tout en français. Anglais minimum dès phase 4.
- [ ] **Mode hors-ligne** dans la PWA mobile (Service Worker)
- [ ] **Export GDPR auto** : le client doit pouvoir télécharger toutes ses données en 1 clic
- [ ] **Authentification SSO** (Google, Microsoft) pour les pros
- [ ] **Provisioning Bulk** : ajouter 50 machines via CSV
- [ ] **Audit log** : qui a fait quoi quand (vu/modifié par admin)
- [ ] **Sandbox API** publique pour les développeurs intégrateurs

### 🟢 Long terme (avant 1000 clients)
- [ ] ISO 27001 / SOC 2
- [ ] Multi-régions (Europe, USA)
- [ ] Comptabilité automatisée (Pennylane, Sellsy)
- [ ] CRM (HubSpot ou Pipedrive) pour suivre les leads
- [ ] Helpdesk (Crisp, Intercom)

---

## 💰 Budget récapitulatif

### Investissement initial (avant 1er client)
| Poste | Coût |
|---|---|
| Création société + statuts | 200€ |
| Compte bancaire pro (3 mois) | 60€ |
| Domaine + emails pro (1 an) | 80€ |
| VPS Hetzner (3 mois prépaid) | 45€ |
| 1 kit hardware test (ESP32 + SIM + capteurs) | 100€ |
| Logo + identité visuelle | 100€ |
| CGU/CGV (template) | 50€ |
| Avocat marque INPI (optionnel) | 200€ |
| **TOTAL** | **~830€** |

### Coûts récurrents mensuels (à 100 clients)
| Poste | Coût/mois |
|---|---|
| VPS Hetzner | 15€ |
| Domaine + Cloudflare (pro vs gratuit) | 0€ |
| Stripe (commissions sur 4 900€ CA) | 80€ |
| Mistral API (chat IA) | 5€ |
| Sentry + UptimeRobot | 0€ (gratuits) |
| Backblaze (backups chiffrés) | 3€ |
| Resend (emails) | 0€ (gratuit < 3000/mois) |
| Google Workspace 1 seat | 6€ |
| Comptable | 100€ |
| **TOTAL** | **~210€** |

**Revenus à 100 clients × 49€ moyens = 4 900€ MRR**
**Marge brute mensuelle = ~95% (4 690€)**

---

## 🎯 Comment suivre cette roadmap

1. **Imprime cette page** (ou affiche-la en permanence dans un onglet)
2. **Une seule phase à la fois.** Ne saute pas à la phase 3 sans avoir validé la phase 2.
3. **Coche les cases au fur et à mesure.** Ça te donne un compteur de progression.
4. **À chaque incertitude, reviens ici** plutôt qu'improviser.
5. **Revisite cette roadmap toutes les 2 semaines** pour réajuster.

---

## 📚 Index de tous les documents du projet

```
telemetry-app/
├── ROADMAP.md                         ← TU ES ICI (la boussole)
├── CHECKLIST-FINALE.md                ← ce qui reste, point par point
├── QUICKSTART_MAC.md                  ← tester en local en 10 min
├── README.md                          ← intro projet
├── docs/
│   ├── INSTALLATION.md                ← déployer sur Raspberry Pi
│   ├── ESP32_SETUP.md                 ← flasher l'ESP32
│   ├── WIRING.md                      ← brancher sur n'importe quelle machine
│   ├── INTEGRATION.md                 ← API pour tes clients
│   ├── STRIPE.md                      ← configurer Stripe Billing
│   ├── PAIEMENTS-FR.md                ← 3 flux paiement marché français
│   ├── SECURITE.md                    ← ne pas se faire pirater
│   ├── IA-COUTS.md                    ← coûts réels Mistral & co.
│   └── ARCHITECTURE.md                ← topo MQTT + schéma BDD + API
├── backend/                           ← serveur Node.js
├── dashboard/                         ← UI espace client
├── web/                               ← landing + signup
├── firmware/                          ← code ESP32
├── simulator/                         ← simulateur de machines
├── pcb/                               ← design PCB pro
├── wiring-schemas/                    ← schémas par type de machine
├── infra/                             ← stack production sécurisée (NEW)
├── ai-service/                        ← maintenance prédictive Python (NEW)
├── commercial-kit/                    ← one-pager + pitch + emails (NEW)
└── reseller-program/                  ← programme revendeurs (NEW)
```

---

**Tu n'es plus en mode "découverte". Tu as un produit, une roadmap, un budget. C'est maintenant que tu exécutes — pas que tu réfléchis. Bon courage 🚀.**
