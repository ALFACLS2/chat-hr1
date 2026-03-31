// ============================================================
//  /api/chat.js — Vercel Serverless Function
//  Flow:
//    1. Baca knowledge.txt
//    2. Coba Gemini API (gratis tier)
//    3. Kalau Gemini gagal/rate limit → fallback TF-IDF
//    4. Kalau ga ketemu di knowledge → jawab "tidak tahu"
// ============================================================

const fs   = require("fs");
const path = require("path");
const { tfidfSearch } = require("../utils/tfidf");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY; // set di Vercel dashboard
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

// ── Load Knowledge ────────────────────────────────────────────

function loadKnowledge() {
  const filePath = path.join(process.cwd(), "data", "knowledge.txt");
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

// ── Gemini API Call ───────────────────────────────────────────

async function askGemini(userMessage, knowledgeContext) {
  const prompt = `
Kamu adalah asisten AI yang hanya menjawab berdasarkan knowledge base berikut.
Jika jawaban TIDAK ADA di knowledge base, balas dengan tepat:
"Maaf, saya tidak memiliki informasi tentang itu."

Jangan mengarang jawaban di luar knowledge base.

=== KNOWLEDGE BASE ===
${knowledgeContext}
=== END KNOWLEDGE BASE ===

Pertanyaan user: ${userMessage}

Jawab dalam bahasa yang sama dengan pertanyaan user. Jawab singkat, jelas, dan ramah.
`.trim();

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 512, temperature: 0.3 }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Gemini error: ${err?.error?.message || response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

// ── Main Handler ──────────────────────────────────────────────

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const knowledge = loadKnowledge();

  if (!knowledge) {
    return res.status(200).json({ reply: "Knowledge base belum tersedia. Silakan tambahkan data/knowledge.txt." });
  }

  // ── Step 1: Coba Gemini ──────────────────────────────────────
  if (GEMINI_API_KEY) {
    try {
      const geminiReply = await askGemini(message, knowledge);
      if (geminiReply) {
        return res.status(200).json({ reply: geminiReply, source: "gemini" });
      }
    } catch (err) {
      console.warn("Gemini gagal, fallback ke TF-IDF:", err.message);
      // Lanjut ke fallback
    }
  }

  // ── Step 2: Fallback TF-IDF ──────────────────────────────────
  const result = tfidfSearch(message, knowledge);

  if (result) {
    return res.status(200).json({ reply: result, source: "tfidf" });
  }

  // ── Step 3: Ga ketemu ─────────────────────────────────────────
  return res.status(200).json({
    reply: "Maaf, saya tidak memiliki informasi tentang itu. Coba tanyakan hal lain ya! 🙏",
    source: "not_found"
  });
};
