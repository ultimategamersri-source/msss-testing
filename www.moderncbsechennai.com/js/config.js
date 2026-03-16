// ========= config.js =========
const API = "https://msss-backend-961983851669.asia-south1.run.app";

let sessionId = localStorage.getItem("chat_session") || null;

async function sendMessage(userMessage) {
  try {
    const res = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: userMessage, session_id: sessionId }),
    });

    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();

    // Save session id
    if (data.session_id) {
      sessionId = data.session_id;
      localStorage.setItem("chat_session", sessionId);
    }

    return data.answer || "No response received.";
  } catch (err) {
    console.error("Error contacting chatbot API:", err);
    return "⚠️ There was an issue connecting to the assistant.";
  }
}

export { API, sendMessage };
