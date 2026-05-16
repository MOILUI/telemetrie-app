"""
Agent Marketing SEO — Génère 1 article de blog complet par exécution,
optimisé SEO, avec meta description, slug, tags, FAQ et CTA.

Usage :
    python marketing_seo_agent.py --topic "surveiller un frigo professionnel à distance"
    python marketing_seo_agent.py --auto    # Choisit lui-même le sujet
    python marketing_seo_agent.py --batch 4 # Génère 4 articles d'un coup

Output :
    blog/2026-05-15-comment-surveiller-frigo-pro-a-distance.md (front-matter Jekyll/Hugo/Astro)

Coût LLM : ~0,30€ par article (Claude Sonnet) ou ~0,05€ (Mistral Large).
"""

import os, sys, json, re, argparse, urllib.request, urllib.error
from datetime import datetime
from pathlib import Path

LLM_PROVIDER = os.getenv('LLM_PROVIDER', 'mistral')   # 'mistral' | 'anthropic'
MISTRAL_KEY = os.getenv('MISTRAL_API_KEY', '')
ANTHROPIC_KEY = os.getenv('ANTHROPIC_API_KEY', '')
OUTPUT_DIR = Path(os.getenv('BLOG_OUTPUT_DIR', 'blog'))
SITE_URL = os.getenv('SITE_URL', 'https://telemetrie-fr.com')

# Backlog de sujets SEO français (rotation auto si --auto)
SEO_TOPICS = [
    "Comment surveiller un frigo professionnel à distance (guide HACCP 2026)",
    "Pourquoi vos distributeurs automatiques sont vides 30% du temps (et comment le corriger)",
    "Maintenance prédictive sur cafetière espresso pro : guide complet",
    "ESP32 + 4G pour superviser une machine industrielle — comparatif 2026",
    "Nayax vs Télémétrie : comparatif honnête prix et fonctionnalités",
    "Conformité HACCP 2026 : automatiser le suivi température en 30 minutes",
    "10 erreurs à éviter quand on installe un boîtier IoT sur une machine pro",
    "Quel ROI attendre d'un système de télémétrie pour parc de 10 machines ?",
    "Comment réduire de 40% les tournées techniciens avec l'IA",
    "Cashless dans le vending : Nayax VPOS vs SumUp vs Stripe Terminal",
]

SYSTEM_PROMPT = """Tu es rédacteur SEO expert pour Télémétrie (SaaS de supervision IoT pour machines : cafetières, distributeurs auto, frigos pro, équipements industriels).

Public cible : gérants de restaurants, sociétés de distribution auto, dirigeants PME (35-55 ans, peu techniques).

Génère un article de blog complet en français selon ces règles :
1. Longueur : 1200-1500 mots
2. Structure : intro (100-150 mots) → 4-6 sections H2 → conclusion (80 mots) → FAQ (5 questions H3)
3. Style : informatif, ton direct, sans jargon. Tutoiement OK. Pas de "passionné, ravi, formidable".
4. Inclure : 1 tableau comparatif, 2-3 listes à puces, chiffres concrets
5. CTA en fin d'article vers /signup avec essai gratuit 14 jours
6. SEO : utiliser le mot-clé principal 5-10 fois naturellement, varier avec synonymes

Réponds UNIQUEMENT avec ce JSON :
{
  "title": "Titre H1 accrocheur, 50-70 caractères",
  "slug": "url-friendly-en-minuscules",
  "meta_description": "150-160 caractères pour Google",
  "tags": ["3-5 tags"],
  "summary": "Résumé 2 phrases pour le partage social",
  "content_markdown": "Article complet en markdown (avec ##, ###, |tableaux|, listes...)"
}
"""


def call_mistral(prompt):
    body = json.dumps({
        "model": "mistral-large-latest",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
        "response_format": {"type": "json_object"},
        "max_tokens": 4096,
    }).encode()
    req = urllib.request.Request(
        "https://api.mistral.ai/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {MISTRAL_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    return json.loads(data['choices'][0]['message']['content'])


def call_claude(prompt):
    body = json.dumps({
        "model": "claude-sonnet-4-6",
        "max_tokens": 4096,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}],
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
    with urllib.request.urlopen(req, timeout=120) as resp:
        data = json.loads(resp.read())
    text = data['content'][0]['text']
    start, end = text.find('{'), text.rfind('}') + 1
    return json.loads(text[start:end])


def generate_article(topic):
    prompt = f"Sujet de l'article : « {topic} »"
    if LLM_PROVIDER == 'mistral':
        if not MISTRAL_KEY: raise RuntimeError("MISTRAL_API_KEY manquante")
        return call_mistral(prompt)
    elif LLM_PROVIDER == 'anthropic':
        if not ANTHROPIC_KEY: raise RuntimeError("ANTHROPIC_API_KEY manquante")
        return call_claude(prompt)
    raise ValueError(f"Provider inconnu : {LLM_PROVIDER}")


def slugify(text):
    text = text.lower()
    text = re.sub(r'[àâä]', 'a', text)
    text = re.sub(r'[éèêë]', 'e', text)
    text = re.sub(r'[îï]', 'i', text)
    text = re.sub(r'[ôö]', 'o', text)
    text = re.sub(r'[ùûü]', 'u', text)
    text = re.sub(r'[ç]', 'c', text)
    text = re.sub(r'[^a-z0-9]+', '-', text).strip('-')
    return text[:80]


def write_article(article, topic):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now().strftime('%Y-%m-%d')
    slug = article.get('slug') or slugify(topic)
    filename = f"{date_str}-{slug}.md"
    filepath = OUTPUT_DIR / filename

    # Front-matter compatible Jekyll/Hugo/Astro
    front_matter = f"""---
title: "{article['title']}"
date: {date_str}
slug: "{slug}"
description: "{article['meta_description']}"
tags: {json.dumps(article['tags'], ensure_ascii=False)}
summary: "{article['summary']}"
canonical: "{SITE_URL}/blog/{slug}"
author: "Télémétrie"
draft: false
---

"""
    filepath.write_text(front_matter + article['content_markdown'])
    return filepath


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--topic', help='Sujet précis de l\'article')
    p.add_argument('--auto', action='store_true', help='Sujet auto depuis le backlog')
    p.add_argument('--batch', type=int, default=1, help='Nb d\'articles à générer')
    p.add_argument('--list', action='store_true', help='Liste les sujets backlog')
    args = p.parse_args()

    if args.list:
        print("📋 Backlog de sujets SEO :")
        for i, t in enumerate(SEO_TOPICS, 1):
            print(f"  {i}. {t}")
        return 0

    topics = []
    if args.topic:
        topics = [args.topic]
    elif args.auto or args.batch > 1:
        # Prend les N premiers sujets non encore traités (basé sur les fichiers existants)
        existing = set()
        if OUTPUT_DIR.exists():
            for f in OUTPUT_DIR.glob('*.md'):
                existing.add(f.stem.split('-', 3)[-1])
        for t in SEO_TOPICS:
            if slugify(t) not in existing:
                topics.append(t)
            if len(topics) >= args.batch: break
        if not topics:
            print("✅ Tous les sujets backlog ont déjà été traités. Ajoute des sujets dans SEO_TOPICS.")
            return 0
    else:
        print("❌ Précise --topic, --auto ou --list")
        return 1

    for topic in topics:
        print(f"\n📝 Génération : « {topic} »")
        try:
            article = generate_article(topic)
        except Exception as e:
            print(f"  ❌ Erreur : {e}")
            continue
        filepath = write_article(article, topic)
        words = len(article['content_markdown'].split())
        print(f"  ✅ {filepath} ({words} mots)")
        print(f"  📌 {article['title']}")
        print(f"  🏷️  {', '.join(article['tags'])}")

    print(f"\n🎉 {len(topics)} article(s) généré(s) dans {OUTPUT_DIR}/")
    print("\n💡 Étape suivante : push sur ton blog (Astro / Hugo / WordPress).")
    return 0


if __name__ == '__main__':
    sys.exit(main())
