# 💳 Configuration de Stripe (paiement par abonnement)

Ce guide t'amène **étape par étape** de "je n'ai pas de compte Stripe" à "mes clients peuvent payer leur abonnement et je reçois l'argent sur mon compte bancaire".

---

## 1️⃣ Créer ton compte Stripe

1. Va sur <https://dashboard.stripe.com/register>
2. Crée un compte avec ton email pro
3. Tu démarres automatiquement en **mode TEST** (parfait pour développer sans risque)

> 💡 Tu peux tout tester avec la carte de test `4242 4242 4242 4242` — date future, CVC quelconque.

---

## 2️⃣ Créer tes produits et prix

Dans le Dashboard Stripe : **Produits → + Ajouter un produit**

Crée 3 produits :

### Produit 1 — Starter
- Nom : `Télémétrie Starter`
- Description : `Jusqu'à 5 machines`
- Tarification : **Récurrent**, **19,00 EUR / mois**
- Clique **Enregistrer le produit**
- **Copie le `Price ID`** qui commence par `price_...` (en haut à droite du produit)

### Produit 2 — Pro
- Nom : `Télémétrie Pro`
- Tarification : Récurrent, **49,00 EUR / mois**
- Copie le `Price ID`

### Produit 3 — Business
- Nom : `Télémétrie Business`
- Tarification : Récurrent, **149,00 EUR / mois**
- Copie le `Price ID`

> 💡 Tu peux modifier les prix/quotas plus tard. Pense aussi à proposer un cycle **annuel** avec remise (Stripe gère ça nativement).

---

## 3️⃣ Récupérer tes clés API

Dans le Dashboard Stripe : **Développeurs → Clés API**

- **Clé publique** (`pk_test_...`) — peut être visible publiquement
- **Clé secrète** (`sk_test_...`) — à GARDER SECRÈTE, ne jamais commit

---

## 4️⃣ Mettre les valeurs dans `.env`

Édite `backend/.env` :

```env
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx

STRIPE_PRICE_STARTER=price_xxxxxxxxxxxx_starter
STRIPE_PRICE_PRO=price_xxxxxxxxxxxx_pro
STRIPE_PRICE_BUSINESS=price_xxxxxxxxxxxx_business

# Sera rempli à l'étape suivante :
STRIPE_WEBHOOK_SECRET=whsec_...

# URL publique du site (importante pour les redirections Stripe)
PUBLIC_URL=http://localhost:3000   # en local
# PUBLIC_URL=https://teletest.fr   # en prod
```

Redémarre le backend (`docker compose restart` ou `npm start`). Tu dois voir :

```
[INFO] Stripe activé (TEST)
```

---

## 5️⃣ Configurer le webhook (CRITIQUE)

Le webhook permet à Stripe de **prévenir ton serveur** quand un paiement réussit, échoue, ou qu'un abonnement est résilié. Sans webhook, les abonnements ne se mettront pas à jour.

### Pour le développement local

Installe le **Stripe CLI** : <https://stripe.com/docs/stripe-cli>

```bash
# Login
stripe login

# Forward des webhooks vers ton serveur local
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Le CLI t'affiche un secret du type `whsec_xxxxxxxxxxxxxxxx` — **mets-le dans `.env`** comme `STRIPE_WEBHOOK_SECRET` et redémarre le backend.

Laisse `stripe listen` tourner dans un terminal pendant tes tests.

### Pour la production

Dans le Dashboard Stripe : **Développeurs → Webhooks → + Ajouter un endpoint**

- **URL de l'endpoint** : `https://teletest.fr/api/stripe/webhook` (HTTPS obligatoire)
- **Évènements à écouter** : sélectionne au minimum :
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- Clique **Ajouter un endpoint**
- Copie le **Signing secret** (`whsec_...`) et mets-le dans le `.env` prod

---

## 6️⃣ Activer le portail client (Customer Portal)

Dans le Dashboard Stripe : **Settings → Billing → Customer portal**

- Active le portail
- Choisis ce que les clients peuvent faire (changer de plan, annuler, voir les factures…)
- Personnalise (logo, couleurs) — totalement géré par Stripe
- Sauvegarde

Tes clients pourront alors gérer leur abonnement sans contact humain depuis le bouton 💳 dans leur dashboard.

---

## 7️⃣ Tester le parcours complet

1. Sur ton site, va sur `/signup.html`
2. Crée un compte
3. Clique sur **Choisir un plan** → choisis un plan
4. Tu es redirigé vers Stripe Checkout
5. Paie avec la carte de test `4242 4242 4242 4242`
6. Tu reviens sur le dashboard, le plan s'affiche
7. Va dans **Stripe Dashboard → Clients** — ton client est là avec son abonnement

Vérifie aussi que le webhook a bien tourné : `stripe listen` doit afficher les événements reçus.

---

## 8️⃣ Passer en mode LIVE (vraie production)

Quand tu es prêt à recevoir de vrais paiements :

1. Dans le Dashboard Stripe, **active ton compte** (vérification d'identité, RIB pour recevoir l'argent)
2. Passe le toggle **Test → Live** en haut à droite
3. Re-crée les mêmes produits/prix en mode Live (les Price IDs sont DIFFÉRENTS de ceux en test)
4. Récupère les clés `sk_live_...` et `pk_live_...`
5. Re-crée le webhook en pointant sur ton URL de production
6. Mets à jour `.env` en production

⚠️ **Ne mélange jamais clés test et live** — chaque mode a son propre univers de produits, clients, abonnements.

---

## 🧮 Combien Stripe te prend ?

- **Carte UE** : 1,5% + 0,25€ par transaction
- **Carte hors UE** : 2,5% + 0,25€
- **SEPA Direct Debit** (RIB) : 0,35€ flat (intéressant pour les abonnements moyennement gros)

Exemple : un abonnement Pro à 49€/mois te rapporte ~47,75€ nets après commission Stripe.

---

## 🆘 Dépannage

| Problème                                         | Solution                                                  |
|--------------------------------------------------|-----------------------------------------------------------|
| `Stripe non configuré` dans les logs             | Vérifie `STRIPE_SECRET_KEY` dans `.env` — la valeur ne doit PAS commencer par `sk_test_REMPLACE` |
| Webhook signature invalide                        | `STRIPE_WEBHOOK_SECRET` ne correspond pas au signing secret affiché par `stripe listen` |
| L'abonnement ne se met pas à jour après paiement | Le webhook ne reçoit pas les évènements — vérifie l'URL et que `stripe listen` tourne (en local) |
| `price ID not configured`                        | Mets bien le Price ID Stripe (pas le Product ID) dans `STRIPE_PRICE_*` |
| Erreur CORS en prod                               | Vérifie que `PUBLIC_URL` correspond à ton vrai domaine    |

---

## 📚 Ressources

- Documentation Stripe (excellente) : <https://stripe.com/docs>
- Test cards : <https://stripe.com/docs/testing>
- Tableau de bord : <https://dashboard.stripe.com>
