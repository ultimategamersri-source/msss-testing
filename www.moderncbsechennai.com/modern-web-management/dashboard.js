async function loadFiles() {
  const res = await fetch(base + "/files");
  const data = await res.json();
  const list = document.getElementById("fileList");
  list.innerHTML = "";

  data.files.forEach(f => {
    const item = document.createElement("div");
    item.innerText = f;
    item.onclick = () => loadSpecificFile(f);
    item.style.cursor = "pointer";
    item.style.padding = "6px";
    item.style.borderBottom = "1px solid #ddd";
    list.appendChild(item);
  });
}

async function loadSpecificFile(name) {
  const res = await fetch(base + "/data/latest", { // replace route if needed
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ filename: name })
  });
}
// Load list
async function listFiles() {
  const files = await (await fetch(base + "/files")).json();
  console.log(files);
}

// Create new
async function createFile() {
  const title = prompt("Title?");
  const content = document.getElementById("editor").value;
  await fetch(base + "/file/create", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ title, content })
  });
}

// Load file
async function openFile(name) {
  const data = await (await fetch(base + "/file/" + name)).json();
  document.getElementById("editor").value = data.content;
  window.activeFile = name;
}

// Save changes
async function saveFile() {
  await fetch(base + "/file/update", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ filename: window.activeFile, content: document.getElementById("editor").value })
  });
}

// Delete
async function deleteFile(name) {
  await fetch(base + "/file/" + name, { method:"DELETE" });
}
