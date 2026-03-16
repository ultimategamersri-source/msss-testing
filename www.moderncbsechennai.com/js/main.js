// ========= main.js =========
import { sendMessage, API } from "./config.js";

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

  // ---- Status banner ----
  (function ensureStatusBanner() {
    if (!document.getElementById("status-banner")) {
      const el = document.createElement("div");
      el.id = "status-banner";
      el.style.cssText =
        "position:fixed;bottom:8px;left:8px;padding:6px 10px;font:12px system-ui;background:#111;color:#fff;border-radius:6px;z-index:99999;opacity:.9";
      el.textContent = "Loading assistant…";
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
      await res.json();
      showStatus("✅ Backend OK");
    } catch (err) {
      console.error("⚠️ Backend not reachable", err);
      showStatus("⚠️ Backend not reachable");
    }
  }

  ping();

  // ---- Restore chat ----
  function restoreChat() {
    chatBox.innerHTML = "";
    chatHistory.forEach((msg) => {
      chatBox.innerHTML += `<div class="${msg.type}-msg">${msg.text}</div>`;
    });
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  restoreChat();

  // ---- Typing effect for bot ----
  async function typeBotMessage(text) {
    const botDiv = document.createElement("div");
    botDiv.className = "bot-msg";
    chatBox.appendChild(botDiv);
    let i = 0;
    while (i < text.length) {
      botDiv.innerHTML += text.charAt(i);
      i++;
      chatBox.scrollTop = chatBox.scrollHeight;
      await new Promise((r) => setTimeout(r, 15));
    }
  }

  // ---- Send handler ----
  async function handleSend() {
    const userMessage = inputField.value.trim();
    if (!userMessage) return;

    chatBox.innerHTML += `<div class="user-msg">${userMessage}</div>`;
    chatHistory.push({ type: "user", text: userMessage });
    inputField.value = "";
    chatBox.scrollTop = chatBox.scrollHeight;

    const thinking = document.createElement("div");
    thinking.className = "bot-msg";
    thinking.textContent = "💡 Thinking...";
    chatBox.appendChild(thinking);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
      const botReply = await sendMessage(userMessage);
      thinking.remove();

      await typeBotMessage(botReply);
      chatHistory.push({ type: "bot", text: botReply });
      localStorage.setItem("chat_history", JSON.stringify(chatHistory));
    } catch (err) {
      thinking.textContent = "⚠️ Error contacting assistant.";
      console.error(err);
    }
  }

  // ---- Event listeners ----
  sendBtn.addEventListener("click", handleSend);
  inputField.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      handleSend();
    });
  }
});
