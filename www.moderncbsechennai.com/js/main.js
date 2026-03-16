// ========= MAIN.JS (Netlify -> Cloud Run) =========
import { sendMessage } from "./config.js";
import { API } from "./config.js";

let sessionId = null;
const chatBox = document.querySelector("#chatBox");
const inputField = document.querySelector("#userInput");
const sendBtn = document.querySelector("#sendBtn");

// Load chat history from localStorage
let chatHistory = JSON.parse(localStorage.getItem("chat_history")) || [];

// Display stored chat messages
chatHistory.forEach(msg => {
  if (msg.type === "user") {
    chatBox.innerHTML += `<div class="user-msg">${msg.text}</div>`;
  } else {
    chatBox.innerHTML += `<div class="bot-msg">${msg.text}</div>`;
  }
});
chatBox.scrollTop = chatBox.scrollHeight;

// Send button click
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

// Small status banner
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
  const b = document.getElementById("status-banner");
  if (b) b.textContent = msg;
  console.log(msg);
}

// Health check
async function ping() {
  try {
    const res = await fetch(`${API}/health`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Health ${res.status}`);
    const data = await res.json();
    showStatus("✅ Backend OK");
    console.log("Backend health:", data);
  } catch (err) {
    console.error("Backend not reachable:", err);
    showStatus("⚠️ Server not reachable.");
  }
}

// Ask endpoint
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

// DOMContentLoaded setup
document.addEventListener("DOMContentLoaded", () => {
  ping();

  const form = document.getElementById("chat-form");
  const input = document.getElementById("userInput"); // match original
  if (!form || !input || !chatBox) {
    console.warn("Chat elements not found in DOM.");
    showStatus("⚠️ Chat elements not found");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const question = input.value.trim();
    if (!question) return;

    chatBox.innerHTML += `<div class="user-msg">${question}</div>`;
    chatHistory.push({ type: "user", text: question });
    input.value = "";

    const reply = await ask(question);
    chatBox.innerHTML += `<div class="bot-msg">${reply}</div>`;
    chatHistory.push({ type: "bot", text: reply });

    localStorage.setItem("chat_history", JSON.stringify(chatHistory));
    chatBox.scrollTop = chatBox.scrollHeight;
  });
});
