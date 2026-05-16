# 🔒 Sécurité bout-en-bout — Comment ne pas se faire pirater

Guide pratique avec actions concrètes, par ordre de priorité. Tu n'es pas obligé de tout faire le jour 1 — mais le bloc "MINIMUM VITAL" doit être en place avant le premier client payant.

---

## 🟥 MINIMUM VITAL (à faire AVANT le 1er client payant)

### 1. HTTPS partout — coût : 0€

Sans HTTPS, n'importe qui sur le même WiFi peut voir les mots de passe de tes clients en clair. Inacceptable.

**Solution : Caddy en reverse proxy** (HTTPS automatique gratuit via Let's Encrypt).

`Caddyfile` (à mettre sur le serveur) :
```
telemetrie.fr {
  reverse_proxy localhost:3000
}
api.telemetrie.fr {
  reverse_proxy localhost:3000
}
```

Lance avec `caddy run` et tout est chiffré. Renouvellement automatique des certificats. **Pas d'excuse pour rester en HTTP.**

### 2. Mots de passe forts + bcrypt — déjà fait

Notre backend hashe avec bcrypt (coût 10). Vérifie dans `.env` :
- `JWT_SECRET` = chaîne de 32+ caractères aléatoires (`openssl rand -hex 32`)
- `ADMIN_PASSWORD` ≠ "changeme" en prod (sinon c'est game over en 5 min)
- `DEVICE_TOKEN` unique par client (déjà géré côté multi-tenant)

### 3. Secrets jamais dans Git — coût : 0€

Ajoute à `.gitignore` (déjà fait) :
```
backend/.env
firmware/config.h
*.key *.pem
```

Si tu as déjà commité un secret par erreur :
1. **Révoque-le immédiatement** dans Stripe / etc.
2. Génère-en un nouveau
3. Utilise `git filter-branch` ou BFG pour purger l'historique
4. Force push

### 4. Stripe webhook : vérifier la signature — déjà fait

Notre code vérifie déjà `stripe-signature` (cf `stripeRoutes.js`). Si tu ne le faisais pas, n'importe qui pourrait simuler des paiements en POSTant directement sur ton endpoint.

### 5. Mises à jour automatiques OS — coût : 0€

Sur le serveur Linux :
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

Les patches de sécurité s'installent tout seuls la nuit.

### 6. Firewall — coût : 0€

```bash
sudo ufw default deny incoming
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (redirigé vers HTTPS par Caddy)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 1883/tcp  # MQTT (ou 8883 si TLS)
sudo ufw enable
```

Tout le reste est bloqué. Tes DB, Redis, etc. ne sont accessibles qu'en interne.

### 7. SSH par clé seulement — coût : 0€

Plus de password SSH. Sur ton ordi :
```bash
ssh-keygen -t ed25519
ssh-copy-id user@ton-serveur
```

Sur le serveur, éditer `/etc/ssh/sshd_config` :
```
PasswordAuthentication no
PermitRootLogin no
```

Puis `sudo systemctl restart ssh`. **Bonus** : installe `fail2ban` qui bannit toute IP avec trop d'échecs.

### 8. Backups automatiques chiffrés — coût : 1-5€/mois

Règle des **3-2-1** : 3 copies, sur 2 supports différents, dont 1 hors site.

Script qui tourne chaque nuit :
```bash
#!/bin/bash
DATE=$(date +%F)
docker exec backend sqlite3 /app/backend/data/telemetry.db ".backup /tmp/backup-$DATE.db"
gpg --encrypt --recipient toi@example.com /tmp/backup-$DATE.db
rclone copy /tmp/backup-$DATE.db.gpg backblaze:mon-bucket/
rm /tmp/backup-$DATE.db*
```

Backup chiffré envoyé vers **Backblaze B2** (0,005$/Go/mois — ridicule) ou Hetzner Storage Box (3€/mois pour 100Go).

---

## 🟧 RECOMMANDÉ (premier mois en prod)

### 9. MQTT en TLS (port 8883)

Sans TLS, les ESP32 envoient leur token en clair sur internet. Quelqu'un qui sniffe le réseau peut voler le token et publier des fausses données.

```javascript
// Côté serveur (server.js)
const tls = require('tls');
const fs = require('fs');
const tlsServer = tls.createServer({
  key: fs.readFileSync('/path/to/key.pem'),
  cert: fs.readFileSync('/path/to/cert.pem'),
}, aedes.handle);
tlsServer.listen(8883);
```

Côté ESP32 (firmware), on passe à WiFiClientSecure et on inclut le certificat. Documentation à fournir au client.

### 10. Rotation des tokens

Permets aux clients de **régénérer leur device_token** depuis le dashboard. Si un token fuit, ils l'invalident en 1 clic.

### 11. 2FA pour le dashboard

Une fois que tes clients sont à 100€/mois et stockent des données business sensibles, ils veulent du 2FA.

Solution simple : intégrer **TOTP** (Google Authenticator, Authy, 1Password).

```javascript
const speakeasy = require('speakeasy');
// Génère secret + QR code à scanner, puis vérifier le code à 6 chiffres au login
```

Lib `speakeasy` + `qrcode` → ~50 lignes de code à ajouter.

### 12. Rate limiting

Empêche les attaques par brute force et déni de service.

```javascript
const rateLimit = require('express-rate-limit');
app.use('/api/login', rateLimit({ windowMs: 15*60*1000, max: 5 }));
app.use('/api/', rateLimit({ windowMs: 60*1000, max: 100 }));
```

### 13. Headers de sécurité

```javascript
const helmet = require('helmet');
app.use(helmet());
```

Cette seule ligne ajoute 12 headers HTTP de protection (XSS, clickjacking, MIME sniffing, etc.).

### 14. Logs centralisés (sans secrets dedans)

Configure des logs structurés (`pino` ou `winston`) qui partent vers :
- Local : fichier rotatif
- Cloud : Better Stack (gratuit < 1Go/mois), Logtail, Grafana Cloud, Papertrail

**Règle d'or** : ne JAMAIS logger un mot de passe, token, payload Stripe, etc. Mets un filtre `redact` qui masque les champs sensibles.

### 15. Monitoring uptime

- **UptimeRobot** (gratuit) : ping ton site toutes les 5 min, t'envoie un SMS si down
- **Better Stack** : monitoring + status page publique (rassure tes clients)
- **Sentry** (gratuit < 5k events/mois) : capture les exceptions JS/Node automatiquement

### 16. Sécurité côté ESP32

- Token unique par device (pas un token par org partagé entre 100 machines)
- Vérification stricte du serveur via certificat TLS
- OTA signé (firmware updates signés cryptographiquement)
- Pas de credentials hardcodés dans le binaire si possible (stocker en NVS chiffré)

---

## 🟨 IDÉAL (à 1000 clients / 100k€ ARR)

### 17. Pentest annuel

Recrute un pentester (Hadrian, Yes We Hack, RougeIT) pour qu'il essaie de pirater ton infra. Compter **3000-8000€** par audit, 1 fois par an.

### 18. Bug bounty programme

Yes We Hack ou HackerOne : tu paies des hackers éthiques pour trouver des failles avant les méchants. Budget 200-2000€ par bug selon gravité.

### 19. Certification ISO 27001 ou SOC 2

Obligatoire si tu veux des clients grands comptes (banques, hôpitaux, mairies). 6-12 mois de prépa, 5-20k€ d'audit. **Pas pour tout de suite.**

### 20. RGPD : registre des traitements + DPA

Pour les clients B2B, ils te demanderont un **Data Processing Agreement** (DPA) signé. Template gratuit sur <https://www.cnil.fr>.

Tu dois aussi tenir un **registre des traitements** (Excel suffit) listant : quelle donnée, où, qui y accède, durée de conservation.

### 21. Suppression sur demande (Article 17 RGPD)

Implémente un endpoint `DELETE /api/me` qui supprime cascade :
- L'utilisateur
- Son organisation
- Ses machines
- Toute sa télémétrie
- Tous ses logs

Délai légal : 30 jours.

### 22. DPO (Data Protection Officer)

Obligatoire si tu fais du "traitement à grande échelle". Tu peux :
- Le déléguer en interne (formation 2 jours)
- L'externaliser (~200€/mois chez DPO Consulting, Demarches.fr)

---

## 🛡️ Architecture sécurisée — schéma cible

```
Internet
   │
   ▼
┌──────────────┐
│ Cloudflare   │  ← DNS + WAF + DDoS protection (gratuit)
└──────┬───────┘
       │ HTTPS only
       ▼
┌──────────────┐
│   Caddy      │  ← reverse proxy + HTTPS auto Let's Encrypt
└──────┬───────┘
       │
   ┌───┴───────────────────────┐
   ▼                           ▼
┌─────────────┐         ┌──────────────┐
│ Node.js     │         │ MQTT broker  │
│ backend     │         │ TLS port 8883│
│ + auth JWT  │         │              │
└──────┬──────┘         └──────────────┘
       │
       ▼
┌──────────────┐
│ SQLite (WAL) │  ← chiffrement disque LUKS
│ + backups GPG│
└──────────────┘
```

Fichier docker-compose complet avec Caddy + backend + monitoring : disponible dans `infra/secure-stack/` (à créer en phase 2).

---

## ✅ Checklist personnelle

Coche ces points avant ton 1er client payant :

```
☐ HTTPS partout (Caddy + Let's Encrypt)
☐ JWT_SECRET = 64+ caractères aléatoires
☐ ADMIN_PASSWORD ≠ changeme en .env prod
☐ .env hors git (ajouté à .gitignore)
☐ Webhook Stripe vérifie la signature
☐ unattended-upgrades activé sur le serveur
☐ ufw firewall actif
☐ SSH par clé uniquement, plus de password
☐ fail2ban installé
☐ Backups quotidiens chiffrés sur Backblaze ou équivalent
☐ helmet middleware sur Express
☐ rate-limit sur /api/login
☐ Sentry pour les exceptions
☐ UptimeRobot ping toutes les 5 min
☐ CGU/CGV/Mentions légales en ligne
☐ Page "Politique de confidentialité" RGPD
```

---

## 🆘 Que faire si je me fais pirater ?

1. **Coupe** : `docker compose stop`, retire le serveur d'internet (ufw deny tout)
2. **Préviens** : tes clients, sous 72h (obligatoire RGPD si données perso)
3. **Notifie** la CNIL via <https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles>
4. **Restaure** depuis un backup non compromis
5. **Reverse tous les secrets** : Stripe, JWT, device tokens
6. **Analyse** les logs pour comprendre l'attaque
7. **Patche** la vulnérabilité
8. **Audit** post-mortem par un pentester
9. **Communique** publiquement (page de transparence)

---

## 📞 Ressources

- **CNIL** (RGPD) : <https://www.cnil.fr>
- **ANSSI** (cyber FR) : <https://www.cybermalveillance.gouv.fr> — guide gratuit PME
- **CERT-FR** : alerte de vulnérabilités, gratuit
- **OWASP Top 10** : les 10 erreurs les plus communes : <https://owasp.org/Top10>
- **Have I Been Pwned** : vérifie si tes emails ont fuité : <https://haveibeenpwned.com>
