"""
Agent Lead Qualification — Score automatique des prospects + génération
d'emails de prospection personnalisés via Mistral / Claude.

Usage :
    python lead_qualification_agent.py prospects.csv
    python lead_qualification_agent.py prospects.csv --dry-run

Format CSV d'entrée (colonnes obligatoires) :
    name,company,website,sector,linkedin_url

Output :
    prospects_qualified.csv (avec score + email perso)
    emails_to_send/  (1 .txt par prospect)

Coût LLM : ~0,01€ par prospect.
"""

import os, sys, csv, json, argparse, urllib.request, urllib.error
from datetime import datetime
from pathlib import Path

MISTRAL_KEY = os.getenv('MISTRAL_API_KEY', '')
FROM_NAME = os.getenv('FROM_NAME', 'Salih')
SECTOR_FIT = {
    'restauration': 9, 'café': 9, 'restaurant': 9, 'hotel': 8,
    'distributeur': 10, 'vending': 10, 'snacking': 9,
    'industrie': 7, 'maintenance': 8, 'plomberie': 6,
    'frigoriste': 9, 'cuisine pro': 8,
    'tabac': 7, 'pressing': 4, 'salon coiffure': 3,
}

SYSTEM_PROMPT = """Tu es expert en prospection B2B pour Télémétrie (SaaS de supervision IoT pour machines : cafetières pro, distributeurs auto, frigos HACCP, équipements industriels).

À partir des informations sur un prospect, tu dois :
1. Évaluer un score d'opportunité de 1 à 10
2. Donner 2-3 raisons concises
3. Rédiger un email de prospection ULTRA-PERSONNALISÉ (4-5 lignes max) qui montre que tu as fait tes devoirs

L'email doit :
- Commencer par "Bonjour {prénom}," (prénom déduit du nom)
- Mentionner un détail spécifique à leur entreprise (basé sur leur secteur)
- Poser UNE question ouverte
- Proposer 15 min de visio
- Signer "{from_name}, Télémétrie"

Style : tutoiement OK pour PME, ton direct, max 80 mots dans l'email. Pas de "passionné, ravi, formidable".

Réponds UNIQUEMENT avec ce JSON :
{
  "score": 1-10,
  "reasons": ["raison 1", "raison 2", "raison 3"],
  "email_subject": "...",
  "email_body": "..."
}
"""

def call_mistral(prompt):
    body = json.dumps({
        "model": "mistral-small-latest",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT.replace("{from_name}", FROM_NAME)},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.5,
        "response_format": {"type": "json_object"},
    }).encode()
    req = urllib.request.Request(
        "https://api.mistral.ai/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {MISTRAL_KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        return json.loads(data['choices'][0]['message']['content'])
    except (urllib.error.URLError, KeyError, json.JSONDecodeError) as e:
        return None


def heuristic_score(prospect):
    """Bonus score basé sur le secteur (avant LLM)."""
    sector = (prospect.get('sector', '') or '').lower()
    for keyword, score in SECTOR_FIT.items():
        if keyword in sector:
            return score
    return 5


def qualify(prospect):
    """Score 1 prospect + génère email."""
    base_score = heuristic_score(prospect)
    context = f"""Prospect à évaluer :
- Nom : {prospect.get('name', '?')}
- Entreprise : {prospect.get('company', '?')}
- Site web : {prospect.get('website', '?')}
- Secteur : {prospect.get('sector', '?')}
- LinkedIn : {prospect.get('linkedin_url', '?')}

Score heuristique initial (basé sur le secteur) : {base_score}/10. Ajuste-le selon ton analyse globale.
"""
    result = call_mistral(context) if MISTRAL_KEY and not MISTRAL_KEY.startswith('REMPLACE') else None
    if not result:
        # Fallback sans LLM : score heuristique seul
        first_name = (prospect.get('name', 'Bonjour').split() or ['Bonjour'])[0]
        return {
            'score': base_score,
            'reasons': [f"Secteur {prospect.get('sector', 'inconnu')} fit moyen", "Pas d'analyse LLM dispo"],
            'email_subject': f"Question rapide à propos de {prospect.get('company', 'votre activité')}",
            'email_body': f"Bonjour {first_name},\n\nJe vois que {prospect.get('company', 'vous')} évolue dans le secteur {prospect.get('sector', '')}. Comment savez-vous aujourd'hui si une de vos machines tombe en panne ?\n\n5 min de visio cette semaine ?\n\n{FROM_NAME}, Télémétrie",
        }
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument('input_csv', help='CSV de prospects')
    p.add_argument('--dry-run', action='store_true')
    p.add_argument('--max', type=int, default=100)
    args = p.parse_args()

    if not Path(args.input_csv).exists():
        print(f"❌ Fichier introuvable : {args.input_csv}")
        return 1

    output_dir = Path('emails_to_send')
    output_dir.mkdir(exist_ok=True)
    output_csv = args.input_csv.replace('.csv', '_qualified.csv')

    rows = []
    with open(args.input_csv) as f:
        rows = list(csv.DictReader(f))
    print(f"📋 {len(rows)} prospects à qualifier (max {args.max})")

    results = []
    for i, prospect in enumerate(rows[:args.max], 1):
        print(f"  [{i}/{min(len(rows), args.max)}] {prospect.get('company', '?')}...", end=' ')
        r = qualify(prospect)
        prospect['score'] = r['score']
        prospect['reasons'] = ' | '.join(r['reasons'])
        prospect['email_subject'] = r['email_subject']
        prospect['email_body'] = r['email_body']
        results.append(prospect)
        print(f"score {r['score']}/10")

        # Sauvegarde email individuel
        if not args.dry_run:
            slug = ''.join(c if c.isalnum() else '_' for c in prospect.get('company', 'lead'))[:30]
            with open(output_dir / f"{i:03d}_{slug}.txt", 'w') as f:
                f.write(f"De : {FROM_NAME} <{os.getenv('FROM_EMAIL', 'contact@telemetrie-fr.com')}>\n")
                f.write(f"À : {prospect.get('email', '?')}\n")
                f.write(f"Sujet : {r['email_subject']}\n\n")
                f.write(r['email_body'])

    # Sauvegarde CSV global
    if results and not args.dry_run:
        keys = list(results[0].keys())
        with open(output_csv, 'w') as f:
            w = csv.DictWriter(f, fieldnames=keys)
            w.writeheader()
            w.writerows(results)
        print(f"\n✅ {len(results)} prospects qualifiés → {output_csv}")
        print(f"✅ Emails individuels dans {output_dir}/")

    # Stats finales
    by_score = {}
    for r in results:
        s = r['score']
        by_score[s] = by_score.get(s, 0) + 1
    print("\n📊 Répartition scores :")
    for s in sorted(by_score.keys(), reverse=True):
        bar = '█' * by_score[s]
        print(f"  {s}/10 : {bar} ({by_score[s]})")

    hot = [r for r in results if r['score'] >= 8]
    print(f"\n🔥 {len(hot)} prospects HOT (score ≥ 8) — à contacter en priorité")
    return 0


if __name__ == '__main__':
    sys.exit(main())
