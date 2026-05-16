"""
Agent Customer Success — Détecte les clients à risque et leur envoie un email
de réengagement personnalisé via Claude API + Resend.

Usage :
    python customer_success_agent.py --dry-run     # Test sans envoyer
    python customer_success_agent.py               # Mode prod
    python customer_success_agent.py --min-days 7  # Inactif depuis 7j au lieu de 14

Cron suggéré (tous les jours 9h) :
    0 9 * * * cd /home/telemetry/agents && python customer_success_agent.py

Coût LLM : ~0,002€/email (Mistral Small) ou ~0,01€ (Claude Haiku)
Coût Resend : gratuit jusqu'à 3000 emails/mois
"""

import os
import sys
import json
import sqlite3
import argparse
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# === Logging ===
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('agent.log'),
        logging.StreamHandler()
    ]
)
log = logging.getLogger('cs-agent')

# === Configuration ===
DB_PATH       = os.getenv('DB_PATH', '../backend/data/telemetry.db')
LLM_PROVIDER  = os.getenv('LLM_PROVIDER', 'mistral')  # 'mistral' ou 'anthropic'
MISTRAL_KEY   = os.getenv('MISTRAL_API_KEY', '')
ANTHROPIC_KEY = os.getenv('ANTHROPIC_API_KEY', '')
RESEND_KEY    = os.getenv('RESEND_API_KEY', '')
FROM_EMAIL    = os.getenv('FROM_EMAIL', 'salih@telemetrie-fr.com')
FROM_NAME     = os.getenv('FROM_NAME', 'Salih')
INACTIVE_DAYS = int(os.getenv('INACTIVE_DAYS', '14'))
MAX_EMAILS    = int(os.getenv('MAX_EMAILS_PER_RUN', '20'))   # Sécurité anti-spam
KILL_FILE     = '../STOP_AGENTS'                            # Kill switch

# === Kill switch ===
if os.path.exists(KILL_FILE):
    log.error("Kill switch activé (fichier STOP_AGENTS détecté). Arrêt.")
    sys.exit(1)


# =========================================================
# Étape 1 — Identifier les clients à risque
# =========================================================
def find_at_risk_customers(db_path: str, inactive_days: int) -> List[Dict]:
    """
    Retourne les comptes qui :
    - Sont actifs payants (plan != 'trial' et != 'canceled')
    - N'ont pas reçu de télémétrie depuis X jours (machine éteinte ?)
    - OU n'ont jamais reçu de télémétrie après inscription (onboarding raté)
    """
    if not os.path.exists(db_path):
        log.error(f"Base introuvable : {db_path}")
        return []

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row

    cutoff = int((datetime.now() - timedelta(days=inactive_days)).timestamp() * 1000)
    week_ago = int((datetime.now() - timedelta(days=7)).timestamp() * 1000)

    query = """
        SELECT
            o.id AS org_id,
            o.name AS company,
            o.plan,
            o.created_at,
            u.email,
            u.id AS user_id,
            (SELECT COUNT(*) FROM devices d WHERE d.org_id = o.id) AS device_count,
            (SELECT MAX(d.last_seen) FROM devices d WHERE d.org_id = o.id) AS last_telemetry,
            (SELECT COUNT(*) FROM events e
              JOIN devices d ON d.id = e.device_id
              WHERE d.org_id = o.id AND e.acked = 0) AS unacked_alerts
        FROM organizations o
        JOIN users u ON u.org_id = o.id AND u.role IN ('owner', 'admin')
        WHERE o.plan NOT IN ('canceled', 'trial')
          AND o.created_at < ?
        GROUP BY o.id
    """
    rows = conn.execute(query, (week_ago,)).fetchall()
    conn.close()

    at_risk = []
    for r in rows:
        record = dict(r)
        last = record['last_telemetry']

        # Cas 1 : devices mais aucune donnée depuis X jours
        if last and last < cutoff and record['device_count'] > 0:
            record['risk_reason'] = 'machines_silent'
            at_risk.append(record)
        # Cas 2 : compte payant SANS aucune machine (onboarding incomplet)
        elif record['device_count'] == 0:
            record['risk_reason'] = 'no_devices'
            at_risk.append(record)
        # Cas 3 : alertes non acquittées (potentiellement abandon)
        elif record['unacked_alerts'] > 5:
            record['risk_reason'] = 'unacked_alerts'
            at_risk.append(record)

    return at_risk[:MAX_EMAILS]  # Limite anti-spam


# =========================================================
# Étape 2 — Générer un email personnalisé avec LLM
# =========================================================
SYSTEM_PROMPT = """Tu es Customer Success Manager pour Télémétrie (SaaS de supervision IoT pour cafetières, distributeurs et frigos pro).

Ton rôle : rédiger un email de réengagement court (5-7 lignes max), chaleureux mais pas mielleux. Pas de "passionné, ravi, formidable". Pas d'emoji.

L'email doit :
1. Commencer par "Bonjour {{prénom_du_destinataire}}," (le prénom = avant le @ de l'email)
2. Mentionner un constat factuel (pas culpabilisant) basé sur les données fournies
3. Poser UNE seule question ouverte (pas plusieurs)
4. Proposer une action simple (visio 15 min, ou réponse par email)
5. Se terminer par "{{from_name}}, Télémétrie"

Style : tutoiement OK pour PME, ton direct, max 80 mots.

Réponds UNIQUEMENT avec un JSON : {"subject": "...", "body": "..."} (rien d'autre).
"""

def generate_email_mistral(customer: Dict) -> Optional[Dict]:
    """Génère subject + body via Mistral API."""
    import urllib.request
    import urllib.error

    context = build_context(customer)

    body = json.dumps({
        "model": "mistral-small-latest",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": context}
        ],
        "temperature": 0.7,
        "response_format": {"type": "json_object"},
    }).encode()

    req = urllib.request.Request(
        "https://api.mistral.ai/v1/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {MISTRAL_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        content = data['choices'][0]['message']['content']
        return json.loads(content)
    except (urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
        log.error(f"Mistral error : {e}")
        return None


def generate_email_claude(customer: Dict) -> Optional[Dict]:
    """Génère subject + body via Anthropic Claude."""
    import urllib.request
    import urllib.error

    context = build_context(customer)
    body = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 400,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": context}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        text = data['content'][0]['text']
        # Cherche le bloc JSON
        start = text.find('{')
        end = text.rfind('}') + 1
        return json.loads(text[start:end])
    except (urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
        log.error(f"Claude error : {e}")
        return None


def build_context(customer: Dict) -> str:
    """Construit le contexte injecté dans le prompt LLM."""
    reason_labels = {
        'machines_silent': "Ses machines n'envoient plus de données depuis longtemps",
        'no_devices': "Il s'est inscrit en plan payant mais n'a connecté aucune machine",
        'unacked_alerts': f"Il a {customer['unacked_alerts']} alertes non lues dans son dashboard",
    }
    last_seen = (
        datetime.fromtimestamp(customer['last_telemetry']/1000).strftime('%d/%m/%Y')
        if customer['last_telemetry'] else "Jamais"
    )
    days_since_signup = (datetime.now() - datetime.fromtimestamp(customer['created_at']/1000)).days

    return f"""Informations sur le client :
- Entreprise : {customer['company']}
- Email : {customer['email']}
- Plan : {customer['plan']}
- Inscrit il y a : {days_since_signup} jours
- Nb machines : {customer['device_count']}
- Dernière télémétrie reçue : {last_seen}
- Alertes non lues : {customer['unacked_alerts']}

Constat : {reason_labels[customer['risk_reason']]}

From: {FROM_NAME}
"""


# =========================================================
# Étape 3 — Envoyer via Resend
# =========================================================
def send_email_resend(to_email: str, subject: str, body: str, dry_run: bool = False) -> bool:
    """Envoie l'email via Resend API."""
    if dry_run:
        log.info(f"[DRY-RUN] À : {to_email}")
        log.info(f"[DRY-RUN] Sujet : {subject}")
        log.info(f"[DRY-RUN] Corps :\n{body}\n")
        return True

    import urllib.request
    import urllib.error

    html_body = body.replace("\n", "<br>")
    payload = json.dumps({
        "from": f"{FROM_NAME} <{FROM_EMAIL}>",
        "to": [to_email],
        "subject": subject,
        "html": f"<div style='font-family:sans-serif;font-size:14px;line-height:1.5'>{html_body}</div>",
        "headers": {
            "List-Unsubscribe": f"<mailto:{FROM_EMAIL}?subject=unsubscribe>",
        },
        "tags": [{"name": "agent", "value": "customer_success"}],
    }).encode()

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {RESEND_KEY}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        log.info(f"Email envoyé à {to_email} (id={data.get('id')})")
        return True
    except urllib.error.URLError as e:
        log.error(f"Resend error pour {to_email} : {e}")
        return False


# =========================================================
# Étape 4 — Tracking des envois (anti-doublon)
# =========================================================
def has_been_contacted_recently(db_path: str, user_id: str, days: int = 30) -> bool:
    """Vérifie qu'on n'a pas spammé le même utilisateur récemment."""
    conn = sqlite3.connect(db_path)
    # Table tracking créée si absente
    conn.execute("""
        CREATE TABLE IF NOT EXISTS agent_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            agent TEXT NOT NULL,
            ts INTEGER NOT NULL,
            subject TEXT,
            success INTEGER
        )
    """)
    cutoff = int((datetime.now() - timedelta(days=days)).timestamp() * 1000)
    row = conn.execute(
        "SELECT 1 FROM agent_logs WHERE user_id = ? AND agent = 'customer_success' AND ts > ? LIMIT 1",
        (user_id, cutoff)
    ).fetchone()
    conn.close()
    return row is not None


def log_contact(db_path: str, user_id: str, subject: str, success: bool):
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO agent_logs (user_id, agent, ts, subject, success) VALUES (?, 'customer_success', ?, ?, ?)",
        (user_id, int(datetime.now().timestamp() * 1000), subject, 1 if success else 0)
    )
    conn.commit()
    conn.close()


# =========================================================
# Main
# =========================================================
def main():
    parser = argparse.ArgumentParser(description="Agent Customer Success")
    parser.add_argument('--dry-run', action='store_true', help='Mode test sans envoi')
    parser.add_argument('--min-days', type=int, default=INACTIVE_DAYS, help='Jours d\'inactivité')
    parser.add_argument('--max', type=int, default=MAX_EMAILS, help='Nb max d\'emails ce run')
    args = parser.parse_args()

    log.info(f"=== Agent Customer Success démarré (dry-run={args.dry_run}) ===")

    # Validations
    if not args.dry_run:
        if not RESEND_KEY: log.error("RESEND_API_KEY manquant"); return 1
    if LLM_PROVIDER == 'mistral' and not MISTRAL_KEY:
        log.error("MISTRAL_API_KEY manquant"); return 1
    if LLM_PROVIDER == 'anthropic' and not ANTHROPIC_KEY:
        log.error("ANTHROPIC_API_KEY manquant"); return 1

    # 1. Identifier les clients à risque
    at_risk = find_at_risk_customers(DB_PATH, args.min_days)
    log.info(f"Clients à risque identifiés : {len(at_risk)}")

    if not at_risk:
        log.info("Rien à faire aujourd'hui. Tous les clients sont actifs.")
        return 0

    # 2. Pour chaque, générer + envoyer
    sent = 0
    skipped = 0
    failed = 0
    for customer in at_risk[:args.max]:
        # Anti-spam : ne pas recontacter < 30j
        if has_been_contacted_recently(DB_PATH, customer['user_id'], 30):
            log.info(f"  ⏭  {customer['email']} déjà contacté < 30j")
            skipped += 1
            continue

        log.info(f"  → {customer['email']} (raison: {customer['risk_reason']})")

        # Générer l'email avec le LLM
        email = (generate_email_mistral(customer) if LLM_PROVIDER == 'mistral'
                 else generate_email_claude(customer))
        if not email or 'subject' not in email or 'body' not in email:
            log.warning(f"    ⚠ Génération LLM échouée")
            failed += 1
            continue

        # Envoyer
        success = send_email_resend(customer['email'], email['subject'], email['body'], args.dry_run)
        if success:
            sent += 1
            if not args.dry_run:
                log_contact(DB_PATH, customer['user_id'], email['subject'], True)
        else:
            failed += 1

    # 3. Rapport
    log.info(f"=== Fini : {sent} envoyés, {skipped} skip, {failed} échecs ===")
    return 0


if __name__ == '__main__':
    sys.exit(main())
