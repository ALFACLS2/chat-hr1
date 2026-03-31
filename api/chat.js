// ============================================================
//  /api/chat.js — Vercel Serverless Function
//  Flow:
//    1. Cari top results pakai TF-IDF
//    2. Kalau skor tinggi → kirim ke Gemini
//    3. Kalau skor rendah → tampilkan suggestion "mungkin kamu bertanya soal"
//    4. Kalau ga ketemu sama sekali → jawab "tidak tahu"
// ============================================================

const fs   = require("fs");
const path = require("path");
const { tfidfSearchTop } = require("../utils/tfidf");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const THRESHOLD_CONFIDENT  = 0.2;  // skor tinggi → jawab
const THRESHOLD_SUGGESTION = 0.08; // skor rendah tapi ada → kasih suggestion

function loadKnowledge() {
  const filePath = path.join(process.cwd(), "data", "knowledge.txt");
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

async function askGemini(userMessage, relevantContext) {
  const prompt = `
Kamu adalah asisten AI yang HANYA menjawab berdasarkan informasi berikut.
Jika jawaban tidak ada, balas TEPAT: "Maaf, saya tidak memiliki informasi tentang itu."
Jangan mengarang. Jangan tambah info di luar yang diberikan.

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

// Ambil topik singkat dari pertanyaan (3 kata pertama)
function extractTopic(question) {
  return question
    .replace(/^(apakah|bagaimana|gimana|apa|boleh|bisa|kapan|dimana|kenapa|siapa)\s+/i, "")
    .split(" ")
    .slice(0, 5)
    .join(" ");
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

  // Step 1: Cari top 5 hasil TF-IDF
  const topResults = tfidfSearchTop(message, knowledge, 5, THRESHOLD_SUGGESTION);

  // Ga ketemu sama sekali
  if (!topResults || topResults.length === 0) {
    return res.status(200).json({
      reply: "Maaf, saya tidak memiliki informasi tentang itu. 🙏\n\nCoba tanyakan dengan kata yang lebih spesifik ya!",
      source: "not_found"
    });
  }

  // Step 2: Cek apakah ada yang skornya confident
  const confidentResults = topResults.filter(r => r.score >= THRESHOLD_CONFIDENT);

  if (confidentResults.length > 0) {
    // Ada jawaban yang yakin → kirim ke Gemini
    const relevantContext = confidentResults
      .slice(0, 3)
      .map((r, i) => `${i + 1}. Q: ${r.question}\n   A: ${r.answer}`)
      .join("\n\n");

    if (GEMINI_API_KEY) {
      try {
        const geminiReply = await askGemini(message, relevantContext);
        if (geminiReply) {
          return res.status(200).json({ reply: geminiReply, source: "gemini" });
        }
      } catch (err) {
        console.warn("Gemini gagal, fallback TF-IDF:", err.message);
      }
    }

    // Fallback TF-IDF
    return res.status(200).json({
      reply: confidentResults[0].answer,
      source: "tfidf"
    });
  }

  // Step 3: Skor rendah → tampilkan suggestion
  const suggestions = topResults
    .slice(0, 3)
    .map(r => `• ${extractTopic(r.question)}`)
    .join("\n");

  return res.status(200).json({
    reply: `Hmm, saya kurang yakin dengan pertanyaanmu. 🙏\n\nMungkin kamu bertanya soal:\n${suggestions}\n\nCoba tanyakan lebih spesifik ya!`,
    source: "suggestion"
  });
};
