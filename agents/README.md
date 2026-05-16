# 🤖 Agents IA — Tous les scripts d'automatisation

5 agents Python prêts à exécuter pour automatiser ton business.

## ✅ Agents disponibles

| Agent | Fichier | Quand l'utiliser | Coût/mois |
|---|---|---|---|
| 🟢 **Customer Success** | `customer_success_agent.py` | Tous les jours 9h · détecte clients inactifs + email réengagement | ~0,30€ |
| 🎯 **Lead Qualification** | `lead_qualification_agent.py` | À la demande · scoring auto prospects + emails personnalisés | ~1€/100 prospects |
| 💬 **Support L1** | `support_l1_agent.py` | 24/7 · répond auto aux questions clients via RAG sur la doc | ~2€/200 questions |
| 📝 **Marketing SEO** | `marketing_seo_agent.py` | Hebdo · génère 1 article blog complet optimisé SEO | ~0,30€/article |
| 🚐 **Operations** | `operations_agent.py` | Tous les matins 7h · optimise tournée + SMS au technicien | ~1,80€ (Twilio SMS) |

## 🚀 Setup commun (15 min)

### 1. Récupérer les clés API

- **Mistral** (le moins cher, FR-friendly) : https://console.mistral.ai
- **Resend** (emails, gratuit < 3000/mois) : https://resend.com
- **Twilio** (SMS, ~0,06€/SMS) : https://twilio.com — *optionnel pour operations*

### 2. Configurer

```bash
cp .env.example .env
nano .env   # remplir les clés
```

### 3. Tester chacun en dry-run

```bash
python3 customer_success_agent.py --dry-run
python3 lead_qualification_agent.py mes_prospects.csv --dry-run
python3 support_l1_agent.py "comment flasher mon ESP32 ?"
python3 marketing_seo_agent.py --topic "Maintenance prédictive cafetière pro"
python3 operations_agent.py --dry-run
```

### 4. Programmer les crons

```bash
crontab -e
```

```cron
# Customer Success — chaque matin 9h
0 9 * * * cd /home/telemetry/agents && /usr/bin/python3 customer_success_agent.py >> agent.log 2>&1

# Operations (tournée techniciens) — chaque jour ouvré 7h
0 7 * * 1-5 cd /home/telemetry/agents && /usr/bin/python3 operations_agent.py >> agent.log 2>&1

# Marketing SEO — chaque lundi 8h, 1 nouvel article
0 8 * * 1 cd /home/telemetry/agents && /usr/bin/python3 marketing_seo_agent.py --auto >> agent.log 2>&1

# Support L1 (mode serveur) — toujours actif
@reboot cd /home/telemetry/agents && /usr/bin/python3 support_l1_agent.py --serve --port 5000 >> agent.log 2>&1
```

## 🛡️ Kill switch global

```bash
touch ../STOP_AGENTS    # Tous les agents s'arrêtent au prochain run
rm ../STOP_AGENTS       # Reprendre
```

## 📊 Suivi des actions

Tous les agents loggent dans :
- `agent.log` (fichier rotatif)
- Table SQLite `agent_logs` (user_id, agent, action, success, ts)

```sql
SELECT agent, COUNT(*), SUM(success) FROM agent_logs
WHERE ts > strftime('%s','now','-30 day') * 1000
GROUP BY agent;
```

## 💡 Cas d'usage concrets

### "Récupérer 10h/mois de support"
→ Branche `support_l1_agent.py --serve` sur Crisp/Intercom webhook.

### "Générer 50 emails de prospection en 1h"
→ Exporte tes prospects LinkedIn/Pappers en CSV, lance `lead_qualification_agent.py prospects.csv`.

### "Avoir 4 articles SEO publiés ce mois sans effort"
→ Cron hebdo `marketing_seo_agent.py --auto`. Tu relis 5 min et publies.

### "Éviter le churn des clients qui décrochent"
→ Cron quotidien `customer_success_agent.py`. Récupère 1 churn/mois = +1 176€ LTV.

### "Optimiser les routes de mes techniciens"
→ Cron 7h `operations_agent.py`. Économise ~40% de km/jour.

## 🧮 ROI total des 5 agents

| Agent | Heures économisées/mois | Coût/mois | Valeur générée |
|---|---|---|---|
| Customer Success | ~10h | 0,30€ | ~500€ |
| Lead Qualification | ~20h | 1€ | ~1 000€ |
| Support L1 | ~30h | 2€ | ~1 500€ |
| Marketing SEO | ~15h | 1,20€ | ~750€ + trafic SEO |
| Operations | ~5h + km | 1,80€ | ~200€ km + 200€ temps |
| **TOTAL** | **~80h/mois** | **~6,30€** | **~4 000€/mois** |

→ **635× ROI**. Le SMIC français à 1 750€/mois = 0,5 mois de SMIC pour faire le boulot de 5 personnes.
