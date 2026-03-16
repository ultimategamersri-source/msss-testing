// ========= MAIN.JS (Netlify -> Cloud Run) =========
import { sendMessage } from "./config.js";
import { API } from "./config.js";

let sessionId = null;
let chatHistory = JSON.parse(localStorage.getItem("chat_history")) || [];

document.addEventListener("DOMContentLoaded", () => {
  // ---- DOM elements ----
  const chatBox = document.querySelector("#chatBox");
  const inputField = document.querySelector("#userInput");
  const sendBtn = document.querySelector("#sendBtn");
  const form = document.querySelector("#chat-form");

  if (!chatBox || !inputField || !sendBtn) {
    console.error("⚠️ Chat elements not found in DOM.");
    return;
  }

  // ---- Restore chat history ----
  chatHistory.forEach(msg => {
    if (msg.type === "user") {
      chatBox.innerHTML += `<div class="user-msg">${msg.text}</div>`;
    } else {
      chatBox.innerHTML += `<div class="bot-msg">${msg.text}</div>`;
    }
  });
  chatBox.scrollTop = chatBox.scrollHeight;

  // ---- Send message function ----
  async function handleSend(message) {
    const userMessage = message || inputField.value.trim();
    if (!userMessage) return;

    // Show user message
    chatBox.innerHTML += `<div class="user-msg">${userMessage}</div>`;
    chatHistory.push({ type: "user", text: userMessage });
    inputField.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    // Thinking indicator
    const thinking = document.createElement("div");
    thinking.className = "bot-msg";
    thinking.innerText = "💡 Thinking...";
    chatBox.appendChild(thinking);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      const botReply = await sendMessage(userMessage);
      thinking.remove();

      chatBox.innerHTML += `<div class="bot-msg">${botReply}</div>`;
      chatHistory.push({ type: "bot", text: botReply });

      // Save history
      localStorage.setItem("chat_history", JSON.stringify(chatHistory));
      chatBox.scrollTop = chatBox.scrollHeight;
    } catch (err) {
      thinking.innerText = "⚠️ Error contacting assistant.";
      console.error(err);
    }
  }

  // ---- Send button click ----
  sendBtn.addEventListener("click", () => handleSend());

  // ---- Enter key ----
  inputField.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // ---- Status banner ----
  (function ensureStatusBanner() {
    if (!document.getElementById("status-banner")) {
      const el = document.createElement("div");
      el.id = "status-banner";
      el.style.cssText =
        "position:fixed;bottom:8px;left:8px;padding:6px 10px;font:12px/1.4 system-ui;background:#111;color:#fff;border-radius:6px;z-index:99999;opacity:.9";
      el.textContent = "main.js loaded…";
      document.body.appendChild(el);
    }
  })();

  function showStatus(msg) {
    console.log(msg);
    const b = document.getElementById("status-banner");
    if (b) b.textContent = msg;
  }

  // ---- Health check ----
  async function ping() {
    try {
      const res = await fetch(`${API}/health`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Health ${res.status}`);
      const data = await res.json();
      console.log("✅ Backend Health:", data);
      showStatus("✅ Backend OK");
    } catch (err) {
      console.error("❌ Backend not reachable:", err);
      showStatus("⚠️ Server not reachable.");
    }
  }

  ping(); // immediate check

  // ---- Ask endpoint (optional if you use sendMessage directly) ----
  async function ask(question) {
    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, session_id: sessionId })
      });

      if (!res.ok) throw new Error(`Ask failed: ${res.status}`);
      const data = await res.json();
      sessionId = data.session_id;
      return data.answer;
    } catch (err) {
      console.error(err);
      showStatus("⚠️ Assistant server error");
      return "Sorry — I couldn’t reach the assistant. Please try again.";
    }
  }

  // ---- Optional: form submit (if you have a <form>) ----
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      await handleSend();
    });
  }
});
