# 💳 Système de paiement complet — Marché français

Tu as **3 flux de paiement différents** à organiser. Ne pas les mélanger.

| Flux | Qui paie qui | Solution recommandée | Coût |
|------|--------------|----------------------|------|
| **A. Abonnement SaaS** | Tes clients → toi | **Stripe Billing** | 1,5% + 0,25€ |
| **B. Cashless sur machines** | Consommateurs → machines de tes clients | **Nayax VPOS** ou **SumUp** | 1,8% à 2,5% |
| **C. Marketplace (option pro)** | Consommateurs → toi → tes clients | **Stripe Connect** ou **Lemonway** | 1,5-2,8% + ta marge |

---

## 🅰️ FLUX A — Encaisser tes abonnements SaaS

C'est ce qu'on a déjà mis en place avec Stripe (voir `docs/STRIPE.md`). Tes clients paient 19€, 49€ ou 149€/mois en CB. Stripe te verse le montant sur ton compte bancaire pro tous les 7 jours.

**Démarches concrètes (1-2 jours)**

1. Crée ta société (auto-entrepreneur, SAS, ou EURL — éviter "particulier")
2. Ouvre un compte pro (Qonto, Shine, ou banque traditionnelle)
3. Inscris-toi sur Stripe (<https://dashboard.stripe.com/register>) avec ton SIREN
4. Vérification d'identité : pièce d'identité + RIB pro + statuts société (~24h)
5. Active "Live mode" → tu peux encaisser tes vrais clients

**Coût concret pour toi**
- Abonnement 49€ → Stripe prend 0,99€ → tu gardes **48,01€ nets**
- TVA collectée sur le client français : 20% (donc tu factures 58,80€ TTC pour 49€ HT)
- Pas d'abonnement Stripe, juste la commission par transaction

---

## 🅱️ FLUX B — Cashless sur les machines de tes clients

Les **consommateurs** veulent payer leur café/produit en CB sans contact ou téléphone. Tu n'es pas dans la boucle de l'argent — chaque client opérateur garde ses propres revenus, ton boulot c'est juste de **remonter les transactions** dans le dashboard.

### Option B1 — **Nayax VPOS** (le standard du marché)

Petit boîtier TPE qui s'installe à côté du paiement de la machine. Accepte CB sans contact, Apple Pay, Google Pay, Pluxee, Edenred.

- **Coût matériel** : ~250€ par unité (achat) ou loc 8-15€/mois
- **Commission Nayax** : ~3,5% sur les transactions
- **Délai mise en place** : 1 semaine
- **Avantage** : protocole MDB standard → ton ESP32 reçoit les ventes en temps réel via RS485

Tu intègres Nayax via leur API REST (déjà compatible avec notre architecture).

### Option B2 — **SumUp Solo** (le plus simple pour cafés)

TPE indépendant, ~30€ achat, commission 1,8% par transaction. Le commerçant peut le brancher sur sa caisse ou directement sur la machine.

- Pour cafés/snacks où le serveur encaisse manuellement
- API SumUp pour récupérer les transactions et les afficher dans ton dashboard
- Pas adapté aux distributeurs automatiques (besoin d'humain)

### Option B3 — **Stripe Terminal** (TPE pro pilotable)

TPE physique connecté Stripe (BBPOS WisePOS E ~250€ ou Verifone P400 ~250€). Idéal pour les machines pro où tu veux un encaissement intégré et un seul fournisseur.

- Commission Stripe : 1,5% sur CB UE
- Pilotable depuis ton dashboard via SDK
- Bonus : ton client utilise le même Stripe que pour son abonnement chez toi → 1 seule comptabilité

### Comparaison pratique

| Critère | Nayax VPOS | SumUp Solo | Stripe Terminal |
|---------|------------|-----------|-----------------|
| Type machine | Distributeurs auto | Cafés / snacks manuels | Tout |
| Mise en place | 1 sem (technique) | 5 min | 1 jour |
| Coût TPE | 250€ ou 12€/mois | 30€ | 250€ |
| Commission | 3,5% | 1,8% | 1,5% |
| Apple/Google Pay | ✅ | ✅ | ✅ |
| Ticket restau Pluxee/Edenred | ✅ | ❌ | Limité |
| Intégration dashboard | ✅ MDB | ✅ API | ✅ API |
| **Idéal pour** | Distri & gros volumes | TPE/PME simples | Mix flotte |

---

## 🅲 FLUX C — Mode marketplace (optionnel mais TRÈS rentable)

C'est là que ça devient sérieux. Au lieu de juste vendre l'abonnement, tu **encaisses les ventes pour le compte de tes clients** et tu prélèves une commission.

**Exemple concret :**
- Un client a 10 distributeurs avec ton système
- Les distributeurs génèrent 5 000€/mois en CB via Nayax/Stripe Terminal
- TU encaisses ces 5 000€ sur ton compte
- Tu prélèves ta commission (ex : 4%) → tu gardes 200€/mois
- Tu reverses 4 800€ au client (J+7 ou J+14 selon contrat)

**Sur 100 clients comme ça** = 5000€/mois de commission **en plus** de l'abonnement SaaS.

### ⚠️ ATTENTION RÉGLEMENTAIRE

Encaisser de l'argent **pour le compte d'autrui** en France nécessite :
- Soit l'**agrément établissement de paiement (PSP)** auprès de l'ACPR (Banque de France) — **18 mois et 350 000€ de capital minimum**
- Soit **passer par un PSP partenaire** qui te donne accès via API

→ **Conclusion : tu DOIS passer par un partenaire au début.**

### Solution recommandée : **Stripe Connect** (le plus simple)

Stripe Connect est conçu exactement pour ça (Uber, Airbnb, Deliveroo utilisent Connect).

**Comment ça marche :**
1. Tu actives Connect dans Stripe Dashboard
2. Pour chaque nouveau client opérateur, tu crées un "Connected Account" (sous-compte Stripe)
3. Chaque transaction CB sur ses machines est encaissée via TON Stripe, avec un split automatique :
   - X% → ton compte (commission)
   - 100-X% → compte du client (versé automatiquement sur SON RIB)
4. Stripe gère la TVA, la conformité, la lutte fraude, et te retire la commission de Stripe (~1,5%)

**Coût :** ~1,5% Stripe + 0,25€ + ta commission (libre, mais 3-5% typique).

**Délai mise en place :** 1 mois (création du compte Connect + revue Stripe pour valider ton business).

### Solution alternative : **Lemonway** (français, conçu pour marketplaces)

Lemonway est **un établissement de paiement français** (agréé ACPR), parfait pour marketplaces B2B.

- Idéal si tu veux du 100% français (RGPD-friendly pour les très gros clients)
- API très complète, plus simple que Connect pour les cas marketplace
- KYC plus stricte (vérification d'identité de chaque sous-marchand)
- Commission : 1,2% + 0,18€ + abonnement plateforme ~200€/mois
- Délai : 6-8 semaines (KYC + intégration)

### Alternative également française : **Mangopay**

Comparable à Lemonway, racheté par Advent International, focus marketplaces et fintechs. Tarification similaire. Bonne option si Lemonway te refuse.

---

## 🎯 Quelle stratégie adopter ?

### Phase 1 (mois 1-6) : démarrer simple
- **Flux A** : Stripe Billing pour tes abonnements (mise en place 1 jour)
- **Flux B** : tu recommandes à tes clients d'utiliser Nayax VPOS ou SumUp eux-mêmes, et tu remontes leurs ventes dans le dashboard
- → Tu génères du revenu **sans complexité réglementaire**, focus sur l'acquisition de clients

### Phase 2 (mois 7-18) : monter en gamme
- Quand tu as 30+ clients et que tu veux scaler, active **Stripe Connect**
- Propose à tes clients de "passer par toi" pour leurs encaissements (avantage : un seul outil, factures auto, comptabilité simplifiée)
- Tu prélèves 3-4% sur leurs ventes machines, en plus de l'abonnement
- → Marge supplémentaire significative

### Phase 3 (mois 18+) : devenir une fintech ?
- Si tu veux ta propre licence PSP (indépendance, marges max) : compter 350k€ capital + 18 mois ACPR
- Ou rester sur Stripe Connect / Lemonway, c'est très scalable

---

## 🔧 Code concret — Intégrer Stripe Connect

Quand tu seras en phase 2, voici à quoi ressemble l'intégration :

### Backend (ajout dans server.js)

```javascript
// Quand un nouveau client opérateur s'inscrit, crée son sous-compte
async function createConnectedAccount(orgId, email, country = 'FR') {
  const account = await stripe.accounts.create({
    type: 'express',           // mode "Express" = onboarding hosted par Stripe
    country, email,
    business_type: 'company',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Stocke account.id dans la table organizations
  stmts.updateOrgStripeAccount.run(account.id, orgId);

  // Génère le lien d'onboarding (KYC, RIB, statuts)
  const link = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${PUBLIC_URL}/app/connect/refresh`,
    return_url: `${PUBLIC_URL}/app/connect/done`,
    type: 'account_onboarding',
  });
  return link.url; // → on redirige le client vers Stripe pour son KYC
}

// Quand une vente est encaissée sur une machine, on crée un paiement avec split
async function chargeWithSplit(amount, connectedAccountId, commissionPct = 4) {
  const commission = Math.round(amount * commissionPct / 100); // en cents
  return await stripe.paymentIntents.create({
    amount,                       // ex: 250 = 2,50€
    currency: 'eur',
    payment_method_types: ['card'],
    application_fee_amount: commission,   // commission qui revient sur TON compte
    transfer_data: { destination: connectedAccountId }, // le reste va au client
  });
}
```

---

## 📋 Récapitulatif des démarches administratives

| Étape | Délai | Coût | Document à fournir |
|-------|-------|------|---------------------|
| Création société (SAS/EURL) | 1-2 sem | ~200€ | CNI, justif. domicile, statuts |
| Compte bancaire pro | 1-3 jours | 0-20€/mois | Kbis, statuts |
| Inscription Stripe | 24h | 0€ | Kbis, RIB, CNI dirigeant |
| Activation Stripe Connect | 1-3 sem | 0€ | Description business, ToS, URL |
| Conditions générales (CGU/CGV) | 1 jour | 0-500€ | Rédige avec un avocat ou template |
| Mentions légales site | 1h | 0€ | Sur le site web |
| DPO si > 1000 clients | — | 200€/mois si externalisé | Optionnel jusque-là |

---

## 💡 Conseil final

**Ne te prends pas la tête au début.** Phase 1 (Stripe Billing seulement) suffit pour valider ton marché et facturer tes 50 premiers clients. Tu activeras Connect quand le volume justifiera la complexité administrative.

Le plus important c'est de **commencer à facturer**, pas d'avoir l'architecture finale dès le jour 1.
