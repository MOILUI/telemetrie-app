'use strict';

const express = require('express');
const { stmts } = require('./db');
const { PLANS, planFromStripePriceId } = require('./plans');

/**
 * Routes Stripe : Checkout, Customer Portal, Webhook.
 *
 * Mode dégradé : si STRIPE_SECRET_KEY n'est pas configurée, les routes
 * répondent en JSON expliquant qu'il faut configurer Stripe. L'app
 * continue de tourner pour le développement local.
 */
function makeStripeRoutes({ stripe, publicUrl, webhookSecret }) {
  const router = express.Router();
  const stripeEnabled = !!stripe;

  // ----- Création d'une session Checkout -----
  // (route protégée par requireAuth en amont)
  router.post('/checkout', async (req, res) => {
    if (!stripeEnabled) {
      return res.status(503).json({ error: 'Stripe non configuré' });
    }
    const { plan } = req.body || {};
    const planDef = PLANS[plan];
    if (!planDef || !planDef.stripe_price_env) {
      return res.status(400).json({ error: 'Plan inconnu' });
    }
    const priceId = process.env[planDef.stripe_price_env];
    if (!priceId || priceId.startsWith('price_REMPLACE')) {
      return res.status(500).json({ error: `Le price ID ${planDef.stripe_price_env} n'est pas configuré dans .env` });
    }

    const orgId = req.user.org_id;
    const org = stmts.getOrg.get(orgId);
    if (!org) return res.status(404).json({ error: 'Org introuvable' });

    // Récupère / crée le customer Stripe
    let customer = null;
    const sub = stmts.getSubscription.get(orgId);
    if (sub && sub.stripe_customer) {
      customer = sub.stripe_customer;
    } else {
      const c = await stripe.customers.create({
        email: req.user.email,
        name: org.name,
        metadata: { org_id: orgId },
      });
      customer = c.id;
      stmts.upsertSubscription.run({
        org_id: orgId,
        stripe_customer: customer,
        stripe_sub_id: null,
        status: 'pending',
        current_period_end: null,
        updated_at: Date.now(),
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${publicUrl}/app/?checkout=success`,
      cancel_url: `${publicUrl}/app/?checkout=cancel`,
      allow_promotion_codes: true,
      metadata: { org_id: orgId, plan: plan },
    });

    res.json({ url: session.url });
  });

  // ----- Customer portal (gérer l'abonnement, factures, CB) -----
  router.post('/portal', async (req, res) => {
    if (!stripeEnabled) return res.status(503).json({ error: 'Stripe non configuré' });
    const orgId = req.user.org_id;
    const sub = stmts.getSubscription.get(orgId);
    if (!sub || !sub.stripe_customer) {
      return res.status(400).json({ error: 'Aucun abonnement actif' });
    }
    const portal = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer,
      return_url: `${publicUrl}/app/`,
    });
    res.json({ url: portal.url });
  });

  // ----- Webhook Stripe -----
  // ATTENTION : pour ce endpoint il faut le raw body (pas le JSON parsé).
  // Le serveur monte ce middleware AVANT le express.json() (voir server.js).
  router.post('/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {
      if (!stripeEnabled) return res.status(503).send('Stripe non configuré');
      let event;
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          req.headers['stripe-signature'],
          webhookSecret
        );
      } catch (err) {
        console.error('Webhook signature invalide:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
      }

      try {
        await handleStripeEvent(stripe, event);
      } catch (err) {
        console.error('Erreur traitement webhook:', err);
        return res.status(500).send('Erreur interne');
      }
      res.json({ received: true });
    }
  );

  return router;
}

async function handleStripeEvent(stripe, event) {
  const data = event.data.object;
  switch (event.type) {

    case 'checkout.session.completed': {
      // Abonnement créé via Checkout
      const orgId = data.metadata && data.metadata.org_id;
      if (!orgId) break;
      const subId = data.subscription;
      if (!subId) break;
      const sub = await stripe.subscriptions.retrieve(subId);
      applySubscription(orgId, sub);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const customerId = data.customer;
      const org = stmts.getOrgByStripeCustomer.get(customerId);
      if (!org) break;
      applySubscription(org.id, data);
      break;
    }

    case 'customer.subscription.deleted': {
      const customerId = data.customer;
      const org = stmts.getOrgByStripeCustomer.get(customerId);
      if (!org) break;
      stmts.upsertSubscription.run({
        org_id: org.id,
        stripe_customer: customerId,
        stripe_sub_id: data.id,
        status: 'canceled',
        current_period_end: data.current_period_end ? data.current_period_end * 1000 : null,
        updated_at: Date.now(),
      });
      stmts.updateOrgPlan.run('canceled', 0, org.id);
      break;
    }

    case 'invoice.payment_failed': {
      const customerId = data.customer;
      const org = stmts.getOrgByStripeCustomer.get(customerId);
      if (!org) break;
      const sub = stmts.getSubscription.get(org.id) || {};
      stmts.upsertSubscription.run({
        org_id: org.id,
        stripe_customer: customerId,
        stripe_sub_id: sub.stripe_sub_id || null,
        status: 'past_due',
        current_period_end: sub.current_period_end || null,
        updated_at: Date.now(),
      });
      break;
    }

    default:
      // Ignoré
      break;
  }
}

function applySubscription(orgId, stripeSub) {
  const priceId = stripeSub.items && stripeSub.items.data && stripeSub.items.data[0]
    ? stripeSub.items.data[0].price.id : null;
  const plan = priceId ? planFromStripePriceId(priceId) : null;
  stmts.upsertSubscription.run({
    org_id: orgId,
    stripe_customer: stripeSub.customer,
    stripe_sub_id: stripeSub.id,
    status: stripeSub.status,
    current_period_end: stripeSub.current_period_end ? stripeSub.current_period_end * 1000 : null,
    updated_at: Date.now(),
  });
  if (plan && stripeSub.status === 'active') {
    stmts.updateOrgPlan.run(plan.id, plan.max_devices, orgId);
  }
}

module.exports = { makeStripeRoutes };
