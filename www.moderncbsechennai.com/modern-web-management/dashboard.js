const API_BASE = "https://msss-backend-961983851669.asia-south1.run.app";

// === PASSWORD PROTECTION ===
const DASHBOARD_PASSWORD = "modernSchool2025";

function checkPassword() {
  const pass = document.getElementById("dashboardPassword").value;
  if(pass === DASHBOARD_PASSWORD){
    const API_BASE = "https://msss-backend-961983851669.asia-south1.run.app";

    // === State ===
    let filesData = [];

    // UTIL: show error
    function showPasswordError(msg){
      const err = document.getElementById('passwordError');
      err.textContent = msg;
    }

    // PASSWORD: verify with backend /auth-check
    async function checkPassword() {
      const pass = document.getElementById('dashboardPassword').value.trim();
      showPasswordError('');
      try{
        const res = await fetch(`${API_BASE}/auth-check`, {
          method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ password: pass })
        });
        const j = await res.json();
        if(j && j.success){
          document.getElementById('passwordOverlay').style.display = 'none';
          document.getElementById('dashboardContainer').classList.remove('blurred');
          await loadFiles();
        } else {
          showPasswordError('Incorrect password.');
          document.getElementById('dashboardPassword').value = '';
        }
      }catch(err){
        console.error(err);
        showPasswordError('Auth check failed.');
      }
    }

    // Demo button for local quick view (no auth) - still loads files if backend allows
    async function demoAccess(){
      document.getElementById('passwordOverlay').style.display = 'none';
      document.getElementById('dashboardContainer').classList.remove('blurred');
      await loadFiles();
    }

    // Load files from API
    async function loadFiles(){
      const listEl = document.getElementById('fileList');
      listEl.innerHTML = 'Loading...';
      try{
        const res = await fetch(`${API_BASE}/files`);
        const data = await res.json();
        filesData = Array.isArray(data) ? data : (data.files || []);
        renderFileList();
      }catch(err){
        console.error(err);
        listEl.innerHTML = 'Failed to load files.';
      }
    }

    // Render files in sidebar
    function renderFileList(){
      const list = document.getElementById('fileList');
      list.innerHTML = '';
      filesData.forEach((f, i) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.filename = f;
        item.innerHTML = `<div class="titleWrap"><span class="fileTitle">${escapeHtml(f)}</span></div>`;
        item.onclick = () => openFile(f);

        // long press to rename
        let pressTimer = null;
        item.addEventListener('mousedown', ()=> pressTimer = setTimeout(()=> renameFileSidebar(f, item), 800));
        item.addEventListener('mouseup', ()=> clearTimeout(pressTimer));
        item.addEventListener('mouseleave', ()=> clearTimeout(pressTimer));

        list.appendChild(item);
      });
    }

    // Escape simple html
    function escapeHtml(s){ return String(s).replace(/[&<>"']/g, (c)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'":"&#39;'}[c])); }

    // Search filter
    function filterFiles(){
      const q = document.getElementById('searchFiles').value.toLowerCase();
      const filtered = filesData.filter(f => f.toLowerCase().includes(q));
      const list = document.getElementById('fileList');
      list.innerHTML = '';
      filtered.forEach(f => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.dataset.filename = f;
        item.innerHTML = `<div class="titleWrap"><span class="fileTitle">${escapeHtml(f)}</span></div>`;
        item.onclick = () => openFile(f);
        list.appendChild(item);
      });
    }

    // Open file and add block
    async function openFile(name){
      try{
        const res = await fetch(`${API_BASE}/file/${encodeURIComponent(name)}`);
        if(!res.ok) throw new Error('Not found');
        const data = await res.json();
        addFileBlock(name, data.content || '');
      }catch(err){
        console.error(err);
        alert('Failed to open file');
      }
    }

    // Create UI block for a file
    function addFileBlock(name, content){
      const container = document.getElementById('blocksContainer');
      const block = document.createElement('div');
      block.className = 'fileBlock';

      const header = document.createElement('div');
      header.className = 'fileBlockHeader';
      const title = document.createElement('div'); title.className='fileBlockTitle'; title.textContent = name;
      const actions = document.createElement('div'); actions.className='fileBlockActions';

      const saveBtn = document.createElement('button'); saveBtn.className='saveBtn'; saveBtn.textContent='Save';
      const delBtn = document.createElement('button'); delBtn.className='deleteBtn'; delBtn.textContent='Delete';
      const renameBtn = document.createElement('button'); renameBtn.className='renameBtn'; renameBtn.textContent='Rename';

      actions.appendChild(saveBtn); actions.appendChild(delBtn); actions.appendChild(renameBtn);
      header.appendChild(title); header.appendChild(actions);

      const ta = document.createElement('textarea'); ta.value = content;

      saveBtn.onclick = async ()=> { await saveFile(name, ta.value); };
      delBtn.onclick = async ()=> { if(confirm('Delete '+name+'?')){ await deleteFile(name); block.remove(); } };
      renameBtn.onclick = async ()=> { await renameFile(name, ta.value, title); };

      block.appendChild(header); block.appendChild(ta);
      container.prepend(block);
      // scroll into view
      block.scrollIntoView({ behavior:'smooth', block:'start' });
    }

    // Save file using update endpoint
    async function saveFile(filename, content){
      try{
        const res = await fetch(`${API_BASE}/file/update`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ filename, content })
        });
        if(!res.ok) throw new Error('Save failed');
        alert('Saved '+filename);
        await loadFiles();
      }catch(err){ console.error(err); alert('Save failed'); }
    }

    // Delete file
    async function deleteFile(filename){
      try{
        const res = await fetch(`${API_BASE}/file/${encodeURIComponent(filename)}`, { method:'DELETE' });
        if(!res.ok) throw new Error('Delete failed');
        filesData = filesData.filter(f => f !== filename);
        renderFileList();
      }catch(err){ console.error(err); alert('Delete failed'); }
    }

    // Rename implemented as create(new) + delete(old)
    async function renameFile(oldName, currentContent, titleNode){
      const newName = prompt('New file name (include extension if desired)?', oldName);
      if(!newName) return;
      try{
        // create new
        const createRes = await fetch(`${API_BASE}/file/create`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ title: stripExtensionForTitle(newName), content: currentContent })
        });
        if(!createRes.ok) throw new Error('Create failed');
        // delete old
        const delRes = await fetch(`${API_BASE}/file/${encodeURIComponent(oldName)}`, { method:'DELETE' });
        // update local list & UI
        filesData = filesData.map(f => f===oldName ? deriveFilenameFromTitle(newName) : f);
        renderFileList();
        if(titleNode) titleNode.textContent = deriveFilenameFromTitle(newName);
      }catch(err){ console.error(err); alert('Rename failed'); }
    }

    // Sidebar long-press rename
    async function renameFileSidebar(oldName, el){
      const newName = prompt('New name?', oldName);
      if(!newName) return;
      try{
        // fetch content then create+delete
        const res = await fetch(`${API_BASE}/file/${encodeURIComponent(oldName)}`);
        const j = await res.json();
        await fetch(`${API_BASE}/file/create`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: stripExtensionForTitle(newName), content: j.content||'' }) });
        await fetch(`${API_BASE}/file/${encodeURIComponent(oldName)}`, { method:'DELETE' });
        el.querySelector('.fileTitle').textContent = deriveFilenameFromTitle(newName);
        filesData = filesData.map(f => f===oldName ? deriveFilenameFromTitle(newName) : f);
      }catch(err){ console.error(err); alert('Rename failed'); }
    }

    // Create new file
    async function createFile(){
      const name = prompt('File name?'); if(!name) return;
      try{
        await fetch(`${API_BASE}/file/create`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ title: stripExtensionForTitle(name), content: '' }) });
        filesData.unshift(deriveFilenameFromTitle(name));
        renderFileList();
      }catch(err){ console.error(err); alert('Create failed'); }
    }

    function stripExtensionForTitle(name){
      // remove .txt if present, backend will append .txt
      return name.replace(/\.txt$/i, '').replace(/_/g,' ').trim();
    }

    function deriveFilenameFromTitle(title){
      // backend uses: title.replace(' ','_').toLowerCase()+'.txt'
      return title.replace(/\s+/g,'_').toLowerCase().replace(/\.txt$/i,'') + '.txt';
    }

    // init handlers
    document.addEventListener('DOMContentLoaded', ()=>{
      document.getElementById('enterBtn').addEventListener('click', checkPassword);
      document.getElementById('demoBtn').addEventListener('click', demoAccess);
      document.getElementById('addFileTop').addEventListener('click', createFile);
      document.getElementById('addFileBottom').addEventListener('click', createFile);
      document.getElementById('searchFiles').addEventListener('input', filterFiles);
    });

    // Render listArea rows to approximate the provided mockup
    function renderListRows(){
      const area = document.getElementById('listArea');
      if(!area) return;
      area.innerHTML = '';
      filesData.forEach((f, idx) => {
        const row = document.createElement('div'); row.className = 'listRow';

        const chk = document.createElement('input'); chk.type='checkbox'; chk.className='check';
        const avatar = document.createElement('div'); avatar.className='avatar'; avatar.textContent = initialsFromName(f);
        const name = document.createElement('div'); name.className='name'; name.textContent = prettifyName(f);
        const meta = document.createElement('div'); meta.className='meta'; meta.textContent = 'Web Designer • 5 yrs';
        const edu = document.createElement('div'); edu.className='meta'; edu.textContent = 'Bachelor Degree';
        const salary = document.createElement('div'); salary.className='salary'; salary.textContent = '$40,000';

        row.appendChild(chk); row.appendChild(avatar); row.appendChild(name); row.appendChild(meta); row.appendChild(edu); row.appendChild(salary);
        row.onclick = ()=> openFile(f);
        area.appendChild(row);
      });
    }

    function initialsFromName(filename){
      const n = filename.replace(/\.txt$/i,'').replace(/[_-]/g,' ').trim();
      const parts = n.split(/\s+/).filter(Boolean);
      if(parts.length===0) return 'F';
      if(parts.length===1) return parts[0].slice(0,2).toUpperCase();
      return (parts[0][0]+parts[1][0]).toUpperCase();
    }

    function prettifyName(filename){
      return filename.replace(/\.txt$/i,'').replace(/[_-]/g,' ').replace(/\b([a-z])/g, (m)=>m.toUpperCase());
    }

    // update renderFileList to also refresh rows
    const _origRender = renderFileList;
    renderFileList = function(){
      _origRender();
      renderListRows();
    }
