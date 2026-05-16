# 🔥 Déployer sur Firebase — pas à pas

3 options. Choisis selon ce que tu veux.

| Option | Délai | Coût | Ce qui marche |
|---|---|---|---|
| **F1 — Hosting seul** | 5 min | Gratuit, sans CB | Démos visuelles uniquement (comme Netlify) |
| **F2 — Hosting + Cloud Run** ⭐ | 1h | Gratuit avec CB | **Backend complet → signup/login marchent** |
| **F3 — 100% Firebase natif** | 2-3 jours | Gratuit | Réécriture complète en Firebase Auth + Firestore |

> 💡 **Pour que ton ami crée un compte**, tu veux l'**option F2**.

---

# F1 — Firebase Hosting seul (démos uniquement)

**Pour quoi :** envoyer juste les démos visuelles à ton ami. Pas de signup possible.
**Durée :** 5 min · **Coût :** 0€ · **CB :** non requise

### Pré-requis

- Compte Google (Gmail suffit) → <https://firebase.google.com>
- Node.js installé sur ton Mac (pour la CLI Firebase)

### Étapes

```bash
# 1. Installe la CLI Firebase
npm install -g firebase-tools

# 2. Login (ouvre une page navigateur)
firebase login

# 3. Va dans le projet
cd ~/Library/Application\ Support/Claude/local-agent-mode-sessions/c4d80757-e53c-45eb-b93d-7c204ba6b2df/df55fadf-a439-4c8d-8d55-15cbefd7468c/local_f9b0bd5e-71ef-45d6-a856-85db6e4e664a/outputs/telemetry-app/

# 4. Crée un projet Firebase (ou utilise un existant)
firebase projects:create telemetrie-fr-demo --display-name "Télémétrie Demo"

# 5. Lie ce projet au dossier
firebase use telemetrie-fr-demo

# 6. Édite firebase.json pour servir uniquement les statiques
# (Modifie "rewrites" pour pointer vers un index ou supprime cette section)
# Pour F1, simplifie firebase.json comme suit :
cat > firebase.json <<EOF
{
  "hosting": {
    "public": "public-pack",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "cleanUrls": true
  }
}
EOF

# 7. Déploie
firebase deploy --only hosting
```

✅ Tu obtiens : `https://telemetrie-fr-demo.web.app`

Limites : pas de backend, signup affichera erreur réseau. Pour la vraie signup → suis F2.

---

# F2 — Firebase Hosting + Cloud Run (RECOMMANDÉ ⭐)

**Pour quoi :** ton ami peut créer un compte, se connecter, tester en vrai.
**Durée :** ~1h · **Coût :** Gratuit (tier généreux) · **CB :** requise pour activer Cloud Run

### Pré-requis

- [ ] Compte Google
- [ ] **Carte bancaire** (Google demande pour Cloud Run, mais ne facture pas dans le free tier)
- [ ] Node.js installé : `node --version`
- [ ] `gcloud` CLI installé → `brew install --cask google-cloud-sdk` (5 min)

### ÉTAPE 1 — Créer le projet Google Cloud (5 min)

1. Va sur <https://console.cloud.google.com/projectcreate>
2. **Project name** : `telemetrie-fr` (ou ce que tu veux)
3. **Project ID** : note-le bien (ex: `telemetrie-fr-123456`)
4. Clique **Create**
5. Sélectionne ton projet dans la barre du haut

### ÉTAPE 2 — Activer la facturation (CB) (3 min)

Cloud Run a un **free tier généreux** (2M requêtes/mois) mais GCP exige une CB pour activer.

1. Menu hamburger → **Billing** → **Manage billing accounts**
2. **Create account** → ajoute ta CB (tu peux mettre une CB virtuelle Revolut)
3. Lie ton projet à ce compte de facturation

⚠️ **Tu ne seras pas facturé** si tu restes dans le free tier (2M req/mois). Pour être tranquille, mets une **alerte de budget à 5€** :
- Billing → Budgets & alerts → Create budget → Amount $5

### ÉTAPE 3 — Activer les APIs (1 min)

```bash
gcloud auth login
gcloud config set project TON-PROJECT-ID

gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable firebasehosting.googleapis.com
```

### ÉTAPE 4 — Builder et déployer le backend sur Cloud Run (15 min)

```bash
cd ~/Library/Application\ Support/Claude/local-agent-mode-sessions/c4d80757-e53c-45eb-b93d-7c204ba6b2df/df55fadf-a439-4c8d-8d55-15cbefd7468c/local_f9b0bd5e-71ef-45d6-a856-85db6e4e664a/outputs/telemetry-app/

# Build l'image Docker via Cloud Build (5-8 min)
gcloud builds submit --tag gcr.io/TON-PROJECT-ID/telemetrie-backend

# Déploie sur Cloud Run (1-2 min)
gcloud run deploy telemetrie-backend \
  --image gcr.io/TON-PROJECT-ID/telemetrie-backend \
  --region europe-west1 \
  --platform managed \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --port 8080 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars NODE_ENV=production,JWT_SECRET=CHANGE_MOI_64_CHARS,ADMIN_EMAIL=toi@example.com,ADMIN_PASSWORD=ChangeMoi123,PUBLIC_URL=https://telemetrie-fr.web.app
```

Tu reçois une URL Cloud Run du style `https://telemetrie-backend-xxxxx-ew.a.run.app`.

**Test rapide :**
```bash
curl https://telemetrie-backend-xxxxx-ew.a.run.app/api/health
# → {"ok":true,"ts":1234567890}
```

### ÉTAPE 5 — Initialiser Firebase Hosting (5 min)

```bash
npm install -g firebase-tools
firebase login
firebase use --add TON-PROJECT-ID
```

→ Sélectionne ton projet, alias `default`.

### ÉTAPE 6 — Déployer le frontend statique (2 min)

Le fichier `firebase.json` est déjà préparé pour pointer `/api/*` vers Cloud Run.

```bash
firebase deploy --only hosting
```

✅ Tu reçois : `https://TON-PROJECT-ID.web.app`

### ÉTAPE 7 — Tester (5 min)

```
https://TON-PROJECT-ID.web.app/                  → landing
https://TON-PROJECT-ID.web.app/demos/             → démos visuelles
https://TON-PROJECT-ID.web.app/signup.html        → page inscription
https://TON-PROJECT-ID.web.app/api/health         → vérifie le backend
```

Crée un compte → tu dois être redirigé vers le dashboard `/app/`.

### ÉTAPE 8 — Domaine custom (optionnel, 10 min)

Si tu veux `telemetrie-fr.com` au lieu de `xxx.web.app` :
1. Achète le domaine sur Cloudflare Registrar (~10€/an)
2. Firebase Console → Hosting → Add custom domain
3. Suis les instructions DNS (TXT + A records)
4. Wait ~1h pour propagation

---

## F2 — Variables d'environnement importantes

À mettre dans la commande `gcloud run deploy --set-env-vars` ou via Cloud Console :

| Variable | Valeur | Obligatoire |
|---|---|---|
| `JWT_SECRET` | Chaîne aléatoire 64 caractères | ✅ |
| `ADMIN_EMAIL` | ton.email@gmail.com | ✅ |
| `ADMIN_PASSWORD` | Mot de passe fort | ✅ |
| `PUBLIC_URL` | https://TON-PROJECT.web.app | ✅ |
| `NODE_ENV` | production | ✅ |
| `STRIPE_SECRET_KEY` | sk_test_... | optionnel |
| `STRIPE_PUBLISHABLE_KEY` | pk_test_... | optionnel |
| `STRIPE_WEBHOOK_SECRET` | whsec_... | optionnel |
| `MISTRAL_API_KEY` | ... | optionnel |
| `DB_PATH` | /tmp/telemetry.db | déjà dans Dockerfile |

> 🔑 Pour générer JWT_SECRET : `openssl rand -hex 32`

⚠️ **Limitation Cloud Run gratuit** : le filesystem est **éphémère**. Si Cloud Run scale à 0 (pause après 15 min sans trafic), la base SQLite est perdue !

**Pour la démo de quelques jours avec ton ami :**
- Tu peux laisser ainsi, juste préviens-le que les données seront perdues si le service redémarre

**Pour une vraie prod :**
- Soit : migrer vers **Cloud SQL PostgreSQL** (5€/mois minimum)
- Soit : utiliser un volume persistent → pas dispo en Cloud Run, plutôt **Compute Engine** ou **GKE**
- Soit : passer sur **Railway** ou **Hetzner** où le filesystem persiste

---

## F2 — Update workflow (re-déployer après modif)

```bash
# Rebuild + redéploie en 1 commande
gcloud builds submit --tag gcr.io/TON-PROJECT-ID/telemetrie-backend \
&& gcloud run deploy telemetrie-backend \
   --image gcr.io/TON-PROJECT-ID/telemetrie-backend \
   --region europe-west1

# Pour le frontend uniquement
firebase deploy --only hosting
```

---

# F3 — 100% Firebase natif (Auth + Firestore + Functions)

**Pour quoi :** si tu veux vraiment du 100% Firebase, pas de Docker, pas de Node.js serveur custom.
**Durée :** 2-3 jours de réécriture · **Pour qui :** tu acceptes de réécrire 40% du backend.

### Ce qu'il faut migrer

| Actuel | → Firebase | Effort |
|---|---|---|
| JWT + bcrypt + table `users` | **Firebase Auth** (email/password, Google, Apple…) | -50% de code |
| SQLite tables | **Firestore** collections | Réécriture moyenne |
| Express routes | **Cloud Functions for Firebase** | Réécriture moyenne |
| Socket.io temps réel | **Firestore real-time listeners** | Réécriture importante |
| MQTT broker Aedes | **❌ NON DISPONIBLE** — il faut un MQTT externe (HiveMQ Cloud, EMQX Cloud) | Architecture |
| Stripe webhook | Cloud Functions HTTP trigger | OK direct |

### Ce que tu y gagnes

- ✅ Auth Google/Apple/Email "out of the box"
- ✅ Real-time data sync via Firestore (mieux que Socket.io)
- ✅ Scale automatique infini
- ✅ Mobile SDKs natifs iOS/Android (si tu fais une vraie app native un jour)
- ✅ Tier gratuit très généreux (50k reads/jour Firestore + 2M function calls)

### Ce que tu y perds

- ❌ Vendor lock-in Google
- ❌ Pas de MQTT TCP natif → broker externe (HiveMQ Cloud gratuit jusqu'à 100 connexions)
- ❌ Coût explose au-delà du free tier (Firestore facture par lecture/écriture)
- ❌ Skill à apprendre (NoSQL Firestore vs SQL)

### Si tu veux que je fasse F3

Dis-moi et je code la version Firebase Auth + Firestore. Compte ~3 jours.

---

## 🆘 Dépannage F2

### "Permission denied" sur gcloud

```bash
gcloud auth login   # Re-authentifie
```

### "Project not found"

```bash
gcloud config set project TON-VRAI-PROJECT-ID
gcloud projects list  # Pour voir tes projets
```

### Cloud Build échoue à compiler better-sqlite3

→ Le `Dockerfile` racine installe déjà `python3 make g++`. Vérifie qu'il est bien à la racine du projet.

### "Cloud Run failed" : "memory limit exceeded"

→ Augmente la mémoire :
```bash
gcloud run services update telemetrie-backend --memory 1Gi --region europe-west1
```

### Firebase hosting rewrite ne marche pas (404 sur /api/...)

→ Vérifie que ton service Cloud Run s'appelle bien `telemetrie-backend` :
```bash
gcloud run services list
```
→ Le `serviceId` dans `firebase.json` doit correspondre.

### "Cold start" lent (la 1ère requête prend 5-10 sec)

→ Normal sur Cloud Run quand min-instances=0. Pour fluidifier :
```bash
gcloud run services update telemetrie-backend --min-instances 1 --region europe-west1
```
⚠️ Mais ça consomme du free tier (5€/mois si tu laisses 1 instance toujours allumée).

---

## 💰 Coût réel sur Firebase + Cloud Run

### Free tier mensuel généreux

- **Cloud Run** : 2M req/mois, 360 000 GB-sec compute, 180 000 vCPU-sec
- **Firebase Hosting** : 10 GB stockage, 360 MB/jour bande passante
- **Cloud Build** : 120 min/jour gratuites

### Estimation pour ton démarrage (0-50 clients)

| Usage | Coût |
|---|---|
| Cloud Run (~50k req/mois) | **0€** (dans le free tier) |
| Firebase Hosting (~1 GB transfert/mois) | **0€** |
| Cloud Build (5 deploys/mois) | **0€** |
| Container Registry (~1 GB stockage) | **~0,02€** |
| **TOTAL réel** | **~0,02€/mois** |

À 100+ clients : compter **~5-15€/mois**.

> 💡 Tu peux **mettre une alerte de budget à 5€** dans GCP Billing pour ne pas avoir de surprise.

---

## 🎯 Recommandation finale

| Si tu veux... | Choisis... |
|---|---|
| Juste montrer les démos à ton ami | F1 (5 min) |
| **Signup/login fonctionnel pour ton ami** | **F2 (1h)** ⭐ |
| Vraie production scalable Firebase | F3 (2-3 jours) ou Hetzner (1h) |

---

## 📌 Note importante : Railway reste plus simple

Pour info :
- **Railway** = 25 min, $5 trial gratuit, **pas de CB requise au départ**, code Node.js intact
- **Firebase F2** = 1h, free tier généreux mais **CB requise**, plus complexe

Si tu veux le truc le plus rapide et sans CB → garde Railway (cf. `RAILWAY-STEP-BY-STEP.md`).
Si tu veux du **Google/Firebase** (préférence personnelle ou marque) → F2 ici.

À toi de choisir. Je suis là pour les 2.
