# 📦 Pack public — prêt à déployer

Ce dossier contient **tout ce dont tu as besoin** pour héberger ton site en 5 minutes sur Netlify ou Cloudflare Pages.

## 📂 Contenu

- `index.html` → landing marketing (page d'accueil par défaut)
- `signup.html` → page inscription
- `app/` → dashboard espace client (login + supervision)
- `demos/` → 7 démos visuelles (admin v1/v2/v3/v4 + mobile + driver + consumer)
- `NAVIGATION.html` → centre de navigation interne (à supprimer si tu ne veux pas le montrer)

## 🚀 Déployer en 30 secondes

### Option 1 — Netlify Drop (le plus rapide)

1. Ouvre <https://app.netlify.com/drop>
2. Drag-drop ce dossier complet
3. URL reçue : `https://xxxxx.netlify.app`

### Option 2 — Cloudflare Pages

1. <https://pages.cloudflare.com> → crée un compte
2. "Upload assets" → drag-drop le dossier
3. URL reçue : `https://xxxxx.pages.dev`

### Option 3 — Vercel Drop

1. <https://vercel.com/new>
2. "Upload" → drag-drop

## ⚠️ Limites du déploiement statique seul

Avec **uniquement ce pack**, ton ami pourra :
- ✅ Voir la landing marketing
- ✅ Naviguer entre les 7 démos
- ❌ **NE POURRA PAS** créer un compte (pas de backend)
- ❌ **NE POURRA PAS** se connecter
- ❌ **NE POURRA PAS** voir le vrai dashboard avec ses données

Pour la **vraie inscription/connexion**, il faut déployer aussi le **backend Node.js**. Suit le guide `../DEPLOY-RAPIDE.md` option B (Railway, ~30 min).

## 🎯 Conseil

Si tu veux juste **impressionner ton ami avec le produit visuel**, le pack statique suffit largement. Les démos sont autonomes et tournent dans le navigateur (3 machines simulées par démo, animations, IA visuelle).

Pour qu'il **teste le parcours signup → login** comme un vrai client, il faut le backend en plus.
