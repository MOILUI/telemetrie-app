# 🤖 Agents IA — Automatiser la gestion de ton business

**Tu n'es pas obligé d'embaucher 5 personnes pour gérer 100 clients.** Des agents IA peuvent prendre en charge 80% du boulot répétitif : support, prospection, suivi client, facturation, marketing.

Ce doc te donne :
- ⚙️ La stack technique pour faire tourner des agents
- 🤖 8 agents prêts à déployer avec leurs prompts, données et coûts
- 💸 Le retour sur investissement de chaque agent

---

## 🎯 C'est quoi un "agent IA" exactement ?

Un **agent IA** = un LLM (Mistral, Claude, GPT) + des **outils** + des **règles métier** + un **déclencheur**.

Exemple simple :
> Tous les jours à 9h, regarde dans la base les clients qui n'ont pas ouvert le dashboard depuis 14 jours. Pour chaque, génère un email de réengagement personnalisé (avec ses dernières données) et envoie-le via Mailgun.

Ça remplace un Customer Success Manager qui ferait ça à la main (50€ × 5 min × 30 clients = 125€/jour).

**Coût pour faire tourner cet agent :** ~2€/mois en API LLM. ROI : x1000.

---

## 🧱 Stack technique : 3 options

### Option A — No-code : **n8n** ou **Make.com**

- **n8n** : open-source, self-hosted gratuit (5€/mois sur Hetzner), interface visuelle drag-and-drop
- **Make.com** (ex-Integromat) : SaaS, $9-29/mois
- **Zapier** : SaaS, plus cher, plus simple

**Idéal pour :** workflows simples (ex: déclencheur → API LLM → email Gmail).

### Option B — Low-code : **Claude Skills** / **OpenAI Assistants**

- API officielle avec tools intégrés
- Tu décris l'agent en prompt, l'API gère le reste
- Plus pratique pour des agents complexes avec mémoire long terme

### Option C — Code maison : **Python + Claude SDK**

- Maximum de contrôle
- Coût minimal
- Recommandé pour la prod sérieuse

**Recommandation pour ton projet :** mix **n8n** (workflows simples) + **Python** (agents critiques avec accès à ta BDD).

---

# 🤖 Les 8 agents à déployer

## ⓵ Agent Customer Success (réengagement)

> **Mission :** détecter les clients à risque et les sauver avant qu'ils ne partent.

**Fréquence :** chaque jour à 9h

**Données nécessaires :**
- Liste des comptes actifs (table `organizations`)
- Date de dernière connexion (à logger côté backend)
- Nb de machines connectées
- Statut Stripe (abonnement actif / past_due)

**Logique :**

1. Récupère les clients inactifs depuis 14 jours
2. Pour chaque, analyse son contexte (nb machines, plan, dernière activité)
3. Génère un email **personnalisé** avec Claude/Mistral
4. Envoie via **Resend** ou **Mailgun**
5. Marque le contact comme "à suivre" dans le CRM

**Prompt système :**
```
Tu es Customer Success Manager pour Télémétrie (SaaS de supervision machines IoT).
Ton job : rédiger un email court (max 5 lignes), chaleureux mais pas mielleux, qui :
- Pose 1 question ouverte sur leur usage
- Met en avant 1 fonctionnalité qu'ils n'ont pas encore essayée
- Propose 15 min de visio pour les aider

Style : tutoiement OK pour PME, ton direct, pas de "passionné, ravi, formidable".
Signature : "{{user_first_name}}, équipe Télémétrie".
```

**Coût LLM :** ~0,002€/email × 5 clients/jour × 30 jours = **0,30€/mois**.
**ROI :** récupérer 1 churn/mois (49€/mois × 24 mois LTV = 1176€) = **ROI x3900**.

> Code complet livré dans `commercial-kit/customer-success-agent.py`.

---

## ⓶ Agent Lead Qualification (sales)

> **Mission :** qualifier les prospects et préparer des emails de prospection ultra-ciblés.

**Fréquence :** à la demande (quand tu importes une liste de prospects)

**Données nécessaires :**
- Liste de prospects (entreprise, site web, secteur, taille)
- Informations LinkedIn (optionnel — via Phantombuster ou Apify)

**Logique :**

1. Pour chaque prospect, l'agent va sur leur site web (via Browse-MCP ou Apify)
2. Identifie le type de machines qu'ils pourraient avoir
3. Évalue un **score d'opportunité** (1-10) avec justification
4. Génère un **email de prospection personnalisé** qui montre que tu as fait tes devoirs

**Exemple de prompt :**
```
Tu es expert en prospection B2B pour un SaaS de télémétrie machines.
Analyse ce prospect : {{nom}} - {{site_web}} - {{secteur}}.
Donne moi :
1. Score 1-10 de pertinence pour notre solution
2. 3 raisons pourquoi
3. Un email de prospection de 4 lignes max, personnalisé
```

**Outils stack :**
- LLM (Mistral Large) avec function calling
- API Apify pour scraper LinkedIn (gratuit < 5 req/jour)
- Mailgun pour envoyer

**Coût :** ~0,01€/prospect qualifié × 100/mois = **1€/mois**.

---

## ⓷ Agent Support L1 (tickets clients)

> **Mission :** répondre automatiquement à 80% des questions support, escalader le reste à un humain.

**Stack recommandée :** **Crisp** (chat gratuit) + **Claude API** + base de connaissances vectorielle

**Logique :**

1. Client pose une question dans le chat support
2. Agent cherche dans la documentation (`docs/*.md`) avec un **embedding search** (chromaDB ou Mistral embeddings)
3. Si confidence > 80% → répond automatiquement
4. Sinon → ping notification humaine + suggère un brouillon

**Exemple de questions auto-résolues :**
- "Comment réinitialiser mon mot de passe ?"
- "Pourquoi mon ESP32 ne se connecte pas ?"
- "Comment ajouter une machine ?"
- "Quel est mon token MQTT ?"

**Coût :** 0,01€ par conversation × 200/mois = **2€/mois**.
**Gain :** ~10h de support manuel = **500€ valeur**.

> Code : voir [Crisp + Claude tutorial](https://help.crisp.chat/en/article/how-to-use-ai-with-crisp-1xt1nlj/)

---

## ⓸ Agent Operations (tournées techniciens)

> **Mission :** chaque matin, optimiser les routes des techniciens et envoyer leur planning.

**Fréquence :** chaque jour à 7h

**Données nécessaires :**
- Géolocalisation des machines (déjà en base : `devices.lat/lng`)
- État stock + alertes ouvertes
- Disponibilités des techniciens (calendrier Google)

**Logique :**

1. Récupère les machines à visiter aujourd'hui (stock < 30%, alertes critiques, maintenance programmée)
2. Récupère les techniciens dispo et leur position de départ
3. Optimise la tournée avec **OR-Tools de Google** (TSP) ou Mapbox Optimization API
4. Envoie le planning via **SMS Twilio** + email avec lien Google Maps multi-stops

**Pas de LLM nécessaire ici, juste de l'optimisation classique.** Mais on peut **utiliser un LLM** pour générer le SMS personnalisé :
> "Salut Jean, ta tournée du jour : 5 stops, 32 km, ~2h15. Lien : ..."

**Coût :** OR-Tools gratuit + Twilio SMS = **0,06€ × 30 SMS/mois = 1,80€**.
**ROI :** -40% de km × 50 km/jour × 0,40€/km × 22 jours = **176€/mois économisés**.

---

## ⓹ Agent Marketing / Contenu SEO

> **Mission :** générer 4 articles de blog par mois pour le SEO, sans intervention humaine.

**Stack :** Claude Sonnet (qualité rédactionnelle supérieure) + **WordPress** ou **Astro** static site

**Logique :**

1. Lundi matin : récupère les **questions tendances Google** sur ton secteur (Google Trends API ou Ahrefs)
2. Sélectionne 1 sujet (ex: "Comment surveiller un frigo professionnel à distance")
3. Génère un **article de 1500 mots** avec H1/H2/H3 optimisés SEO
4. Ajoute des images via DALL-E ou Stable Diffusion
5. Publie sur le blog en brouillon → toi tu relis et valides en 5 min

**Prompt :**
```
Tu es rédacteur SEO pour Télémétrie (SaaS supervision machines).
Génère un article de 1500 mots sur le sujet "{{sujet}}".
Public : gérants de restaurants/PME, niveau technique faible.
Structure : intro 100 mots, 5 sections H2 avec sous-sections H3, conclusion.
Inclus : 1 tableau comparatif, 1 FAQ de 5 questions, CTA vers /signup.
Ton : informatif, sans jargon, avec des chiffres concrets.
```

**Coût :** Claude Sonnet ~0,30€/article × 4/mois = **1,20€/mois**.
**ROI :** chaque article peut générer 100-1000 visites/mois sur Google après 6 mois = **leads gratuits à vie**.

---

## ⓺ Agent Finance (rapprochements + facturation)

> **Mission :** vérifier que tous les paiements Stripe matchent les factures, alerter si écart.

**Fréquence :** chaque dimanche soir

**Données nécessaires :**
- API Stripe (`/v1/charges`, `/v1/invoices`)
- API ton expert comptable (Pennylane, Sellsy, etc.)

**Logique :**

1. Liste tous les paiements Stripe de la semaine
2. Liste les factures émises côté Pennylane
3. Cherche les écarts (paiement sans facture, facture sans paiement)
4. Si tout OK → email de récap au dirigeant
5. Si écart → escalade humaine + suggestion de correction

**Stack :** Python script lancé en cron + Claude pour générer le résumé.

**Coût :** quasi nul (~0,10€/mois).
**ROI :** évite 1 erreur comptable/an = **~1000€ d'amende ou retard**.

---

## ⓻ Agent Veille concurrentielle

> **Mission :** te prévenir si Nayax/Vendon lance une nouveauté, baisse ses prix, ou si un article dans la presse mentionne le secteur.

**Stack :** Make.com + ChatGPT Browse + Google Alerts

**Logique :**

1. Chaque jour : scrape les sites de Nayax, Vendon, Televend
2. Compare avec la version d'hier (diff)
3. Si changement → envoie un résumé en français de ce qui a changé
4. + Google Alerts sur "télémétrie distributeur", "IoT vending"
5. Slack / email quotidien

**Coût :** 5€/mois Make.com + 1€/mois LLM = **6€/mois**.
**Gain :** **rester compétitif**. Tu réagis en jours au lieu de mois.

---

## ⓼ Agent Recrutement (sourcing)

> **Mission :** te trouver des candidats pour ta future embauche commerciale ou technique.

**Quand activer :** quand tu commences à recruter (10-30 clients atteints).

**Stack :** Python + LinkedIn API + Claude

**Logique :**

1. Tu décris le profil cible (ex: "commercial B2B IoT, 3+ ans expérience, FR ou EN")
2. L'agent scrappe LinkedIn (via Phantombuster / Lix / Apollo.io)
3. Pour chaque profil pertinent, génère un **message LinkedIn personnalisé**
4. Tu valides 1 par 1 avant envoi

**Coût :** Phantombuster $69/mois + LLM 5€/mois = **75€/mois**.
**ROI :** trouver 1 bon commercial = **~30 000€ de revenus généré an 1**.

---

# 💡 Comment construire ton 1er agent (cas concret)

On va construire l'**Agent Customer Success** en 30 minutes.

## Stack

- **Python** (que tu as déjà sur Mac)
- **Claude API** (clé gratuite < 5$ d'usage)
- **Resend** (1000 emails gratuits/mois)
- **Cron sur ton serveur** Hetzner

## Étapes

1. **Créer un compte Anthropic** : <https://console.anthropic.com> → récupérer ta clé `sk-ant-...`
2. **Créer un compte Resend** : <https://resend.com> → récupérer ta clé `re_...`
3. **Configurer le DNS** de ton domaine pour autoriser Resend à envoyer (SPF + DKIM, 5 min)
4. **Pull le script** : `customer-success-agent.py` (livré dans le projet)
5. **Configurer les credentials** dans `.env`
6. **Tester** : `python customer-success-agent.py --dry-run`
7. **Cron sur Hetzner** : `0 9 * * * cd /home/telemetry/agents && python customer-success-agent.py`

## Et hop, ton premier agent tourne 24/7.

---

# 🧠 Patterns d'agent — comment penser le design

## Pattern 1 : Cron-based (déclencheur temps)

Le plus simple. Un script qui s'exécute toutes les X heures/jours.

**Exemples :** Customer Success, Operations, Finance, Marketing.

## Pattern 2 : Event-driven (déclencheur évènement)

Réagit en temps réel à un évènement (nouveau signup, nouvelle alerte critique, etc.).

**Stack :** webhook depuis ton backend → file d'attente (Redis/SQS) → agent qui traite.

**Exemples :** Support L1 (chat reçu), Lead qualification (signup), Anti-fraude.

## Pattern 3 : On-demand (déclencheur humain)

Tu cliques un bouton dans ton interface → l'agent fait le boulot.

**Exemples :** "Générer un email de prospection pour ce lead", "Rédige un brief pour cet article".

## Pattern 4 : Multi-step (chain of thought)

L'agent enchaîne plusieurs étapes avec validation à chaque palier.

**Exemple :** Article SEO = (1) trouve sujet → (2) plan → (3) écrit intro → (4) écrit corps → (5) génère image → (6) review.

---

# 🛡️ Sécurité & contrôle des agents

**Les agents peuvent faire des bêtises si mal cadrés.** Bonnes pratiques :

1. **Mode "dry-run" obligatoire** : tester sans envoyer
2. **Validation humaine** sur les actions risquées (suppression, gros montants)
3. **Logs détaillés** de toutes les actions de l'agent
4. **Limites strictes** (max X emails/jour, max Y € de transaction)
5. **Kill switch** : un fichier `STOP_AGENTS` qui arrête tout
6. **Prompts injection-proof** : ne jamais faire confiance aux entrées utilisateur dans le prompt

---

# 📊 Tableau récapitulatif

| Agent | Économise | Coût LLM | ROI / mois | Difficulté |
|---|---|---|---|---|
| Customer Success | ~10h/mois | 0,30€ | x1000 | 🟢 Facile |
| Lead Qualification | ~20h/mois | 1€ | x500 | 🟡 Moyen |
| Support L1 | ~30h/mois | 2€ | x300 | 🟡 Moyen |
| Operations (tournées) | ~5h/mois + km | 2€ | x100 | 🟡 Moyen |
| Marketing SEO | ~15h/mois | 1,20€ | x∞ (long terme) | 🟢 Facile |
| Finance | ~5h/mois | 0,10€ | x50 | 🟡 Moyen |
| Veille | ~3h/mois | 6€ | x10 | 🟢 Facile |
| Recrutement | ~20h (one-shot) | 75€ | x400 | 🔴 Avancé |
| **TOTAL** | **~108h/mois** | **~88€/mois** | **Énorme** | |

> 108h/mois = **~3 700€ de valeur par mois** pour 88€ d'IA. **C'est 42× moins cher qu'un employé temps plein.**

---

# 🚀 Plan de déploiement recommandé

| Mois | Agent à activer | Pourquoi cet ordre |
|---|---|---|
| 1 | Customer Success | Le plus rentable, le plus rapide à mettre en place |
| 2 | Support L1 | Quand tu commences à avoir des questions répétitives |
| 3 | Lead Qualification | Pour scaler ta prospection |
| 4 | Operations | Quand tu as 10+ clients avec des tournées |
| 6 | Marketing SEO | Long terme, dès que possible mais résultats à 6 mois |
| 9 | Finance | Quand tu as 50+ factures/mois |
| 12 | Veille | Optionnel mais utile |
| 18 | Recrutement | Quand tu cherches à embaucher |

---

# 🎓 Aller plus loin

- **Cours Anthropic "Prompt Engineering"** : <https://www.anthropic.com/learn>
- **Mistral Cookbook** : <https://github.com/mistralai/cookbook> (exemples agents)
- **n8n templates** : <https://n8n.io/workflows/>
- **LangChain docs** : framework Python pour agents complexes
- **Awesome AI Agents** : <https://github.com/e2b-dev/awesome-ai-agents>
