# 🚂 Déployer sur Railway — pas à pas

**Objectif :** avoir une URL `https://ton-app.up.railway.app` où ton ami peut créer un compte et se connecter.
**Durée :** ~25 minutes
**Coût :** 0€ (trial $5 gratuit ≈ 1-2 mois de hosting)

---

## 📋 Pré-requis (5 min)

- [ ] Un compte **GitHub** (gratuit) → <https://github.com/signup>
- [ ] Un compte **Railway** (gratuit, $5 trial) → <https://railway.app/login>
- [ ] **Git installé** sur ton Mac → vérifier avec `git --version` dans Terminal
   - Si pas installé : `xcode-select --install` (5 min)

---

## ÉTAPE 1 — Pousser le projet sur GitHub (10 min)

### 1.1 Créer un dépôt privé sur GitHub

1. Va sur <https://github.com/new>
2. **Repository name** : `telemetrie-app`
3. **Visibility** : ✓ **Private** (important — ton code contient des secrets potentiels)
4. Ne coche RIEN d'autre (pas de README, pas de .gitignore — déjà dans le projet)
5. Clique **Create repository**
6. GitHub t'affiche une page avec des commandes — **garde l'onglet ouvert**

### 1.2 Pousser ton projet

Ouvre **Terminal** sur Mac et copie-colle ces commandes une par une :

```bash
cd ~/Library/Application\ Support/Claude/local-agent-mode-sessions/c4d80757-e53c-45eb-b93d-7c204ba6b2df/df55fadf-a439-4c8d-8d55-15cbefd7468c/local_f9b0bd5e-71ef-45d6-a856-85db6e4e664a/outputs/telemetry-app
```

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
```

Maintenant, regarde sur GitHub ce qu'ils te disent à propos de `git remote add origin ...` et copie-colle leur ligne. Ça ressemble à :

```bash
git remote add origin https://github.com/TON-USERNAME/telemetrie-app.git
git push -u origin main
```

À la 1ère fois, GitHub te demandera ton **token personnel** comme mot de passe. Si tu n'en as pas :

1. Va sur <https://github.com/settings/tokens>
2. **Generate new token (classic)**
3. Note: `telemetrie-app`, expire 90 days, coche **repo**
4. Génère et **copie le token** (commence par `ghp_...`)
5. Utilise-le comme mot de passe quand `git push` demande

✅ Si tout marche, tu vois ton code sur GitHub.

---

## ÉTAPE 2 — Connecter Railway à GitHub (3 min)

1. Va sur <https://railway.app/new>
2. Clique **Deploy from GitHub repo**
3. **Configure GitHub App** → autorise Railway à accéder à `telemetrie-app`
4. Sélectionne ton repo **telemetrie-app**
5. Railway commence à builder automatiquement (1-2 min)

⏳ Pendant le build, passe à l'étape suivante.

---

## ÉTAPE 3 — Configurer les variables d'environnement (5 min)

Dans Railway, clique sur ton service → onglet **Variables**.

### 3.1 Variables OBLIGATOIRES

Clique **+ New Variable** pour chacune :

```
JWT_SECRET                = (clique "Generate" sur Railway, ou copie une chaîne aléatoire 64 chars)
ADMIN_EMAIL               = ton.email@gmail.com
ADMIN_PASSWORD            = ChoisisUnMotDePasseFort123
NODE_ENV                  = production
```

> 💡 Pour générer un JWT_SECRET aléatoire dans Terminal : `openssl rand -hex 32`

### 3.2 Variables OPTIONNELLES (à configurer si tu veux activer Stripe et IA)

```
STRIPE_PUBLISHABLE_KEY    = pk_test_XXXXX        (depuis dashboard.stripe.com en mode TEST)
STRIPE_SECRET_KEY         = sk_test_XXXXX
STRIPE_PRICE_STARTER      = price_XXXXX          (créer 3 produits dans Stripe Dashboard)
STRIPE_PRICE_PRO          = price_XXXXX
STRIPE_PRICE_BUSINESS     = price_XXXXX

MISTRAL_API_KEY           = XXX                  (depuis console.mistral.ai)
```

> ⚠️ Sans Stripe, le bouton "Choisir un plan" affichera une erreur. Sans Mistral, le chat IA tombera en mode "fallback".
> Pour la démo signup/login **basique**, ces variables ne sont pas requises.

### 3.3 Variable importante après le déploiement

Une fois ton app déployée (étape suivante), reviens ici et ajoute :

```
PUBLIC_URL = https://ton-app.up.railway.app  (l'URL que Railway te donne)
```

---

## ÉTAPE 4 — Générer une URL publique (1 min)

1. Toujours dans Railway, clique sur ton service → onglet **Settings**
2. Section **Networking** → **Generate Domain**
3. Tu obtiens une URL du style `telemetrie-app-production.up.railway.app`
4. **Copie cette URL**
5. Reviens dans **Variables** → ajoute `PUBLIC_URL = https://ton-url.up.railway.app`
6. Railway redémarre automatiquement (~1 min)

---

## ÉTAPE 5 — Tester (2 min)

### 5.1 Vérifier que le serveur tourne

Dans ton navigateur, ouvre `https://ton-url.up.railway.app/api/health`

Tu dois voir : `{"ok":true,"ts":1234567890}`

✅ Si tu vois ça, le backend tourne. 🎉

❌ Si erreur : va dans Railway → onglet **Deployments** → clique sur le déploiement → onglet **Logs** → cherche le message d'erreur.

### 5.2 Tester la landing

Ouvre `https://ton-url.up.railway.app/`

Tu vois ta landing marketing. ✅

### 5.3 Tester signup

Ouvre `https://ton-url.up.railway.app/signup.html`

Crée un compte :
- Email : un email valide
- Mot de passe : 8+ caractères
- Entreprise : ce que tu veux

Tu dois être redirigé vers le dashboard `/app/` avec ton compte connecté.

### 5.4 Tester login

Déconnecte-toi (bouton en haut à droite du dashboard).
Reconnecte-toi avec les mêmes identifiants.

✅ Si tout marche, **c'est en ligne !**

---

## ÉTAPE 6 — Envoyer le lien à ton ami (30 sec)

Copie cette URL et envoie-la à ton ami :

```
https://ton-url.up.railway.app/signup.html
```

Message-type à lui envoyer :

```
Salut !

Voilà mon projet de télémétrie IoT pour machines :
https://ton-url.up.railway.app

Tu peux :
1. Voir la landing (page d'accueil)
2. Regarder les démos (ajoute /demos/05-dashboard-pro-v4.html à l'URL)
3. Créer un compte (essai gratuit 14 jours)
4. Te connecter et voir le dashboard

⚠️ Limites actuelles : pas encore de vraies machines connectées,
le dashboard sera vide à l'inscription. C'est normal.

Dis-moi :
- Est-ce que c'est clair ce que ça fait ?
- Tu paierais combien par mois pour ça ?
- Tu connais qui qui aurait besoin de ça ?

Merci ! 🙏
```

---

## 🐛 Dépannage

### "Build failed" sur Railway

→ Va dans **Deployments** → clique le déploiement → **Build logs**. Cherche l'erreur.
Erreur fréquente : `better-sqlite3` qui veut python3. Le `nixpacks.toml` inclus dans le projet règle ça.

### "Application crashed" / "Cannot find module"

→ Va dans **Deploy logs**. Si l'erreur est `Cannot find module 'X'`, c'est qu'une dep n'est pas dans `backend/package.json`. Dis-le moi je corrige.

### "JWT_SECRET is required"

→ Tu n'as pas ajouté `JWT_SECRET` dans les variables. Retourne étape 3.1.

### Signup échoue avec "internal server error"

→ Regarde les **Deploy logs** en temps réel pendant que tu fais signup. Le vrai message d'erreur sera affiché.

### Mot de passe oublié

→ Pas encore codé côté backend. Pour la démo, dis à ton ami "écris-moi je te reset". OU connecte-toi à Railway, va sur l'onglet **Data** → table `users`, supprime la ligne et il pourra refaire signup.

### Stripe checkout ne marche pas

→ Vérifie que `STRIPE_*` sont bien configurés et que tu utilises Stripe **en mode TEST** (clés commençant par `pk_test_` et `sk_test_`).

---

## 💰 Surveillance du coût

Le trial Railway = $5 de crédit. Ton app consomme ~$5/mois quand elle tourne 24/7.

Dans Railway → **Project Settings** → **Usage** → tu vois ton crédit restant en temps réel.

**Quand tu auras épuisé le trial**, tu choisis :
- Payer $5/mois (carte bancaire requise)
- Migrer sur **Hetzner CCX13** (14€/mois mais plus puissant) → suivre `docs/HEBERGEMENT.md`
- Mettre le service en pause (Railway → Settings → Pause)

---

## 🎯 Et après ?

Une fois que ton ami a testé et te donne du feedback :

1. **Si le feedback est positif** → continue avec un VPS Hetzner pour la prod, suis `docs/HEBERGEMENT.md`
2. **Si le feedback est mitigé** → itère le produit en local d'abord, redéploie quand prêt
3. **Si tu veux pivoter** → mets en pause Railway, tu garderas tout pour plus tard

---

## 📚 Ressources

- Docs Railway : <https://docs.railway.app>
- Status Railway : <https://status.railway.app>
- Support Railway : <https://help.railway.app>
- Discord Railway : <https://discord.gg/railway>

Tu es bloqué ? Dis-moi exactement à quelle étape, je débugue avec toi.
