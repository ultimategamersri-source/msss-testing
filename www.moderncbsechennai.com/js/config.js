// js/config.js
const API = "https://msss-backend-961983851669.asia-south1.run.app";

let sessionId = localStorage.getItem("chat_session");

async function sendMessage(userMessage) {
  try {
    const response = await fetch(`${API}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: userMessage,
        session_id: sessionId
      })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();

    // 👇 ADD IT HERE
    sessionId = data.session_id;
    localStorage.setItem("chat_session", sessionId);

    return data.answer || "No response received.";

  } catch (error) {
    console.error("Error contacting chatbot API:", error);
    return "There was an issue connecting to the chatbot.";
  }
}

export { sendMessage };
export { API };
