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
  const clearBtn   = document.getElementById("clear-btn");

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
  const WELCOME = "Hello! Ask me about school. 😊";
  const chatHistory = [{ type: "bot", text: WELCOME, time: getTime() }];

  // ---- Time helper --------------------------------------------------------
  function getTime() {
    const now  = new Date();
    let h      = now.getHours();
    const m    = String(now.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  // ---- Markdown renderer --------------------------------------------------
  function parseMarkdown(text) {
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^[•\-]\s+(.+)$/gm, "<li>$1</li>");

    html = html.split("\n").map(line => {
      if (line.startsWith("<li>")) return line;
      if (line.trim() === "") return "<br>";
      return line + "<br>";
    }).join("");

    html = html.replace(/(<li>.*?<\/li>)(?:\s*(<li>.*?<\/li>))*/gs, m => `<ul>${m}</ul>`);
    html = html.replace(/(<br>){3,}/g, "<br><br>");
    return html;
  }

  // ---- Render messages ----------------------------------------------------
  function renderMessages() {
    chatBody.innerHTML = "";
    chatHistory.forEach((msg, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = `message-wrapper ${msg.type}`;

      const bubble = document.createElement("div");
      bubble.className = `message ${msg.type}`;

      if (msg.type === "bot") {
        const icon = document.createElement("span");
        icon.className = "icon";
        icon.textContent = "💡";
        bubble.appendChild(icon);

        if (msg.typing) {
          bubble.innerHTML += `
            <div class="typing-indicator">
              <span>Thinking...</span>
              <div class="dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
            </div>`;
        } else {
          const content = document.createElement("div");
          content.className = "bot-content";
          content.innerHTML = parseMarkdown(msg.text);
          bubble.appendChild(content);
        }
      } else {
        bubble.appendChild(document.createTextNode(msg.text));
      }

      wrapper.appendChild(bubble);

      // Timestamp
      if (msg.time && !msg.typing) {
        const ts = document.createElement("div");
        ts.className = "msg-time";
        ts.textContent = msg.time;
        wrapper.appendChild(ts);
      }

      // Copy button for bot messages (not typing, not welcome)
      if (msg.type === "bot" && !msg.typing && idx > 0) {
        const copyBtn = document.createElement("button");
        copyBtn.className = "copy-btn";
        copyBtn.textContent = "📋 Copy";
        copyBtn.addEventListener("click", () => {
          navigator.clipboard.writeText(msg.text).then(() => {
            copyBtn.textContent = "✅ Copied!";
            setTimeout(() => copyBtn.textContent = "📋 Copy", 2000);
          });
        });
        wrapper.appendChild(copyBtn);
      }

      chatBody.appendChild(wrapper);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function autoResizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  }

  // ---- Open / Close -------------------------------------------------------
  function openChat() {
    chatOpen = true;
    chatWindow.classList.remove("hidden");
    autoResizeTextarea();
    userInput.focus();
  }

  function closeChat() {
    chatOpen = false;
    chatWindow.classList.add("hidden");
  }

  // Open on first visit automatically
  const hasVisited = localStorage.getItem("brightly_visited");
  if (!hasVisited) {
    localStorage.setItem("brightly_visited", "1");
    openChat();
  } else {
    closeChat();
  }

  chatBtn.addEventListener("click", () => {
    chatOpen ? closeChat() : openChat();
  });

  // ---- Clear chat ---------------------------------------------------------
  clearBtn.addEventListener("click", () => {
    chatHistory.length = 0;
    chatHistory.push({ type: "bot", text: WELCOME, time: getTime() });
    renderMessages();
  });

  // ---- Draggable ----------------------------------------------------------
  let isDragging = false, offsetX = 0, offsetY = 0;
  header.addEventListener("mousedown", (e) => {
    if (e.target === clearBtn) return; // don't drag when clicking clear
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

  // ---- Session end --------------------------------------------------------
  function sendSessionEnd() {
    if (!sessionId) return;
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

    chatHistory.push({ type: "user", text, time: getTime() });
    renderMessages();
    userInput.value = "";
    autoResizeTextarea();

    chatHistory.push({ type: "bot", text: "", time: null, typing: true });
    renderMessages();
    waiting = true;
    sendBtn.disabled = true;

    try {
      const answer = await postToAsk(text);
      chatHistory.pop();
      chatHistory.push({ type: "bot", text: answer, time: getTime() });
      renderMessages();
    } catch (e) {
      console.error("[chat.js] Error:", e);
      chatHistory.pop();
      chatHistory.push({ type: "bot", text: "⚠️ Having trouble reaching the server. Please try again.", time: getTime() });
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
