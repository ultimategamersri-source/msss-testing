// ===============================
// CONFIG
// ===============================
const API_BASE = "https://msss-backend-961983851669.asia-south1.run.app"; // Cloud Run URL

// ===============================
// TEACHER MANAGEMENT
// ===============================
async function addTeacher() {
  const name = document.getElementById("teacherName").value.trim();
  if (!name) return alert("Enter teacher name");

  const res = await fetch(`${API_BASE}/add-teacher`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });

  document.getElementById("resultBox").textContent = await res.text();
  document.getElementById("teacherName").value = "";
}

async function getTeachers() {
  const res = await fetch(`${API_BASE}/teachers`);
  const data = await res.json();
  document.getElementById("resultBox").textContent = JSON.stringify(data, null, 2);
}

// ===============================
// FILE MANAGEMENT
// ===============================
async function loadFiles() {
  const res = await fetch(`${API_BASE}/files`);
  const data = await res.json();
  
  const list = document.getElementById("fileList");
  list.innerHTML = "";

  data.files.forEach(file => {
    const item = document.createElement("div");
    item.className = "file-item";
    item.innerText = file;
    item.onclick = () => openFile(file);
    list.appendChild(item);
  });
}

async function openFile(filename) {
  const res = await fetch(`${API_BASE}/file/${filename}`);
  const data = await res.json();
  window.activeFile = filename;
  document.getElementById("editor").value = data.content;
}

async function saveFile() {
  if (!window.activeFile) return alert("Select a file first");

  const content = document.getElementById("editor").value;
  await fetch(`${API_BASE}/file/update`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filename: window.activeFile, content })
  });

  alert("Saved!");
}

async function createFile() {
  const title = prompt("New file name?");
  if (!title) return;
  const content = document.getElementById("editor").value;

  await fetch(`${API_BASE}/file/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content })
  });

  loadFiles();
}

async function deleteFile() {
  if (!window.activeFile) return alert("Open a file first");
  await fetch(`${API_BASE}/file/${window.activeFile}`, { method: "DELETE" });
  document.getElementById("editor").value = "";
  window.activeFile = null;
  loadFiles();
}
