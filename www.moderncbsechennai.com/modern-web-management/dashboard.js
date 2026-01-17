const API_BASE = "https://msss-backend-961983851669.asia-south1.run.app";

// === State ===
let filesData = [];
let fileTree = {}; // Store hierarchical structure
let currentFiles = {}; // Track open files
let isAuthenticated = false;
let longPressTimer = null;
let renameTarget = null;
let expandedFolders = new Set(); // Track expanded folders

// === Password Protection ===
async function checkPassword() {
  const pass = document.getElementById('dashboardPassword').value.trim();
  showPasswordError('');
  
  if (!pass) {
    showPasswordError('Please enter a password');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/auth-check`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ password: pass })
    });
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('Auth response:', data);
    
    if (data && data.success === true) {
      isAuthenticated = true;
      document.getElementById('passwordOverlay').style.display = 'none';
      document.getElementById('dashboardContainer').classList.remove('blurred');
      await loadFiles();
    } else {
      showPasswordError('Incorrect password. Please try again.');
      document.getElementById('dashboardPassword').value = '';
      document.getElementById('dashboardPassword').focus();
    }
  } catch (err) {
    console.error('Auth error:', err);
    showPasswordError(`Authentication failed: ${err.message}. Please check your connection.`);
  }
}


function showPasswordError(msg) {
  const err = document.getElementById('passwordError');
  err.textContent = msg;
  err.style.display = msg ? 'block' : 'none';
}

// === File Operations ===
async function loadFiles() {
  const listEl = document.getElementById('fileList');
  listEl.innerHTML = '<div class="loading">Loading files...</div>';
  
  try {
    const res = await fetch(`${API_BASE}/files`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('Response error:', errorText);
      throw new Error(`Failed to fetch files: ${res.status} ${res.statusText}`);
    }
    
    const data = await res.json();
    console.log('Files loaded:', data);
    
    // Handle both old flat format and new hierarchical format
    if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'type' in data[0]) {
      // New hierarchical format
      fileTree = data;
      filesData = flattenFileTree(data); // Keep flat list for backward compatibility
    } else {
      // Old flat format (backward compatibility)
      filesData = Array.isArray(data) ? data : (data.files || []);
      // Convert flat list to tree structure
      fileTree = buildTreeFromFlatList(filesData);
    }
    
    if (filesData.length === 0 && (!fileTree || fileTree.length === 0)) {
      listEl.innerHTML = '<div class="empty-state">No files found. Click "Add File" to create one.</div>';
    } else {
      renderFileList();
    }
  } catch (err) {
    console.error('Load files error:', err);
    listEl.innerHTML = `<div class="error-state">Failed to load files: ${err.message}. Please check your connection and try again.</div>`;
    showNotification(`Failed to load files: ${err.message}`, 'error');
  }
}

function flattenFileTree(tree) {
  const result = [];
  for (const item of tree) {
    if (item.type === 'file') {
      result.push(item.path);
    } else if (item.type === 'folder' && item.children) {
      result.push(...flattenFileTree(item.children));
    }
  }
  return result;
}

function buildTreeFromFlatList(flatList) {
  const tree = {};
  for (const filepath of flatList) {
    const parts = filepath.split('/');
    let current = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = { type: 'folder', children: {} };
      }
      current = current[part].children;
    }
    const filename = parts[parts.length - 1];
    current[filename] = { type: 'file', path: filepath };
  }
  
  // Convert to list format
  function convertToList(obj, prefix = '') {
    const result = [];
    for (const [name, item] of Object.entries(obj).sort()) {
      if (item.type === 'folder') {
        result.push({
          name,
          type: 'folder',
          path: prefix + name + '/',
          children: convertToList(item.children, prefix + name + '/')
        });
      } else {
        result.push({
          name,
          type: 'file',
          path: item.path
        });
      }
    }
    return result;
  }
  
  return convertToList(tree);
}

let fileItemIndex = 0;

function renderFileList() {
  const list = document.getElementById('fileList');
  list.innerHTML = '';
  fileItemIndex = 0; // Reset index for color rotation
  
  if (fileTree && fileTree.length > 0) {
    renderTreeItems(fileTree, list, 0);
  } else {
    // Fallback to flat list if tree is empty
    filesData.forEach((filename) => {
      createFileItem(filename, list);
    });
  }
}

function renderTreeItems(items, container, depth = 0) {
  items.forEach((item) => {
    if (item.type === 'folder') {
      createFolderItem(item, container, depth);
    } else {
      createFileItem(item.path, container, depth);
    }
  });
}

function createFolderItem(folder, container, depth) {
  const folderItem = document.createElement('div');
  folderItem.className = 'folder-item';
  folderItem.style.paddingLeft = `${depth * 20 + 12}px`;
  folderItem.dataset.folderPath = folder.path;
  
  const isExpanded = expandedFolders.has(folder.path);
  
  const folderHeader = document.createElement('div');
  folderHeader.className = 'folder-header';
  
  const toggleIcon = document.createElement('span');
  toggleIcon.className = 'folder-toggle';
  toggleIcon.textContent = isExpanded ? '📂' : '📁';
  toggleIcon.style.marginRight = '8px';
  toggleIcon.style.cursor = 'pointer';
  
  const folderName = document.createElement('span');
  folderName.className = 'folder-name';
  folderName.textContent = folder.name;
  
  folderHeader.appendChild(toggleIcon);
  folderHeader.appendChild(folderName);
  folderItem.appendChild(folderHeader);
  
  // Toggle expand/collapse
  folderHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    if (isExpanded) {
      expandedFolders.delete(folder.path);
    } else {
      expandedFolders.add(folder.path);
    }
    renderFileList(); // Re-render to update
  });
  
  // Long press to rename folder
  let pressTimer = null;
  folderHeader.addEventListener('mousedown', (e) => {
    pressTimer = setTimeout(() => {
      startRename(folder.path, null, folderName, true); // true indicates it's a folder
    }, 800);
  });
  
  folderHeader.addEventListener('mouseup', () => {
    clearTimeout(pressTimer);
  });
  
  folderHeader.addEventListener('mouseleave', () => {
    clearTimeout(pressTimer);
  });
  
  // Right click or long press for delete folder option
  const folderActions = document.createElement('div');
  folderActions.className = 'folder-actions';
  folderActions.style.display = 'none';
  folderActions.style.position = 'absolute';
  folderActions.style.right = '10px';
  folderActions.style.top = '50%';
  folderActions.style.transform = 'translateY(-50%)';
  
  const deleteFolderBtn = document.createElement('button');
  deleteFolderBtn.className = 'folder-delete-btn';
  deleteFolderBtn.innerHTML = '🗑️';
  deleteFolderBtn.title = 'Delete folder';
  deleteFolderBtn.style.background = 'rgba(255, 0, 0, 0.2)';
  deleteFolderBtn.style.border = 'none';
  deleteFolderBtn.style.borderRadius = '6px';
  deleteFolderBtn.style.padding = '6px 10px';
  deleteFolderBtn.style.cursor = 'pointer';
  deleteFolderBtn.style.color = 'white';
  deleteFolderBtn.style.fontSize = '14px';
  
  deleteFolderBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const folderPath = folder.path.endsWith('/') ? folder.path.slice(0, -1) : folder.path;
    const filesInFolder = filesData.filter(f => f.startsWith(folderPath + '/'));
    
    if (filesInFolder.length === 0) {
      if (confirm(`Are you sure you want to delete the empty folder "${folder.name}"?`)) {
        await deleteFolder(folderPath);
      }
    } else {
      if (confirm(`Are you sure you want to delete folder "${folder.name}" and all ${filesInFolder.length} file(s) inside it?`)) {
        await deleteFolder(folderPath);
      }
    }
  });
  
  folderActions.appendChild(deleteFolderBtn);
  folderHeader.appendChild(folderActions);
  
  // Show delete button on hover
  folderHeader.addEventListener('mouseenter', () => {
    folderActions.style.display = 'block';
  });
  
  folderHeader.addEventListener('mouseleave', () => {
    folderActions.style.display = 'none';
  });
  
  // Create children container
  const childrenContainer = document.createElement('div');
  childrenContainer.className = 'folder-children';
  childrenContainer.style.display = isExpanded ? 'block' : 'none';
  
  if (folder.children && folder.children.length > 0) {
    renderTreeItems(folder.children, childrenContainer, depth + 1);
  }
  
  folderItem.appendChild(childrenContainer);
  container.appendChild(folderItem);
}

function createFileItem(filepath, container, depth = 0) {
  const item = document.createElement('div');
  item.className = 'file-item';
  item.dataset.filename = filepath;
  item.style.paddingLeft = `${depth * 20 + 12}px`;
  
  // Color rotation for beautiful file items
  const colorClass = `color-${fileItemIndex % 8}`;
  item.classList.add(colorClass);
  fileItemIndex++;
  
  // Check if file is currently open
  if (currentFiles[filepath]) {
    item.classList.add('active');
  }
  
  const title = document.createElement('div');
  title.className = 'file-title';
  const filename = filepath.split('/').pop();
  title.textContent = prettifyFileName(filename);
  
  item.appendChild(title);
  
  // Click to open file
  item.addEventListener('click', (e) => {
    if (!e.target.closest('.file-item-actions')) {
      openFile(filepath);
    }
  });
  
  // Long press to rename
  let pressTimer = null;
  item.addEventListener('mousedown', (e) => {
    pressTimer = setTimeout(() => {
      startRename(filepath, item);
    }, 800);
  });
  
  item.addEventListener('mouseup', () => {
    clearTimeout(pressTimer);
  });
  
  item.addEventListener('mouseleave', () => {
    clearTimeout(pressTimer);
  });
  
  // Hover effect
  item.addEventListener('mouseenter', () => {
    item.style.transform = 'translateX(8px) scale(1.02)';
  });
  
  item.addEventListener('mouseleave', () => {
    if (!currentFiles[filepath]) {
      item.style.transform = 'translateX(0) scale(1)';
    }
  });
  
  container.appendChild(item);
}

function prettifyFileName(filename) {
  return filename
    .replace(/\.txt$/i, '')
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function filterFiles() {
  const query = document.getElementById('searchFiles').value.toLowerCase().trim();
  
  if (!query) {
    // If no query, show all items and restore normal state
    const items = document.querySelectorAll('.file-item, .folder-item, .folder-children');
    items.forEach((item) => {
      item.style.display = '';
    });
    return;
  }
  
  // Simple search - just show/hide items without re-rendering
  const items = document.querySelectorAll('.file-item, .folder-item');
  const foldersToExpand = new Set();
  
  items.forEach((item) => {
    const filename = item.dataset.filename || item.dataset.folderPath || '';
    const displayName = item.querySelector('.file-title')?.textContent || 
                        item.querySelector('.folder-name')?.textContent || '';
    
    const matches = filename.toLowerCase().includes(query) || 
                    displayName.toLowerCase().includes(query);
    
    if (matches) {
      item.style.display = '';
      
      // If it's a folder and matches, expand it
      if (item.classList.contains('folder-item')) {
        const folderPath = item.dataset.folderPath;
        if (folderPath) {
          foldersToExpand.add(folderPath);
          // Show children
          const children = item.querySelector('.folder-children');
          if (children) {
            children.style.display = 'block';
          }
        }
      }
      
      // Show all parent folders
      let parent = item.parentElement;
      while (parent) {
        if (parent.classList.contains('folder-children')) {
          parent.style.display = 'block';
          const folderItem = parent.parentElement;
          if (folderItem && folderItem.classList.contains('folder-item')) {
            folderItem.style.display = '';
            const folderPath = folderItem.dataset.folderPath;
            if (folderPath) {
              foldersToExpand.add(folderPath);
            }
            parent = folderItem.parentElement;
          } else {
            break;
          }
        } else {
          parent = parent.parentElement;
        }
      }
    } else {
      // Hide item if it doesn't match
      item.style.display = 'none';
    }
  });
  
  // Expand folders that need to be shown
  foldersToExpand.forEach(path => {
    expandedFolders.add(path);
    // Escape special characters for querySelector
    const escapedPath = path.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    const folderItem = document.querySelector(`[data-folder-path="${escapedPath}"]`);
    if (folderItem) {
      const children = folderItem.querySelector('.folder-children');
      if (children) {
        children.style.display = 'block';
      }
      const toggleIcon = folderItem.querySelector('.folder-toggle');
      if (toggleIcon) {
        toggleIcon.textContent = '📂';
      }
    }
  });
}

// === Open File ===
async function openFile(filename) {
  // Check if already open
  if (currentFiles[filename]) {
    // Scroll to existing block
    const block = document.querySelector(`[data-file-block="${filename}"]`);
    if (block) {
      block.scrollIntoView({ behavior: 'smooth', block: 'start' });
      block.classList.add('highlight');
      setTimeout(() => block.classList.remove('highlight'), 2000);
    }
    return;
  }
  
  try {
    // Properly encode the filename, handling slashes - encode each segment separately
    const pathParts = filename.split('/');
    const encodedParts = pathParts.map(part => encodeURIComponent(part));
    const encodedFilename = encodedParts.join('/');
    
    console.log(`Attempting to open file: ${filename} (encoded: ${encodedFilename})`);
    
    const res = await fetch(`${API_BASE}/file/${encodedFilename}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'File not found' }));
      console.error(`File open failed: ${res.status}`, errorData);
      throw new Error(errorData.error || `File not found (${res.status})`);
    }
    
    const data = await res.json();
    console.log(`✅ File opened: ${filename}`, data);
    addFileBlock(filename, data.content || '');
    
    // Mark as open in sidebar
    // Escape special characters for querySelector
    const escapedFilename = filename.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    const item = document.querySelector(`[data-filename="${escapedFilename}"]`);
    if (item) {
      item.classList.add('active');
    }
  } catch (err) {
    console.error('Open file error:', err);
    showNotification(`Failed to open file: ${err.message}`, 'error');
  }
}

// === Create File Block ===
function addFileBlock(filename, content) {
  const container = document.getElementById('contentArea');
  const welcomeMsg = document.getElementById('welcomeMessage');
  if (welcomeMsg) {
    welcomeMsg.style.display = 'none';
  }
  
  // Check if block already exists
  const existing = document.querySelector(`[data-file-block="${filename}"]`);
  if (existing) {
    existing.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  
  const block = document.createElement('div');
  block.className = 'file-block';
  block.dataset.fileBlock = filename;
  
  // Header
  const header = document.createElement('div');
  header.className = 'file-block-header';
  
  const title = document.createElement('div');
  title.className = 'file-block-title';
  title.textContent = prettifyFileName(filename);
  
  const actions = document.createElement('div');
  actions.className = 'file-block-actions';
  
  const editBtn = document.createElement('button');
  editBtn.className = 'action-btn edit-btn';
  editBtn.innerHTML = '✏️ Edit';
  editBtn.title = 'Edit file';
  
  const saveBtn = document.createElement('button');
  saveBtn.className = 'action-btn save-btn';
  saveBtn.innerHTML = '💾 Save';
  saveBtn.title = 'Save changes';
  saveBtn.style.display = 'none';
  
  const renameBtn = document.createElement('button');
  renameBtn.className = 'action-btn rename-btn';
  renameBtn.innerHTML = '✏️ Rename';
  renameBtn.title = 'Rename file';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'action-btn delete-btn';
  deleteBtn.innerHTML = '🗑️ Delete';
  deleteBtn.title = 'Delete file';
  
  actions.appendChild(editBtn);
  actions.appendChild(saveBtn);
  actions.appendChild(renameBtn);
  actions.appendChild(deleteBtn);
  
  header.appendChild(title);
  header.appendChild(actions);
  
  // Content area
  const contentDiv = document.createElement('div');
  contentDiv.className = 'file-block-content';
  
  const displayDiv = document.createElement('div');
  displayDiv.className = 'file-content-display';
  displayDiv.textContent = content;
  
  const textarea = document.createElement('textarea');
  textarea.className = 'file-content-editor';
  textarea.value = content;
  textarea.style.display = 'none';
  
  contentDiv.appendChild(displayDiv);
  contentDiv.appendChild(textarea);
  
  block.appendChild(header);
  block.appendChild(contentDiv);
  
  // Event handlers
  let isEditing = false;
  
  editBtn.addEventListener('click', () => {
    if (!isEditing) {
      isEditing = true;
      displayDiv.style.display = 'none';
      textarea.style.display = 'block';
      textarea.focus();
      editBtn.style.display = 'none';
      saveBtn.style.display = 'inline-flex';
    }
  });
  
  saveBtn.addEventListener('click', async () => {
    await saveFile(filename, textarea.value);
    displayDiv.textContent = textarea.value;
    displayDiv.style.display = 'block';
    textarea.style.display = 'none';
    editBtn.style.display = 'inline-flex';
    saveBtn.style.display = 'none';
    isEditing = false;
  });
  
  renameBtn.addEventListener('click', () => {
    startRename(filename, null, title);
  });
  
  deleteBtn.addEventListener('click', async () => {
    if (confirm(`Are you sure you want to delete "${filename}"?`)) {
      await deleteFile(filename);
      block.remove();
      
      // Show welcome message if no files left
      if (container.children.length === 0 || 
          (container.children.length === 1 && container.querySelector('.welcome-message'))) {
        const welcomeMsg = document.getElementById('welcomeMessage');
        if (welcomeMsg) {
          welcomeMsg.style.display = 'flex';
        }
      }
    }
  });
  
  container.appendChild(block);
  block.scrollIntoView({ behavior: 'smooth', block: 'start' });
  
  // Mark as open
  currentFiles[filename] = true;
}

// === Save File ===
async function saveFile(filename, content) {
  try {
    const res = await fetch(`${API_BASE}/file/update`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ filename, content })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Save failed');
    }
    
    const data = await res.json();
    showNotification(`File "${filename}" saved successfully!`, 'success');
    return data;
  } catch (err) {
    console.error('Save error:', err);
    showNotification(`Failed to save file: ${err.message}`, 'error');
    throw err;
  }
}

// === Delete File ===
async function deleteFile(filename) {
  try {
    // Properly encode the filename, handling slashes
    const encodedFilename = filename.split('/').map(part => encodeURIComponent(part)).join('/');
    const res = await fetch(`${API_BASE}/file/${encodedFilename}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      throw new Error('Delete failed');
    }
    
    // Remove from local state
    filesData = filesData.filter(f => f !== filename);
    delete currentFiles[filename];
    
    // Update sidebar
    // Escape special characters for querySelector
    const escapedFilename = filename.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    const item = document.querySelector(`[data-filename="${escapedFilename}"]`);
    if (item) {
      item.classList.remove('active');
    }
    
    // Reload files to update tree structure
    await loadFiles();
    showNotification(`File "${filename}" deleted successfully!`, 'success');
  } catch (err) {
    console.error('Delete error:', err);
    showNotification(`Failed to delete file: ${err.message}`, 'error');
    throw err;
  }
}

// === Delete Folder ===
async function deleteFolder(folderPath) {
  try {
    console.log('Deleting folder:', folderPath);
    
    // Get all files in the folder - make sure folderPath ends with / for matching
    const searchPath = folderPath.endsWith('/') ? folderPath : folderPath + '/';
    const filesInFolder = filesData.filter(f => f.startsWith(searchPath));
    
    console.log(`Found ${filesInFolder.length} files in folder:`, filesInFolder);
    
    if (filesInFolder.length === 0) {
      showNotification('Folder is empty. Nothing to delete.', 'info');
      await loadFiles();
      return;
    }
    
    // Delete all files in the folder
    let deletedCount = 0;
    let failedCount = 0;
    
    for (const filePath of filesInFolder) {
      try {
        const encodedPath = filePath.split('/').map(part => encodeURIComponent(part)).join('/');
        console.log(`Deleting file: ${filePath} (encoded: ${encodedPath})`);
        
        const res = await fetch(`${API_BASE}/file/${encodedPath}`, {
          method: 'DELETE'
        });
        
        if (res.ok) {
          deletedCount++;
          // Remove from local state
          filesData = filesData.filter(f => f !== filePath);
          delete currentFiles[filePath];
          console.log(`✅ Deleted: ${filePath}`);
        } else {
          failedCount++;
          console.error(`❌ Failed to delete ${filePath}: ${res.status}`);
        }
      } catch (err) {
        failedCount++;
        console.error(`Failed to delete file ${filePath}:`, err);
      }
    }
    
    // Reload files to update tree structure
    await loadFiles();
    
    if (deletedCount > 0) {
      showNotification(`Folder deleted successfully! ${deletedCount} file(s) removed.${failedCount > 0 ? ` ${failedCount} file(s) failed to delete.` : ''}`, 'success');
    } else {
      showNotification(`Failed to delete folder. No files were deleted.`, 'error');
    }
  } catch (err) {
    console.error('Delete folder error:', err);
    showNotification(`Failed to delete folder: ${err.message}`, 'error');
  }
}

// === Rename File ===
function startRename(filename, sidebarItem, titleElement, isFolder = false) {
  renameTarget = { filename, sidebarItem, titleElement, isFolder };
  const modal = document.getElementById('renameModal');
  const input = document.getElementById('renameInput');
  
  if (isFolder) {
    // For folders, extract just the folder name
    const folderName = filename.endsWith('/') ? filename.slice(0, -1).split('/').pop() : filename.split('/').pop();
    input.value = prettifyFileName(folderName);
  } else {
    // For files, extract just the filename
    const fileOnly = filename.split('/').pop();
    input.value = prettifyFileName(fileOnly);
  }
  
  modal.classList.remove('hidden');
  input.focus();
  input.select();
}

async function confirmRename() {
  const input = document.getElementById('renameInput');
  const newName = input.value.trim();
  
  if (!newName) {
    alert('Please enter a name');
    return;
  }
  
  if (!renameTarget) return;
  
  const { filename, sidebarItem, titleElement, isFolder } = renameTarget;
  
  // Handle folder renaming
  if (isFolder) {
    try {
      // For folders, we need to rename all files inside the folder
      const oldFolderPath = filename.endsWith('/') ? filename.slice(0, -1) : filename;
      const newFolderName = newName.replace(/\s+/g, '_').toLowerCase();
      const pathParts = oldFolderPath.split('/');
      pathParts.pop(); // Remove old folder name
      const parentPath = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
      const newFolderPath = parentPath + newFolderName + '/';
      
      // Get all files in the folder
      const filesInFolder = filesData.filter(f => f.startsWith(oldFolderPath + '/'));
      
      if (filesInFolder.length === 0) {
        showNotification('Folder is empty. Cannot rename empty folder.', 'info');
        document.getElementById('renameModal').classList.add('hidden');
        renameTarget = null;
        return;
      }
      
      // Rename all files in the folder
      let renamedCount = 0;
      for (const oldFilePath of filesInFolder) {
        const relativePath = oldFilePath.replace(oldFolderPath + '/', '');
        const newFilePath = newFolderPath + relativePath;
        
        // Fetch old file content
        const encodedOldPath = oldFilePath.split('/').map(part => encodeURIComponent(part)).join('/');
        const res = await fetch(`${API_BASE}/file/${encodedOldPath}`);
        if (!res.ok) continue;
        
        const data = await res.json();
        const content = data.content || '';
        
        // Create new file
        const createRes = await fetch(`${API_BASE}/file/create`, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({ title: newFilePath, content })
        });
        
        if (createRes.ok) {
          // Delete old file
          await fetch(`${API_BASE}/file/${encodedOldPath}`, { method: 'DELETE' });
          renamedCount++;
        }
      }
      
      if (renamedCount > 0) {
        await loadFiles(); // Reload to update tree
        showNotification(`Folder renamed successfully! ${renamedCount} file(s) moved.`, 'success');
      } else {
        showNotification('Failed to rename folder. No files were moved.', 'error');
      }
      
      document.getElementById('renameModal').classList.add('hidden');
      renameTarget = null;
      return;
    } catch (err) {
      console.error('Folder rename error:', err);
      showNotification(`Failed to rename folder: ${err.message}`, 'error');
      document.getElementById('renameModal').classList.add('hidden');
      renameTarget = null;
      return;
    }
  }
  
  try {
    // For files, preserve the folder path
    const pathParts = filename.split('/');
    const oldFileName = pathParts.pop();
    const folderPath = pathParts.length > 0 ? pathParts.join('/') + '/' : '';
    
    // Fetch current content
    const encodedFilename = filename.split('/').map(part => encodeURIComponent(part)).join('/');
    const res = await fetch(`${API_BASE}/file/${encodedFilename}`);
    if (!res.ok) throw new Error('Failed to fetch file');
    
    const data = await res.json();
    const content = data.content || '';
    
    // Create new filename with folder path preserved
    const newFileBase = newName.replace(/\s+/g, '_').toLowerCase() + '.txt';
    const newFilename = folderPath + newFileBase;
    
    // Create new file
    const createRes = await fetch(`${API_BASE}/file/create`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ title: newName, content })
    });
    
    if (!createRes.ok) {
      // If create fails, try with folder path
      const createRes2 = await fetch(`${API_BASE}/file/create`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title: folderPath + newName, content })
      });
      if (!createRes2.ok) throw new Error('Failed to create new file');
    }
    
    // Delete old file
    await fetch(`${API_BASE}/file/${encodedFilename}`, {
      method: 'DELETE'
    });
    
    // Update local state
    filesData = filesData.map(f => f === filename ? newFilename : f);
    
    // Update UI
    if (sidebarItem) {
      sidebarItem.dataset.filename = newFilename;
      const titleEl = sidebarItem.querySelector('.file-title');
      if (titleEl) {
        titleEl.textContent = prettifyFileName(newFileBase);
      }
      sidebarItem.classList.remove('active');
    }
    
    if (titleElement) {
      titleElement.textContent = prettifyFileName(newFileBase);
    }
    
    // Update file block
    // Escape special characters for querySelector
    const escapedOldFilename = filename.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, '\\$&');
    const block = document.querySelector(`[data-file-block="${escapedOldFilename}"]`);
    if (block) {
      block.dataset.fileBlock = newFilename;
      const blockTitle = block.querySelector('.file-block-title');
      if (blockTitle) {
        blockTitle.textContent = prettifyFileName(newFileBase);
      }
    }
    
    // Update currentFiles
    if (currentFiles[filename]) {
      currentFiles[newFilename] = currentFiles[filename];
      delete currentFiles[filename];
    }
    
    // Reload files to update tree structure
    await loadFiles();
    showNotification(`File renamed to "${newFileBase}"`, 'success');
    
    document.getElementById('renameModal').classList.add('hidden');
    renameTarget = null;
  } catch (err) {
    console.error('Rename error:', err);
    showNotification(`Failed to rename file: ${err.message}`, 'error');
  }
}

function cancelRename() {
  document.getElementById('renameModal').classList.add('hidden');
  renameTarget = null;
}

// === Create New File ===
function showCreateFileModal() {
  const modal = document.getElementById('createFileModal');
  const input = document.getElementById('createFileNameInput');
  input.value = '';
  modal.classList.remove('hidden');
  input.focus();
}

async function confirmCreateFile() {
  const input = document.getElementById('createFileNameInput');
  const fileName = input.value.trim();
  
  if (!fileName) {
    alert('Please enter a file name');
    return;
  }
  
  try {
    // Check if user wants to create in a folder (format: "folder/filename" or just "filename")
    let filename, folderPath = '';
    
    if (fileName.includes('/')) {
      const parts = fileName.split('/');
      const filePart = parts.pop();
      folderPath = parts.join('/') + '/';
      filename = folderPath + filePart.replace(/\s+/g, '_').toLowerCase() + '.txt';
    } else {
      filename = fileName.replace(/\s+/g, '_').toLowerCase() + '.txt';
    }
    
    const res = await fetch(`${API_BASE}/file/create`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ title: fileName, content: '' })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Create failed');
    }
    
    // Reload files to get updated tree structure
    await loadFiles();
    
    // Open the new file
    await openFile(filename);
    
    showNotification(`File "${fileName}" created successfully!`, 'success');
    
    document.getElementById('createFileModal').classList.add('hidden');
  } catch (err) {
    console.error('Create error:', err);
    showNotification(`Failed to create file: ${err.message}`, 'error');
  }
}

function cancelCreateFile() {
  document.getElementById('createFileModal').classList.add('hidden');
}

// === Search Toggle ===
function toggleSearch() {
  const container = document.getElementById('searchContainer');
  container.classList.toggle('hidden');
  
  if (!container.classList.contains('hidden')) {
    document.getElementById('searchFiles').focus();
  }
}

// === View Password ===
async function showViewPasswordModal() {
  const modal = document.getElementById('viewPasswordModal');
  const passwordDisplay = document.getElementById('passwordDisplay');
  const errorEl = document.getElementById('viewPasswordError');
  
  errorEl.textContent = '';
  errorEl.style.display = 'none';
  passwordDisplay.type = 'password';
  modal.classList.remove('hidden');
  
  // Just show the default password (no need to fetch from storage)
  passwordDisplay.value = 'modernSchool2025';
}

function togglePasswordVisibility() {
  const passwordDisplay = document.getElementById('passwordDisplay');
  const toggleBtn = document.getElementById('togglePasswordVisibility');
  
  if (passwordDisplay.type === 'password') {
    passwordDisplay.type = 'text';
    toggleBtn.textContent = '🙈';
  } else {
    passwordDisplay.type = 'password';
    toggleBtn.textContent = '👁️';
  }
}

function closeViewPasswordModal() {
  document.getElementById('viewPasswordModal').classList.add('hidden');
}

// === Change Password ===
function showChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  document.getElementById('oldPasswordInput').value = '';
  document.getElementById('newPasswordInput').value = '';
  document.getElementById('confirmPasswordInput').value = '';
  const errorEl = document.getElementById('changePasswordError');
  errorEl.textContent = '';
  errorEl.style.display = 'none';
  modal.classList.remove('hidden');
  document.getElementById('oldPasswordInput').focus();
  
  // Remove any existing view password button if it exists
  const existingBtn = document.getElementById('viewPasswordFromChangeBtn');
  if (existingBtn) {
    existingBtn.remove();
  }
}

async function confirmChangePassword() {
  const oldPassword = document.getElementById('oldPasswordInput').value.trim();
  const newPassword = document.getElementById('newPasswordInput').value.trim();
  const confirmPassword = document.getElementById('confirmPasswordInput').value.trim();
  const errorEl = document.getElementById('changePasswordError');
  
  errorEl.style.display = 'none';
  errorEl.textContent = '';
  
  if (!oldPassword || !newPassword || !confirmPassword) {
    errorEl.textContent = 'All fields are required';
    errorEl.style.display = 'block';
    return;
  }
  
  if (newPassword !== confirmPassword) {
    errorEl.textContent = 'New passwords do not match';
    errorEl.style.display = 'block';
    return;
  }
  
  if (newPassword.length < 4) {
    errorEl.textContent = 'New password must be at least 4 characters';
    errorEl.style.display = 'block';
    return;
  }
  
  try {
    const res = await fetch(`${API_BASE}/change-password`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ oldPassword, newPassword })
    });
    
    const data = await res.json();
    
    if (data && data.success) {
      showNotification('Password changed successfully!', 'success');
      document.getElementById('changePasswordModal').classList.add('hidden');
    } else {
      errorEl.textContent = data.error || 'Failed to change password';
      errorEl.style.display = 'block';
    }
  } catch (err) {
    console.error('Change password error:', err);
    errorEl.textContent = 'Failed to change password. Please try again.';
    errorEl.style.display = 'block';
  }
}

function cancelChangePassword() {
  document.getElementById('changePasswordModal').classList.add('hidden');
}

// === Notification System ===
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// === Initialize ===
document.addEventListener('DOMContentLoaded', () => {
  // Password handlers
  document.getElementById('enterBtn').addEventListener('click', checkPassword);
  
  // View Password button in password overlay
  const demoBtn = document.getElementById('demoBtn');
  if (demoBtn) {
    demoBtn.addEventListener('click', () => {
      showViewPasswordModal();
    });
  }
  
  // Enter key on password input
  document.getElementById('dashboardPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      checkPassword();
    }
  });
  
  // File operations
  document.getElementById('addFileBtn').addEventListener('click', showCreateFileModal);
  document.getElementById('searchToggleBtn').addEventListener('click', toggleSearch);
  document.getElementById('searchFiles').addEventListener('input', filterFiles);
  
  // Change password button (actually opens change password modal)
  document.getElementById('viewPasswordBtn').addEventListener('click', showChangePasswordModal);
  document.getElementById('changePasswordConfirmBtn').addEventListener('click', confirmChangePassword);
  document.getElementById('changePasswordCancelBtn').addEventListener('click', cancelChangePassword);
  
  // View password (accessible from change password modal)
  document.getElementById('viewPasswordCloseBtn').addEventListener('click', closeViewPasswordModal);
  document.getElementById('viewPasswordChangeBtn').addEventListener('click', () => {
    closeViewPasswordModal();
    showChangePasswordModal();
  });
  document.getElementById('togglePasswordVisibility').addEventListener('click', togglePasswordVisibility);
  
  // Modal handlers
  document.getElementById('renameConfirmBtn').addEventListener('click', confirmRename);
  document.getElementById('renameCancelBtn').addEventListener('click', cancelRename);
  document.getElementById('createFileConfirmBtn').addEventListener('click', confirmCreateFile);
  document.getElementById('createFileCancelBtn').addEventListener('click', cancelCreateFile);
  
  // Close modals on outside click
  document.getElementById('renameModal').addEventListener('click', (e) => {
    if (e.target.id === 'renameModal') {
      cancelRename();
    }
  });
  
  document.getElementById('createFileModal').addEventListener('click', (e) => {
    if (e.target.id === 'createFileModal') {
      cancelCreateFile();
    }
  });
  
  document.getElementById('viewPasswordModal').addEventListener('click', (e) => {
    if (e.target.id === 'viewPasswordModal') {
      closeViewPasswordModal();
    }
  });
  
  document.getElementById('changePasswordModal').addEventListener('click', (e) => {
    if (e.target.id === 'changePasswordModal') {
      cancelChangePassword();
    }
  });
  
  // Enter key in rename input
  document.getElementById('renameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmRename();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  });
  
  // Enter key in create file input
  document.getElementById('createFileNameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      confirmCreateFile();
    } else if (e.key === 'Escape') {
      cancelCreateFile();
    }
  });
  
  // Enter key in change password inputs
  ['oldPasswordInput', 'newPasswordInput', 'confirmPasswordInput'].forEach(id => {
    document.getElementById(id).addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        confirmChangePassword();
      } else if (e.key === 'Escape') {
        cancelChangePassword();
      }
    });
  });
  
  // Focus password input on load
  document.getElementById('dashboardPassword').focus();
});
