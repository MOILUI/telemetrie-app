# 🚀 Tester ton dashboard en 10 minutes sur Mac

Aucun matériel nécessaire. Tu vas lancer le serveur sur ton Mac et un simulateur qui fait semblant d'être 3 vraies machines.

---

## ✅ Pré-requis : installer Node.js

Si tu ne l'as pas déjà :

1. Va sur <https://nodejs.org>
2. Télécharge la version **LTS** (en vert)
3. Lance l'installateur, suis "Suivant" jusqu'au bout

Pour vérifier, ouvre **Terminal** (Cmd+Espace → tape "Terminal" → Entrée) et tape :

```bash
node --version
```

Tu dois voir un numéro comme `v20.18.0`. Si oui, c'est bon.

---

## 🎬 Étape 1 — Démarrer le serveur backend

Dans le Terminal, copie-colle ces 4 commandes une par une :

```bash
cd ~/Library/Application\ Support/Claude/local-agent-mode-sessions/c4d80757-e53c-45eb-b93d-7c204ba6b2df/df55fadf-a439-4c8d-8d55-15cbefd7468c/local_f9b0bd5e-71ef-45d6-a856-85db6e4e664a/outputs/telemetry-app/backend
```

```bash
cp .env.example .env
```

```bash
npm install
```

(la dernière commande prend 1-2 min — c'est normal, ça télécharge les libraries)

```bash
npm start
```

Tu dois voir :

```
[INFO] Broker MQTT démarré sur le port 1883
[INFO] Serveur HTTP + Dashboard sur http://localhost:3000
[INFO] Identifiants : admin / (défaut, à changer !)
```

✅ **Laisse cette fenêtre Terminal ouverte.** Si tu la fermes, le serveur s'arrête.

---

## 🎬 Étape 2 — Lancer le simulateur

Ouvre **une nouvelle fenêtre Terminal** (Cmd+N dans Terminal), puis :

```bash
cd ~/Library/Application\ Support/Claude/local-agent-mode-sessions/c4d80757-e53c-45eb-b93d-7c204ba6b2df/df55fadf-a439-4c8d-8d55-15cbefd7468c/local_f9b0bd5e-71ef-45d6-a856-85db6e4e664a/outputs/telemetry-app/simulator
```

```bash
npm install
```

```bash
npm start
```

Tu dois voir :

```
📡 Simulateur de télémétrie
Connexion à mqtt://localhost:1883 ...
✅ Connecté au broker MQTT

Machines simulées :
  • cafe-paris-01  ☕ Cafetière espresso (Paris)
  • vending-lyon-12  🥤 Distributeur boissons (Lyon Part-Dieu)
  • generic-marseille-07  ⚙️ Machine industrielle (Marseille)

📊 Ouvre le dashboard : http://localhost:3000
```

---

## 🎬 Étape 3 — Ouvrir le dashboard

Dans ton navigateur, ouvre :

**<http://localhost:3000>**

Login :
- Utilisateur : `admin`
- Mot de passe : `changeme`

Tu vas voir tes 3 machines apparaître avec leurs données en temps réel :

- ☕ La **cafetière** monte son compteur de tasses, voit son niveau d'eau baisser, et déclenchera une alerte quand l'eau ou les grains seront bas
- 🥤 Le **distributeur** enregistre des ventes, surveille la température du frigo
- ⚙️ La **machine industrielle** compte les cycles, surveille les vibrations

Clique sur une carte pour voir les **détails et les graphiques**.

Va voir l'icône 🔔 **Alertes** en haut à droite — elle s'allumera quand le simulateur déclenche un évènement.

Tu peux aussi **envoyer une commande** à une machine depuis sa page détail (ex: `ping`, `reboot`, `reset_counter`).

---

## 🛑 Arrêter

Dans chaque Terminal, fais **Ctrl+C**.

---

## 🔁 Relancer plus tard

Quand tu reviens, il suffit de refaire les commandes `npm start` (pas besoin de refaire `npm install`).

```bash
# Terminal 1 :
cd ~/Library/Application\ Support/Claude/local-agent-mode-sessions/c4d80757-e53c-45eb-b93d-7c204ba6b2df/df55fadf-a439-4c8d-8d55-15cbefd7468c/local_f9b0bd5e-71ef-45d6-a856-85db6e4e664a/outputs/telemetry-app/backend
npm start

# Terminal 2 :
cd ~/Library/Application\ Support/Claude/local-agent-mode-sessions/c4d80757-e53c-45eb-b93d-7c204ba6b2df/df55fadf-a439-4c8d-8d55-15cbefd7468c/local_f9b0bd5e-71ef-45d6-a856-85db6e4e664a/outputs/telemetry-app/simulator
npm start
```

---

## 🆘 Dépannage

| Problème                                          | Solution                                              |
|---------------------------------------------------|-------------------------------------------------------|
| `command not found: node`                         | Node.js pas installé — retourne sur nodejs.org        |
| `EADDRINUSE: port 3000 already in use`            | Un autre programme utilise le port — change `HTTP_PORT` dans `backend/.env` |
| `EADDRINUSE: port 1883 already in use`            | Idem pour le MQTT — change `MQTT_PORT` dans `.env` ET dans le simulateur (`MQTT_PORT=… npm start`) |
| Dashboard ne montre rien                          | Vérifie que le simulateur affiche bien `✅ Connecté au broker MQTT` |
| `Auth refusée` côté simulateur                    | `MQTT_TOKEN` du simulateur ≠ `DEVICE_TOKEN` du backend |
| Erreur `npm install` sur better-sqlite3           | Installe les outils Mac : `xcode-select --install`    |

---

## ✨ Prochaine étape

Une fois que tu as testé et que ça te plaît, on passe au **vrai matériel** : Raspberry Pi + ESP32 + machine. Voir [`docs/INSTALLATION.md`](docs/INSTALLATION.md) et [`docs/ESP32_SETUP.md`](docs/ESP32_SETUP.md).
