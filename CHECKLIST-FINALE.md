# ✅ Checklist finale — État du projet

**Mis à jour le :** 15 mai 2026
**Total fichiers livrés :** 40+
**Total lignes de code :** ~8 000

---

## 🟢 CE QUI EST FAIT (livré dans ce projet)

### Code & technique
- ✅ Backend Node.js multi-tenant (Express + Socket.io + Aedes MQTT)
- ✅ Schéma BDD SQLite avec organizations, users, devices, telemetry, events
- ✅ Authentification email/password (bcrypt) + JWT
- ✅ API REST complète protégée
- ✅ WebSocket temps réel scopé par organisation
- ✅ Stripe Billing (Flux A — abonnements SaaS)
- ✅ Stripe Connect (Flux C — marketplace)
- ✅ Intégration Mistral pour chat IA (function calling + fallback)
- ✅ Service Python FastAPI maintenance prédictive (Isolation Forest + ARIMA)
- ✅ Firmware ESP32 + SIM7600 (4G) avec capteurs génériques
- ✅ Simulateur de machines (Node.js) pour tester sans matos
- ✅ Dashboard pro 17 pages avec IA, cartes Leaflet, charts Chart.js
- ✅ App mobile PWA (bottom-nav, modale détail)
- ✅ Landing page marketing + page inscription avec pricing dynamique

### Hardware & raccordement
- ✅ Design PCB pro complet (schéma SVG + BOM + brief KiCad)
- ✅ Schémas raccordement détaillés pour 4 types de machines
- ✅ Guide composants par cas (cafetière, distri, frigo, indus)

### Infra & sécurité
- ✅ Docker Compose dev (Raspberry Pi)
- ✅ Docker Compose prod (Caddy + backend + uptime kuma + backup)
- ✅ Caddyfile HTTPS auto + headers sécurité
- ✅ Script setup-server.sh (durcissement VPS Ubuntu)
- ✅ Script backup chiffré GPG + upload Backblaze
- ✅ Config fail2ban pour brute force

### Documentation
- ✅ Roadmap maîtresse du projet
- ✅ Quickstart Mac (test local 10 min)
- ✅ Installation Raspberry Pi pas-à-pas
- ✅ Setup ESP32 + flash firmware
- ✅ Guide raccordement (WIRING)
- ✅ Architecture (MQTT + BDD + API)
- ✅ Stripe Billing configuration
- ✅ Paiements FR (3 flux : SaaS, cashless, marketplace)
- ✅ Sécurité bout-en-bout (3 niveaux)
- ✅ IA & coûts réels (Mistral, alternatives)
- ✅ Intégration client / API publique
- ✅ Plans tarifaires (Trial / Starter / Pro / Business / Enterprise)

### Go-to-market
- ✅ One-pager commercial
- ✅ Pitch deck (12 slides)
- ✅ Séquence emails prospection (8 mails sur 30j)
- ✅ Programme revendeurs (3 niveaux + contrat type)

---

## 🟧 CE QUI RESTE À FAIRE (par ordre de priorité)

### 🔴 BLOQUANT avant 1er client payant (1-2 semaines)

- [ ] **Émettre une 1ère facture conforme** (Stripe Invoices : activer + mentions légales)
- [ ] **Email transactionnel** : envoyer mail de bienvenue après signup
  - Intégrer **Resend** ou **Postmark** (~10 min de code)
  - Templates : welcome, mot de passe oublié, alerte critique, facture
- [ ] **Endpoint "mot de passe oublié"**
  - Route `POST /api/forgot-password` → envoie token email avec lien
  - Route `POST /api/reset-password` → vérifie token + change mdp
- [ ] **Page légales sur le site** : Mentions légales, CGV, Politique de confidentialité (générer sur Iubenda ou OAGenerator gratuit)
- [ ] **CGU/CGV acceptables Stripe** : activer la case à cocher au signup
- [ ] **Tests E2E manuels** : signup → flash ESP → voir données → upgrade plan → cancel
- [ ] **Domaine + DNS + Caddy en prod** : `telemetrie-fr.com` accessible HTTPS

### 🟠 IMPORTANT (1 mois)

- [ ] **Onboarding première utilisation** : wizard 4 étapes pour nouveaux users
- [ ] **Limites par plan** : forcer `history_days` selon plan (30j Starter, 1an Pro, illimité Business)
- [ ] **2FA TOTP** pour le dashboard (lib `speakeasy`)
- [ ] **Notifications email critiques** : si machine offline > 30 min
- [ ] **Notifications SMS** (Twilio ou OVH SMS) pour alertes critiques
- [ ] **Page de status publique** (Uptime Kuma déjà dans docker-compose, ne reste qu'à brancher domaine)
- [ ] **Export RGPD** : `GET /api/me/export` qui renvoie toutes les données du client en JSON/CSV
- [ ] **Suppression compte** : `DELETE /api/me` qui cascade tout
- [ ] **Tests unitaires** : ajouter Vitest, viser 50% de couverture sur les routes critiques
- [ ] **Monitoring** : Sentry pour exceptions backend, UptimeRobot pour ping
- [ ] **Tutoriels vidéo** : 5 vidéos Loom de 2 min (signup, install ESP, premier alerte, etc.)
- [ ] **Chat support** : Crisp (gratuit) ou Tally form

### 🟡 NICE TO HAVE (3 mois)

- [ ] **MQTT TLS** (port 8883) au lieu de plaintext
- [ ] **OTA firmware** : mise à jour ESP32 à distance
- [ ] **API publique** OpenAPI/Swagger
- [ ] **SDKs** publiés : npm `telemetrie-fr`, PyPI `telemetrie-fr`, Arduino lib
- [ ] **Webhooks sortants** côté client (notifications Slack, Discord, etc.)
- [ ] **Multi-langue** : anglais minimum
- [ ] **Mode offline PWA** : Service Worker
- [ ] **Tableau de bord revendeur** (page dans /app/#partner)
- [ ] **Calcul commission automatique** (cron mensuel + Stripe Transfer)
- [ ] **Audit log** : qui a fait quoi (RGPD recommande)
- [ ] **Imports bulk** : ajouter 50 machines via CSV

### 🟢 LONG TERME (6-12 mois)

- [ ] **Programme affiliation grand public** (Tolt / Rewardful)
- [ ] **Marketplace white-label** : interface admin pour gérer des sous-tenants
- [ ] **SSO** (Google Workspace, Microsoft 365)
- [ ] **Mobile native iOS/Android** (au-delà de la PWA)
- [ ] **ISO 27001** ou SOC 2 (pour grands comptes)
- [ ] **Module IA avancé** : sales forecasting Prophet, route TSP OR-Tools
- [ ] **MDB integration** : protocole bus distributeurs pour suivi par produit
- [ ] **Multi-régions** : déploiement Europe / USA

---

## ⚠️ POINTS DE VIGILANCE / OUBLIS FRÉQUENTS

### Légal / Admin
- [ ] **Numéro de TVA intracommunautaire** dans les factures
- [ ] **Conditions générales de vente** validées par avocat
- [ ] **DPA (Data Processing Agreement)** signé avec sous-traitants (Stripe, Mistral, Hetzner)
- [ ] **Déclaration CNIL** : pas obligatoire mais conseillé
- [ ] **Assurance responsabilité civile professionnelle** (200-800€/an)

### Comptable
- [ ] **Logiciel de comptabilité** : Pennylane (49€/mois) ou Sellsy
- [ ] **Expert comptable** : 80-200€/mois selon volume
- [ ] **Calendrier TVA** : déclaration mensuelle ou trimestrielle
- [ ] **Mention de retenue** sur factures B2B export

### Opérationnel
- [ ] **Stock de kits ESP32** (5-10 d'avance pour livrer en <48h)
- [ ] **Process SAV hardware** : qui remplace un kit défectueux, comment ?
- [ ] **Numéro de téléphone pro** affiché sur le site (rassure les prospects B2B)
- [ ] **Adresse postale** (chez toi, ou domiciliation pro à 20€/mois)
- [ ] **Carte de visite** ou page LinkedIn entreprise propre

### Marketing
- [ ] **Référencement Google** : Search Console + Sitemap soumis
- [ ] **Google My Business** : si tu as une adresse locale
- [ ] **LinkedIn Page entreprise** : avec posts réguliers
- [ ] **Témoignages clients** : 3 cas concrets en vidéo (gratuit en échange du témoignage)

### Technique
- [ ] **Backup test mensuel** : restaurer le backup et vérifier que ça marche
- [ ] **Plan de reprise activité (PRA)** : que faire si le VPS Hetzner explose
- [ ] **Documentation interne** : runbooks ("comment debug si X arrive")
- [ ] **Veille sécurité** : abonnement CERT-FR + dépendances (Dependabot GitHub)

---

## 📚 Inventaire complet des fichiers

```
outputs/
├── demo-telemetrie.html           ← Démo v1 (standalone)
├── demo-pro.html                  ← Démo v2 dashboard pro
├── demo-pro-v3.html               ← Démo v3 avec IA + marketplace
├── demo-mobile-app.html           ← App mobile PWA
└── telemetry-app/                 ← Le projet complet
    ├── ROADMAP.md                 ← 🗺️ Plan de marche
    ├── CHECKLIST-FINALE.md        ← Ce fichier
    ├── QUICKSTART_MAC.md
    ├── README.md
    ├── docker-compose.yml
    ├── .gitignore
    ├── backend/
    │   ├── Dockerfile
    │   ├── package.json
    │   ├── .env.example
    │   └── src/
    │       ├── server.js
    │       ├── db.js
    │       ├── auth.js
    │       ├── mqtt.js
    │       ├── plans.js
    │       ├── stripeRoutes.js     ← Flux A
    │       ├── stripeConnect.js    ← Flux C (marketplace)
    │       └── aiRoutes.js         ← Chat IA Mistral
    ├── dashboard/
    │   ├── index.html
    │   └── app.js
    ├── web/
    │   ├── index.html              ← Landing marketing
    │   └── signup.html
    ├── firmware/
    │   ├── telemetry_esp32.ino
    │   └── config.h.example
    ├── simulator/
    │   ├── package.json
    │   └── simulate.js
    ├── ai-service/
    │   ├── predict.py              ← Maintenance prédictive
    │   ├── requirements.txt
    │   └── Dockerfile
    ├── pcb/
    │   ├── README.md
    │   ├── schematic.svg
    │   ├── BOM.csv
    │   └── brief-freelance.md
    ├── wiring-schemas/
    │   ├── 01-cafetiere-espresso.svg
    │   ├── 02-distributeur.svg
    │   ├── 03-frigo-haccp.svg
    │   └── 04-machine-industrielle.svg
    ├── infra/
    │   ├── Caddyfile               ← HTTPS auto
    │   ├── docker-compose.prod.yml ← Stack hardenée
    │   ├── fail2ban-telemetry.conf
    │   ├── setup-server.sh         ← Install VPS
    │   └── scripts/
    │       └── backup.sh           ← Backup chiffré
    ├── commercial-kit/
    │   ├── one-pager.md
    │   ├── pitch-deck.md
    │   └── emails-prospection.md
    ├── reseller-program/
    │   ├── README.md
    │   └── contrat-revendeur.md
    └── docs/
        ├── INSTALLATION.md
        ├── ESP32_SETUP.md
        ├── WIRING.md
        ├── ARCHITECTURE.md
        ├── INTEGRATION.md
        ├── STRIPE.md
        ├── PAIEMENTS-FR.md
        ├── SECURITE.md
        └── IA-COUTS.md
```

---

## 🎯 Si tu ne devais faire que 3 choses cette semaine

1. **Tester l'app en local** (suivre `QUICKSTART_MAC.md`) — 30 min, valider visuellement ce qui marche
2. **Créer la société + Stripe** (mode TEST d'abord) — 1-2 jours
3. **Prospecter 10 leads** avec les emails de `commercial-kit/emails-prospection.md` — 1 journée

À ce stade, tu n'as PAS besoin de coder. Tu as **besoin de prospects qui te disent oui ou non**. Le code livré ici suffira pour les 50 premiers clients.

---

**🚀 Bon lancement.**
