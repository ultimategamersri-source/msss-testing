const API_BASE = "https://msss-backend-961983851669.asia-south1.run.app";

// === PASSWORD PROTECTION ===
const DASHBOARD_PASSWORD = "modernSchool2025";

function checkPassword() {
  const pass = document.getElementById("dashboardPassword").value;
  if(pass === DASHBOARD_PASSWORD){
    document.getElementById("passwordOverlay").style.display = "none";
    document.getElementById("dashboardContainer").style.display = "flex";
    loadFiles();
  } else {
    document.getElementById("passwordError").textContent = "Incorrect password!";
  }
}

// === FILE LIST ===
let filesData = [];

async function loadFiles() {
  try{
    const res = await fetch(`${API_BASE}/files`);
    const data = await res.json();
    filesData = data.files || [];
    renderFileList();
  }catch(err){
    console.error(err);
    document.getElementById("fileList").innerHTML = "Failed to load files.";
  }
}

function renderFileList() {
  const list = document.getElementById("fileList");
  list.innerHTML = "";
  filesData.forEach(f => {
    const div = document.createElement("div");
    div.textContent = f;
    div.className = "file-item";
    div.onclick = () => openFile(f);
    
    // Long press rename
    let pressTimer;
    div.onmousedown = () => pressTimer = setTimeout(()=>renameFileSidebar(f, div), 800);
    div.onmouseup = div.onmouseleave = () => clearTimeout(pressTimer);

    list.appendChild(div);
  });
}

// Sidebar search
function filterFiles() {
  const query = document.getElementById("searchFiles").value.toLowerCase();
  const filtered = filesData.filter(f => f.toLowerCase().includes(query));
  const list = document.getElementById("fileList");
  list.innerHTML = "";
  filtered.forEach(f => {
    const div = document.createElement("div");
    div.textContent = f;
    div.className = "file-item";
    div.onclick = () => openFile(f);
    list.appendChild(div);
  });
}

// OPEN FILE
async function openFile(name) {
  try {
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(name)}`);
    const data = await res.json();
    addFileBlock(name, data.content);
  } catch(err){
    console.error(err);
    alert("Failed to load file");
  }
}

// ADD FILE BLOCK TO MAIN CONTENT
function addFileBlock(name, content){
  const main = document.getElementById("mainContent");
  const block = document.createElement("div");
  block.className = "fileBlock";
  
  const header = document.createElement("h3");
  header.textContent = name;

  const btnContainer = document.createElement("span");
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save"; saveBtn.className="saveBtn";
  saveBtn.onclick = async () => saveFile(name, textarea.value);

  const deleteBtn = document.createElement("button");
  deleteBtn.textContent="Delete"; deleteBtn.className="deleteBtn";
  deleteBtn.onclick = async () => { await deleteFile(name); block.remove(); };

  const renameBtn = document.createElement("button");
  renameBtn.textContent="Rename"; renameBtn.className="renameBtn";
  renameBtn.onclick = async () => renameFile(name, textarea, header);

  btnContainer.appendChild(saveBtn);
  btnContainer.appendChild(deleteBtn);
  btnContainer.appendChild(renameBtn);
  header.appendChild(btnContainer);

  const textarea = document.createElement("textarea");
  textarea.value = content;

  block.appendChild(header);
  block.appendChild(textarea);
  main.appendChild(block);
}

// SAVE, DELETE, RENAME, CREATE
async function saveFile(name, content){
  try{
    await fetch(`${API_BASE}/file/update`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ filename:name, content })
    });
    alert("Saved "+name);
    loadFiles();
  }catch(err){console.error(err);}
}

async function deleteFile(name){
  try{
    await fetch(`${API_BASE}/file/${encodeURIComponent(name)}`, { method:"DELETE" });
    filesData = filesData.filter(f => f!==name);
    renderFileList();
  }catch(err){console.error(err);}
}

async function renameFile(oldName, textarea, header){
  const newName = prompt("New name?", oldName);
  if(!newName) return;
  try{
    await fetch(`${API_BASE}/file/rename`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ oldName, newName, content: textarea.value })
    });
    header.childNodes[0].textContent = newName;
    filesData = filesData.map(f => f===oldName ? newName : f);
    renderFileList();
  }catch(err){console.error(err);}
}

async function renameFileSidebar(oldName, div){
  const newName = prompt("New file name?", oldName);
  if(!newName) return;
  try{
    await fetch(`${API_BASE}/file/rename`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ oldName, newName, content: "" })
    });
    div.textContent = newName;
    filesData = filesData.map(f => f===oldName ? newName : f);
  }catch(err){console.error(err);}
}

async function createFile(){
  const name = prompt("File name?");
  if(!name) return;
  try{
    await fetch(`${API_BASE}/file/create`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({ title:name, content:"" })
    });
    filesData.push(name);
    renderFileList();
  }catch(err){console.error(err);}
}
