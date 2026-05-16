"""
Agent Operations — Chaque matin à 7h :
1. Détecte les machines à visiter (stock bas, alertes critiques, maintenance programmée)
2. Optimise la tournée (nearest-neighbor TSP heuristique, sans dépendance externe)
3. Envoie le planning au technicien par SMS (Twilio) + URL Google Maps multi-stops

Usage :
    python operations_agent.py                                      # Run prod
    python operations_agent.py --dry-run                            # Sans envoyer SMS
    python operations_agent.py --tech-phone +33612345678 --tech-start 48.85,2.35

Cron suggéré :
    0 7 * * 1-5 cd /home/telemetry/agents && python operations_agent.py

Coût : Twilio SMS FR ~0,06€/SMS. Pas de LLM utilisé (optimisation TSP pure).
"""

import os, sys, json, math, sqlite3, argparse, urllib.parse, urllib.request, urllib.error
from datetime import datetime

DB_PATH = os.getenv('DB_PATH', '../backend/data/telemetry.db')
TWILIO_SID = os.getenv('TWILIO_ACCOUNT_SID', '')
TWILIO_TOKEN = os.getenv('TWILIO_AUTH_TOKEN', '')
TWILIO_FROM = os.getenv('TWILIO_FROM', '+33XXXXXXXXX')
TECH_PHONE = os.getenv('TECH_PHONE', '')
TECH_START_LAT = float(os.getenv('TECH_START_LAT', '48.8566'))
TECH_START_LNG = float(os.getenv('TECH_START_LNG', '2.3522'))
STOCK_THRESHOLD = int(os.getenv('STOCK_THRESHOLD', '25'))
MAX_STOPS = int(os.getenv('MAX_STOPS_PER_TOUR', '8'))


def haversine(lat1, lng1, lat2, lng2):
    """Distance km entre 2 points GPS."""
    R = 6371
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dlng/2)**2
    return 2 * R * math.asin(math.sqrt(a))


# =========================================================
# 1. Identifier les machines à visiter
# =========================================================
def find_machines_to_visit():
    if not os.path.exists(DB_PATH):
        print(f"❌ Base introuvable : {DB_PATH}")
        return []
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    # Devices avec lat/lng (les colonnes peuvent ne pas exister)
    cols = [r['name'] for r in conn.execute("PRAGMA table_info(devices)")]
    if 'metadata_json' not in cols:
        conn.close(); return []

    devices = conn.execute("SELECT * FROM devices").fetchall()
    to_visit = []

    for d in devices:
        meta = {}
        try:
            meta = json.loads(d['metadata_json']) if d['metadata_json'] else {}
        except: pass
        lat = meta.get('lat')
        lng = meta.get('lng')
        if not lat or not lng:
            continue   # impossible d'optimiser sans GPS

        reason = None
        priority = 0

        # Dernière télémétrie
        last = conn.execute(
            "SELECT payload FROM telemetry WHERE device_id = ? ORDER BY ts DESC LIMIT 1",
            (d['id'],)
        ).fetchone()
        if last:
            try:
                p = json.loads(last['payload'])
                stock = p.get('stock_pct') or p.get('stock')
                if stock is not None and stock < STOCK_THRESHOLD:
                    reason = f"Stock {stock}%"
                    priority = max(priority, 60 + (STOCK_THRESHOLD - stock))
            except: pass

        # Alertes ouvertes
        alerts = conn.execute(
            "SELECT COUNT(*) as n, MAX(level) as worst FROM events WHERE device_id = ? AND acked = 0",
            (d['id'],)
        ).fetchone()
        if alerts and alerts['n'] > 0:
            level = alerts['worst'] or 'info'
            if level == 'error':
                reason = (reason + ' + ' if reason else '') + 'ALERTE CRITIQUE'
                priority = max(priority, 100)
            elif level == 'warn':
                reason = (reason + ' + ' if reason else '') + 'alerte'
                priority = max(priority, 70)

        if reason:
            to_visit.append({
                'id': d['id'], 'name': d['name'], 'lat': float(lat), 'lng': float(lng),
                'location': d['location'] or '', 'reason': reason, 'priority': priority,
            })

    conn.close()
    return to_visit


# =========================================================
# 2. TSP nearest-neighbor (heuristique simple, suffisante < 20 stops)
# =========================================================
def optimize_route(start_lat, start_lng, stops):
    """Renvoie les stops dans l'ordre optimal + distance totale."""
    if not stops: return [], 0
    remaining = stops[:]
    current_lat, current_lng = start_lat, start_lng
    ordered = []
    total_km = 0

    while remaining:
        # Trouve le plus proche, en pondérant par priorité (les criticals d'abord à dist égale)
        best = None
        best_score = float('inf')
        for s in remaining:
            d = haversine(current_lat, current_lng, s['lat'], s['lng'])
            score = d - (s['priority'] / 20)   # priorité haute → score diminué
            if score < best_score:
                best_score = score
                best = s
        ordered.append(best)
        total_km += haversine(current_lat, current_lng, best['lat'], best['lng'])
        current_lat, current_lng = best['lat'], best['lng']
        remaining.remove(best)

    # Retour au point de départ
    total_km += haversine(current_lat, current_lng, start_lat, start_lng)
    return ordered, total_km


def google_maps_url(start_lat, start_lng, stops):
    waypoints = [f"{s['lat']},{s['lng']}" for s in stops]
    if not waypoints: return None
    origin = f"{start_lat},{start_lng}"
    destination = waypoints[-1]
    intermediate = "|".join(waypoints[:-1])
    url = "https://www.google.com/maps/dir/?api=1"
    url += f"&origin={origin}&destination={destination}"
    if intermediate: url += f"&waypoints={urllib.parse.quote(intermediate)}"
    url += "&travelmode=driving"
    return url


def format_sms(ordered, total_km, gmaps_url):
    n = len(ordered)
    est_minutes = int(total_km / 50 * 60 + n * 20)  # 50 km/h + 20 min/stop
    msg = f"🚐 Tournée du {datetime.now().strftime('%d/%m')} :\n"
    msg += f"{n} stops · {total_km:.0f} km · ~{est_minutes//60}h{est_minutes%60:02d}\n\n"
    for i, s in enumerate(ordered, 1):
        msg += f"{i}. {s['name']} ({s['location']}) — {s['reason']}\n"
    if gmaps_url:
        msg += f"\n📍 GPS : {gmaps_url[:80]}...\n"
    return msg


# =========================================================
# 3. Envoi Twilio
# =========================================================
def send_sms_twilio(to, body):
    if not TWILIO_SID or not TWILIO_TOKEN:
        return False, "TWILIO non configuré"
    url = f"https://api.twilio.com/2010-04-01/Accounts/{TWILIO_SID}/Messages.json"
    data = urllib.parse.urlencode({'From': TWILIO_FROM, 'To': to, 'Body': body}).encode()
    auth = f"{TWILIO_SID}:{TWILIO_TOKEN}"
    import base64
    auth_b64 = base64.b64encode(auth.encode()).decode()
    req = urllib.request.Request(url, data=data, headers={
        'Authorization': f'Basic {auth_b64}',
        'Content-Type': 'application/x-www-form-urlencoded',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.loads(r.read())
        return True, d.get('sid')
    except urllib.error.HTTPError as e:
        return False, e.read().decode()


# =========================================================
# Main
# =========================================================
def main():
    p = argparse.ArgumentParser()
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--tech-phone', default=TECH_PHONE)
    p.add_argument('--tech-start', help='Format: lat,lng', default=f"{TECH_START_LAT},{TECH_START_LNG}")
    p.add_argument('--max-stops', type=int, default=MAX_STOPS)
    args = p.parse_args()

    try:
        start_lat, start_lng = [float(x) for x in args.tech_start.split(',')]
    except:
        print(f"❌ tech-start invalide : {args.tech_start}")
        return 1

    print(f"🔍 Recherche machines à visiter (stock < {STOCK_THRESHOLD}%, alertes critiques)...")
    machines = find_machines_to_visit()
    print(f"   → {len(machines)} machines candidates")
    if not machines:
        print("✅ Rien à faire aujourd'hui.")
        return 0

    # Trie par priorité, garde les N premières
    machines.sort(key=lambda m: -m['priority'])
    machines = machines[:args.max_stops]

    print(f"🗺️  Optimisation tournée depuis ({start_lat}, {start_lng})...")
    ordered, total_km = optimize_route(start_lat, start_lng, machines)

    gmaps = google_maps_url(start_lat, start_lng, ordered)
    sms = format_sms(ordered, total_km, gmaps)
    print("\n" + sms)

    if args.tech_phone and not args.dry_run:
        ok, info = send_sms_twilio(args.tech_phone, sms)
        if ok:
            print(f"\n✅ SMS envoyé à {args.tech_phone} (SID: {info})")
        else:
            print(f"\n⚠️  Échec SMS : {info}")
    elif args.dry_run:
        print("\n[DRY-RUN] SMS NON envoyé.")
    else:
        print("\n⚠️  Pas de TECH_PHONE configuré — SMS non envoyé.")

    return 0


if __name__ == '__main__':
    sys.exit(main())
