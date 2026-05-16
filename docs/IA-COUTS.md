# 🤖 IA — Comment ça marche, et combien ça coûte vraiment

**Réponse rapide :** non, tu n'as pas besoin de "gros abonnements IA chers". 80% de ce qu'on appelle "IA" dans notre dashboard est en réalité des **stats classiques gratuites** (Python scikit-learn, Prophet). Seul le chat assistant utilise un LLM payant — et ça coûte centimes par utilisation.

---

## 🧠 Les 5 fonctions "IA" du dashboard, décortiquées

### 1. **Maintenance prédictive** (panne dans X jours)

**Comment ça marche :** on apprend la signature normale d'une machine (vibrations, températures, courant) pendant 7 jours, puis on détecte les déviations.

- **Algo utilisé :** Isolation Forest + ARIMA (Python `scikit-learn` + `statsmodels`)
- **C'est de l'IA ?** Au sens marketing oui (apprentissage automatique). Au sens "GPT/LLM" non.
- **Coût d'exécution :** **0€**. Tourne en local sur ton serveur. CPU négligeable.
- **Coût d'entraînement :** 0€, ré-entraîne chaque semaine en arrière-plan.

### 2. **Prévision de ventes 7 jours**

**Comment ça marche :** modèle Prophet (Facebook) qui apprend la saisonnalité hebdo, mensuelle, jours fériés.

- **Algo :** Prophet (lib Python Meta) ou statsmodels SARIMAX
- **Coût :** **0€** (open source, tourne sur ton serveur)
- **Précision typique :** 85-95% sur volume hebdo

### 3. **Détection d'anomalies**

**Comment ça marche :** compare les patterns de la dernière heure aux 90 jours précédents. Si ventes ÷ 3 ou ouvertures porte ×4 → alerte.

- **Algo :** Z-score classique + Isolation Forest
- **Coût :** **0€**

### 4. **Smart restock / optimisation de routes**

**Comment ça marche :** projection consommation × inventaire actuel = prédiction date de rupture. Optimisation TSP (Travelling Salesman Problem) pour les routes.

- **Algo :** OR-Tools de Google (gratuit, open source)
- **Coût :** **0€**

### 5. **Chat assistant en langage naturel** ⚠️

**Comment ça marche :** l'utilisateur écrit "quelle machine a chuté en ventes cette semaine ?" → ON UTILISE UN LLM pour interpréter la question, on fait la requête SQL/API correspondante, le LLM formule la réponse.

- **C'est ÇA qui coûte de l'argent.**
- **Coût :** dépend du LLM (voir tableau ci-dessous)

---

## 💰 Comparatif des LLM pour le chat (prix réels)

| Modèle | Prix Input / Output | Qualité | Latence | RGPD/FR |
|--------|---------------------|---------|---------|---------|
| **Mistral Small** | 0,20€ / 0,60€ par M tokens | ⭐⭐⭐ | 200ms | ✅ Français, données en UE |
| **Mistral Large** | 1,80€ / 5,40€ par M tokens | ⭐⭐⭐⭐⭐ | 400ms | ✅ Français, données en UE |
| **Claude Haiku** | 0,80€ / 4€ par M tokens | ⭐⭐⭐⭐ | 300ms | ⚠️ Anthropic (US) |
| **Claude Sonnet** | 2,80€ / 14€ par M tokens | ⭐⭐⭐⭐⭐ | 600ms | ⚠️ Anthropic (US) |
| **GPT-4o-mini** | 0,14€ / 0,56€ par M tokens | ⭐⭐⭐⭐ | 250ms | ⚠️ OpenAI (US) |
| **GPT-4o** | 2,30€ / 9,20€ par M tokens | ⭐⭐⭐⭐⭐ | 500ms | ⚠️ OpenAI (US) |
| **Llama 3 self-hosted** | 0€ (juste le serveur) | ⭐⭐⭐ | 1-3s | ✅ Si serveur UE |

> Prix mai 2026, ordres de grandeur. Vérifier sur le site officiel avant de signer.

---

## 🧮 Combien va te coûter le chat IA dans la vraie vie ?

**Hypothèse :** une conversation = 3 messages aller-retour = **~3000 tokens**.

**Calcul pour 1 client qui utilise le chat 10 fois par mois :**
- 30 000 tokens = 0,030 M tokens
- Avec **Mistral Small** : 30k × 0,40€/M = **0,012€/mois** (un centième d'euro)
- Avec **Claude Haiku** : 30k × 2,4€/M = **0,072€/mois**
- Avec **GPT-4o-mini** : 30k × 0,35€/M = **0,011€/mois**

**Pour 100 clients :**
- Mistral Small : **1,20€/mois**
- Claude Haiku : **7,20€/mois**
- GPT-4o-mini : **1,05€/mois**

**Pour 1000 clients :**
- Mistral Small : **12€/mois**
- GPT-4o-mini : **10,50€/mois**

→ **Conclusion : c'est ridiculement peu cher.** Tu peux inclure le chat IA dans ton offre Pro sans même y penser.

---

## 🎯 Recommandation concrète : Mistral

Pour ton produit français, je recommande **Mistral**. Raisons :

1. **Français natif** : Mistral est entraîné prioritairement en français, comprend mieux les nuances
2. **RGPD compliant** : données traitées en UE (gros plus pour tes clients restaurants/PME)
3. **Pas cher** : 4x moins cher que Claude/GPT à qualité équivalente
4. **API très simple** : ressemble à OpenAI, intégration en 30 min
5. **Soutient la french tech** : argument commercial

**Comment l'intégrer (5 lignes de code) :**

```javascript
// Dans backend/src/aiRoutes.js
const Mistral = require('@mistralai/mistralai');
const client = new Mistral.Mistral({ apiKey: process.env.MISTRAL_API_KEY });

async function askAI(question, contextData) {
  const completion = await client.chat.complete({
    model: 'mistral-small-latest',
    messages: [
      { role: 'system', content: `Tu es un assistant de télémétrie. Contexte : ${JSON.stringify(contextData)}` },
      { role: 'user', content: question },
    ],
  });
  return completion.choices[0].message.content;
}
```

S'inscrire : <https://console.mistral.ai> (carte CB ou virement, sans abonnement, paie à la consommation).

---

## 🆓 Alternative 100% gratuite : self-hosting

Si tu veux **0€/mois d'IA** :

### Option A : Ollama + Llama 3 sur ton serveur

```bash
# Sur ton VPS (Hetzner CCX12 8€/mois, 4Go RAM suffit pour Llama 3.2 3B)
curl https://ollama.com/install.sh | sh
ollama pull llama3.2:3b
ollama run llama3.2:3b
```

Côté backend Node.js, tu interroges `http://localhost:11434/api/chat`. **Gratuit à vie**, mais qualité moyenne et latence 1-3s.

### Option B : Hugging Face inference (gratuit < 100 req/jour)

Pour prototyper, leur API gratuite est suffisante.

### Verdict

- **Phase 1 (validation)** : Mistral payant = 5-10€/mois total, 5 min de setup, qualité top
- **Phase 2 (croissance)** : continue Mistral, c'est <1% de ton CA
- **Phase 3 (très gros volume > 10k clients)** : envisage self-hosting Llama sur serveur GPU si l'économie justifie la complexité

---

## 📊 Modèle IA spécifique : maintenance prédictive (gratuite)

Ce module est entièrement local, voici comment il marche concrètement.

### Pseudo-code Python (à intégrer dans le backend)

```python
import numpy as np
from sklearn.ensemble import IsolationForest
from statsmodels.tsa.arima.model import ARIMA

# 1. Charge l'historique vibrations 30j d'une machine
data = db.query("SELECT ts, vibrations_g FROM telemetry WHERE device_id = ? ORDER BY ts", [device_id])
values = [d['vibrations_g'] for d in data]

# 2. Entraîne un détecteur d'anomalie sur les 7 premiers jours
baseline = np.array(values[:7*24*60]).reshape(-1, 1)  # 7j × 24h × 60min
detector = IsolationForest(contamination=0.05).fit(baseline)

# 3. Détecte les anomalies dans les 24h récentes
recent = np.array(values[-24*60:]).reshape(-1, 1)
scores = detector.score_samples(recent)
anomaly_pct = (scores < -0.5).sum() / len(scores)

# 4. Si > 15% d'anomalies → prédiction panne
if anomaly_pct > 0.15:
    # ARIMA pour estimer dans combien de temps la machine va péter
    model = ARIMA(values, order=(2,1,2)).fit()
    forecast = model.forecast(steps=30*24*60)  # 30j à venir
    breakdown_idx = next((i for i, v in enumerate(forecast) if v > CRITICAL_THRESHOLD), None)
    days_to_failure = breakdown_idx / (24*60) if breakdown_idx else None

    create_alert(device_id, level='warn', message=f"Panne probable dans {days_to_failure:.0f} jours",
                 confidence=anomaly_pct)
```

**Pas de LLM, pas de coût, juste 50 lignes de Python.** C'est de la "vraie" maintenance prédictive industrielle, utilisée par Schneider Electric, Siemens, etc.

---

## 💸 Récap des coûts IA mensuels par phase

| Phase | Volume clients | Stack IA | Coût total IA |
|-------|----------------|----------|---------------|
| Lancement (0-10 clients) | Faible | Stats Python locales + Mistral Small pour chat | **~1€/mois** |
| Croissance (10-100 clients) | Moyen | Idem + maintenance prédictive personnalisée | **~5€/mois** |
| Scale (100-1000 clients) | Élevé | Idem + cache LLM réponses fréquentes | **~30€/mois** |
| Hypercroissance (1000+ clients) | Massif | Self-hosting Llama + Mistral pour cas complexes | **~150€/mois** |

> À comparer avec ton revenu mensuel : à 100 clients à 49€/mois = 4900€ MRR, dépenser 5€ en IA c'est 0,1% de marge. C'est invisible.

**Conclusion : non, tu ne vas pas te ruiner en IA.** Le vrai coût d'un SaaS, c'est l'hébergement (5-50€/mois), Stripe (1,5% du CA), et toi-même.

---

## 🎁 Bonus : faire passer ton chat IA pour "magique"

Quelques techniques pour que les utilisateurs trouvent ton IA bluffante (et que tes coûts restent bas) :

### 1. Pré-calcul + cache

90% des questions sont prévisibles ("quelle est ma meilleure machine ?", "y a-t-il des alertes ?"). Pré-calcule les réponses **une fois par heure** et garde-les en cache. Coût LLM tombe à 0.

### 2. RAG (Retrieval-Augmented Generation)

Avant d'envoyer la question au LLM, on récupère les **3-5 lignes de données pertinentes** en base et on les colle dans le prompt. Ça permet d'utiliser un petit modèle (Mistral Small) avec des résultats aussi bons que GPT-4o.

### 3. Function calling

Au lieu de demander au LLM d'analyser les données, on lui fait juste choisir **quelle fonction backend appeler** (`getTopMachines()`, `getAlerts()`, etc.) et il formule la réponse. Très peu de tokens consommés.

### 4. Mode dégradé en cas de panne API

Si Mistral est down, on bascule automatiquement sur des **réponses templates** (par règles SQL). L'utilisateur ne s'en rend pas compte.

---

## 🧰 Stack IA recommandée pour démarrer

1. **Maintenance prédictive + Forecasting + Anomalies** :
   - Python `scikit-learn` + `statsmodels` + `prophet`
   - Tourne localement, gratuit
   - Job cron qui s'exécute toutes les 30 min

2. **Chat assistant** :
   - **Mistral Small** via API (5 min setup, 1-10€/mois)
   - Avec function calling vers ton API REST

3. **OCR / lecture de factures (option avancée)** :
   - Mistral Pixtral (vision)
   - ou Tesseract OCR (gratuit, mais moins bon)

4. **Notifications intelligentes** :
   - Templates locaux + un appel LLM **uniquement quand l'alerte est custom**

Total estimé pour gérer **1000 clients** : **~30€/mois d'IA**. C'est ridicule.

---

## ❓ Questions fréquentes

**Q : Mistral / OpenAI peuvent voir les données de mes clients ?**
R : Oui, ce que tu envoies dans le prompt. Pour éviter ça :
- Anonymise (remplace nom_client par "client A")
- N'envoie que les agrégats, pas les détails sensibles
- Pour les clients ultra-sensibles, utilise Mistral self-hosted ou Llama

**Q : Si Mistral ferme, je suis bloqué ?**
R : Non. Toutes les APIs LLM utilisent le même format OpenAI. Tu changes 2 lignes de code et tu passes sur Claude/GPT/Llama.

**Q : Mes clients vont-ils trouver l'IA "convaincante" ?**
R : Si tu utilises RAG + bonne UX (chips de suggestions, animations de "réflexion", liens vers données sources) → oui, totalement.

**Q : Faut-il un PhD en IA pour tout ça ?**
R : Non. Tout est en API REST. Tu envoies du JSON, tu reçois du JSON. Mistral SDK = 10 lignes de code. C'est plus simple que d'intégrer Stripe.

**Q : Est-ce que l'IA va remplacer un humain dans mon équipe ?**
R : Pas avant 2-3 ans. Aujourd'hui elle automatise le **support de niveau 1** ("comment changer mon mot de passe ?") et la **détection d'anomalies**. Ton équipe humaine reste indispensable pour le commercial, l'install hardware, et la résolution de pannes physiques.

---

## ✅ Action plan IA — par ordre

1. **Semaine 1** : crée un compte Mistral (console.mistral.ai), récupère ta clé API, mets-la dans `.env`. Coût : 0€.
2. **Semaine 2** : ajoute le module chat IA au backend (~50 lignes de code).
3. **Semaine 3** : implémente la maintenance prédictive en Python (~100 lignes).
4. **Semaine 4** : ajoute le RAG sur le chat pour réponses plus précises.
5. **Mois 2** : ajoute prévisions de ventes Prophet.
6. **Mois 3** : module "smart restock" avec OR-Tools.

**Tu n'as JAMAIS besoin de prendre un "abonnement IA cher"** type ChatGPT Plus à 20€/mois — ces abonnements sont pour utiliser l'interface web, pas pour une API. Toi tu paies à l'usage, et c'est radicalement moins cher.
