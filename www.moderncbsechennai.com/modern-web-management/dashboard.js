const API_BASE = "https://msss-backend-961983851669.asia-south1.run.app";
const DASHBOARD_PASSWORD = "modernSchool2025"; // match your Cloud Run env var

// Password modal
const modal = document.getElementById("passwordModal");
const loginBtn = document.getElementById("loginBtn");
const passwordInput = document.getElementById("dashboardPassword");
const loginError = document.getElementById("loginError");
const dashboard = document.getElementById("dashboard");

loginBtn.addEventListener("click", () => {
  if(passwordInput.value === DASHBOARD_PASSWORD) {
    modal.style.display = "none";
    dashboard.classList.remove("hidden");
    initDashboard();
  } else {
    loginError.textContent = "Incorrect password!";
  }
});

// ---- Dashboard functions ----
let editor, activeFile = null;

async function initDashboard() {
  const textarea = document.getElementById("editor");
  editor = CodeMirror.fromTextArea(textarea, {
    lineNumbers: true,
    mode: "javascript",
    theme: "material-darker",
    lineWrapping: true
  });

  document.getElementById("refreshBtn").onclick = loadFiles;
  document.getElementById("createBtn").onclick = createFile;
  document.getElementById("saveBtn").onclick = saveFile;
  document.getElementById("deleteBtn").onclick = deleteFile;

  editor.on("change", () => {
    document.getElementById("preview").innerHTML = marked(editor.getValue());
  });

  await loadFiles();
}

async function loadFiles() {
  const res = await fetch(`${API_BASE}/files`);
  const data = await res.json();
  const list = document.getElementById("fileList");
  list.innerHTML = "";
  data.files.forEach(f => {
    const item = document.createElement("div");
    item.textContent = f;
    item.onclick = () => openFile(f);
    list.appendChild(item);
  });
}

async function openFile(name) {
  activeFile = name;
  const res = await fetch(`${API_BASE}/file/${name}`);
  const data = await res.json();
  editor.setValue(data.content);
}

async function createFile() {
  const title = prompt("New file name?");
  if(!title) return;
  await fetch(`${API_BASE}/file/create`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ title, content: "" })
  });
  await loadFiles();
  openFile(title);
}

async function saveFile() {
  if(!activeFile) return alert("Open a file first!");
  await fetch(`${API_BASE}/file/update`, {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ filename: activeFile, content: editor.getValue() })
  });
  alert("Saved successfully!");
}

async function deleteFile() {
  if(!activeFile) return alert("Open a file first!");
  if(!confirm(`Delete file "${activeFile}"?`)) return;
  await fetch(`${API_BASE}/file/${activeFile}`, { method:"DELETE" });
  editor.setValue("");
  activeFile = null;
  await loadFiles();
}
