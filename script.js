// ============================================================
//  script.js — Chat UI Logic
//  Handles: send message, render bubble, typing indicator,
//           auto-scroll, timestamp, call /api/chat
// ============================================================

const chatContainer = document.getElementById("chat-container");
const messageInput  = document.getElementById("message-input");
const sendButton    = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");
const dateMarker    = document.getElementById("date-marker");

// Set today's date on the marker
dateMarker.textContent = new Date().toLocaleDateString("id-ID", {
  weekday: "long", day: "numeric", month: "long", year: "numeric"
});

// ── Helpers ──────────────────────────────────────────────────

function getTime() {
  return new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function scrollToBottom() {
  chatContainer.scrollTo({ top: chatContainer.scrollHeight, behavior: "smooth" });
}

// ── Render Bubbles ────────────────────────────────────────────

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

function renderAIBubble(text) {
  const time = getTime();
  const wrapper = document.createElement("div");
  wrapper.className = "flex flex-col items-start space-y-1 message-bubble";

  // Basic markdown: **bold**, `code`
  const formatted = formatText(text);

  wrapper.innerHTML = `
    <div class="max-w-[85%] glass-bubble-ai text-on-surface px-4 py-3 rounded-t-xl rounded-br-xl rounded-bl-sm shadow-md">
      <div class="space-y-2 font-Inter text-[15px] leading-relaxed">${formatted}</div>
    </div>
    <span class="text-[10px] text-slate-600 px-1 font-medium">${time}</span>
  `;
  chatContainer.insertBefore(wrapper, typingIndicator);
  scrollToBottom();
}

// ── Text Formatter (mini markdown) ───────────────────────────

function formatText(text) {
  // Code block ```...```
  text = text.replace(/```([\s\S]*?)```/g, '<div class="code-block">$1</div>');
  // Inline code `...`
  text = text.replace(/`([^`]+)`/g, '<code class="bg-white/40 px-1 rounded text-secondary font-mono text-sm">$1</code>');
  // Bold **...**
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-primary">$1</strong>');
  // Newline
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

// ── Typing Indicator ─────────────────────────────────────────

function showTyping() {
  typingIndicator.classList.remove("hidden");
  scrollToBottom();
}

function hideTyping() {
  typingIndicator.classList.add("hidden");
}

// ── Send Message ─────────────────────────────────────────────

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
    renderAIBubble(data.reply);

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
    renderAIBubble("Halo! 👋 Ada yang bisa saya bantu?");
  }, 500);
});
