# AI Chatbot — Knowledge Base Assistant

Chatbot berbasis knowledge base dengan UI glassmorphism ala WhatsApp.  
Menggunakan Gemini API (free tier) + fallback TF-IDF similarity search.

## 📁 Struktur Project

```
/project
├── /api
│   └── chat.js          ← Serverless function (Vercel)
├── /data
│   └── knowledge.txt    ← Knowledge base kamu (edit ini!)
├── /utils
│   └── tfidf.js         ← TF-IDF similarity search
├── index.html           ← UI Chat
├── style.css            ← Styling glassmorphism
├── script.js            ← Logic frontend
├── vercel.json          ← Konfigurasi Vercel
└── README.md
```

## 🚀 Cara Deploy ke Vercel

### 1. Push ke GitHub
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/username/repo-name.git
git push -u origin main
```

### 2. Connect ke Vercel
- Buka [vercel.com](https://vercel.com)
- Import repo GitHub kamu
- Tambahkan Environment Variable:
  - `GEMINI_API_KEY` = API key kamu dari [Google AI Studio](https://aistudio.google.com)

### 3. Deploy!
Vercel akan otomatis deploy setiap kali kamu push ke GitHub.

## 📝 Update Knowledge Base

Edit file `/data/knowledge.txt` dengan format:

```
Q: Pertanyaan kamu
A: Jawaban kamu

Q: Pertanyaan lain
A: Jawaban lain
```

Setelah edit → `git push` → Vercel auto redeploy ✅

## 🔄 Flow Sistem

```
User kirim pesan
  → /api/chat.js
      → Gemini API (kalau ada API key & tidak rate limit)
          ↓ sukses → kirim jawaban
          ↓ gagal  → TF-IDF search di knowledge.txt
                        ↓ ketemu → kirim jawaban
                        ↓ tidak  → "Maaf, tidak ada info"
```

## 🔑 Dapatkan Gemini API Key (Gratis)

1. Buka [aistudio.google.com](https://aistudio.google.com)
2. Login dengan akun Google
3. Klik "Get API Key"
4. Copy key → paste di Vercel Environment Variables
