// ============================================================
//  /utils/tfidf.js — TF-IDF Similarity Search
// ============================================================

function parseKnowledge(rawText) {
  const entries = [];
  const blocks  = rawText.split(/\n(?=Q:)/i);
  for (const block of blocks) {
    const qMatch = block.match(/^Q:\s*(.+)/im);
    const aMatch = block.match(/^A:\s*([\s\S]+)/im);
    if (qMatch && aMatch) {
      entries.push({ question: qMatch[1].trim(), answer: aMatch[1].trim() });
    }
  }
  return entries;
}

function tokenize(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function computeTF(tokens) {
  const tf = {};
  for (const token of tokens) tf[token] = (tf[token] || 0) + 1;
  const total = tokens.length;
  for (const key in tf) tf[key] /= total;
  return tf;
}

function computeIDF(documents) {
  const idf = {};
  const N   = documents.length;
  for (const doc of documents) {
    const unique = new Set(tokenize(doc));
    for (const term of unique) idf[term] = (idf[term] || 0) + 1;
  }
  for (const term in idf) idf[term] = Math.log(N / idf[term]);
  return idf;
}

function tfidfVector(tokens, idf) {
  const tf  = computeTF(tokens);
  const vec = {};
  for (const term in tf) vec[term] = tf[term] * (idf[term] || 0);
  return vec;
}

function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  for (const term in vecA) {
    dot   += (vecA[term] || 0) * (vecB[term] || 0);
    normA += vecA[term] ** 2;
  }
  for (const term in vecB) normB += vecB[term] ** 2;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function tfidfSearch(query, rawKnowledge, threshold = 0.25) {
  const results = tfidfSearchTop(query, rawKnowledge, 1, threshold);
  return results.length > 0 ? results[0].answer : null;
}

function tfidfSearchTop(query, rawKnowledge, topN = 3, threshold = 0.2) {
  const entries = parseKnowledge(rawKnowledge);
  if (entries.length === 0) return [];

  const documents = entries.map(e => e.question + " " + e.answer);
  const idf       = computeIDF(documents);
  const queryVec  = tfidfVector(tokenize(query), idf);

  const scored = entries.map((entry, i) => ({
    question: entry.question,
    answer:   entry.answer,
    score:    cosineSimilarity(queryVec, tfidfVector(tokenize(documents[i]), idf))
  }));

  return scored
    .filter(r => r.score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

module.exports = { tfidfSearch, tfidfSearchTop };
