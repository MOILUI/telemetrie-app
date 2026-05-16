'use strict';

/**
 * Stripe Connect — Marketplace.
 *
 * Permet à tes clients d'encaisser les ventes de leurs machines via TON Stripe
 * (split paiement : commission pour toi, reste pour eux).
 *
 * Mode "Express" : Stripe héberge l'onboarding KYC, on n'a qu'à rediriger.
 *
 * Schéma BDD : on stocke `stripe_account_id` dans la table organizations.
 * Migration nécessaire au premier démarrage :
 *   ALTER TABLE organizations ADD COLUMN stripe_account_id TEXT;
 *   ALTER TABLE organizations ADD COLUMN connect_status TEXT;  -- 'pending' / 'active' / 'restricted'
 *   ALTER TABLE organizations ADD COLUMN commission_pct REAL DEFAULT 4.0;
 *
 * Cette migration est exécutée à l'init si la colonne n'existe pas.
 */

const express = require('express');
const { db, stmts } = require('./db');

// Migration douce : ajoute les colonnes si absentes
function ensureSchema() {
  const cols = db.pragma("table_info(organizations)").map(c => c.name);
  if (!cols.includes('stripe_account_id')) {
    db.exec(`ALTER TABLE organizations ADD COLUMN stripe_account_id TEXT`);
  }
  if (!cols.includes('connect_status')) {
    db.exec(`ALTER TABLE organizations ADD COLUMN connect_status TEXT DEFAULT 'none'`);
  }
  if (!cols.includes('commission_pct')) {
    db.exec(`ALTER TABLE organizations ADD COLUMN commission_pct REAL DEFAULT 4.0`);
  }
}
ensureSchema();

const connectStmts = {
  setStripeAccount: db.prepare(`UPDATE organizations SET stripe_account_id = ?, connect_status = ? WHERE id = ?`),
  setCommission: db.prepare(`UPDATE organizations SET commission_pct = ? WHERE id = ?`),
  getOrgByStripeAccount: db.prepare(`SELECT * FROM organizations WHERE stripe_account_id = ?`),
};

function makeStripeConnectRoutes({ stripe, publicUrl }) {
  const router = express.Router();
  const enabled = !!stripe;

  // ----- Créer un compte connecté (mode Express) -----
  router.post('/account', async (req, res) => {
    if (!enabled) return res.status(503).json({ error: 'Stripe non configuré' });
    const org = stmts.getOrg.get(req.user.org_id);
    if (!org) return res.status(404).json({ error: 'Org introuvable' });

    let accountId = org.stripe_account_id;
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: req.body.country || 'FR',
        email: req.user.email,
        business_type: req.body.business_type || 'company',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: { org_id: org.id },
      });
      accountId = account.id;
      connectStmts.setStripeAccount.run(accountId, 'pending', org.id);
    }

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${publicUrl}/app/?connect=refresh`,
      return_url: `${publicUrl}/app/?connect=done`,
      type: 'account_onboarding',
    });
    res.json({ account_id: accountId, onboarding_url: link.url });
  });

  // ----- Récupérer l'état du compte connecté -----
  router.get('/account', async (req, res) => {
    if (!enabled) return res.status(503).json({ error: 'Stripe non configuré' });
    const org = stmts.getOrg.get(req.user.org_id);
    if (!org || !org.stripe_account_id) {
      return res.json({ exists: false });
    }
    const account = await stripe.accounts.retrieve(org.stripe_account_id);
    res.json({
      exists: true,
      id: account.id,
      charges_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      details_submitted: account.details_submitted,
      requirements: account.requirements,
      commission_pct: org.commission_pct,
    });
  });

  // ----- Login link (pour aller dans le dashboard Stripe du client) -----
  router.post('/login-link', async (req, res) => {
    if (!enabled) return res.status(503).json({ error: 'Stripe non configuré' });
    const org = stmts.getOrg.get(req.user.org_id);
    if (!org || !org.stripe_account_id) return res.status(400).json({ error: 'Pas de compte connecté' });
    const link = await stripe.accounts.createLoginLink(org.stripe_account_id);
    res.json({ url: link.url });
  });

  // ----- Créer un paiement avec split commission -----
  // Utilisé par tes machines / TPE pour encaisser au nom du client
  router.post('/charge', async (req, res) => {
    if (!enabled) return res.status(503).json({ error: 'Stripe non configuré' });
    const { amount_cents, device_id, payment_method_id, currency } = req.body || {};
    if (!amount_cents || amount_cents < 50) return res.status(400).json({ error: 'amount_cents invalide' });
    const org = stmts.getOrg.get(req.user.org_id);
    if (!org || !org.stripe_account_id) return res.status(400).json({ error: 'Pas de compte connecté actif' });

    const commission = Math.round(amount_cents * (org.commission_pct || 4) / 100);

    const pi = await stripe.paymentIntents.create({
      amount: amount_cents,
      currency: currency || 'eur',
      payment_method: payment_method_id,
      confirm: !!payment_method_id,
      application_fee_amount: commission,
      transfer_data: { destination: org.stripe_account_id },
      metadata: { org_id: org.id, device_id: device_id || '' },
    });
    res.json({ payment_intent_id: pi.id, client_secret: pi.client_secret, status: pi.status, commission_cents: commission });
  });

  // ----- Configurer la commission (admin) -----
  router.put('/commission', (req, res) => {
    if (req.user.role !== 'superadmin') return res.status(403).json({ error: 'Réservé superadmin' });
    const { org_id, commission_pct } = req.body || {};
    if (!org_id || commission_pct == null) return res.status(400).json({ error: 'Paramètres manquants' });
    if (commission_pct < 0 || commission_pct > 50) return res.status(400).json({ error: 'Commission entre 0 et 50%' });
    connectStmts.setCommission.run(commission_pct, org_id);
    res.json({ ok: true });
  });

  return router;
}

// =========================================================
// Webhook handler additionnel pour Connect
// À appeler depuis le webhook général (stripeRoutes.js)
// =========================================================
async function handleConnectEvent(event) {
  const data = event.data.object;
  if (event.type === 'account.updated') {
    const accountId = data.id;
    const org = connectStmts.getOrgByStripeAccount.get(accountId);
    if (!org) return;
    let status = 'pending';
    if (data.charges_enabled && data.payouts_enabled) status = 'active';
    else if (data.requirements && data.requirements.disabled_reason) status = 'restricted';
    connectStmts.setStripeAccount.run(accountId, status, org.id);
  }
}

module.exports = { makeStripeConnectRoutes, handleConnectEvent };
