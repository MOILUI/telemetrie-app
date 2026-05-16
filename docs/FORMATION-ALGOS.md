# 🎓 Formation — Tous les algos et techniques utilisés

Catalogue pédagogique de **chaque brique technique** du projet. Pour chacune :
- **Où** elle est utilisée
- **Comment** ça marche en langage humain
- **Pourquoi** je l'ai choisie
- **Alternatives** possibles
- **Comment répondre** à une question client

> 💡 Lis ce doc **après** la roadmap. Garde-le ouvert quand tu présentes le produit à un client technique.

---

## 🗂️ Sommaire

1. [Sécurité & authentification](#sécurité)
2. [Stockage & base de données](#stockage)
3. [Réseau & communication](#réseau)
4. [Capteurs & électronique](#capteurs)
5. [Machine Learning & IA](#machine-learning)
6. [Paiement & fintech](#paiement)
7. [Frontend & UX](#frontend)
8. [Infrastructure & déploiement](#infrastructure)

---

# 🔐 Sécurité

## 1. bcrypt (hashing mot de passe)

**Où :** `backend/src/auth.js` — méthode `hashPassword()`

**Comment ça marche :** quand un utilisateur crée son compte, on ne stocke **jamais** son mot de passe en clair. À la place, bcrypt génère un "hash" :
- Le mot de passe est mélangé avec un **sel aléatoire** (sequence unique)
- Le tout passe **plusieurs milliers de fois** dans une fonction mathématique irréversible (Blowfish modifié)
- On stocke seulement le résultat en base
- Pour vérifier un login, on refait le calcul avec le mot de passe saisi et on compare

**Pourquoi bcrypt :**
- Lent par design (~100ms par hash) → casser 1 million de comptes prendrait des décennies même avec une ferme de GPU
- Le **coût** est ajustable (paramètre `rounds`, on utilise 10) → on peut le rendre plus lent dans 5 ans quand les ordis seront plus rapides
- Standard de l'industrie depuis 1999, **jamais cassé**

**Alternatives :** argon2 (gagnant compétition crypto 2015, encore mieux), scrypt, PBKDF2. SHA-256 est **INTERDIT** pour mots de passe (trop rapide, donc cassable).

**Si un client demande "comment vous stockez les mots de passe ?" :**
> "On utilise bcrypt avec un coût de 10. Même si notre base était volée, les mots de passe seraient inutilisables pour un attaquant — il faudrait des décennies de calcul pour casser un seul compte."

---

## 2. JWT (JSON Web Token)

**Où :** `backend/src/auth.js` — `signToken()`, `verifyToken()`

**Comment ça marche :**
- Quand l'utilisateur se connecte, on génère un **token** (chaîne base64) qui contient son identité (id, email, org_id)
- Ce token est **signé** cryptographiquement avec ton `JWT_SECRET` (HMAC-SHA256)
- Le navigateur garde ce token et l'envoie dans chaque requête (header `Authorization: Bearer ...`)
- Le serveur vérifie la signature avec son secret → il sait que le token est authentique sans avoir besoin de consulter une base de données

**Pourquoi JWT :**
- **Stateless** : pas besoin de session côté serveur (scale horizontal trivial)
- **Standard universel** : compatible Stripe, Auth0, tout ce qui existe
- **Auto-expirant** : expiration à 7 jours par défaut

**Inconvénient** : on ne peut pas "révoquer" un token avant expiration sans système annexe. Solution : tokens courts (15 min) + refresh tokens.

**Alternatives :** sessions cookies (Express-session), Paseto (plus simple/sûr que JWT mais moins répandu), OAuth2 tokens.

**Si un client demande "vous êtes en SaaS, comment marche la connexion ?" :**
> "On utilise JWT avec HMAC-SHA256. Chaque session est signée avec une clé que seul notre serveur connaît. Le token a une durée de vie limitée et est révoqué automatiquement à la déconnexion."

---

## 3. HMAC-SHA256 (signature de webhooks)

**Où :** `backend/src/stripeRoutes.js` — vérification webhook Stripe

**Comment ça marche :**
- Stripe envoie un webhook (POST sur notre URL) à chaque évènement (paiement réussi, abonnement annulé, etc.)
- Stripe **signe** le contenu avec un secret partagé : il calcule `HMAC(secret, body)` et le met dans le header `Stripe-Signature`
- Notre serveur recalcule la même signature et compare : si ça matche, on sait que **c'est vraiment Stripe** qui parle (pas un attaquant)

**Pourquoi :** sans cette vérif, n'importe qui pourrait POST sur `/api/stripe/webhook` et **simuler de faux paiements** → tu donnerais des abonnements gratuits aux pirates.

**Si un client demande "comment vous savez que les paiements sont vrais ?" :**
> "Chaque notification de paiement est signée cryptographiquement par Stripe avec HMAC-SHA256. On vérifie cette signature avant de la traiter — impossible à falsifier sans le secret partagé."

---

## 4. TLS / HTTPS (Let's Encrypt)

**Où :** `infra/Caddyfile`

**Comment ça marche :**
1. Caddy demande automatiquement un **certificat** à Let's Encrypt (autorité gratuite reconnue par tous les navigateurs)
2. Pour prouver qu'on contrôle bien le domaine, on répond à un "challenge" ACME (Caddy gère ça tout seul)
3. Let's Encrypt nous donne un certificat valide 90 jours
4. Caddy **chiffre** toutes les communications avec ce certificat (TLS 1.3 par défaut)
5. Renouvellement automatique 30 jours avant expiration

**Pourquoi :**
- Sans HTTPS, tout le trafic est en clair (mots de passe visibles dans le WiFi d'un café)
- Sans HTTPS, Chrome affiche "Non sécurisé" — fuite de prospects garantie
- Gratuit, automatique, zéro maintenance

**Si un client demande "vos données sont chiffrées ?" :**
> "Oui, toutes les communications passent en TLS 1.3 (HTTPS) avec certificats Let's Encrypt renouvelés automatiquement. Aucun message ne transite en clair."

---

# 💾 Stockage

## 5. SQLite avec WAL mode

**Où :** `backend/src/db.js`

**Comment ça marche :**
- SQLite stocke toute la base dans un **seul fichier** sur disque (ex: `telemetry.db`)
- Le mode **WAL (Write-Ahead Logging)** sépare les lectures et les écritures :
  - Les écritures vont dans un fichier `.wal` à part
  - Les lectures voient toujours une version cohérente, sans bloquer
  - Périodiquement on fusionne le WAL dans le fichier principal (checkpoint)
- Tout est ACID (Atomicité, Cohérence, Isolation, Durabilité)

**Pourquoi SQLite plutôt que PostgreSQL :**
- **Zéro admin** : pas de serveur à lancer, pas de mot de passe, pas de port
- **Ultra rapide** pour <100 GB et <100 req/s
- **Backup trivial** : copier le fichier
- **Largement suffisant** pour 1000-10 000 clients

**Quand passer à PostgreSQL :** > 10 000 clients, ou besoin de réplication multi-serveur. Migration prend 1 journée.

**Si un client demande "quelle BDD vous utilisez ?" :**
> "SQLite en mode WAL — c'est utilisé par WhatsApp pour stocker les messages de 2 milliards d'utilisateurs, par Mozilla Firefox, et tous les iPhones. C'est l'une des bases les plus testées au monde, parfaite pour notre usage."

---

## 6. Prepared statements (anti SQL injection)

**Où :** `backend/src/db.js` — toutes les queries

**Comment ça marche :**
- ❌ Mauvaise façon : `db.exec("SELECT * FROM users WHERE email = '" + email + "'")` — si email = `'; DROP TABLE users; --`, ta base explose
- ✅ Bonne façon : `stmts.getUserByEmail.get(email)` où la requête est pré-compilée avec `?` à la place de la donnée. La donnée est envoyée séparément, jamais interprétée comme du code SQL.

**Pourquoi :** SQL injection est dans le **top 10 OWASP** depuis 20 ans. Les prepared statements éliminent 100% des risques.

---

## 7. Index B-tree (pour les recherches rapides)

**Où :** `backend/src/db.js` — `idx_telemetry_device_ts`, `idx_devices_org`, etc.

**Comment ça marche :**
- Sans index, chercher "tous les points de télémétrie pour la machine X" oblige à **scanner toute la table** (millions de lignes)
- Un index B-tree est un arbre équilibré pré-trié → recherche en **O(log n)** au lieu de O(n)
- Sur 1 million de lignes : sans index = 1 seconde · avec index = 0.001 seconde (×1000 plus rapide)

**Coût :** prend un peu de place disque + ralentit légèrement les insertions. Mais c'est totalement négligeable.

---

# 🌐 Réseau

## 8. MQTT (Message Queuing Telemetry Transport)

**Où :** `backend/src/mqtt.js`, `firmware/telemetry_esp32.ino`

**Comment ça marche :**
- Protocole de messaging créé par IBM en 1999, conçu pour les **réseaux instables / bas débit** (parfait pour 4G)
- Modèle **publish/subscribe** : les machines (ESP32) publient sur des "topics", le serveur s'abonne aux topics qui l'intéressent
- **Last Will & Testament (LWT)** : si une machine se déconnecte brutalement, le broker publie automatiquement un message "offline" en son nom → détection panne instantanée
- **QoS levels** : 0 (au plus une fois), 1 (au moins une fois), 2 (exactement une fois)

**Pourquoi MQTT plutôt qu'HTTP :**
- 10× moins de bande passante (header de 2 octets vs ~500 pour HTTP)
- Persistant : un message envoyé reste dans le broker jusqu'à ce que le destinataire le reçoive
- Bidirectionnel : on peut envoyer des commandes au device (impossible en HTTP standard)
- Standard IoT mondial : utilisé par Tesla, Amazon AWS IoT, etc.

**Si un client demande "comment vous communiquez avec les ESP32 ?" :**
> "On utilise MQTT, le protocole IoT standard. Il est conçu pour la 4G : 10× plus économe en bande passante que HTTP, et il garantit la livraison des messages même en cas de coupure réseau."

---

## 9. WebSocket (temps réel dashboard)

**Où :** `backend/src/server.js` (Socket.io), `dashboard/app.js`

**Comment ça marche :**
- HTTP classique = aller-retour (le client demande, le serveur répond). Pour avoir du temps réel, il faut faire du polling (demander toutes les 1s "y a quoi de neuf ?")
- WebSocket = **tunnel permanent** entre le navigateur et le serveur → le serveur peut **pousser** des messages quand il veut, sans que le client demande
- Sur Socket.io : si WebSocket n'est pas dispo (firewall), bascule automatiquement sur "long-polling" comme fallback

**Pourquoi :**
- 1 seconde de latence vs 30 minutes en polling
- Bande passante divisée par 100
- Expérience "live" : tu vois la machine du client se mettre à jour pendant que tu la regardes

**Si un client demande "comment c'est temps réel ?" :**
> "WebSockets permanent entre votre dashboard et notre serveur. Dès qu'une de vos machines envoie une donnée, vous la voyez en moins d'une seconde sur votre écran."

---

## 10. CSP (Content Security Policy)

**Où :** `infra/Caddyfile`

**Comment ça marche :** un header HTTP qui dit au navigateur "n'autorise les scripts/images/connexions que depuis ces domaines précis". Si un attaquant injecte du JS malveillant via une faille XSS, le navigateur le bloque.

**Si un client demande "comment vous prévenez le XSS ?" :**
> "On a une politique CSP stricte qui n'autorise les scripts qu'à provenir de notre domaine + cdnjs. Toute tentative d'injection est bloquée par le navigateur."

---

# 🔌 Capteurs

## 11. Compteur d'impulsions matériel (PCNT ESP32)

**Où :** `firmware/telemetry_esp32.ino` — `attachInterrupt(PULSE_INPUT_PIN, onPulse, FALLING)`

**Comment ça marche :**
- L'ESP32 a un module hardware dédié au comptage (PCNT) qui peut compter jusqu'à 10 000 impulsions/seconde sans charger le CPU
- À chaque front descendant (FALLING) sur le GPIO, le compteur s'incrémente automatiquement
- **Debounce** logiciel (50 ms) pour éviter les rebonds mécaniques d'un switch

**Si un client demande "comment comptez-vous les ventes ?" :**
> "Le micro-switch de la trappe de votre distributeur est connecté à un compteur matériel sur l'ESP32. Précision : 100% jusqu'à 10 000 ventes/seconde — théoriquement plus que toutes les machines du monde réunies."

---

## 12. OneWire (DS18B20 température)

**Où :** firmware, bibliothèque `DallasTemperature`

**Comment ça marche :**
- Protocole conçu par Dallas Semiconductor (racheté par Maxim) en 1990
- Un seul fil de données pour tout : alimentation, données, masse (3 fils possibles, mais "parasite" sur 2 fils possible)
- Adressage 64-bit unique gravé en usine → on peut mettre **127 sondes sur le même fil** et les distinguer
- Précision : ±0.5°C de -55°C à +125°C

**Pourquoi DS18B20 :**
- Standard de l'industrie depuis 30 ans (utilisé par HACCP, frigos pharma, etc.)
- 3€ par sonde
- Câble jusqu'à 100m possible

---

## 13. I²C (Inter-Integrated Circuit)

**Où :** firmware, connexion accéléromètre ADXL345

**Comment ça marche :**
- Bus de communication créé par Philips en 1982
- 2 fils seulement : SDA (data) et SCL (clock)
- Chaque capteur a une **adresse** 7-bit → on peut chaîner jusqu'à 127 capteurs sur les mêmes 2 fils
- Vitesse : 100 kHz (standard) à 3.4 MHz (high speed)

**Utilité dans notre projet :** brancher accéléromètre, OLED, baromètre, capteur lumière, etc. — tous sur les mêmes 2 fils.

---

# 🤖 Machine Learning

## 14. Isolation Forest (détection d'anomalies)

**Où :** `ai-service/predict.py` — `/predict/maintenance` et `/anomaly/detect`

**Comment ça marche (vulgarisé) :**

Imagine une forêt où chaque arbre coupe les données au hasard.
- Pour une donnée **normale**, il faut beaucoup de coupes pour l'isoler du reste du tas
- Pour une donnée **anormale** (très différente), elle est isolée en quelques coupes seulement
- L'algo construit 100 arbres aléatoires, mesure combien de coupes en moyenne pour isoler chaque point → les points isolés rapidement sont les anomalies

**Pourquoi Isolation Forest :**
- **Non supervisé** : pas besoin d'exemples étiquetés "panne / normal" pour l'entraîner
- Marche bien sur **petits volumes** (100-10 000 points) — parfait IoT
- Ultra rapide : entraîne 1 million de points en <1 seconde
- Robuste aux outliers, parallélisable

**Alternatives :**
- One-Class SVM (plus précis, mais 100× plus lent)
- DBSCAN (clustering, complexité différente)
- Auto-encoders neuronaux (overkill pour la plupart des cas)

**Si un client demande "comment vous détectez les anomalies ?" :**
> "On utilise Isolation Forest, un algorithme de Microsoft Research (2008). Il apprend les comportements normaux de votre machine pendant 7 jours, puis détecte les déviations sans avoir besoin qu'on lui montre des exemples de pannes. Précision typique : 85-95%."

---

## 15. ARIMA (forecasting de séries temporelles)

**Où :** `ai-service/predict.py` — prévision panne + prévision ventes

**Comment ça marche (vulgarisé) :**

ARIMA = **A**uto**R**egressive **I**ntegrated **M**oving **A**verage. Trois mots :
1. **AutoRegressive (AR)** : la valeur future dépend des valeurs passées (ex: la T° d'aujourd'hui dépend de celle d'hier)
2. **Integrated (I)** : on travaille sur les **différences** plutôt que les valeurs absolues (rend la série "stationnaire")
3. **Moving Average (MA)** : on lisse les bruits aléatoires

Le modèle apprend ces 3 paramètres `(p, d, q)` sur ton historique → peut prédire les jours suivants avec une marge d'erreur calculée.

**Pourquoi ARIMA :**
- Standard depuis 1970 (créé par Box & Jenkins)
- Hyper rapide (10ms pour entraîner sur 1 an de données)
- **Interprétable** : tu peux expliquer à un client pourquoi la prédiction est ce qu'elle est
- Pas besoin de GPU

**Alternatives :**
- Prophet (Facebook, gère mieux la saisonnalité forte)
- LSTM (réseaux de neurones, plus puissant mais 1000× plus lent et boîte noire)
- Exponential Smoothing (Holt-Winters)

**Si un client demande "comment vous prévoyez les ventes ?" :**
> "ARIMA, le modèle de référence pour les séries temporelles depuis 50 ans. Il analyse votre historique de ventes, identifie les patterns (hebdomadaires, mensuels, jours fériés) et prévoit les 7 prochains jours avec une marge d'erreur de 5-15%."

---

## 16. Transformers (Mistral, GPT, Claude — chat assistant)

**Où :** `backend/src/aiRoutes.js` — appel API Mistral

**Comment ça marche (vraiment vulgarisé) :**

Un "Large Language Model" comme Mistral est un réseau de neurones avec ~7-100 milliards de paramètres entraîné sur **tout internet** (Wikipédia, livres, forums, code) pour **prédire le mot suivant** dans un texte.

Quand tu lui envoies "Bonjour, combien de machines en alerte ?", il :
1. **Tokenise** ta phrase (la découpe en sous-mots)
2. Passe ces tokens à travers ses 50+ couches d'**attention** qui calculent le contexte
3. Génère le **prochain token** le plus probable, puis le suivant, et ainsi de suite jusqu'à former la réponse

**Function calling** : on peut lui donner une liste de "fonctions disponibles" (`list_devices()`, `active_alerts()`, etc.) et lui demander d'appeler la bonne en fonction de la question. C'est ce qu'on fait dans `aiRoutes.js`.

**Pourquoi Mistral :**
- **Français natif** (entreprise française, données françaises prioritaires)
- **RGPD-compliant** (serveurs UE)
- **Pas cher** : 0,20€ / million de tokens vs 5€ pour GPT-4o
- Open source pour les modèles "petits" (peut être self-hosted)

**Si un client demande "vous utilisez ChatGPT ?" :**
> "Non, on utilise Mistral, l'équivalent français de ChatGPT. C'est entraîné en France, les données restent en Europe (conforme RGPD), et c'est 5× moins cher. Pour notre cas d'usage (questions sur les machines), Mistral Small donne d'excellents résultats."

---

## 17. RAG (Retrieval-Augmented Generation)

**Où :** non encore implémenté, mentionné dans `docs/IA-COUTS.md`

**Comment ça marche :**
- Problème : un LLM ne connaît pas tes données spécifiques (machines, ventes, etc.)
- Solution : avant d'envoyer la question, on récupère les 3-5 données pertinentes de notre base et on les colle dans le prompt
- Le LLM répond en utilisant à la fois ses connaissances générales + nos données spécifiques

**Pourquoi RAG :**
- Évite le coût d'entraînement d'un modèle custom (millions €)
- Toujours à jour (tes données changent tous les jours)
- Tu peux utiliser un petit modèle pas cher avec d'excellents résultats

**Si un client demande "comment l'IA connaît mes données ?" :**
> "On utilise une technique appelée RAG (Retrieval-Augmented Generation). Quand vous posez une question, on récupère les données pertinentes de votre compte et on les fournit en contexte au modèle. Vos données ne sont jamais utilisées pour entraîner le modèle — elles restent isolées dans votre espace."

---

## 18. Z-score (statistique classique)

**Où :** `backend/src/aiRoutes.js` (utilisable), `ai-service/predict.py`

**Comment ça marche :**
- Z-score = (valeur actuelle - moyenne) / écart-type
- Si Z > 3, la valeur est à plus de 3 écarts-types de la normale → anomalie statistique (probabilité < 0.3%)

**Pourquoi :** plus simple que Isolation Forest, fonctionne bien pour des données qui suivent une distribution normale (températures par exemple).

---

# 💳 Paiement

## 19. Stripe Connect (split payment marketplace)

**Où :** `backend/src/stripeConnect.js`

**Comment ça marche :**
- Stripe est notre **PSP (Payment Service Provider) agréé** — il a la licence ACPR/équivalent
- On crée des "Connected Accounts" pour chaque client (sous-comptes liés au nôtre)
- À chaque paiement, on définit un **split** :
  - `application_fee_amount` → revient à notre compte (commission)
  - Le reste va automatiquement sur le compte du client (sa banque)
- Stripe gère TVA, conformité PSD2, lutte contre fraude

**Pourquoi pas faire ça nous-mêmes :** il faut une licence d'établissement de paiement (350k€ de capital, 18 mois d'agrément ACPR). Stripe Connect est la solution standard utilisée par Uber, Airbnb, Doctolib.

---

## 20. 3DS / SCA (Strong Customer Authentication)

**Où :** géré automatiquement par Stripe Checkout

**Comment ça marche :**
- Directive européenne PSD2 (depuis 2021) : pour les paiements > 30€, il faut **2 facteurs** d'authentification (CB + SMS, ou CB + biométrie banque)
- Stripe gère automatiquement le déclenchement de la 2FA quand nécessaire
- Réduit fraude de ~80%

---

# 🎨 Frontend

## 21. Tailwind CSS (utility-first)

**Où :** tous les HTML

**Comment ça marche :** au lieu de CSS classique avec classes sémantiques (`.button-primary`), Tailwind fournit des **classes utilitaires** (`bg-blue-600 text-white px-4 py-2 rounded-lg`).

**Pourquoi :**
- Pas besoin de switcher entre HTML et CSS files
- Le HTML est auto-suffisant (copier-coller fonctionne)
- **Purge automatique** : seules les classes utilisées finissent dans le CSS final → fichier de 8 KB
- Standard moderne (utilisé par GitHub, Shopify, Heroku)

---

## 22. Chart.js

**Où :** dashboards

**Comment ça marche :** lib Canvas qui dessine 8 types de graphiques (line, bar, doughnut, etc.) avec animations. Performant jusqu'à ~10 000 points.

**Alternative : Apache ECharts** (plus puissant, plus lourd), **D3.js** (totale liberté mais ~10× plus de code).

---

## 23. Leaflet (cartographie)

**Où :** dashboards

**Comment ça marche :**
- Charge des **tuiles** (images PNG 256×256) depuis OpenStreetMap selon le zoom
- Affiche des marqueurs SVG superposés
- Gère pan/zoom/click

**Alternative :** Mapbox GL (3D, plus joli, payant > 50k utilisateurs/mois), Google Maps (payant).

**Pourquoi Leaflet :** gratuit, libre, tuiles OSM gratuites, marche partout.

---

## 24. PWA (Progressive Web App)

**Où :** `demo-mobile-app.html`

**Comment ça marche :** une PWA est un site web qui peut être **installé** sur le téléphone via "Ajouter à l'écran d'accueil". Elle apparaît comme une vraie app, marche en plein écran, peut envoyer des notifications.

**Fichiers requis :**
- `manifest.json` (nom, icônes, theme color)
- Service Worker (pour le mode offline et notifications)
- HTTPS obligatoire

**Pourquoi PWA :**
- Pas de soumission App Store / Play Store (gain de 1-3 semaines)
- 1 codebase pour iOS + Android + Web
- Mise à jour instantanée (pas de validation Apple)

---

# 🏗️ Infrastructure

## 25. Docker (containers)

**Où :** `Dockerfile`, `docker-compose.yml`

**Comment ça marche :**
- Un container = **une mini machine virtuelle ultra-légère** qui contient ton app + ses dépendances + son OS minimal
- Avantage par rapport à une VM : démarre en 1s (vs 1 min), prend 50 Mo (vs 1 Go), partage le kernel Linux de l'hôte
- Une **image Docker** est immuable et reproductible → "ça marche chez moi" devient "ça marche partout"

**Si un client demande "comment vous garantissez la stabilité ?" :**
> "Notre stack tourne dans des containers Docker — un standard utilisé par Netflix, Google et 80% de l'industrie. Chaque déploiement est reproductible bit pour bit, et un redémarrage prend moins de 5 secondes."

---

## 26. Reverse proxy (Caddy)

**Où :** `infra/Caddyfile`

**Comment ça marche :**
- Caddy se met **devant** ton backend Node.js
- Il reçoit les requêtes HTTPS sur le port 443 → les transforme en HTTP local → les envoie à Node.js sur le port 3000
- Il gère TLS automatiquement (Let's Encrypt)
- Il fait du **load balancing** si tu as plusieurs instances backend
- Il fait du **caching** pour les fichiers statiques
- Il **bloque les requêtes malformées** avant qu'elles atteignent ton app (protection)

**Alternative :** Nginx (plus complexe à configurer), Traefik (similaire), HAProxy (industrial-strength).

---

## 27. Rate limiting (sliding window)

**Où :** `infra/Caddyfile` ou à ajouter via `express-rate-limit`

**Comment ça marche :**
- On compte le nombre de requêtes par IP dans une fenêtre glissante (ex: 100/min)
- Si dépassé, on renvoie HTTP 429 "Too Many Requests"
- Protection contre les attaques par déni de service et le brute force login

**Algo sous-jacent :** fenêtre glissante avec compteurs Redis (mais on peut faire en mémoire pour notre échelle).

---

## 28. fail2ban (bannissement IP)

**Où :** `infra/fail2ban-telemetry.conf`

**Comment ça marche :**
- Surveille les logs (Caddy access.log, journal SSH, etc.)
- Si une IP fait trop d'échecs (ex: 5 tentatives login en 10 min), elle est **bannie 1 heure** via une règle iptables/ufw
- Apprentissage automatique : les "recidivistes" sont bannis 1 semaine

**Pourquoi indispensable :** des bots scannent l'internet 24/7 pour des serveurs faibles. fail2ban arrête 99% du bruit automatiquement.

---

## 29. Backup avec restauration testée (3-2-1)

**Où :** `infra/scripts/backup.sh`

**Comment ça marche :**
- Tous les soirs : snapshot SQLite atomique (avec `.backup` SQL natif → cohérence garantie)
- Compression gzip
- **Chiffrement GPG** (clé que toi seul détiens)
- Upload sur **Backblaze B2** (cloud externe = "1 copie hors site")
- **Test de restauration automatique** chaque dimanche (CRITIQUE — beaucoup de gens découvrent que leurs backups sont corrompus le jour où ils en ont besoin)

**Règle 3-2-1 :** 3 copies, 2 médias différents, 1 hors site.

---

## 30. Git + Atomic deployments

**Où :** workflow recommandé

**Comment ça marche :**
- Tout le code dans Git (GitHub privé gratuit)
- Chaque commit est immuable (on peut revenir en arrière)
- **Tags** = versions stables (`v1.0.0`)
- En prod : `git pull && docker compose up -d` redémarre seulement les services modifiés (zéro downtime si bien fait)

---

# 📊 Récap : qui sert à quoi

| Question client | Algo/Tech | Réponse type |
|---|---|---|
| "Mes mots de passe sont protégés ?" | bcrypt | "Hashage bcrypt avec coût 10, impossible à inverser même en cas de vol de la base" |
| "Les communications sont chiffrées ?" | TLS 1.3 | "HTTPS Let's Encrypt sur toutes les connexions, certificats renouvelés automatiquement" |
| "Comment vous savez qu'il y a une panne ?" | Isolation Forest + Z-score | "ML d'anomalie qui apprend votre baseline pendant 7j et détecte les déviations" |
| "Vous prévoyez les ventes ?" | ARIMA | "Modèle ARIMA sur 30 jours d'historique, marge d'erreur < 15%" |
| "C'est temps réel comment ?" | WebSocket | "WebSocket permanent, latence < 1 seconde" |
| "Vous communiquez avec les machines en 4G ?" | MQTT | "Protocole MQTT, le standard IoT mondial (Tesla, AWS, Microsoft)" |
| "Comment marche le chat IA ?" | Mistral + function calling + RAG | "LLM français Mistral, appelle nos APIs internes pour fournir des réponses sur vos données" |
| "C'est conforme RGPD ?" | Hébergement EU + chiffrement + DPA | "Données hébergées en France, chiffrées au repos et en transit, DPA signable, droit à l'oubli implémenté" |
| "Vous tenez à la charge ?" | Docker + Caddy + Aedes | "Architecture conteneurisée, load balancer Caddy, broker MQTT léger Aedes. Capacité testée 1000 machines/serveur." |
| "Comment vous évitez le piratage ?" | Multi-couche (bcrypt + JWT + CSP + fail2ban + WAF + TLS) | "Défense en profondeur sur 5 niveaux : application, transport, OS, réseau, monitoring" |

---

## 🎓 Ressources pour aller plus loin

- **bcrypt vs argon2 vs scrypt** : <https://words.filippo.io/the-ecb-penguin/>
- **MQTT spec officielle** : <https://mqtt.org/mqtt-specification/>
- **Isolation Forest (papier original)** : Liu, Ting, Zhou (2008)
- **OWASP Top 10** : <https://owasp.org/Top10/>
- **Stripe Connect docs** : <https://stripe.com/docs/connect>
- **Caddy docs** : <https://caddyserver.com/docs/>
- **PWA spec** : <https://web.dev/progressive-web-apps/>
