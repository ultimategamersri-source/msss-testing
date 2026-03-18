<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MSSS</title>

  <link rel="stylesheet" href="dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="dist/css/bootstrap-theme.min.css">
  <link rel="stylesheet" href="css/style.css">

  <script type="module" src="js/config.js"></script>
  <script src="js/jquery.js" type="text/javascript"></script>
  <script src="dist/js/bootstrap.min.js"></script>
  <script type="module" src="js/chat.js"></script>

  <style>
    /* === Chat Button === */
    #chat-btn {
      position: fixed; bottom: 20px; right: 20px;
      background: linear-gradient(270deg, #ff6ec4, #7873f5, #42e695, #ffe140, #ff6ec4);
      background-size: 1000% 1000%;
      color: white; border: none; border-radius: 50%;
      width: 65px; height: 65px; font-size: 30px; cursor: pointer;
      animation: moveGradient 4s linear infinite, pulseGlow 2.5s ease-in-out infinite;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3); z-index: 9999;
      transition: transform 0.2s;
    }
    #chat-btn:hover { transform: scale(1.15); }
    #chat-btn.wiggle { animation: moveGradient 4s linear infinite, wiggle 0.6s ease-in-out 3; }

    /* Unread badge */
    #chat-badge {
      position: fixed; bottom: 58px; right: 16px;
      background: #ff4757; color: white;
      border-radius: 50%; width: 20px; height: 20px;
      font-size: 11px; font-weight: bold;
      display: none; align-items: center; justify-content: center;
      z-index: 10000; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      animation: badgePop 0.3s cubic-bezier(0.68,-0.55,0.27,1.55);
    }
    #chat-badge.show { display: flex; }

    @keyframes badgePop {
      0%   { transform: scale(0); }
      100% { transform: scale(1); }
    }
    @keyframes pulseGlow {
      0%, 100% { box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 0 0 rgba(120,115,245,0.5); }
      50%       { box-shadow: 0 4px 8px rgba(0,0,0,0.3), 0 0 0 12px rgba(120,115,245,0); }
    }
    @keyframes wiggle {
      0%, 100% { transform: rotate(0deg); }
      20%       { transform: rotate(-15deg); }
      40%       { transform: rotate(15deg); }
      60%       { transform: rotate(-10deg); }
      80%       { transform: rotate(10deg); }
    }
    @keyframes moveGradient {
      0%   { background-position: 0% 50%; }
      50%  { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    /* === Chat Window === */
    #chat-window {
      position: fixed; bottom: 100px; right: 20px;
      width: 350px; min-height: 200px; max-height: 600px;
      background-color: #fdfdfd; border-radius: 30px;
      box-shadow: 0 8px 25px rgba(0,0,0,0.25);
      flex-direction: column; z-index: 9999; display: flex;
      transform-origin: bottom right;
      transition: none;
    }

    /* Hidden state */
    #chat-window.hidden {
      opacity: 0;
      pointer-events: none;
      transform: scale(0.3) translateY(40px);
      transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
    }

    /* Opening animation — shine + expand */
    #chat-window.opening {
      animation: shineOpen 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards;
    }

    /* Normal close */
    #chat-window.closing {
      animation: closeDown 0.3s ease forwards;
    }

    @keyframes shineOpen {
      0%   { opacity: 0; transform: scale(0.2) translateY(60px); filter: brightness(2) saturate(2); }
      40%  { opacity: 1; transform: scale(1.08) translateY(-6px); filter: brightness(1.4) saturate(1.5); }
      70%  { transform: scale(0.97) translateY(2px); filter: brightness(1.1); }
      100% { opacity: 1; transform: scale(1) translateY(0); filter: brightness(1) saturate(1); }
    }

    @keyframes closeDown {
      0%   { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(0.3) translateY(40px); }
    }

    /* Sparkles + Fireworks container */
    #sparkles {
      position: fixed; bottom: 80px; right: 10px;
      width: 80px; height: 80px;
      pointer-events: none; z-index: 9998;
    }
    .sparkle {
      position: absolute;
      border-radius: 50%;
      animation: sparkleFly 0.9s ease-out forwards;
    }
    @keyframes sparkleFly {
      0%   { opacity: 1; transform: scale(1) translate(0,0); }
      100% { opacity: 0; transform: scale(0) translate(var(--tx), var(--ty)); }
    }

    /* Fireworks canvas — above everything including intro */
    #fireworks-canvas {
      position: fixed; inset: 0;
      width: 100vw; height: 100vh;
      pointer-events: none; z-index: 999999;
      display: none;
    }
    #fireworks-canvas.active { display: block; }

    /* Scrollbar only when needed */
    #chat-body { overflow-y: auto; scrollbar-width: thin; scrollbar-color: #c0b4f5 transparent; }
    #chat-body::-webkit-scrollbar { width: 4px; }
    #chat-body::-webkit-scrollbar-thumb { background: #c0b4f5; border-radius: 4px; }
    #chat-body::-webkit-scrollbar-track { background: transparent; }

    /* === Chat Header === */
    #chat-header {
      background: linear-gradient(270deg, #ff6ec4, #7873f5, #42e695, #ffe140, #ff6ec4);
      background-size: 1000% 1000%;
      animation: moveGradient 10s linear infinite;
      color: #ffed4f; font-weight: bold;
      padding: 12px 14px;
      display: flex; align-items: center; justify-content: space-between;
      font-family: "Comic Sans MS", sans-serif;
      border-top-left-radius: 30px; border-top-right-radius: 30px;
      font-size: large; cursor: grab;
    }

    #close-chat-btn, #fullscreen-btn {
      background: rgba(255,255,255,0.2); border: none;
      border-radius: 50%; width: 28px; height: 28px;
      color: white; font-size: 14px; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.2s; flex-shrink: 0; line-height: 1;
    }
    #close-chat-btn:hover, #fullscreen-btn:hover { background: rgba(255,255,255,0.4); }
    .header-btns { display: flex; gap: 6px; align-items: center; }

    /* Fullscreen mode */
    #chat-window.fullscreen {
      width: 100vw !important; height: 100vh !important;
      max-height: 100vh !important; bottom: 0 !important;
      right: 0 !important; border-radius: 0 !important;
    }

    /* === Chat Body === */
    #chat-body {
      flex: 1; padding: 12px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 8px; background: #fff;
    }

    /* === Bubbles === */
    .message {
      padding: 10px 14px 6px 14px;
      border-radius: 22px;
      word-wrap: break-word;
      font-family: "Comic Sans MS", sans-serif;
      font-size: 1em; line-height: 1.5;
      box-shadow: 0 2px 5px rgba(0,0,0,0.12);
      position: relative;
      display: flex; flex-direction: column;
      max-width: 80%;
    }
    .message.user {
      align-self: flex-end;
      background: linear-gradient(135deg, #42e695, #3bb2b8);
      color: #fff; border-bottom-right-radius: 5px;
    }
    .message.bot {
      align-self: flex-start;
      background: linear-gradient(135deg, #7873f5, #a98df5);
      color: white; border-bottom-left-radius: 5px;
      padding-left: 28px;
    }
    .bot .icon { position: absolute; top: 8px; left: 8px; }

    /* === Bot content === */
    .bot-content { color: white; font-family: "Comic Sans MS", sans-serif; }
    .bot-content strong { color: #ffed4f; font-weight: bold; }
    .bot-content ul { margin: 4px 0; padding-left: 16px; list-style: none; }
    .bot-content ul li::before { content: "•"; color: #ffed4f; font-weight: bold; margin-right: 6px; }
    .bot-content br { display: block; margin: 1px 0; }

    /* === Bubble footer === */
    .bubble-footer {
      display: flex; align-items: center; justify-content: flex-end;
      gap: 5px; margin-top: 4px;
    }
    .msg-time {
      font-size: 0.65em; color: rgba(255,255,255,0.75);
      font-family: "Comic Sans MS", sans-serif; white-space: nowrap;
    }
    .copy-btn, .edit-btn {
      background: none; border: none; cursor: pointer; padding: 0;
      display: flex; align-items: center; transition: opacity 0.2s, transform 0.15s;
    }
    .copy-btn svg, .edit-btn svg { width: 12px; height: 12px; stroke: rgba(255,255,255,0.75); }
    .copy-btn:hover svg, .edit-btn:hover svg { stroke: white; }
    .edit-btn { opacity: 0; transition: opacity 0.2s; }
    .message.user:hover .edit-btn { opacity: 1; }

    /* === Inline edit === */
    .inline-edit-area {
      display: none; flex-direction: column; gap: 6px; margin-top: 6px;
    }
    .inline-edit-area textarea {
      background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.5);
      border-radius: 10px; color: white;
      font-family: "Comic Sans MS", sans-serif; font-size: 0.95em;
      padding: 6px 8px; resize: none; outline: none; width: 100%;
    }
    .inline-edit-area textarea::placeholder { color: rgba(255,255,255,0.6); }
    .inline-edit-area .edit-btns { display: flex; gap: 6px; justify-content: flex-end; }
    .inline-edit-area button {
      border: none; border-radius: 10px; padding: 3px 10px;
      font-family: "Comic Sans MS", sans-serif; font-size: 0.8em; cursor: pointer;
    }
    .edit-save   { background: rgba(255,255,255,0.3); color: white; }
    .edit-cancel { background: rgba(0,0,0,0.15); color: white; }

    /* === Typing indicator === */
    .typing-indicator { display: flex; align-items: center; gap: 8px; color: #ffffffcc; font-family: "Comic Sans MS", sans-serif; font-size: 0.9em; }
    .dots { display: flex; gap: 4px; align-items: center; }
    .dot { width: 7px; height: 7px; background: #ffed4f; border-radius: 50%; animation: bounce 1.2s infinite ease-in-out; }
    .dot:nth-child(1) { animation-delay: 0s; }
    .dot:nth-child(2) { animation-delay: 0.2s; }
    .dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30%            { transform: translateY(-6px); }
    }

    /* === Input === */
    #chat-input {
      display: flex; padding: 8px; border-top: 1px solid #ccc;
      background: #f7f7f7;
      border-bottom-left-radius: 30px; border-bottom-right-radius: 30px;
    }
    #user-input {
      flex: 1; min-height: 40px; max-height: 120px; resize: none;
      border-radius: 20px; padding: 10px 12px; border: 1px solid #ddd;
      font-size: 0.95em; font-family: "Comic Sans MS", sans-serif;
      outline: none; transition: all 0.2s;
    }
    #user-input:focus { border-color: #7873f5; }
    #send-btn {
      margin-left: 8px; padding: 10px 14px;
      background: linear-gradient(135deg, #ff6ec4, #7873f5);
      color: white; border: none; border-radius: 20px;
      cursor: pointer; font-weight: bold; transition: 0.2s;
    }
    #send-btn:hover { transform: scale(1.1); }

    @media (max-width: 480px) {
      #chat-window { width: calc(100vw - 20px); right: 10px; bottom: 90px; max-height: 70vh; border-radius: 20px; }
      #chat-btn { width: 55px; height: 55px; font-size: 24px; bottom: 15px; right: 15px; }
    }

    /* ========== INTRO SCREEN ========== */
    #intro-screen {
      position: fixed; inset: 0; z-index: 99999;
      background: #0a0a1a;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      overflow: hidden;
      cursor: pointer;
    }
    #intro-screen.fade-out {
      animation: introFadeOut 1s ease forwards;
    }
    @keyframes introFadeOut {
      0%   { opacity: 1; transform: scale(1); }
      100% { opacity: 0; transform: scale(1.05); pointer-events: none; }
    }

    /* Star field background */
    #intro-canvas {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
    }

    /* Logo ring */
    .intro-ring {
      position: relative; z-index: 2;
      width: 140px; height: 140px;
      border-radius: 50%;
      background: linear-gradient(135deg, #7873f5, #ff6ec4, #42e695, #ffe140);
      display: flex; align-items: center; justify-content: center;
      animation: ringPulse 2s ease-in-out infinite, ringAppear 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.3s both;
      box-shadow: 0 0 60px rgba(120,115,245,0.8), 0 0 120px rgba(255,110,196,0.4);
    }
    .intro-ring-inner {
      width: 120px; height: 120px; border-radius: 50%;
      background: #0a0a1a;
      display: flex; align-items: center; justify-content: center;
      font-size: 52px;
    }
    @keyframes ringAppear {
      0%   { opacity: 0; transform: scale(0) rotate(-180deg); }
      100% { opacity: 1; transform: scale(1) rotate(0deg); }
    }
    @keyframes ringPulse {
      0%,100% { box-shadow: 0 0 60px rgba(120,115,245,0.8), 0 0 120px rgba(255,110,196,0.4); }
      50%      { box-shadow: 0 0 80px rgba(120,115,245,1),   0 0 160px rgba(255,110,196,0.6); }
    }

    /* School name */
    .intro-title {
      position: relative; z-index: 2;
      margin-top: 32px;
      font-family: "Comic Sans MS", sans-serif;
      font-size: clamp(1.4rem, 5vw, 2.4rem);
      font-weight: 900;
      text-align: center;
      background: linear-gradient(90deg, #ff6ec4, #ffe140, #42e695, #7873f5, #ff6ec4);
      background-size: 300% 100%;
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: titleSlide 0.8s cubic-bezier(0.34,1.56,0.64,1) 0.9s both,
                 shimmer 3s linear 1.7s infinite;
      letter-spacing: 2px;
      text-shadow: none;
    }
    .intro-subtitle {
      position: relative; z-index: 2;
      margin-top: 10px;
      font-family: "Comic Sans MS", sans-serif;
      font-size: clamp(0.8rem, 2.5vw, 1rem);
      color: rgba(255,255,255,0.6);
      letter-spacing: 4px;
      text-transform: uppercase;
      animation: titleSlide 0.8s cubic-bezier(0.34,1.56,0.64,1) 1.1s both;
    }
    @keyframes titleSlide {
      0%   { opacity: 0; transform: translateY(40px); }
      100% { opacity: 1; transform: translateY(0); }
    }
    @keyframes shimmer {
      0%   { background-position: 0% 50%; }
      100% { background-position: 300% 50%; }
    }

    /* Tap to continue */
    .intro-tap {
      position: relative; z-index: 2;
      margin-top: 48px;
      font-family: "Comic Sans MS", sans-serif;
      font-size: 0.85rem;
      color: rgba(255,255,255,0.4);
      animation: tapBlink 1.4s ease-in-out 2s infinite, titleSlide 0.6s ease 2s both;
      letter-spacing: 2px;
    }
    @keyframes tapBlink {
      0%,100% { opacity: 0.4; }
      50%      { opacity: 1; color: rgba(255,255,255,0.9); }
    }

    /* Orbiting dots */
    .intro-orbit {
      position: absolute; z-index: 2;
      width: 220px; height: 220px;
      animation: orbitSpin 4s linear infinite;
    }
    .intro-orbit-dot {
      position: absolute; border-radius: 50%;
      width: 10px; height: 10px;
    }
    @keyframes orbitSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

  </style>
</head>
<body>
  <!-- ===== INTRO SCREEN ===== -->
  <div id="intro-screen">
    <canvas id="intro-canvas"></canvas>
    <!-- Orbiting dots -->
    <div class="intro-orbit" id="intro-orbit"></div>
    <!-- Logo -->
    <div class="intro-ring">
      <div class="intro-ring-inner">🎓</div>
    </div>
    <!-- Text -->
    <div class="intro-title">ABC Senior Secondary School</div>
    <div class="intro-subtitle">Chennai &nbsp;·&nbsp; Est. 2026</div>
    <div class="intro-tap">✦ tap anywhere to enter ✦</div>
  </div>

  <!-- ===== INTRO SCRIPT (inline so it runs immediately) ===== -->
  <script>
  (function() {
    const intro   = document.getElementById("intro-screen");
    const canvas  = document.getElementById("intro-canvas");
    const orbit   = document.getElementById("intro-orbit");
    if (!intro || !canvas) return;

    // ---- Orbiting dots ----
    const ORBIT_COLORS = ["#ff6ec4","#7873f5","#42e695","#ffe140","#54a0ff","#ff9f43"];
    for (let i = 0; i < 6; i++) {
      const dot = document.createElement("div");
      dot.className = "intro-orbit-dot";
      const angle  = (i / 6) * 360;
      const rad    = angle * Math.PI / 180;
      dot.style.cssText = `
        background: ${ORBIT_COLORS[i]};
        box-shadow: 0 0 10px ${ORBIT_COLORS[i]};
        left: calc(50% + ${Math.cos(rad) * 100}px - 5px);
        top:  calc(50% + ${Math.sin(rad) * 100}px - 5px);
      `;
      orbit.appendChild(dot);
    }

    // ---- Star field canvas ----
    const ctx = canvas.getContext("2d");
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);

    const STARS = Array.from({length: 180}, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      r: Math.random() * 1.8 + 0.2,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.012,
      vx: (Math.random() - 0.5) * 0.15,
      vy: (Math.random() - 0.5) * 0.15,
      color: ORBIT_COLORS[Math.floor(Math.random() * ORBIT_COLORS.length)],
    }));

    let raf;
    function drawStars() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      STARS.forEach(s => {
        s.x = (s.x + s.vx + canvas.width)  % canvas.width;
        s.y = (s.y + s.vy + canvas.height) % canvas.height;
        s.a = Math.max(0.1, Math.min(1, s.a + s.da));
        if (s.a <= 0.1 || s.a >= 1) s.da *= -1;
        ctx.globalAlpha = s.a;
        ctx.fillStyle   = s.color;
        ctx.shadowColor = s.color;
        ctx.shadowBlur  = 6;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      raf = requestAnimationFrame(drawStars);
    }
    drawStars();

    // ---- Web Audio sound ----
    function playIntroSound() {
      try {
        const ac  = new (window.AudioContext || window.webkitAudioContext)();
        const t   = ac.currentTime;

        function note(freq, start, dur, vol=0.3) {
          const osc  = ac.createOscillator();
          const gain = ac.createGain();
          osc.connect(gain); gain.connect(ac.destination);
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, t + start);
          gain.gain.setValueAtTime(0, t + start);
          gain.gain.linearRampToValueAtTime(vol, t + start + 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, t + start + dur);
          osc.start(t + start);
          osc.stop(t + start + dur + 0.1);
        }

        // Rising majestic chord sequence — Nintendo-style
        note(261.6, 0.0,  0.4, 0.25); // C4
        note(329.6, 0.15, 0.4, 0.25); // E4
        note(392.0, 0.3,  0.4, 0.25); // G4
        note(523.3, 0.5,  0.6, 0.3);  // C5
        note(659.3, 0.7,  0.5, 0.25); // E5
        note(783.9, 0.9,  0.8, 0.3);  // G5 — hold
        note(1046.5,1.1,  1.0, 0.2);  // C6 — sparkle top

        // Add shimmer — high frequency sweep
        const sw   = ac.createOscillator();
        const swg  = ac.createGain();
        sw.connect(swg); swg.connect(ac.destination);
        sw.type = "triangle";
        sw.frequency.setValueAtTime(1200, t + 0.8);
        sw.frequency.exponentialRampToValueAtTime(2400, t + 1.6);
        swg.gain.setValueAtTime(0.08, t + 0.8);
        swg.gain.exponentialRampToValueAtTime(0.001, t + 2.0);
        sw.start(t + 0.8); sw.stop(t + 2.1);

      } catch(e) { console.log("Audio not available:", e); }
    }

    // ---- Dismiss ----
    function dismiss() {
      cancelAnimationFrame(raf);
      intro.classList.add("fade-out");
      intro.addEventListener("animationend", () => {
        intro.style.display = "none";
        // Signal to chat.js that intro is done
        window.dispatchEvent(new CustomEvent("introDone"));
      }, { once: true });
    }

    // Auto dismiss after 4.5s, or on tap
    const autoTimer = setTimeout(dismiss, 4500);
    intro.addEventListener("click", () => { clearTimeout(autoTimer); dismiss(); });

    // Play sound on first interaction (browser policy) or auto after short delay
    let soundPlayed = false;
    function trySound() {
      if (!soundPlayed) { soundPlayed = true; playIntroSound(); }
    }
    document.addEventListener("click",     trySound, { once: true });
    document.addEventListener("touchstart", trySound, { once: true });
    // Try auto after 200ms (works on some browsers without interaction)
    setTimeout(() => { try { playIntroSound(); soundPlayed = true; } catch(e){} }, 200);
  })();
  </script>

  <button id="chat-btn">💬</button>
  <div id="chat-badge"></div>
  <canvas id="fireworks-canvas"></canvas>

  <div id="chat-window" class="hidden">
    <div id="chat-header">
      <span>✨ Brightly (School Assistant)</span>
      <div class="header-btns">
        <button id="fullscreen-btn" title="Fullscreen">⛶</button>
        <button id="close-chat-btn" title="Close">✕</button>
      </div>
    </div>
    <div id="chat-body"></div>
    <div id="chat-input">
      <textarea id="user-input" placeholder="Ask something..."></textarea>
      <button id="send-btn">Send</button>
    </div>
  </div>

  <div class="container-fluid">
    <div class="jumbotron">
      <h2 align="center">ABC Senior Secondary School</h2>
    </div>
  </div>
</body>
</html>
