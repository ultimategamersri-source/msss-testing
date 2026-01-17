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
    
    const data = await res.json();
    
    if (data && data.success) {
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
    showPasswordError('Authentication failed. Please check your connection.');
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
  const query = document.getElementById('searchFiles').value.toLowerCase();
  
  if (!query) {
    // If no query, show all items
    const items = document.querySelectorAll('.file-item, .folder-item, .folder-children');
    items.forEach((item) => {
      item.style.display = '';
    });
    return;
  }
  
  const items = document.querySelectorAll('.file-item, .folder-item');
  const foldersToExpand = new Set();
  
  items.forEach((item) => {
    const filename = item.dataset.filename || item.dataset.folderPath || '';
    const displayName = item.querySelector('.file-title')?.textContent || 
                        item.querySelector('.folder-name')?.textContent || '';
    
    if (filename.toLowerCase().includes(query) || displayName.toLowerCase().includes(query)) {
      item.style.display = '';
      // If it's a folder and matches, mark it for expansion
      if (item.classList.contains('folder-item')) {
        const folderPath = item.dataset.folderPath;
        if (folderPath) {
          foldersToExpand.add(folderPath);
        }
      }
      // Show parent folders
      let parent = item.parentElement;
      while (parent && parent.classList.contains('folder-children')) {
        parent.style.display = '';
        parent = parent.parentElement;
        if (parent && parent.classList.contains('folder-item')) {
          const folderPath = parent.dataset.folderPath;
          if (folderPath) {
            foldersToExpand.add(folderPath);
          }
          parent.style.display = '';
        }
      }
    } else {
      item.style.display = 'none';
    }
  });
  
  // Expand matching folders
  foldersToExpand.forEach(path => expandedFolders.add(path));
  
  // Re-render to apply expansions
  if (foldersToExpand.size > 0) {
    renderFileList();
    // Re-apply filter after render
    setTimeout(() => filterFiles(), 10);
  }
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
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(filename)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      mode: 'cors'
    });
    
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ error: 'File not found' }));
      throw new Error(errorData.error || 'File not found');
    }
    
    const data = await res.json();
    console.log(`✅ File opened: ${filename}`);
    addFileBlock(filename, data.content || '');
    
    // Mark as open in sidebar
    const item = document.querySelector(`[data-filename="${filename}"]`);
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
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    
    if (!res.ok) {
      throw new Error('Delete failed');
    }
    
    // Remove from local state
    filesData = filesData.filter(f => f !== filename);
    delete currentFiles[filename];
    
    // Update sidebar
    const item = document.querySelector(`[data-filename="${filename}"]`);
    if (item) {
      item.classList.remove('active');
    }
    
    renderFileList();
    showNotification(`File "${filename}" deleted successfully!`, 'success');
  } catch (err) {
    console.error('Delete error:', err);
    showNotification(`Failed to delete file: ${err.message}`, 'error');
    throw err;
  }
}

// === Rename File ===
function startRename(filename, sidebarItem, titleElement) {
  renameTarget = { filename, sidebarItem, titleElement };
  const modal = document.getElementById('renameModal');
  const input = document.getElementById('renameInput');
  
  input.value = prettifyFileName(filename);
  modal.classList.remove('hidden');
  input.focus();
  input.select();
}

async function confirmRename() {
  const input = document.getElementById('renameInput');
  const newName = input.value.trim();
  
  if (!newName) {
    alert('Please enter a file name');
    return;
  }
  
  if (!renameTarget) return;
  
  const { filename, sidebarItem, titleElement } = renameTarget;
  
  try {
    // Fetch current content
    const res = await fetch(`${API_BASE}/file/${encodeURIComponent(filename)}`);
    if (!res.ok) throw new Error('Failed to fetch file');
    
    const data = await res.json();
    const content = data.content || '';
    
    // Create new file
    const newFilename = newName.replace(/\s+/g, '_').toLowerCase() + '.txt';
    const createRes = await fetch(`${API_BASE}/file/create`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ title: newName, content })
    });
    
    if (!createRes.ok) throw new Error('Failed to create new file');
    
    // Delete old file
    await fetch(`${API_BASE}/file/${encodeURIComponent(filename)}`, {
      method: 'DELETE'
    });
    
    // Update local state
    filesData = filesData.map(f => f === filename ? newFilename : f);
    
    // Update UI
    if (sidebarItem) {
      sidebarItem.dataset.filename = newFilename;
      sidebarItem.querySelector('.file-title').textContent = prettifyFileName(newFilename);
      sidebarItem.classList.remove('active');
    }
    
    if (titleElement) {
      titleElement.textContent = prettifyFileName(newFilename);
    }
    
    // Update file block
    const block = document.querySelector(`[data-file-block="${filename}"]`);
    if (block) {
      block.dataset.fileBlock = newFilename;
      block.querySelector('.file-block-title').textContent = prettifyFileName(newFilename);
    }
    
    // Update currentFiles
    if (currentFiles[filename]) {
      currentFiles[newFilename] = currentFiles[filename];
      delete currentFiles[filename];
    }
    
    renderFileList();
    showNotification(`File renamed to "${newFilename}"`, 'success');
    
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
    const filename = fileName.replace(/\s+/g, '_').toLowerCase() + '.txt';
    
    const res = await fetch(`${API_BASE}/file/create`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ title: fileName, content: '' })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Create failed');
    }
    
    // Add to local state
    filesData.unshift(filename);
    renderFileList();
    
    // Open the new file
    await openFile(filename);
    
    showNotification(`File "${filename}" created successfully!`, 'success');
    
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
  
  // Change password
  document.getElementById('changePasswordBtn').addEventListener('click', showChangePasswordModal);
  document.getElementById('changePasswordConfirmBtn').addEventListener('click', confirmChangePassword);
  document.getElementById('changePasswordCancelBtn').addEventListener('click', cancelChangePassword);
  
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
