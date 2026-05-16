#!/bin/bash
# Script d'install d'un VPS Ubuntu 22.04 frais pour Télémétrie
# Usage : curl -fsSL https://raw.githubusercontent.com/.../setup-server.sh | sudo bash
set -e

echo "=== 1/9 Mises à jour système ==="
apt update && apt upgrade -y

echo "=== 2/9 Installation outils essentiels ==="
apt install -y curl wget git ufw fail2ban unattended-upgrades sqlite3 gnupg rclone

echo "=== 3/9 Firewall UFW ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp        # SSH
ufw allow 80/tcp        # HTTP
ufw allow 443/tcp       # HTTPS
ufw allow 443/udp       # HTTP/3
ufw allow 1883/tcp      # MQTT
ufw --force enable

echo "=== 4/9 SSH hardening ==="
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh || systemctl restart sshd

echo "=== 5/9 Mises à jour auto ==="
dpkg-reconfigure -plow unattended-upgrades

echo "=== 6/9 fail2ban ==="
systemctl enable --now fail2ban

echo "=== 7/9 Docker ==="
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "=== 8/9 Création utilisateur applicatif ==="
if ! id telemetry &>/dev/null; then
  useradd -m -s /bin/bash telemetry
  usermod -aG docker telemetry
fi

echo "=== 9/9 Récap ==="
ufw status verbose
docker --version
echo ""
echo "✅ Serveur prêt."
echo ""
echo "Étapes suivantes :"
echo "  1. Pousser le code dans /home/telemetry/telemetry-app"
echo "  2. Configurer backend/.env (Stripe LIVE, JWT_SECRET, etc.)"
echo "  3. Pointer ton DNS vers cette IP :"
ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | head -1
echo "  4. cd telemetry-app/infra && docker compose -f docker-compose.prod.yml up -d"
echo "  5. Vérifier https://telemetrie-fr.com et https://status.telemetrie-fr.com"
