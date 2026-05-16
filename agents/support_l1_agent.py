"""
Agent Support L1 — Répond automatiquement aux questions clients via chat,
en s'appuyant sur la documentation du projet (RAG simple TF-IDF).

Si confidence > 0.7 → répond directement.
Si confidence < 0.7 → escalade humaine (notification Slack/email).

Usage :
    # Mode CLI (test rapide)
    python support_l1_agent.py "comment je flash mon ESP32 ?"

    # Mode serveur HTTP (à brancher sur Crisp webhook ou autre)
    python support_l1_agent.py --serve --port 5000
    # POST http://localhost:5000/ask  {"question": "..."}

Coût : ~0,002€ par question via Mistral Small.
"""

import os, sys, json, re, math, argparse, urllib.request, urllib.error
from pathlib import Path
from collections import Counter

MISTRAL_KEY = os.getenv('MISTRAL_API_KEY', '')
DOCS_DIR = Path(os.getenv('DOCS_DIR', '../docs'))
ESCALATION_EMAIL = os.getenv('ESCALATION_EMAIL', 'salih@example.com')
CONFIDENCE_THRESHOLD = float(os.getenv('CONFIDENCE_THRESHOLD', '0.15'))

SYSTEM_PROMPT = """Tu es agent de support client niveau 1 pour Télémétrie (SaaS de supervision IoT).

Ton job : répondre clairement aux questions des utilisateurs en t'appuyant UNIQUEMENT sur les extraits de documentation fournis.

Règles :
1. Si la réponse est dans la doc → réponds de façon concise (3-5 lignes max)
2. Si la doc ne contient pas la réponse → dis explicitement "Je vais transmettre votre question à un humain" et arrête-toi
3. Tutoie l'utilisateur (clients PME français)
4. Termine toujours par : "Cela vous a-t-il aidé ?"
5. Pas d'emoji excessif. Reste pro mais accessible.
"""


# =========================================================
# RAG simple : TF-IDF sur les docs/*.md (sans dépendance externe)
# =========================================================
def tokenize(text):
    text = text.lower()
    text = re.sub(r'[^a-zàâäéèêëîïôöùûüç0-9\s]', ' ', text)
    words = text.split()
    # Stopwords FR basiques
    stop = {'le','la','les','de','du','des','un','une','et','ou','à','au','aux','en','dans','sur','par','pour','avec','sans','sous','sont','est','être','avoir','que','qui','quoi','comment','pourquoi','où','y','a','ce','cet','cette','ces','je','tu','il','elle','on','nous','vous','ils','elles','se','sa','son','ses','mon','ton','leur','pas','ne','plus','très','si','mais','donc','car'}
    return [w for w in words if len(w) > 2 and w not in stop]


def load_doc_chunks():
    """Charge tous les .md et découpe en chunks de ~300 mots."""
    chunks = []
    if not DOCS_DIR.exists():
        print(f"⚠️  Dossier docs introuvable : {DOCS_DIR}")
        return chunks
    for md in DOCS_DIR.glob('*.md'):
        text = md.read_text()
        # Découpage par sections (## headings)
        sections = re.split(r'\n##\s+', text)
        for i, sec in enumerate(sections):
            words = sec.split()
            # Chunks de 300 mots max
            for j in range(0, len(words), 300):
                chunk_text = ' '.join(words[j:j+300])
                if len(chunk_text) > 100:
                    chunks.append({
                        'source': md.name,
                        'section': i,
                        'text': chunk_text,
                        'tokens': tokenize(chunk_text),
                    })
    return chunks


def compute_idf(chunks):
    """IDF inverse pour pondérer les mots rares."""
    n = len(chunks)
    df = Counter()
    for c in chunks:
        for w in set(c['tokens']):
            df[w] += 1
    return {w: math.log((n + 1) / (1 + df[w])) for w in df}


def score_chunk(question_tokens, chunk, idf):
    """Score TF-IDF cosine similarity."""
    if not chunk['tokens']:
        return 0
    q_tf = Counter(question_tokens)
    c_tf = Counter(chunk['tokens'])
    # Dot product avec IDF
    common = set(question_tokens) & set(chunk['tokens'])
    if not common:
        return 0
    dot = sum(q_tf[w] * c_tf[w] * (idf.get(w, 1) ** 2) for w in common)
    q_norm = math.sqrt(sum((q_tf[w] * idf.get(w, 1)) ** 2 for w in q_tf))
    c_norm = math.sqrt(sum((c_tf[w] * idf.get(w, 1)) ** 2 for w in c_tf))
    if q_norm == 0 or c_norm == 0: return 0
    return dot / (q_norm * c_norm)


def retrieve(question, chunks, idf, top_k=3):
    """Retourne les k chunks les + pertinents."""
    q_tokens = tokenize(question)
    scored = [(score_chunk(q_tokens, c, idf), c) for c in chunks]
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[:top_k]


# =========================================================
# Appel LLM avec contexte RAG
# =========================================================
def ask_llm(question, context_chunks):
    if not MISTRAL_KEY or MISTRAL_KEY.startswith('REMPLACE'):
        return "Mistral API key non configurée. Configurez MISTRAL_API_KEY dans .env."

    context = "\n\n---\n\n".join(f"Source : {c['source']}\n\n{c['text']}" for _, c in context_chunks)
    user_msg = f"Documentation pertinente :\n\n{context}\n\n---\n\nQuestion utilisateur : {question}"

    body = json.dumps({
        "model": "mistral-small-latest",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        "temperature": 0.3,
    }).encode()
    req = urllib.request.Request(
        "https://api.mistral.ai/v1/chat/completions",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {MISTRAL_KEY}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        return data['choices'][0]['message']['content']
    except urllib.error.URLError as e:
        return f"Erreur API Mistral : {e}"


def answer(question, chunks, idf):
    top = retrieve(question, chunks, idf, top_k=3)
    best_score = top[0][0] if top else 0
    if best_score < CONFIDENCE_THRESHOLD:
        return {
            'answer': "Je n'ai pas trouvé d'information précise pour répondre à votre question. Je transmets votre demande à un membre de notre équipe qui vous répondra par email dans la journée.",
            'confidence': best_score,
            'sources': [],
            'escalate': True,
        }
    response = ask_llm(question, top)
    return {
        'answer': response,
        'confidence': best_score,
        'sources': list(set(c['source'] for _, c in top)),
        'escalate': False,
    }


# =========================================================
# CLI + mode serveur
# =========================================================
def main():
    p = argparse.ArgumentParser()
    p.add_argument('question', nargs='?', help='Question (mode CLI)')
    p.add_argument('--serve', action='store_true', help='Lance un serveur HTTP')
    p.add_argument('--port', type=int, default=5000)
    args = p.parse_args()

    print(f"📚 Chargement de la documentation depuis {DOCS_DIR}...")
    chunks = load_doc_chunks()
    if not chunks:
        print("❌ Aucun chunk chargé. Vérifie le DOCS_DIR.")
        return 1
    print(f"✅ {len(chunks)} chunks indexés.")
    idf = compute_idf(chunks)

    if args.serve:
        from http.server import HTTPServer, BaseHTTPRequestHandler
        class Handler(BaseHTTPRequestHandler):
            def do_POST(self):
                if self.path != '/ask':
                    self.send_error(404); return
                length = int(self.headers.get('Content-Length', 0))
                data = json.loads(self.rfile.read(length)) if length else {}
                q = data.get('question', '')
                result = answer(q, chunks, idf)
                body = json.dumps(result, ensure_ascii=False).encode()
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(body)
            def log_message(self, fmt, *a): pass
        print(f"🌐 Serveur sur http://localhost:{args.port}/ask")
        example = '{"question":"comment flasher l ESP32 ?"}'
        print(f'   Test : curl -X POST -H "Content-Type:application/json" -d \'{example}\' http://localhost:{args.port}/ask')
        HTTPServer(('', args.port), Handler).serve_forever()
        return 0

    if args.question:
        r = answer(args.question, chunks, idf)
        print(f"\n🤖 Réponse (confidence {r['confidence']:.2f}) :\n{r['answer']}")
        if r['sources']:
            print(f"\n📖 Sources : {', '.join(r['sources'])}")
        if r['escalate']:
            print("⚠️  → Escalade humaine recommandée")
    else:
        # Mode interactif
        print("💬 Mode interactif. 'exit' pour sortir.\n")
        while True:
            try:
                q = input("❓ ").strip()
            except (EOFError, KeyboardInterrupt):
                break
            if q.lower() in ('exit', 'quit', ''): break
            r = answer(q, chunks, idf)
            print(f"\n🤖 ({r['confidence']:.2f}) {r['answer']}")
            if r['sources']: print(f"📖 {', '.join(r['sources'])}")
            print()
    return 0


if __name__ == '__main__':
    sys.exit(main())
