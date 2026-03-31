// ============================================================
//  script.js — Chat UI Logic
// ============================================================

const chatContainer   = document.getElementById("chat-container");
const messageInput    = document.getElementById("message-input");
const sendButton      = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const dateMarker      = document.getElementById("date-marker");

dateMarker.textContent = new Date().toLocaleDateString("id-ID", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});

// ── Quick Reply Topics ────────────────────────────────────────

const QUICK_REPLIES = [
  { label: "Info Lowongan",    message: "ada lowongan" },
  { label: "Cara Daftar",      message: "cara ngelamar" },
  { label: "Lokasi Tes",       message: "tmpat tes dmn" },
  { label: "Syarat Dokumen",   message: "bwa ap aj" },
  { label: "Walk In",          message: "walk in" },
  { label: "Status Lamaran",   message: "kok msh d proses" },
];

// ── Helpers ───────────────────────────────────────────────────

function getTime() {
  return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function scrollToBottom() {
  chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
}

// ── Render User Bubble ────────────────────────────────────────

function renderUserBubble(text) {
  const time = getTime();
  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-col items-end space-y-1 message-bubble";
  wrapper.innerHTML = `
    <div class="max-w-[85%] glass-bubble-user text-white px-4 py-3 rounded-t-xl rounded-bl-xl rounded-br-sm shadow-lg">
      <p class="font-Inter text-[15px] leading-relaxed">${escapeHtml(text)}</p>
    </div>
    <div class="flex items-center gap-1 px-1">
      <span class="text-[10px] text-slate-600 font-medium">${time}</span>
      <span class="material-symbols-outlined text-[14px] text-primary" style="font-variation-settings: 'FILL' 1;">done_all</span>
    </div>
  `;
  chatContainer.insertBefore(wrapper, typingIndicator);
  scrollToBottom();
}

// ── Render AI Bubble ──────────────────────────────────────────

function renderAIBubble(text, suggestions = []) {
  const time = getTime();
  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-col items-start space-y-1 message-bubble";

  const formatted = formatText(text);

  let suggestionHTML = "";
  if (suggestions && suggestions.length > 0) {
    const buttons = suggestions.map(s => `
      <button
        onclick="handleSuggestion(this)"
        data-text="${escapeHtml(s)}"
        class="text-left px-3 py-2 rounded-full text-[13px] font-medium text-primary border border-primary/30 bg-white/50 hover:bg-primary hover:text-white active:scale-95 transition-all"
      >${escapeHtml(s)}</button>
    `).join("");
    suggestionHTML = `<div class="flex flex-wrap gap-2 mt-2">${buttons}</div>`;
  }

  wrapper.innerHTML = `
    <div class="max-w-[85%] glass-bubble-ai text-on-surface px-4 py-3 rounded-t-xl rounded-br-xl rounded-bl-sm shadow-md">
      <div class="space-y-2 font-Inter text-[15px] leading-relaxed">${formatted}</div>
      ${suggestionHTML}
    </div>
    <span class="text-[10px] text-slate-600 px-1 font-medium">${time}</span>
  `;
  chatContainer.insertBefore(wrapper, typingIndicator);
  scrollToBottom();
}

// ── Handle Suggestion Click ───────────────────────────────────

window.handleSuggestion = function(btn) {
  const text = btn.getAttribute("data-text");
  if (!text) return;
  messageInput.value = text;
  sendMessage();
};

// ── Handle Quick Reply Click ──────────────────────────────────

window.handleQuickReply = function(message) {
  messageInput.value = message;
  sendMessage();
};

// ── Text Formatter ────────────────────────────────────────────

function formatText(text) {
  text = text.replace(/```([\s\S]*?)```/g, '<div class="code-block">$1</div>');
  text = text.replace(/`([^`]+)`/g, '<code class="bg-white/40 px-1 rounded text-secondary font-mono text-sm">$1</code>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-primary">$1</strong>');
  text = text.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary underline font-medium break-all">$1</a>');
  text = text.replace(/\n/g, "<br/>");
  return text;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Typing Indicator ──────────────────────────────────────────

function showTyping() {
  typingIndicator.classList.remove("hidden");
  scrollToBottom();
}

function hideTyping() {
  typingIndicator.classList.add("hidden");
}

// ── Send Message ──────────────────────────────────────────────

async function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  messageInput.value = "";
  sendButton.disabled = true;
  renderUserBubble(text);
  showTyping();

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text })
    });

    if (!response.ok) throw new Error("Server error");

    const data = await response.json();
    hideTyping();
    renderAIBubble(data.reply, data.suggestions || []);

  } catch (err) {
    hideTyping();
    renderAIBubble("Maaf, terjadi kesalahan. Coba lagi ya! 🙏");
    console.error("Chat error:", err);
  }

  sendButton.disabled = false;
  messageInput.focus();
}

// ── Event Listeners ───────────────────────────────────────────

sendButton.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// ── Welcome Message ───────────────────────────────────────────

window.addEventListener("load", () => {
  setTimeout(() => {
    renderAIBubble("Halo! 👋 Ada yang bisa saya bantu?\nSilakan pilih topik di bawah atau ketik pertanyaanmu langsung.");
  }, 500);
});

// ── Render Quick Reply Bar ────────────────────────────────────

function renderQuickReplies() {
  const container = document.getElementById("quick-reply-bar");
  if (!container) return;

  QUICK_REPLIES.forEach(item => {
    const btn = document.createElement("button");
    btn.className = "flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-semibold text-primary border border-primary/40 bg-white/50 backdrop-blur-sm hover:bg-primary hover:text-white active:scale-95 transition-all whitespace-nowrap shadow-sm";
    btn.textContent = item.label;
    btn.onclick = () => handleQuickReply(item.message);
    container.appendChild(btn);
  });
}

renderQuickReplies();
