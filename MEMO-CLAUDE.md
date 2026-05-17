# 🧠 MEMO CLAUDE — À coller au début de CHAQUE nouvelle conversation

> Copie-colle ce fichier entier dans ton 1er message à chaque nouvelle conversation
> Claude. Ça économise 50-80% des tokens en évitant les re-explications.

---

## 👤 Qui je suis

- **Salih** — entrepreneur français, **revendeur SaaS** de télémétrie IoT
- Mon objectif : revendre une plateforme de **supervision de machines** (cafetières pro, distributeurs auto, frigos HACCP, machines industrielles) à des PME/restaurateurs en France
- Je ne code pas. Tu pilotes tout (code, git, déploiement, browser).
- Email : `proturbo69@gmail.com`
- GitHub user : `MOILUI`

## 🏗 Architecture du projet (DÉJÀ EN PLACE — pas à refaire)

**Stack technique :**
- Backend Node.js + Express + Socket.io + Aedes MQTT broker (sur `/sessions/.../telemetry-app/backend/`)
- Frontend HTML + Tailwind CDN + Chart.js + Leaflet
- BDD SQLite (better-sqlite3) — éphémère sur Railway (à migrer plus tard)
- Auth JWT + bcrypt (pas Firebase Auth)
- Paiement Stripe Billing (mode TEST configuré, pas LIVE)

**Multi-tenant DÉJÀ implémenté :**
- Table `organizations` : 1 par client revendeur
- Table `users` : N par org (rôle owner/admin/superadmin/viewer)
- Table `devices` : N par org, scope auto par `org_id` dans toutes les routes API
- Chaque ESP32 utilise le `device_token` UNIQUE de l'org pour publier en MQTT → isolation garantie

**3 niveaux d'accès :**
| URL | Rôle | Voit |
|---|---|---|
| `/app/` | client (owner/admin) | Ses machines uniquement |
| `/admin/` | superadmin (= MOI) | TOUS les clients, MRR, stats |
| `/` | public | Landing marketing |

## 🌐 Déploiement (DÉJÀ EN LIGNE)

- **Plateforme** : Railway (~5€/mois trial $5)
- **URL** : `https://web-production-ad600.up.railway.app`
- **GitHub repo** : `https://github.com/MOILUI/telemetrie-app` (PUBLIC)
- **Branche** : `main` (auto-deploy sur push)
- **Token GitHub** : ⚠️ révoqué après chaque session, demande-moi à chaque fois

**Credentials admin (à NE PAS rediscuter) :**
- Email : `proturbo69@gmail.com`
- Password : `TelemetriePro2026`
- JWT_SECRET : déjà configuré dans Railway env vars
- Token MQTT org admin : changera à chaque reset BDD (volatile)

## 📂 Structure du repo (DÉJÀ STRUCTURÉE)

```
telemetry-app/
├── backend/src/          # Code serveur Node.js
│   ├── server.js         # Routes API + sert frontend
│   ├── db.js             # Schéma SQLite multi-tenant
│   ├── auth.js           # JWT + bcrypt
│   ├── mqtt.js           # Broker Aedes embarqué
│   ├── plans.js          # 4 plans tarifaires
│   ├── stripeRoutes.js   # Stripe Billing
│   ├── stripeConnect.js  # Marketplace (optionnel)
│   └── aiRoutes.js       # Chat Mistral (pas activé)
├── web/                  # Landing marketing publique
│   ├── index.html        # Page d'accueil
│   └── signup.html       # Inscription
├── dashboard/            # Espace client /app/
│   └── index.html        # Dashboard simplifié réel (login + machines + stocks + tickets + tournées + alertes)
├── admin/                # Backoffice superadmin /admin/
│   └── index.html        # Stats globales + liste clients + actions
├── firmware/             # Code ESP32 + 4G
├── demos/                # Démos statiques internes (NE PAS exposer)
├── demos-public/         # SEULE démo exposée sur /demo/
└── docs/                 # 18 docs FR (ROADMAP, SECURITE, IA-COUTS, etc.)
```

## ✅ Ce qui MARCHE actuellement (NE PAS refaire)

- ✅ Landing marketing publique avec pricing
- ✅ Signup client (email + mdp + entreprise) — crée org + user trial 14j
- ✅ Login JWT
- ✅ Dashboard client `/app/` avec : Vue d'ensemble, Machines (ajout/suppr **fonctionnel**), Stock & emplacement (planogramme drag-drop localStorage), Tickets (localStorage), Tournées (génère URL Google Maps), Alertes, Mon compte (token MQTT visible)
- ✅ Backoffice admin `/admin/` avec : KPIs globaux (comptes, MRR, ARR, signups), liste clients, change plan, reset MDP, export CSV
- ✅ Multi-tenant strict côté API + MQTT
- ✅ HTTPS + HTTP/2 + Caddy auto via Railway

## ❌ Ce qui MANQUE ENCORE (à coder si demandé)

| Priorité | Manque | Impact |
|---|---|---|
| 🔴 Critique | "Mot de passe oublié" côté backend | bloquant à 3+ clients |
| 🔴 Critique | Emails transactionnels (Resend) : welcome, alerte critique, facture | bloquant pour pro |
| 🔴 Critique | TVA intracommunautaire sur factures Stripe | obligation légale |
| 🟠 Important | Tickets + planogrammes en BDD (pas localStorage) | sinon perdu si change PC |
| 🟠 Important | Admin drill-down : voir machines d'un client | gestion clients revendus |
| 🟡 NTH | Notifications SMS (Twilio) | pour alertes critiques |
| 🟡 NTH | Chat IA Mistral branché en prod | bonus |
| 🟡 NTH | Domaine custom `app.tondomaine.fr` | image pro |

## 🎯 Sa stratégie business (à comprendre)

- Vise des PME françaises avec machines pro (restos, gestionnaires distri, frigoristes)
- **Prix** : Starter 19€/mois (5 machines), Pro 49€ (20 machines), Business 149€ (100)
- **Hardware** : ESP32 + 4G LilyGO T-SIM7600E + capteurs = ~90€/machine
- **Cash flow** : abonnement remboursé en 10-14 mois sur le matos
- **Phase actuelle** : MVP en prod, **PAS encore de vrai client**, pas de hardware physique testé
- **Réalité** : pas faire de prospection grande échelle tant que pas validé sur 1 vraie machine en conditions réelles

## 📋 Comment me parler (pour économiser tokens)

**✅ BIEN — précis :**
- "Code mot de passe oublié + email reset Resend"
- "Ajoute dans /admin/ un bouton voir machines d'un client"
- "Change le prix Pro à 79€ dans plans.js"
- "Mon ami a une erreur 'X' sur /signup, débug"

**❌ MAL — vague :**
- "Améliore le truc"
- "Ajoute des features cool"
- "C'est bidon recommence"

**📋 Format de question idéal :**
```
Sur la page [X], quand je [action], j'aimerais [résultat].
Contexte : [pourquoi].
Contrainte : [budget temps / pas casser Y].
```

## 🚨 À NE PAS oublier dans NOS échanges

1. **Je suis REVENDEUR** → toujours penser multi-client (pas juste pour moi)
2. **Je ne code pas** → tu pilotes git, browser, terminal pour moi
3. **Je n'ai PAS encore de hardware testé** → ne pas pousser à la prospection
4. **Budget Railway** : $5 trial puis CB. Évite de cramer en builds inutiles.
5. **NE PAS proposer "tester sur ton Mac avec npm install"** → j'ai pas envie de jouer en Terminal
6. **NE PAS proposer Firebase 100% Auth/Firestore** → trop de réécriture, Railway suffit
7. **Quand tu modifies du code, push direct via API GitHub** — pas git push (je hais le terminal)

## 📞 Quand je te dis "branche"

- "branche l'IA" → ajoute appel Mistral dans /api/ai/chat
- "branche les emails" → intégrer Resend pour welcome/alert
- "branche un domaine" → guide me pour configurer DNS custom domain Railway

## 🆘 En cas de doute

1. Vérifie ce memo en premier
2. Pose UNE question claire au lieu d'inventer
3. Si je dis "fais comme tu veux" → choisis l'option **la plus simple qui marche**

---

**Date dernière mise à jour de ce memo :** 16 mai 2026

**Comment l'utiliser :** au début de chaque conversation Claude, tu colles ce fichier entier en disant *"Lis d'abord ce memo avant de répondre"*. Ça évite que je te re-explique chaque fois.
