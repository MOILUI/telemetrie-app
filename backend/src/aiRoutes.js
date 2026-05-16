'use strict';

/**
 * Chat assistant IA (Mistral) avec function calling.
 *
 * L'utilisateur pose une question en français → le LLM identifie quelle
 * fonction backend appeler, on exécute, le LLM formule la réponse.
 *
 * Fail-safe : si Mistral est down, on tombe sur un mode "réponse template"
 * via patterns regex (utilisateur ne voit pas la différence pour 80% des cas).
 */

const express = require('express');
const { stmts } = require('./db');

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'list_devices',
      description: "Liste toutes les machines de l'organisation avec leur état actuel",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'top_machines_by_revenue',
      description: "Top N machines triées par revenus sur les X derniers jours",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'integer', description: 'Nombre de machines (défaut 5)' },
          days: { type: 'integer', description: 'Fenêtre en jours (défaut 7)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'active_alerts',
      description: "Alertes ouvertes (non acquittées) avec optionnellement un filtre de gravité",
      parameters: {
        type: 'object',
        properties: { level: { type: 'string', enum: ['error', 'warn', 'info'] } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'low_stock_machines',
      description: "Machines dont le stock est inférieur à un seuil (défaut 30%)",
      parameters: {
        type: 'object',
        properties: { threshold: { type: 'integer', description: 'Seuil en %' } },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'device_telemetry_summary',
      description: "Résumé de la télémétrie d'une machine sur une période",
      parameters: {
        type: 'object',
        properties: {
          device_id: { type: 'string', description: 'Identifiant de la machine' },
          hours: { type: 'integer', description: 'Période en heures (défaut 24)' },
        },
        required: ['device_id'],
      },
    },
  },
];

// =========================================================
// Implémentations des fonctions (scope par org_id)
// =========================================================
const handlers = {
  list_devices({ orgId }) {
    return stmts.listDevicesForOrg.all(orgId).map(d => ({
      id: d.id, name: d.name, type: d.machine_type,
      location: d.location, status: d.status, last_seen: d.last_seen,
    }));
  },
  top_machines_by_revenue({ orgId, args }) {
    const limit = Math.min(args.limit || 5, 20);
    const since = Date.now() - (args.days || 7) * 86400000;
    // NB: simplifié — la "revenue" est extraite du JSON payload (champ rev24 ou ventes_jour * prix)
    const devices = stmts.listDevicesForOrg.all(orgId);
    const ranked = devices.map(d => {
      const points = stmts.telemetrySince.all(d.id, since);
      let total = 0;
      for (const p of points) {
        try {
          const obj = JSON.parse(p.payload);
          total += (obj.revenus_eur || obj.rev24 || (obj.ventes_jour || 0) * 2.5 || 0);
        } catch (_) {}
      }
      return { id: d.id, name: d.name, revenue_eur: +total.toFixed(2) };
    }).sort((a, b) => b.revenue_eur - a.revenue_eur).slice(0, limit);
    return ranked;
  },
  active_alerts({ orgId, args }) {
    const list = stmts.unackedEventsForOrg.all(orgId, 50);
    return args.level ? list.filter(e => e.level === args.level) : list;
  },
  low_stock_machines({ orgId, args }) {
    const threshold = args.threshold || 30;
    const devices = stmts.listDevicesForOrg.all(orgId);
    const result = [];
    for (const d of devices) {
      const last = stmts.recentTelemetry.all(d.id, 1)[0];
      if (!last) continue;
      try {
        const obj = JSON.parse(last.payload);
        const stock = obj.stock_pct || obj.stock || null;
        if (stock != null && stock <= threshold) {
          result.push({ id: d.id, name: d.name, location: d.location, stock_pct: stock });
        }
      } catch (_) {}
    }
    return result.sort((a, b) => a.stock_pct - b.stock_pct);
  },
  device_telemetry_summary({ orgId, args }) {
    const d = stmts.getDeviceForOrg.get(args.device_id, orgId);
    if (!d) return { error: 'Device introuvable' };
    const since = Date.now() - (args.hours || 24) * 3600000;
    const points = stmts.telemetrySince.all(args.device_id, since);
    if (points.length === 0) return { device_id: args.device_id, points: 0, message: 'Pas de données' };
    const sample = JSON.parse(points[points.length - 1].payload);
    const numericKeys = Object.keys(sample).filter(k => typeof sample[k] === 'number' && k !== 'ts');
    const summary = { device_id: args.device_id, name: d.name, points_count: points.length, hours: args.hours || 24, metrics: {} };
    for (const k of numericKeys) {
      const vals = points.map(p => { try { return JSON.parse(p.payload)[k]; } catch (_) { return null; } }).filter(v => v != null);
      if (!vals.length) continue;
      const min = Math.min(...vals), max = Math.max(...vals);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      summary.metrics[k] = { min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2), last: vals[vals.length - 1] };
    }
    return summary;
  },
};

// =========================================================
// Appel Mistral avec function calling
// =========================================================
async function callMistral({ apiKey, model, messages, tools, retries = 1 }) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, tools, tool_choice: 'auto', temperature: 0.2 }),
      });
      if (!r.ok) throw new Error(`Mistral HTTP ${r.status}`);
      return await r.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(res => setTimeout(res, 500 * (attempt + 1)));
    }
  }
}

// =========================================================
// Mode dégradé (templates) — utilisé si Mistral indisponible
// =========================================================
function fallbackResponse(question, orgId) {
  const q = question.toLowerCase();
  if (q.includes('alerte') || q.includes('alert') || q.includes('probleme')) {
    const alerts = handlers.active_alerts({ orgId, args: {} });
    if (alerts.length === 0) return 'Aucune alerte ouverte 🎉';
    return `Vous avez ${alerts.length} alerte(s) ouverte(s) :\n` + alerts.slice(0, 5).map(a => `• ${a.device_name} — ${a.message}`).join('\n');
  }
  if (q.includes('top') || q.includes('meilleur') || q.includes('rentable')) {
    const top = handlers.top_machines_by_revenue({ orgId, args: { limit: 3 } });
    return 'Top 3 machines par revenus (7j) :\n' + top.map((m, i) => `${i+1}. ${m.name} — ${m.revenue_eur}€`).join('\n');
  }
  if (q.includes('stock') || q.includes('vide')) {
    const low = handlers.low_stock_machines({ orgId, args: {} });
    if (low.length === 0) return 'Tous tes stocks sont OK (>30%) 👍';
    return `${low.length} machine(s) à réapprovisionner :\n` + low.slice(0, 5).map(m => `• ${m.name} (${m.location}) — ${m.stock_pct}%`).join('\n');
  }
  if (q.includes('combien') && q.includes('machine')) {
    const list = handlers.list_devices({ orgId });
    const online = list.filter(d => d.status === 'online').length;
    return `Tu as ${list.length} machine(s), dont ${online} en ligne.`;
  }
  return "Je n'ai pas compris ta question. Essaie : « combien de machines ? », « alertes ouvertes ? », « top machines ? », « stock bas ? ».";
}

// =========================================================
// Routes Express
// =========================================================
function makeAIRoutes({ requireAuth }) {
  const router = express.Router();
  const apiKey = process.env.MISTRAL_API_KEY || '';
  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  const enabled = !!apiKey && !apiKey.startsWith('REMPLACE');

  router.post('/chat', requireAuth, async (req, res) => {
    const { question, history } = req.body || {};
    if (!question) return res.status(400).json({ error: 'question requise' });
    const orgId = req.user.org_id;

    // Mode dégradé si Mistral désactivé
    if (!enabled) {
      return res.json({ answer: fallbackResponse(question, orgId), source: 'fallback' });
    }

    try {
      // 1er appel : laisser Mistral décider quelle(s) fonction(s) appeler
      const sysPrompt = `Tu es un assistant de télémétrie qui aide ${req.user.email} à piloter ses machines connectées (cafetières, distributeurs, frigos pro, équipements industriels). Tu réponds en français, de façon concise et factuelle, en t'appuyant sur les données réelles via les outils. Si tu n'as pas l'info, dis-le. Aujourd'hui : ${new Date().toLocaleDateString('fr-FR')}.`;
      const messages = [
        { role: 'system', content: sysPrompt },
        ...((history || []).slice(-6)),
        { role: 'user', content: question },
      ];

      let response = await callMistral({ apiKey, model, messages, tools: TOOLS });
      let msg = response.choices[0].message;
      messages.push(msg);

      // 2e tour : exécuter les tool calls éventuels puis demander la réponse finale
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const call of msg.tool_calls) {
          const name = call.function.name;
          const args = JSON.parse(call.function.arguments || '{}');
          const handler = handlers[name];
          let result;
          try {
            result = handler ? handler({ orgId, args }) : { error: 'unknown function' };
          } catch (e) {
            result = { error: e.message };
          }
          messages.push({
            role: 'tool',
            name,
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        response = await callMistral({ apiKey, model, messages, tools: TOOLS });
        msg = response.choices[0].message;
      }

      res.json({ answer: msg.content || '(réponse vide)', source: 'mistral', model });
    } catch (err) {
      console.error('Mistral error, fallback:', err.message);
      res.json({ answer: fallbackResponse(question, orgId), source: 'fallback', error: err.message });
    }
  });

  // Endpoint diagnostic
  router.get('/status', (req, res) => {
    res.json({
      enabled,
      model,
      tools: TOOLS.length,
      ready: enabled,
    });
  });

  return router;
}

module.exports = { makeAIRoutes };
