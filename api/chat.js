// ============================================================
//  /api/chat.js — Vercel Serverless Function
//  Flow:
//    1. Cari context relevan dulu pakai TF-IDF
//    2. Kirim HANYA context relevan ke Gemini
//    3. Kalau Gemini gagal → pakai hasil TF-IDF langsung
//    4. Kalau ga ketemu sama sekali → jawab "tidak tahu"
// ============================================================

const fs   = require("fs");
const path = require("path");
const { tfidfSearch, tfidfSearchTop } = require("../utils/tfidf");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

function loadKnowledge() {
  const filePath = path.join(process.cwd(), "data", "knowledge.txt");
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

async function askGemini(userMessage, relevantContext) {
  const prompt = `
Kamu adalah asisten AI yang HANYA menjawab berdasarkan informasi berikut.
Jika jawaban tidak ada di informasi ini, balas TEPAT dengan:
"Maaf, saya tidak memiliki informasi tentang itu."

Jangan mengarang. Jangan tambah informasi di luar yang diberikan.

=== INFORMASI RELEVAN ===
${relevantContext}
=== END ===

Pertanyaan: ${userMessage}

Jawab singkat, jelas, dan ramah. Gunakan bahasa yang sama dengan pertanyaan.
`.trim();

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.1 }
    })
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Gemini error: ${err?.error?.message || response.status}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

module.exports = async function handler(req, res) {
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
    return res.status(200).json({ reply: "Knowledge base belum tersedia." });
  }

  // Step 1: Cari top 3 context paling relevan
  const topResults = tfidfSearchTop(message, knowledge, 3);

  if (!topResults || topResults.length === 0) {
    return res.status(200).json({
      reply: "Maaf, saya tidak memiliki informasi tentang itu. 🙏",
      source: "not_found"
    });
  }

  // Gabungkan jadi context
  const relevantContext = topResults
    .map((r, i) => `${i + 1}. Q: ${r.question}\n   A: ${r.answer}`)
    .join("\n\n");

  // Step 2: Kirim HANYA context relevan ke Gemini
  if (GEMINI_API_KEY) {
    try {
      const geminiReply = await askGemini(message, relevantContext);
      if (geminiReply) {
        return res.status(200).json({ reply: geminiReply, source: "gemini" });
      }
    } catch (err) {
      console.warn("Gemini gagal, fallback ke TF-IDF:", err.message);
    }
  }

  // Step 3: Fallback TF-IDF
  return res.status(200).json({
    reply: topResults[0].answer,
    source: "tfidf"
  });
};
