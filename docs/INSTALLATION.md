# 🛠️ Installation pas-à-pas sur Raspberry Pi

Ce guide te permet de faire tourner la plateforme de télémétrie **sans connaissance préalable en code**.
Tu n'auras besoin que de copier-coller quelques commandes.

---

## 📋 Matériel nécessaire

| Élément                                | Pourquoi                                              |
|----------------------------------------|-------------------------------------------------------|
| Raspberry Pi 4 (2 Go minimum) ou Pi 5  | Le serveur de télémétrie                              |
| Carte SD 32 Go                          | OS du Pi                                              |
| Alimentation USB-C officielle           | Stabilité (les chargeurs bas de gamme causent des bugs) |
| Connexion internet du Pi (ethernet idéal) | Pour recevoir les données des ESP32                  |
| Une IP publique fixe **ou** un nom de domaine (no-ip.com, duckdns.org gratuits) | Pour que les ESP32 puissent se connecter |

---

## 1️⃣ Préparer le Raspberry Pi

### Installer Raspberry Pi OS

1. Télécharge **Raspberry Pi Imager** : <https://www.raspberrypi.com/software/>
2. Lance-le, choisis **Raspberry Pi OS Lite (64-bit)** (pas besoin de bureau)
3. Clique sur l'engrenage ⚙️ pour pré-configurer :
   - Active **SSH**
   - Définis un nom d'utilisateur et mot de passe
   - Renseigne ton **Wi-Fi** si pas d'ethernet
4. Flashe la carte SD, insère-la dans le Pi, et allume.

### Se connecter en SSH

Sur ton ordinateur :

```bash
ssh ton-utilisateur@raspberrypi.local
```

Si `raspberrypi.local` ne marche pas, trouve son IP dans ta box internet.

---

## 2️⃣ Installer Docker

Une commande suffit :

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# Redémarre la session pour appliquer les permissions
exit
```

Reconnecte-toi en SSH, puis vérifie :

```bash
docker --version
docker compose version
```

---

## 3️⃣ Récupérer le code de l'application

Si tu as les fichiers en zip, transfère-les sur le Pi via SCP :

```bash
# Depuis ton ordinateur (pas le Pi)
scp -r telemetry-app/ ton-utilisateur@raspberrypi.local:~/
```

Sinon, depuis Git :

```bash
# Sur le Pi
git clone <url-de-ton-dépôt> telemetry-app
cd telemetry-app
```

---

## 4️⃣ Configurer le backend

```bash
cd ~/telemetry-app
cp backend/.env.example backend/.env
nano backend/.env
```

Modifie **obligatoirement** ces lignes :

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=mon-super-mot-de-passe   # CHANGE-MOI
JWT_SECRET=une-longue-chaine-aleatoire   # CHANGE-MOI (ex: openssl rand -hex 32)
DEVICE_TOKEN=esp32-secret-tres-long      # CHANGE-MOI (mémorise-le, à mettre dans les ESP32)
```

Pour générer un `JWT_SECRET` solide :

```bash
openssl rand -hex 32
```

Sauvegarde (Ctrl+O, Entrée, Ctrl+X).

---

## 5️⃣ Lancer l'application

```bash
docker compose up -d
```

La première fois, ça prend 2-5 minutes (téléchargement et build).

Vérifie que tout tourne :

```bash
docker compose ps
docker compose logs -f telemetry
```

Tu dois voir :

```
[INFO] Broker MQTT démarré sur le port 1883
[INFO] Serveur HTTP + Dashboard sur http://localhost:3000
```

Appuie sur `Ctrl+C` pour quitter les logs (le container reste actif).

---

## 6️⃣ Accéder au dashboard

Sur ton ordinateur, ouvre dans le navigateur :

```
http://<ip-de-ton-pi>:3000
```

Login : `admin` / le mot de passe que tu as défini.

🎉 **Tu es opérationnel !** Le dashboard est vide pour le moment — il se remplira dès qu'un ESP32 enverra des données.

---

## 7️⃣ Rendre le Pi accessible depuis internet

Pour que les ESP32 sur le terrain (réseau cellulaire 4G) puissent joindre ton Pi, il faut **ouvrir l'accès depuis l'extérieur**.

### Option A : Box internet avec IP publique (le plus simple)

1. Va dans l'interface de ta box (Freebox, Livebox, etc.)
2. Crée deux **redirections de port** vers l'IP locale du Pi :
   - Port externe **1883** → port interne **1883** (MQTT)
   - Port externe **3000** → port interne **3000** (dashboard, optionnel)
3. Note ton **IP publique** (visible sur <https://whatismyip.com>)
4. Si ton IP change, utilise un service de **DNS dynamique** :
   - **DuckDNS** (gratuit) : <https://duckdns.org>
   - **No-IP** (gratuit) : <https://noip.com>

Tu auras alors une adresse type `monpi.duckdns.org` à mettre dans `firmware/config.h` (`MQTT_HOST`).

### Option B : VPN privé (le plus sûr)

Installe **Tailscale** sur le Pi et sur chaque ESP32 (peu courant côté ESP32) — utile surtout pour gérer le Pi à distance.

### Option C : Tunnel Cloudflare

Plus avancé, sécurise et chiffre les connexions, gratuit jusqu'à un certain trafic.

---

## 8️⃣ Maintenance

### Mettre à jour

```bash
cd ~/telemetry-app
git pull                                # ou re-transfère les fichiers
docker compose build
docker compose up -d
```

### Voir les logs

```bash
docker compose logs -f telemetry
```

### Sauvegarder la base de données

```bash
docker run --rm -v telemetry-app_telemetry_data:/data -v $(pwd):/backup busybox \
  tar czvf /backup/sauvegarde-$(date +%F).tar.gz /data
```

### Arrêter / redémarrer

```bash
docker compose stop
docker compose start
docker compose restart
```

### Désinstaller complètement

```bash
docker compose down -v   # -v supprime aussi les données !
```

---

## 🆘 Dépannage

| Problème                              | Solution                                                |
|---------------------------------------|---------------------------------------------------------|
| `docker: command not found`           | Reconnecte-toi en SSH après l'install Docker             |
| Dashboard inaccessible                | Vérifie `docker compose ps`, puis le port 3000 dans la box |
| ESP32 ne se connecte pas              | Teste depuis ton PC : `mosquitto_sub -h <ip-pi> -p 1883 -u device -P <token> -t '#'` |
| `Auth refusée` côté ESP32             | `MQTT_PASSWORD` du firmware ≠ `DEVICE_TOKEN` du backend |
| Pi rame                                | Augmente le swap : `sudo dphys-swapfile setup`           |

---

Bon déploiement ! Pour les questions sur l'ESP32, voir [`ESP32_SETUP.md`](ESP32_SETUP.md).
