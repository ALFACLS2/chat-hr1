const fs   = require("fs");
const path = require("path");
const { tfidfSearchTop } = require("../utils/tfidf");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL     = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

const THRESHOLD_CONFIDENT  = 0.08; // turunkan biar ga banyak "tidak tahu"
const THRESHOLD_SUGGESTION = 0.02; // minimum buat munculin suggestion

function loadKnowledge() {
  const filePath = path.join(process.cwd(), "data", "knowledge.txt");
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

async function askGemini(userMessage, relevantContext) {
  const prompt = `
Kamu adalah asisten AI rekrutmen Alfamart Cileungsi 2.
Jawab HANYA berdasarkan informasi berikut. Jangan mengarang.
Jika tidak ada di informasi, balas: "Maaf, saya tidak memiliki informasi tentang itu."

=== INFORMASI RELEVAN ===
${relevantContext}
=== END ===

Pertanyaan: ${userMessage}

Jawab singkat, jelas, ramah. Gunakan bahasa yang sama dengan pertanyaan.
`.trim();

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 256, temperature: 0.1 }
    })
  });

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
}

function extractTopic(question) {
  return question
    .replace(/^(apakah|bagaimana|gimana|apa|boleh|bisa|kapan|dimana|kenapa|siapa)\s+/i, "")
    .split(" ")
    .slice(0, 6)
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
    return res.status(200).json({ reply: "Knowledge base belum tersedia.", suggestions: [] });
  }

  // Cari top 5 hasil TF-IDF
  const topResults = tfidfSearchTop(message, knowledge, 5, THRESHOLD_SUGGESTION);

  // Ga ketemu sama sekali
  if (!topResults || topResults.length === 0) {
    return res.status(200).json({
      reply: "Maaf, saya tidak memiliki informasi tentang itu. 🙏\nCoba tanyakan dengan kata yang lebih spesifik ya!",
      suggestions: [],
      source: "not_found"
    });
  }

  const confidentResults = topResults.filter(r => r.score >= THRESHOLD_CONFIDENT);

  if (confidentResults.length > 0) {
    const relevantContext = confidentResults
      .slice(0, 3)
      .map((r, i) => `${i + 1}. Q: ${r.question}\n   A: ${r.answer}`)
      .join("\n\n");

    if (GEMINI_API_KEY) {
      try {
        const geminiReply = await askGemini(message, relevantContext);
        if (geminiReply) {
          return res.status(200).json({ reply: geminiReply, suggestions: [], source: "gemini" });
        }
      } catch (err) {
        console.warn("Gemini gagal:", err.message);
      }
    }

    return res.status(200).json({
      reply: confidentResults[0].answer,
      suggestions: [],
      source: "tfidf"
    });
  }

  // Skor rendah → kasih suggestion bubble
  const suggestions = topResults
    .slice(0, 3)
    .map(r => extractTopic(r.question));

  return res.status(200).json({
    reply: "Hmm, saya kurang yakin dengan pertanyaanmu. 🙏\nMungkin kamu bertanya soal:",
    suggestions,
    source: "suggestion"
  });
};
