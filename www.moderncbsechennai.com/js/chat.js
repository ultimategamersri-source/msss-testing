// js/chat.js
import { API } from "./config.js";

window.addEventListener("DOMContentLoaded", () => {

  const chatBtn    = document.getElementById("chat-btn");
  const chatWindow = document.getElementById("chat-window");
  const sendBtn    = document.getElementById("send-btn");
  const userInput  = document.getElementById("user-input");
  const chatBody   = document.getElementById("chat-body");
  const header     = document.getElementById("chat-header");

  if (!chatBtn || !chatWindow || !sendBtn || !userInput || !chatBody || !header) {
    console.error("[chat.js] Missing DOM elements."); return;
  }

  // ---- Session ------------------------------------------------------------
  let sessionId = localStorage.getItem("chat_session") || null;

  // ---- State --------------------------------------------------------------
  let waiting = false, chatOpen = false;
  const WELCOME = "Hello! Ask me about school. 😊";
  const chatHistory = [{ type: "bot", text: WELCOME, time: getTime() }];

  // ---- Helpers ------------------------------------------------------------
  function getTime() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  }

  function parseMarkdown(text) {
    let html = text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
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

  // SVG icons
  const COPY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>`;
  const COPY_OK_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#42e695" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;
  const EDIT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>`;

  // ---- Render -------------------------------------------------------------
  function renderMessages() {
    chatBody.innerHTML = "";

    chatHistory.forEach((msg, idx) => {
      const wrapper = document.createElement("div");
      wrapper.className = `message-wrapper ${msg.type}`;

      // --- Action buttons (outside bubble) ---
      const actions = document.createElement("div");
      actions.className = "msg-actions";

      // --- Bubble ---
      const bubble = document.createElement("div");
      bubble.className = `message ${msg.type}`;

      if (msg.type === "bot") {
        // Icon
        const icon = document.createElement("span");
        icon.className = "icon"; icon.textContent = "💡";
        bubble.appendChild(icon);

        if (msg.typing) {
          bubble.innerHTML += `<div class="typing-indicator"><span>Thinking...</span><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
        } else {
          // Content
          const content = document.createElement("div");
          content.className = "bot-content";
          content.innerHTML = parseMarkdown(msg.text);
          bubble.appendChild(content);

          // Timestamp inside bubble
          const ts = document.createElement("span");
          ts.className = "msg-time"; ts.textContent = msg.time || "";
          bubble.appendChild(ts);

          // Copy button in actions
          if (idx > 0) {
            const copyBtn = document.createElement("button");
            copyBtn.className = "copy-btn"; copyBtn.title = "Copy";
            copyBtn.innerHTML = COPY_SVG;
            copyBtn.addEventListener("click", () => {
              navigator.clipboard.writeText(msg.text).then(() => {
                copyBtn.innerHTML = COPY_OK_SVG;
                setTimeout(() => copyBtn.innerHTML = COPY_SVG, 2000);
              });
            });
            actions.appendChild(copyBtn);
          }
        }

      } else {
        // User bubble — text span (hidden when editing)
        const textSpan = document.createElement("span");
        textSpan.className = "user-text";
        textSpan.textContent = msg.text;
        bubble.appendChild(textSpan);

        // Timestamp inside bubble
        const ts = document.createElement("span");
        ts.className = "msg-time"; ts.textContent = msg.time || "";
        bubble.appendChild(ts);

        // Inline edit area — lives INSIDE the bubble, styled to match
        const editArea = document.createElement("div");
        editArea.className = "inline-edit-area";
        editArea.innerHTML = `
          <textarea rows="2">${msg.text}</textarea>
          <div class="edit-btns">
            <button class="edit-cancel">Cancel</button>
            <button class="edit-save">Send ✓</button>
          </div>`;
        bubble.appendChild(editArea);

        // Edit button in actions
        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn"; editBtn.title = "Edit";
        editBtn.innerHTML = EDIT_SVG;
        editBtn.addEventListener("click", () => {
          const isEditing = editArea.style.display === "flex";
          if (isEditing) {
            editArea.style.display = "none";
            textSpan.style.display = "";
          } else {
            editArea.style.display = "flex";
            textSpan.style.display = "none";
            const ta = editArea.querySelector("textarea");
            ta.value = msg.text; ta.focus();
          }
        });

        // Cancel
        editArea.querySelector(".edit-cancel").addEventListener("click", () => {
          editArea.style.display = "none";
          textSpan.style.display = "";
        });

        // Save — resend from this point
        editArea.querySelector(".edit-save").addEventListener("click", async () => {
          const ta = editArea.querySelector("textarea");
          const newText = ta.value.trim();
          if (!newText || waiting) return;

          // Update history: edit this message, remove everything after
          msg.text = newText;
          msg.time = getTime();
          chatHistory.splice(idx + 1);

          // Resend
          chatHistory.push({ type: "bot", text: "", time: null, typing: true });
          renderMessages();
          waiting = true; sendBtn.disabled = true;

          try {
            const answer = await postToAsk(newText);
            chatHistory.pop();
            chatHistory.push({ type: "bot", text: answer, time: getTime() });
          } catch {
            chatHistory.pop();
            chatHistory.push({ type: "bot", text: "⚠️ Error reaching server.", time: getTime() });
          } finally {
            waiting = false; sendBtn.disabled = false;
            renderMessages();
          }
        });

        actions.appendChild(editBtn);
      }

      // Assemble wrapper
      wrapper.appendChild(bubble);
      if (!msg.typing) wrapper.appendChild(actions);
      chatBody.appendChild(wrapper);
    });

    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function autoResizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  }

  // ---- Open/Close ---------------------------------------------------------
  function openChat()  { chatOpen = true;  chatWindow.classList.remove("hidden"); autoResizeTextarea(); userInput.focus(); }
  function closeChat() { chatOpen = false; chatWindow.classList.add("hidden"); }

  const hasVisited = localStorage.getItem("brightly_visited");
  if (!hasVisited) { localStorage.setItem("brightly_visited", "1"); openChat(); }
  else { closeChat(); }

  chatBtn.addEventListener("click", () => chatOpen ? closeChat() : openChat());

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
  document.addEventListener("mouseup", () => { isDragging = false; header.style.cursor = "grab"; });

  // ---- Session end --------------------------------------------------------
  function sendSessionEnd() {
    if (!sessionId) return;
    navigator.sendBeacon(`${API}/session/end`, new Blob([JSON.stringify({ session_id: sessionId })], { type: "application/json" }));
    localStorage.removeItem("chat_session"); sessionId = null;
  }
  window.addEventListener("beforeunload", sendSessionEnd);

  // ---- API ----------------------------------------------------------------
  async function postToAsk(question) {
    const res = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, session_id: sessionId }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    if (data.session_id)      { sessionId = data.session_id; localStorage.setItem("chat_session", sessionId); }
    if (data.session_id === null) { localStorage.removeItem("chat_session"); sessionId = null; }
    return data.answer || "I couldn't find an answer.";
  }

  // ---- Send ---------------------------------------------------------------
  async function handleSend() {
    if (waiting) return;
    const text = (userInput.value || "").trim();
    if (!text) return;

    chatHistory.push({ type: "user", text, time: getTime() });
    renderMessages();
    userInput.value = ""; autoResizeTextarea();

    chatHistory.push({ type: "bot", text: "", time: null, typing: true });
    renderMessages();
    waiting = true; sendBtn.disabled = true;

    try {
      const answer = await postToAsk(text);
      chatHistory.pop();
      chatHistory.push({ type: "bot", text: answer, time: getTime() });
    } catch {
      chatHistory.pop();
      chatHistory.push({ type: "bot", text: "⚠️ Having trouble reaching the server. Please try again.", time: getTime() });
    } finally {
      waiting = false; sendBtn.disabled = false;
      renderMessages();
    }
  }

  sendBtn.addEventListener("click", handleSend);
  userInput.addEventListener("input", autoResizeTextarea);
  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  renderMessages();
  autoResizeTextarea();
  fetch(`${API}/health`).then(r => r.json()).then(d => console.log("[chat.js] health:", d)).catch(() => {});
});
