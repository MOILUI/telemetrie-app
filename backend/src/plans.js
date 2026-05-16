'use strict';

/**
 * Définition des plans d'abonnement.
 * Modifie librement les libellés, prix et quotas — la source de vérité
 * pour les prix est dans Stripe (price IDs dans .env). Ce fichier sert
 * surtout à l'UI et aux quotas côté backend.
 */
const PLANS = {
  trial: {
    id: 'trial',
    name: 'Essai gratuit',
    price_month_eur: 0,
    max_devices: 3,
    duration_days: 14,
    features: [
      'Jusqu\'à 3 machines',
      '14 jours d\'essai gratuit',
      'Dashboard temps réel',
      'Alertes',
    ],
  },
  starter: {
    id: 'starter',
    name: 'Starter',
    price_month_eur: 19,
    max_devices: 5,
    stripe_price_env: 'STRIPE_PRICE_STARTER',
    features: [
      'Jusqu\'à 5 machines',
      'Historique 30 jours',
      'Alertes email',
      'Support email',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    price_month_eur: 49,
    max_devices: 20,
    popular: true,
    stripe_price_env: 'STRIPE_PRICE_PRO',
    features: [
      'Jusqu\'à 20 machines',
      'Historique 1 an',
      'Alertes email + SMS',
      'Multi-utilisateurs',
      'API access',
      'Support prioritaire',
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    price_month_eur: 149,
    max_devices: 100,
    stripe_price_env: 'STRIPE_PRICE_BUSINESS',
    features: [
      'Jusqu\'à 100 machines',
      'Historique illimité',
      'Alertes email + SMS + Slack',
      'Multi-utilisateurs avec rôles',
      'API + webhooks',
      'Support dédié',
      'SLA 99.9%',
    ],
  },
};

function planById(id) {
  return PLANS[id] || PLANS.trial;
}

function planFromStripePriceId(stripePriceId) {
  for (const plan of Object.values(PLANS)) {
    if (!plan.stripe_price_env) continue;
    if (process.env[plan.stripe_price_env] === stripePriceId) return plan;
  }
  return null;
}

module.exports = { PLANS, planById, planFromStripePriceId };
