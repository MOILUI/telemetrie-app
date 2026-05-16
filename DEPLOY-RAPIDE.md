# 🚀 Déployer en ligne rapidement — 3 options

> Pour envoyer un lien à un ami qui puisse **voir** et **éventuellement créer un compte**.

---

## ⚡ Option A — Démos uniquement (5 minutes, gratuit)

**Ce que ton ami pourra faire :** voir les 7 démos visuelles + le site marketing.
**Ce qu'il NE pourra PAS faire :** créer un compte / se connecter (pas de backend).

### Méthode la plus rapide : **Netlify Drop**

1. Ouvre <https://app.netlify.com/drop> dans ton navigateur (pas besoin de compte)
2. Dans Finder Mac, ouvre le dossier `public-pack/` (que je viens de créer juste pour ça)
3. **Drag-drop le dossier entier** sur la zone Netlify Drop
4. En 30 secondes, tu reçois une URL du style `https://serene-cupcake-a1b2c3.netlify.app`
5. Copie/colle cette URL à ton ami

### Méthode alternative : **Cloudflare Pages**

Pareil mais hébergement français/européen (RGPD-friendly) :
1. Va sur <https://pages.cloudflare.com>
2. Crée un compte (gratuit, illimité de bande passante)
3. "Upload assets" → drag-drop le dossier `public-pack/`
4. Tu auras une URL du style `https://telemetrie-fr.pages.dev`

> 💡 Pour avoir un nom de domaine custom (`telemetrie-fr.com`), achète-le sur Cloudflare Registrar (~10€/an) et configure le DNS — 5 min de plus.

---

## 🔥 Option B — Backend complet pour que l'ami crée un compte (30 minutes, gratuit avec trial)

**Ce que ton ami pourra faire :** créer un compte, se connecter, voir le dashboard vide, payer en mode test Stripe.

### Méthode recommandée : **Railway.app**

Railway offre $5 de crédit gratuit (= 1-2 mois de hosting). Aucune CB demandée pour démarrer.

#### Étape 1 — Initialiser un dépôt Git local

```bash
cd ~/Library/Application\ Support/Claude/local-agent-mode-sessions/c4d80757-e53c-45eb-b93d-7c204ba6b2df/df55fadf-a439-4c8d-8d55-15cbefd7468c/local_f9b0bd5e-71ef-45d6-a856-85db6e4e664a/outputs/telemetry-app/

git init
git add .
git commit -m "Initial commit"
```

#### Étape 2 — Pousser sur GitHub (gratuit, privé)

1. Crée un repo privé sur <https://github.com/new> (nom : `telemetrie-app`)
2. Suis les instructions affichées (`git remote add origin ...` puis `git push`)

#### Étape 3 — Déployer sur Railway

1. Va sur <https://railway.app> → "Start a new project"
2. "Deploy from GitHub repo" → autorise → sélectionne `telemetrie-app`
3. Railway détecte Node.js, **crée le service backend**
4. Onglet "Variables" → ajoute ces variables d'environnement :

```env
HTTP_PORT=3000
MQTT_PORT=1883
JWT_SECRET=remplace-par-une-chaine-aleatoire-32-octets
ADMIN_EMAIL=salih@example.com
ADMIN_PASSWORD=ton-mot-de-passe
DEVICE_TOKEN=esp32-secret-token
STRIPE_SECRET_KEY=sk_test_XXXX
STRIPE_PUBLISHABLE_KEY=pk_test_XXXX
STRIPE_WEBHOOK_SECRET=whsec_XXXX
MISTRAL_API_KEY=ta-clé-mistral
PUBLIC_URL=https://ton-app.up.railway.app
```

5. Onglet "Settings" → "Networking" → "Generate Domain" → tu obtiens une URL HTTPS gratuite
6. Railway redémarre automatiquement, ton app est en ligne en <2 min

#### Étape 4 — Envoyer le lien à ton ami

Format du lien : `https://ton-app.up.railway.app/signup.html`

Ton ami :
1. Ouvre le lien
2. Clique "Démarrer l'essai gratuit"
3. Email + mot de passe + nom entreprise
4. Arrive sur son dashboard `https://ton-app.up.railway.app/app/`
5. Voit son token MQTT pour brancher un futur ESP32
6. Tout fonctionne en mode test Stripe (peut "souscrire" un plan avec CB 4242 4242 4242 4242)

### Alternative : **Render.com**

Similaire mais $7/mois (pas de trial). Plus simple si tu déteste Railway.

---

## 🏗️ Option C — Production sérieuse (1-2 heures, ~15€/mois)

**Pour quand tu auras tes premiers vrais clients payants.**

Suit le guide complet [`docs/HEBERGEMENT.md`](docs/HEBERGEMENT.md) qui explique :
- VPS Hetzner CCX13 (14€/mois)
- Domaine custom + DNS Cloudflare
- HTTPS auto avec Caddy
- Backups chiffrés GPG sur Backblaze
- Monitoring UptimeRobot
- Stripe mode LIVE

---

## ⚠️ Avant de déployer — checklist 5 min

| Item | Statut | Notes |
|---|---|---|
| ☐ `JWT_SECRET` est une **chaîne aléatoire de 32+ octets** (pas "change-me") | À faire | `openssl rand -hex 32` |
| ☐ `ADMIN_PASSWORD` n'est **pas** "changeme" | À faire | minimum 12 caractères |
| ☐ Compte Stripe créé (mode TEST OK pour démarrer) | À faire | https://stripe.com |
| ☐ Compte Mistral créé (clé API récupérée) | Optionnel | https://console.mistral.ai |
| ☐ Backend testé en local au moins une fois | À faire | suivre `QUICKSTART_MAC.md` |
| ☐ CGV/Mentions légales en ligne (même placeholder) | À faire | template gratuit Iubenda |

---

## 🚨 Limitation honnête à dire à ton ami

Quand ton ami testera la création de compte, **certaines fonctionnalités ne marcheront PAS encore** :

| Feature | État | Workaround pour la démo |
|---|---|---|
| ✅ Signup / Login | Fonctionne | — |
| ✅ Dashboard vide | Fonctionne | — |
| ⚠️ Voir une machine en temps réel | Nécessite un ESP32 flashé | Lance le simulateur (`simulator/simulate.js`) sur le serveur, ça créera 3 fausses machines |
| ⚠️ Email "bienvenue" automatique | **Pas encore codé** | Désactivé pour l'instant |
| ⚠️ "Mot de passe oublié" | **Pas encore codé** | Si l'ami oublie, tu le réinitialises manuellement en DB |
| ✅ Paiement Stripe mode TEST | Fonctionne | CB 4242 4242 4242 4242 |
| ⚠️ Chat IA | Marche si MISTRAL_API_KEY configurée | Sinon mode fallback |

→ Pour une **vraie démo prospect commercial**, il vaut mieux montrer les **démos HTML statiques** (Option A) qui sont impressionnantes et déjà parfaitement fonctionnelles visuellement.

---

## 🎯 Ma recommandation pour toi maintenant

**Maintenant tout de suite (5 min) :**
→ Option A — Netlify Drop avec le dossier `public-pack/` que je viens de créer.
→ Tu obtiens une URL en 30 secondes, tu l'envoies à ton ami, il voit le produit.

**Cette semaine (30 min) :**
→ Option B — Railway pour avoir un backend fonctionnel.
→ Ton ami peut créer un compte, tester signup/login, et voir le dashboard.

**Quand tu auras un 1er client payant (1-2h) :**
→ Option C — VPS Hetzner pour la prod sérieuse.

---

## 📦 Le pack public à déployer

J'ai préparé le dossier `public-pack/` à la racine du projet. Il contient :
- `index.html` → landing marketing (page d'accueil par défaut)
- `signup.html` → page inscription (pointera vers ton backend)
- `app/` → dashboard espace client
- `demos/` → les 7 démos visuelles
- `INDEX.html` → vue "centre de commande" (à supprimer si tu veux pas la montrer)

**Drag-drop ce dossier sur Netlify Drop → URL en 30 secondes.**
