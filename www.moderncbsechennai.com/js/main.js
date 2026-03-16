// ========= MAIN.JS (Netlify -> Cloud Run) =========
import { sendMessage, API } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const sendBtn = document.querySelector("#send-btn");
  const inputField = document.querySelector("#user-input");
  const chatBox = document.querySelector("#chat-body");

  if (!sendBtn || !inputField || !chatBox) {
    console.warn("Chat elements missing!");
    return;
  }

  let sessionId = localStorage.getItem("chat_session") || null;

  async function sendMessageToBackend(message) {
    try {
      const res = await fetch(`${API}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: message, session_id: sessionId }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      if (data.session_id) {
        sessionId = data.session_id;
        localStorage.setItem("chat_session", sessionId);
      }
      return data.answer || "No response received.";
    } catch (err) {
      console.error("Error contacting chatbot API:", err);
      return "⚠️ Could not reach assistant.";
    }
  }

  function appendMessage(msg, sender) {
    const div = document.createElement("div");
    div.className = `message ${sender}`;
    div.innerHTML = msg;
    chatBox.appendChild(div);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  sendBtn.addEventListener("click", async () => {
    const message = inputField.value.trim();
    if (!message) return;

    appendMessage(message, "user");
    inputField.value = "";

    const reply = await sendMessageToBackend(message);
    appendMessage(reply, "bot");
  });

  // Optional: press Enter to send
  inputField.addEventListener("keypress", async (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

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

  ping(); // test immediately

  // --- Small status banner
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
});
