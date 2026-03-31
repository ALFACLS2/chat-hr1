// ============================================================
//  /utils/tfidf.js — TF-IDF Similarity Search
//  Format knowledge.txt yang didukung:
//    Q: pertanyaan
//    A: jawaban
// ============================================================

// ── Parse Knowledge ───────────────────────────────────────────

function parseKnowledge(rawText) {
  const entries = [];
  const blocks  = rawText.split(/\n(?=Q:)/i);

  for (const block of blocks) {
    const qMatch = block.match(/^Q:\s*(.+)/im);
    const aMatch = block.match(/^A:\s*([\s\S]+)/im);
    if (qMatch && aMatch) {
      entries.push({
        question: qMatch[1].trim(),
        answer:   aMatch[1].trim()
      });
    }
  }

  return entries;
}

// ── Tokenize ──────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ── TF ────────────────────────────────────────────────────────

function computeTF(tokens) {
  const tf = {};
  for (const token of tokens) {
    tf[token] = (tf[token] || 0) + 1;
  }
  const total = tokens.length;
  for (const key in tf) tf[key] /= total;
  return tf;
}

// ── IDF ───────────────────────────────────────────────────────

function computeIDF(documents) {
  const idf = {};
  const N   = documents.length;

  for (const doc of documents) {
    const unique = new Set(tokenize(doc));
    for (const term of unique) {
      idf[term] = (idf[term] || 0) + 1;
    }
  }

  for (const term in idf) {
    idf[term] = Math.log(N / idf[term]);
  }

  return idf;
}

// ── TF-IDF Vector ─────────────────────────────────────────────

function tfidfVector(tokens, idf) {
  const tf  = computeTF(tokens);
  const vec = {};
  for (const term in tf) {
    vec[term] = tf[term] * (idf[term] || 0);
  }
  return vec;
}

// ── Cosine Similarity ─────────────────────────────────────────

function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;

  for (const term in vecA) {
    dot   += (vecA[term] || 0) * (vecB[term] || 0);
    normA += vecA[term] ** 2;
  }
  for (const term in vecB) {
    normB += vecB[term] ** 2;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Main Search ───────────────────────────────────────────────

function tfidfSearch(query, rawKnowledge, threshold = 0.15) {
  const entries = parseKnowledge(rawKnowledge);
  if (entries.length === 0) return null;

  const documents = entries.map(e => e.question + " " + e.answer);
  const idf       = computeIDF(documents);

  const queryTokens = tokenize(query);
  const queryVec    = tfidfVector(queryTokens, idf);

  let bestScore = -1;
  let bestEntry = null;

  for (let i = 0; i < entries.length; i++) {
    const docTokens = tokenize(documents[i]);
    const docVec    = tfidfVector(docTokens, idf);
    const score     = cosineSimilarity(queryVec, docVec);

    if (score > bestScore) {
      bestScore = score;
      bestEntry = entries[i];
    }
  }

  if (bestScore >= threshold && bestEntry) {
    return bestEntry.answer;
  }

  return null;
}

module.exports = { tfidfSearch };
