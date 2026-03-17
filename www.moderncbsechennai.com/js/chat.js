// js/chat.js
import { API } from "./config.js";

window.addEventListener("DOMContentLoaded", () => {

  console.log("[chat.js] Using API:", API);

  const chatBtn    = document.getElementById("chat-btn");
  const chatWindow = document.getElementById("chat-window");
  const sendBtn    = document.getElementById("send-btn");
  const userInput  = document.getElementById("user-input");
  const chatBody   = document.getElementById("chat-body");
  const header     = document.getElementById("chat-header");

  if (!chatBtn || !chatWindow || !sendBtn || !userInput || !chatBody || !header) {
    console.error("[chat.js] Missing DOM elements.");
    return;
  }

  // ---- Session ID ---------------------------------------------------------
  let sessionId = localStorage.getItem("chat_session") || null;
  console.log("[chat.js] Loaded session_id:", sessionId);

  // ---- State --------------------------------------------------------------
  let waiting  = false;
  let chatOpen = false;
  const chatHistory = [{ type: "bot", text: "Hello! Ask me about school." }];

  // ---- UI helpers ---------------------------------------------------------
  function renderMessages() {
    chatBody.innerHTML = "";
    chatHistory.forEach((msg) => {
      const bubble = document.createElement("div");
      bubble.className = `message ${msg.type}`;
      if (msg.type === "bot") {
        const icon = document.createElement("span");
        icon.className = "icon";
        icon.textContent = "💡";
        bubble.appendChild(icon);
      }
      bubble.appendChild(document.createTextNode(msg.text));
      chatBody.appendChild(bubble);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function autoResizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  }

  // ---- Draggable ----------------------------------------------------------
  let isDragging = false, offsetX = 0, offsetY = 0;
  header.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - chatWindow.offsetLeft;
    offsetY = e.clientY - chatWindow.offsetTop;
    header.style.cursor = "grabbing";
  });
  document.addEventListener("mousemove", (e) => {
    if (isDragging) {
      chatWindow.style.left = e.clientX - offsetX + "px";
      chatWindow.style.top  = e.clientY - offsetY + "px";
    }
  });
  document.addEventListener("mouseup", () => {
    isDragging = false;
    header.style.cursor = "grab";
  });

  // ---- Toggle open/close --------------------------------------------------
  chatBtn.addEventListener("click", () => {
    chatOpen = !chatOpen;
    chatWindow.style.display = chatOpen ? "flex" : "none";
    if (chatOpen) {
      autoResizeTextarea();
      userInput.focus();
    }
  });

  // ---- Session end — fires when user closes tab/browser -------------------
  function sendSessionEnd() {
    if (!sessionId) return;
    // Use sendBeacon so it works even during page unload
    const payload = JSON.stringify({ session_id: sessionId });
    navigator.sendBeacon(`${API}/session/end`, new Blob([payload], { type: "application/json" }));
    console.log("[chat.js] Session end signal sent:", sessionId);
    localStorage.removeItem("chat_session");
    sessionId = null;
  }

  window.addEventListener("beforeunload", sendSessionEnd);

  // ---- API call -----------------------------------------------------------
  async function postToAsk(question) {
    const body = { question, session_id: sessionId };
    console.log("[chat.js] Sending:", body);

    const res = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`${API}/ask → ${res.status} ${txt}`);
    }

    const data = await res.json();

    if (data.session_id) {
      sessionId = data.session_id;
      localStorage.setItem("chat_session", sessionId);
      console.log("[chat.js] Session saved:", sessionId);
    }

    // If session was ended (farewell), clear local session
    if (data.session_id === null) {
      localStorage.removeItem("chat_session");
      sessionId = null;
    }

    return data.answer || "I couldn't find an answer.";
  }

  // ---- Send flow ----------------------------------------------------------
  async function handleSend() {
    if (waiting) return;
    const text = (userInput.value || "").trim();
    if (!text) return;

    chatHistory.push({ type: "user", text });
    renderMessages();
    userInput.value = "";
    autoResizeTextarea();

    chatHistory.push({ type: "bot", text: "💭 Thinking..." });
    renderMessages();
    waiting = true;
    sendBtn.disabled = true;

    try {
      const answer = await postToAsk(text);
      chatHistory.pop();
      chatHistory.push({ type: "bot", text: answer });
      renderMessages();
    } catch (e) {
      console.error("[chat.js] Error:", e);
      chatHistory.pop();
      chatHistory.push({ type: "bot", text: "⚠️ Having trouble reaching the server. Please try again." });
      renderMessages();
    } finally {
      waiting = false;
      sendBtn.disabled = false;
    }
  }

  // ---- Events -------------------------------------------------------------
  sendBtn.addEventListener("click", handleSend);
  userInput.addEventListener("input", autoResizeTextarea);
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // ---- Boot ---------------------------------------------------------------
  renderMessages();
  autoResizeTextarea();

  fetch(`${API}/health`)
    .then((r) => r.json())
    .then((d) => console.log("[chat.js] Backend health:", d))
    .catch(() => console.warn("[chat.js] Backend not reachable"));
});
