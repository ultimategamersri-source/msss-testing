// js/chat.js
import { API } from "./config.js";

window.addEventListener("DOMContentLoaded", () => {

  const chatBtn       = document.getElementById("chat-btn");
  const chatWindow    = document.getElementById("chat-window");
  const sendBtn       = document.getElementById("send-btn");
  const userInput     = document.getElementById("user-input");
  const chatBody      = document.getElementById("chat-body");
  const header        = document.getElementById("chat-header");
  const closeChatBtn  = document.getElementById("close-chat-btn");
  const fullscreenBtn = document.getElementById("fullscreen-btn");
  const chatBadge     = document.getElementById("chat-badge");
  // fireworks handled via canvas

  if (!chatBtn || !chatWindow || !sendBtn || !userInput || !chatBody || !header) {
    console.error("[chat.js] Missing DOM elements."); return;
  }

  // ---- Session & State ----------------------------------------------------
  let sessionId   = localStorage.getItem("chat_session") || null;
  let waiting     = false;
  let chatOpen    = false;
  let unreadCount = 0;
  const WELCOME   = "Hello! Ask me about school. 😊";
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

  const COPY_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
  const COPY_OK  = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="stroke:rgba(255,255,255,0.9)"><polyline points="20 6 9 17 4 12"/></svg>`;
  const EDIT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  // ---- Sparkles & Fireworks ----------------------------------------------
  const SPARKLE_COLORS = ["#ff6ec4","#7873f5","#42e695","#ffe140","#ff9ff3","#54a0ff","#ff9f43","#ee5a24"];
  const canvas   = document.getElementById("fireworks-canvas");
  const ctx      = canvas ? canvas.getContext("2d") : null;
  let   fwParts  = [];
  let   fwActive = false;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  function launchFirework(x, y) {
    const count = 120 + Math.floor(Math.random() * 60);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = 4 + Math.random() * 10;
      fwParts.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        size: 3 + Math.random() * 5,
        decay: 0.012 + Math.random() * 0.01,
      });
    }
  }

  function animateFireworks() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fwParts = fwParts.filter(p => p.alpha > 0.01);
    fwParts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.06; // gravity
      p.vx *= 0.98;
      p.alpha -= p.decay;
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle   = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur  = 12;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (fwParts.length > 0) requestAnimationFrame(animateFireworks);
    else {
      fwActive = false;
      if (canvas) canvas.classList.remove("active");
    }
  }

  function startFireworks() {
    if (!canvas || !ctx) return;
    canvas.classList.add("active");
    fwActive = true;
    const w = window.innerWidth, h = window.innerHeight;
    // Launch 6 fireworks at random positions across screen
    const positions = [
      [w * 0.15, h * 0.25], [w * 0.5,  h * 0.15], [w * 0.85, h * 0.25],
      [w * 0.25, h * 0.45], [w * 0.75, h * 0.40], [w * 0.5,  h * 0.30],
      [w * 0.35, h * 0.20], [w * 0.65, h * 0.20], [w * 0.5,  h * 0.50],
    ];
    positions.forEach(([x, y], i) => {
      setTimeout(() => launchFirework(x, y), i * 150);
    });
    animateFireworks();
    setTimeout(() => { fwParts = []; }, 4000);
  }

  // shootSparkles replaced by startFireworks()

  // ---- Badge --------------------------------------------------------------
  function showBadge(n) {
    chatBadge.textContent = n > 9 ? "9+" : n;
    chatBadge.classList.add("show");
  }
  function clearBadge() {
    unreadCount = 0;
    chatBadge.classList.remove("show");
  }

  // ---- Open / Close -------------------------------------------------------
  function openChat(isFirstVisit = false) {
    chatOpen = true;
    clearBadge();

    // Step 1: remove hidden — let browser register the change
    chatWindow.classList.remove("hidden", "closing", "opening");
    chatWindow.style.display = "flex";

    // Step 2: one rAF so browser processes display:flex before animating
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        chatWindow.classList.add("opening");
        if (isFirstVisit) startFireworks();
        chatWindow.addEventListener("animationend", () => {
          chatWindow.classList.remove("opening");
        }, { once: true });
      });
    });

    autoResizeTextarea();
    userInput.focus();
  }

  function closeChat() {
    chatOpen = false;
    chatWindow.classList.add("closing");
    chatWindow.addEventListener("animationend", () => {
      chatWindow.classList.remove("closing");
      chatWindow.classList.add("hidden");
    }, { once: true });
  }

  // ---- Fullscreen ---------------------------------------------------------
  let isFullscreen = false;
  function toggleFullscreen() {
    isFullscreen = !isFullscreen;
    if (isFullscreen) {
      chatWindow.classList.add("fullscreen");
      fullscreenBtn.textContent = "⛶"; // or use ⊡
      fullscreenBtn.title = "Exit fullscreen";
    } else {
      chatWindow.classList.remove("fullscreen");
      fullscreenBtn.textContent = "⛶";
      fullscreenBtn.title = "Fullscreen";
    }
  }

  // First visit — auto open with sparkle animation after short delay
  const hasVisited = localStorage.getItem("brightly_visited");
  if (!hasVisited) {
    localStorage.setItem("brightly_visited", "1");
    setTimeout(() => openChat(true), 800);
  } else {
    chatWindow.classList.add("hidden");
  }

  // ---- Button wiggle every 30s when chat is closed ------------------------
  setInterval(() => {
    if (!chatOpen) {
      chatBtn.classList.add("wiggle");
      chatBtn.addEventListener("animationend", () => {
        chatBtn.classList.remove("wiggle");
      }, { once: true });
    }
  }, 30000);

  // ---- Events -------------------------------------------------------------
  chatBtn.addEventListener("click", () => {
    chatOpen ? closeChat() : openChat(false);
  });
  closeChatBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeChat();
  });
  if (fullscreenBtn) fullscreenBtn.addEventListener("click", (e) => { e.stopPropagation(); toggleFullscreen(); });

  // ---- Draggable ----------------------------------------------------------
  let isDragging = false, offsetX = 0, offsetY = 0;
  header.addEventListener("mousedown", (e) => {
    if (e.target === closeChatBtn || e.target === fullscreenBtn) return;
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

  // ---- Render -------------------------------------------------------------
  function autoResizeTextarea() {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + "px";
  }

  function renderMessages() {
    chatBody.innerHTML = "";
    chatHistory.forEach((msg, idx) => {
      const bubble = document.createElement("div");
      bubble.className = `message ${msg.type}`;

      if (msg.type === "bot") {
        const icon = document.createElement("span");
        icon.className = "icon"; icon.textContent = "💡";
        bubble.appendChild(icon);

        if (msg.typing) {
          bubble.innerHTML += `<div class="typing-indicator"><span>Thinking...</span><div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
        } else {
          const content = document.createElement("div");
          content.className = "bot-content";
          content.innerHTML = parseMarkdown(msg.text);
          bubble.appendChild(content);

          const footer = document.createElement("div");
          footer.className = "bubble-footer";
          const ts = document.createElement("span");
          ts.className = "msg-time"; ts.textContent = msg.time || "";
          footer.appendChild(ts);

          if (idx > 0) {
            const copyBtn = document.createElement("button");
            copyBtn.className = "copy-btn"; copyBtn.title = "Copy";
            copyBtn.innerHTML = COPY_SVG;
            copyBtn.addEventListener("click", () => {
              navigator.clipboard.writeText(msg.text).then(() => {
                copyBtn.innerHTML = COPY_OK;
                setTimeout(() => copyBtn.innerHTML = COPY_SVG, 2000);
              });
            });
            footer.appendChild(copyBtn);
          }
          bubble.appendChild(footer);
        }

      } else {
        const textSpan = document.createElement("span");
        textSpan.className = "user-text"; textSpan.textContent = msg.text;
        bubble.appendChild(textSpan);

        const editArea = document.createElement("div");
        editArea.className = "inline-edit-area";
        editArea.innerHTML = `<textarea rows="2">${msg.text}</textarea><div class="edit-btns"><button class="edit-cancel">Cancel</button><button class="edit-save">Send ✓</button></div>`;
        bubble.appendChild(editArea);

        const footer = document.createElement("div");
        footer.className = "bubble-footer";
        const ts = document.createElement("span");
        ts.className = "msg-time"; ts.textContent = msg.time || "";
        footer.appendChild(ts);

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn"; editBtn.title = "Edit";
        editBtn.innerHTML = EDIT_SVG;
        editBtn.addEventListener("click", () => {
          const isOpen = editArea.style.display === "flex";
          editArea.style.display = isOpen ? "none" : "flex";
          textSpan.style.display = isOpen ? "" : "none";
          if (!isOpen) { const ta = editArea.querySelector("textarea"); ta.value = msg.text; ta.focus(); }
        });
        footer.appendChild(editBtn);
        bubble.appendChild(footer);

        editArea.querySelector(".edit-cancel").addEventListener("click", () => {
          editArea.style.display = "none"; textSpan.style.display = "";
        });
        editArea.querySelector(".edit-save").addEventListener("click", async () => {
          const ta = editArea.querySelector("textarea");
          const newText = ta.value.trim();
          if (!newText || waiting) return;
          msg.text = newText; msg.time = getTime();
          chatHistory.splice(idx + 1);
          chatHistory.push({ type: "bot", text: "", time: null, typing: true });
          renderMessages(); waiting = true; sendBtn.disabled = true;
          try {
            const answer = await postToAsk(newText);
            chatHistory.pop();
            chatHistory.push({ type: "bot", text: answer, time: getTime() });
          } catch {
            chatHistory.pop();
            chatHistory.push({ type: "bot", text: "⚠️ Error reaching server.", time: getTime() });
          } finally { waiting = false; sendBtn.disabled = false; renderMessages(); }
        });
      }

      chatBody.appendChild(bubble);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  // ---- Session end --------------------------------------------------------
  function sendSessionEnd() {
    if (!sessionId) return;
    navigator.sendBeacon(`${API}/session/end`, new Blob([JSON.stringify({ session_id: sessionId })], { type: "application/json" }));
    localStorage.removeItem("chat_session"); sessionId = null;
  }
  window.addEventListener("beforeunload", sendSessionEnd);

  // ---- Rate limit (client-side soft limit) --------------------------------
  const msgTimestamps = [];
  function isRateLimited() {
    const now   = Date.now();
    const limit = msgTimestamps.filter(t => now - t < 60000);
    msgTimestamps.length = 0;
    limit.forEach(t => msgTimestamps.push(t));
    if (msgTimestamps.length >= 20) return true;
    msgTimestamps.push(now);
    return false;
  }

  // ---- API ----------------------------------------------------------------
  async function postToAsk(question) {
    const res = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, session_id: sessionId }),
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    if (data.session_id)          { sessionId = data.session_id; localStorage.setItem("chat_session", sessionId); }
    if (data.session_id === null) { localStorage.removeItem("chat_session"); sessionId = null; }
    return data.answer || "I couldn't find an answer.";
  }

  // ---- Send ---------------------------------------------------------------
  async function handleSend() {
    if (waiting) return;
    const text = (userInput.value || "").trim();
    if (!text) return;

    if (isRateLimited()) {
      chatHistory.push({ type: "bot", text: "⏳ You're sending too fast! Please wait a moment. 😊", time: getTime() });
      renderMessages(); return;
    }

    chatHistory.push({ type: "user", text, time: getTime() });
    renderMessages();
    userInput.value = ""; autoResizeTextarea();

    chatHistory.push({ type: "bot", text: "", time: null, typing: true });
    renderMessages(); waiting = true; sendBtn.disabled = true;

    try {
      const answer = await postToAsk(text);
      chatHistory.pop();
      chatHistory.push({ type: "bot", text: answer, time: getTime() });

      // Unread badge when chat is closed
      if (!chatOpen) {
        unreadCount++;
        showBadge(unreadCount);
      }
    } catch {
      chatHistory.pop();
      chatHistory.push({ type: "bot", text: "⚠️ Having trouble reaching the server. Please try again.", time: getTime() });
    } finally { waiting = false; sendBtn.disabled = false; renderMessages(); }
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
