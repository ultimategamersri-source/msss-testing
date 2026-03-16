// ========= MAIN.JS (Netlify -> Cloud Run) =========
import { sendMessage } from "./config.js";
import { API } from "./config.js";

let chatHistory = JSON.parse(localStorage.getItem("chat_history")) || [];

// --- Small status banner so you can see connectivity at a glance
(function ensureStatusBanner() {
  if (!document.getElementById("status-banner")) {
    const el = document.createElement("div");
    el.id = "status-banner";
    el.style.cssText =
      "position:fixed;bottom:8px;left:8px;padding:6px 10px;font:12px/1.4 system-ui;background:#111;color:#fff;border-radius:6px;z-index:99999;opacity:.9";
    el.textContent = "main.js loaded…";
    document.addEventListener("DOMContentLoaded", () =>
      document.body.appendChild(el)
    );
  }
})();

function showStatus(msg) {
  console.log(msg);
  const b = document.getElementById("status-banner");
  if (b) b.textContent = msg;
}

// --- Health check
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

// --- UI wiring
document.addEventListener("DOMContentLoaded", () => {
  ping();

  const chatBox = document.querySelector("#chatBox");
  const inputField = document.querySelector("#userInput");
  const sendBtn = document.querySelector("#sendBtn");

  if (!chatBox || !inputField || !sendBtn) {
    console.warn("Chat elements not found in DOM.");
    showStatus("⚠️ Chat elements not found");
    return;
  }

  // Restore previous chat
  chatHistory.forEach(msg => {
    if (msg.type === "user") {
      chatBox.innerHTML += `<div class="user-msg">${msg.text}</div>`;
    } else {
      chatBox.innerHTML += `<div class="bot-msg">${msg.text}</div>`;
    }
  });

  chatBox.scrollTop = chatBox.scrollHeight;

  // Send message
  sendBtn.addEventListener("click", async () => {
    const userMessage = inputField.value.trim();
    if (!userMessage) return;

    chatBox.innerHTML += `<div class="user-msg">${userMessage}</div>`;
    chatHistory.push({ type: "user", text: userMessage });

    inputField.value = "";

    const botReply = await sendMessage(userMessage);

    chatBox.innerHTML += `<div class="bot-msg">${botReply}</div>`;
    chatHistory.push({ type: "bot", text: botReply });

    localStorage.setItem("chat_history", JSON.stringify(chatHistory));

    chatBox.scrollTop = chatBox.scrollHeight;
  });
});
