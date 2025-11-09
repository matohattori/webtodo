// Data structure: { id, type, text, checked, order, decoration, deadline, collapsed }
// type: 'text' | 'checkbox' | 'list' | 'hr' | 'heading' | 'collapsible-heading'
// decoration: { presetId } or null
// deadline: ISO date string or null
// collapsed: boolean (only for collapsible-heading)

// User ID Management for per-user database separation
let userID = null;
let isLoggedIn = false;

// Add UID parameter to API URL
function addUIDToURL(url) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}uid=${encodeURIComponent(userID)}`;
}

// Authentication management
let authDialogShown = false;

// Show login screen
function showLoginScreen() {
  const overlay = document.createElement('div');
  overlay.className = 'login-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const dialog = document.createElement('div');
  dialog.className = 'login-dialog';
  dialog.style.cssText = `
    background: white;
    padding: 32px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    max-width: 400px;
    width: 90%;
  `;
  
  const title = document.createElement('h2');
  title.textContent = 'Web ToDo ログイン';
  title.style.cssText = 'margin: 0 0 24px 0; font-size: 20px; text-align: center;';
  
  const idLabel = document.createElement('label');
  idLabel.textContent = 'ユーザーID:';
  idLabel.style.cssText = 'display: block; font-size: 14px; margin-bottom: 4px; font-weight: 500;';
  
  const idInput = document.createElement('input');
  idInput.type = 'text';
  idInput.placeholder = 'ユーザーID（英数字、ハイフンのみ）';
  idInput.style.cssText = `
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
    margin-bottom: 16px;
  `;
  
  const passwordLabel = document.createElement('label');
  passwordLabel.textContent = 'パスワード:';
  passwordLabel.style.cssText = 'display: block; font-size: 14px; margin-bottom: 4px; font-weight: 500;';
  
  const passwordInput = document.createElement('input');
  passwordInput.type = 'password';
  passwordInput.placeholder = 'パスワード';
  passwordInput.style.cssText = `
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
    margin-bottom: 16px;
  `;
  
  const error = document.createElement('div');
  error.style.cssText = 'color: #d00; font-size: 13px; margin-bottom: 16px; min-height: 20px;';
  
  const info = document.createElement('div');
  info.textContent = '※初めてのIDの場合、パスワードを設定して新規登録します';
  info.style.cssText = 'color: #666; font-size: 12px; margin-bottom: 16px;';
  
  const loginBtn = document.createElement('button');
  loginBtn.textContent = 'ログイン / 新規登録';
  loginBtn.style.cssText = `
    width: 100%;
    padding: 12px;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 15px;
    font-weight: 500;
  `;
  
  loginBtn.onclick = async () => {
    const id = idInput.value.trim();
    const password = passwordInput.value;
    
    if (!id) {
      error.textContent = 'ユーザーIDを入力してください';
      return;
    }
    
    if (!/^[a-zA-Z0-9\-]+$/.test(id)) {
      error.textContent = 'ユーザーIDは英数字とハイフンのみ使用できます';
      return;
    }
    
    if (!password) {
      error.textContent = 'パスワードを入力してください';
      return;
    }
    
    try {
      loginBtn.disabled = true;
      loginBtn.textContent = '処理中...';
      
      // Try to login with the provided credentials
      const loginResponse = await fetch(`api.php?action=login&uid=${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
        body: new URLSearchParams({ password })
      });
      
      const data = await loginResponse.json();
      
      if (loginResponse.ok && data.success) {
        // Login successful
        userID = id;
        isLoggedIn = true;
        overlay.remove();
        initializeApp();
      } else {
        error.textContent = data.error || 'ログインに失敗しました';
        loginBtn.disabled = false;
        loginBtn.textContent = 'ログイン / 新規登録';
      }
    } catch (err) {
      console.error('Login error:', err);
      error.textContent = 'ログインエラーが発生しました';
      loginBtn.disabled = false;
      loginBtn.textContent = 'ログイン / 新規登録';
    }
  };
  
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      loginBtn.click();
    }
  };
  
  idInput.addEventListener('keydown', handleKeyDown);
  passwordInput.addEventListener('keydown', handleKeyDown);
  
  dialog.appendChild(title);
  dialog.appendChild(idLabel);
  dialog.appendChild(idInput);
  dialog.appendChild(passwordLabel);
  dialog.appendChild(passwordInput);
  dialog.appendChild(error);
  dialog.appendChild(info);
  dialog.appendChild(loginBtn);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  setTimeout(() => idInput.focus(), 100);
}

// Initialize the app after login
function initializeApp() {
  loadPresets();
  loadItems();
  
  // Setup reorder toggle button if not already set up
  const toggleBtn = document.getElementById('reorderToggle');
  if (toggleBtn && !toggleBtn.hasAttribute('data-initialized')) {
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.addEventListener('click', toggleReorderMode);
    toggleBtn.setAttribute('data-initialized', 'true');
  }
  
  // Setup settings button if not already set up
  const settingsBtn = document.getElementById('settingsToggle');
  if (settingsBtn && !settingsBtn.hasAttribute('data-initialized')) {
    settingsBtn.addEventListener('click', showSettingsDialog);
    settingsBtn.setAttribute('data-initialized', 'true');
  }
}

// Show password prompt dialog
function showPasswordPrompt(callback) {
  if (authDialogShown) return;
  authDialogShown = true;
  
  const overlay = document.createElement('div');
  overlay.className = 'auth-dialog-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const dialog = document.createElement('div');
  dialog.className = 'auth-dialog';
  dialog.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    max-width: 400px;
    width: 90%;
  `;
  
  const title = document.createElement('h2');
  title.textContent = 'パスワード認証';
  title.style.cssText = 'margin: 0 0 16px 0; font-size: 18px;';
  
  const message = document.createElement('p');
  message.textContent = 'このデータベースにはパスワードが設定されています。パスワードを入力してください。';
  message.style.cssText = 'margin: 0 0 16px 0; color: #666; font-size: 14px;';
  
  const input = document.createElement('input');
  input.type = 'password';
  input.placeholder = 'パスワード';
  input.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
    margin-bottom: 16px;
  `;
  
  const error = document.createElement('div');
  error.style.cssText = 'color: #d00; font-size: 13px; margin-bottom: 16px; min-height: 20px;';
  
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px;';
  
  const submitBtn = document.createElement('button');
  submitBtn.textContent = 'ログイン';
  submitBtn.style.cssText = `
    padding: 8px 16px;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  submitBtn.onclick = async () => {
    const password = input.value;
    if (!password) {
      error.textContent = 'パスワードを入力してください';
      return;
    }
    
    try {
      const response = await fetch(addUIDToURL('api.php?action=auth'), {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
        body: new URLSearchParams({ password })
      });
      
      if (response.ok) {
        overlay.remove();
        authDialogShown = false;
        if (callback) callback();
      } else {
        error.textContent = 'パスワードが正しくありません';
        input.value = '';
        input.focus();
      }
    } catch (err) {
      console.error('Authentication error:', err);
      error.textContent = '認証エラーが発生しました';
    }
  };
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      submitBtn.click();
    }
  });
  
  buttons.appendChild(submitBtn);
  dialog.appendChild(title);
  dialog.appendChild(message);
  dialog.appendChild(input);
  dialog.appendChild(error);
  dialog.appendChild(buttons);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  setTimeout(() => input.focus(), 100);
}

// Handle authentication errors (401)
function handleAuthError(retryCallback) {
  showPasswordPrompt(() => {
    if (retryCallback) retryCallback();
  });
}

// Settings dialog for password management
function showSettingsDialog() {
  const overlay = document.createElement('div');
  overlay.className = 'settings-dialog-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const dialog = document.createElement('div');
  dialog.className = 'settings-dialog';
  dialog.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
    max-width: 500px;
    width: 90%;
  `;
  
  const title = document.createElement('h2');
  title.textContent = '設定';
  title.style.cssText = 'margin: 0 0 16px 0; font-size: 18px;';
  
  const uidSection = document.createElement('div');
  uidSection.style.cssText = 'margin-bottom: 24px; padding: 12px; background: #f5f5f5; border-radius: 4px;';
  
  const uidLabel = document.createElement('div');
  uidLabel.textContent = 'ログイン中のユーザー:';
  uidLabel.style.cssText = 'font-size: 13px; color: #666; margin-bottom: 4px;';
  
  const uidValue = document.createElement('div');
  uidValue.textContent = userID;
  uidValue.style.cssText = 'font-family: monospace; font-size: 14px; color: #333; word-break: break-all; font-weight: 500;';
  
  const uidNote = document.createElement('div');
  uidNote.textContent = '※このIDで個別のデータベースが管理されています';
  uidNote.style.cssText = 'font-size: 11px; color: #999; margin-top: 4px;';
  
  uidSection.appendChild(uidLabel);
  uidSection.appendChild(uidValue);
  uidSection.appendChild(uidNote);
  
  const passwordSection = document.createElement('div');
  passwordSection.style.cssText = 'margin-bottom: 16px;';
  
  const passwordTitle = document.createElement('h3');
  passwordTitle.textContent = 'パスワード設定';
  passwordTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 15px;';
  
  const currentPasswordLabel = document.createElement('label');
  currentPasswordLabel.textContent = '現在のパスワード (変更時のみ):';
  currentPasswordLabel.style.cssText = 'display: block; font-size: 13px; margin-bottom: 4px;';
  
  const currentPasswordInput = document.createElement('input');
  currentPasswordInput.type = 'password';
  currentPasswordInput.placeholder = '現在のパスワード';
  currentPasswordInput.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
    margin-bottom: 12px;
  `;
  
  const newPasswordLabel = document.createElement('label');
  newPasswordLabel.textContent = '新しいパスワード:';
  newPasswordLabel.style.cssText = 'display: block; font-size: 13px; margin-bottom: 4px;';
  
  const newPasswordInput = document.createElement('input');
  newPasswordInput.type = 'password';
  newPasswordInput.placeholder = '新しいパスワード';
  newPasswordInput.style.cssText = `
    width: 100%;
    padding: 8px 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    box-sizing: border-box;
    margin-bottom: 12px;
  `;
  
  const error = document.createElement('div');
  error.style.cssText = 'color: #d00; font-size: 13px; margin-bottom: 12px; min-height: 20px;';
  
  const success = document.createElement('div');
  success.style.cssText = 'color: #0a0; font-size: 13px; margin-bottom: 12px; min-height: 20px;';
  
  const setPasswordBtn = document.createElement('button');
  setPasswordBtn.textContent = 'パスワードを設定';
  setPasswordBtn.style.cssText = `
    padding: 8px 16px;
    background: #4a90e2;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    margin-bottom: 16px;
  `;
  
  setPasswordBtn.onclick = async () => {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    
    if (!newPassword) {
      error.textContent = '新しいパスワードを入力してください';
      success.textContent = '';
      return;
    }
    
    try {
      const params = new URLSearchParams({ newpass: newPassword });
      if (currentPassword) {
        params.append('current', currentPassword);
      }
      
      const response = await fetch(addUIDToURL('api.php?action=set_password'), {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
        body: params
      });
      
      const data = await response.json();
      
      if (response.ok) {
        error.textContent = '';
        success.textContent = 'パスワードが設定されました';
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
      } else {
        error.textContent = data.error || 'エラーが発生しました';
        success.textContent = '';
      }
    } catch (err) {
      console.error('Password set error:', err);
      error.textContent = 'パスワード設定エラーが発生しました';
      success.textContent = '';
    }
  };
  
  passwordSection.appendChild(passwordTitle);
  passwordSection.appendChild(currentPasswordLabel);
  passwordSection.appendChild(currentPasswordInput);
  passwordSection.appendChild(newPasswordLabel);
  passwordSection.appendChild(newPasswordInput);
  passwordSection.appendChild(error);
  passwordSection.appendChild(success);
  passwordSection.appendChild(setPasswordBtn);
  
  const buttons = document.createElement('div');
  buttons.style.cssText = 'display: flex; justify-content: space-between; gap: 8px; margin-top: 24px;';
  
  const logoutBtn = document.createElement('button');
  logoutBtn.textContent = 'ログアウト';
  logoutBtn.style.cssText = `
    padding: 8px 16px;
    background: #e74c3c;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  logoutBtn.onclick = async () => {
    try {
      await fetch('api.php?action=logout', { method: 'POST' });
      window.location.reload();
    } catch (err) {
      console.error('Logout error:', err);
      window.location.reload();
    }
  };
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '閉じる';
  closeBtn.style.cssText = `
    padding: 8px 16px;
    background: #ddd;
    color: #333;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  
  closeBtn.onclick = () => {
    overlay.remove();
  };
  
  buttons.appendChild(logoutBtn);
  buttons.appendChild(closeBtn);
  
  dialog.appendChild(title);
  dialog.appendChild(uidSection);
  dialog.appendChild(passwordSection);
  dialog.appendChild(buttons);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// Wrap fetch to handle 401 responses
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  try {
    const response = await originalFetch.apply(this, args);
    
    // Check for 401 Unauthorized - redirect to login
    if (response.status === 401) {
      // Session expired, redirect to login
      window.location.reload();
      return response;
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

let items = [];
let undoStack = [];
let redoStack = [];
let decorationPresets = [];

const list = document.getElementById('todoList');

// Segoe Fluent icon code for collapsible headings (ChevronDown)
const COLLAPSE_ICON_GLYPH = '\uE96E';

const FORMAT_MENU_OPTIONS = [
  { type: 'heading', label: '見出し', command: '/h' },
  { type: 'collapsible-heading', label: '折りたたみ見出し', command: '/b' },
  { type: 'checkbox', label: 'チェックボックス', command: '/c' },
  { type: 'list', label: '箇条書き', command: '/-' },
  { type: 'hr', label: '水平線', command: '/_' },
];

const SLASH_COMMAND_MAP = FORMAT_MENU_OPTIONS.reduce((map, option) => {
  map[option.command] = option.type;
  map[`${option.command}/`] = option.type;
  return map;
}, {});


// Default decoration presets
const DEFAULT_PRESETS = [
  { id: 'important', name: '重要', bold: true, italic: false, color: '#FF0000', shortcut: '1' }
];

// Load presets from localStorage or use defaults
function loadPresets() {
  try {
    const stored = localStorage.getItem('decorationPresets');
    if (stored) {
      decorationPresets = JSON.parse(stored);
    } else {
      decorationPresets = [...DEFAULT_PRESETS];
      savePresets();
    }
  } catch (err) {
    console.error('Failed to load presets:', err);
    decorationPresets = [...DEFAULT_PRESETS];
  }
}

// Save presets to localStorage
function savePresets() {
  try {
    localStorage.setItem('decorationPresets', JSON.stringify(decorationPresets));
  } catch (err) {
    console.error('Failed to save presets:', err);
  }
}

// Get preset by ID
function getPreset(presetId) {
  return decorationPresets.find(p => p.id === presetId);
}

// Apply decoration preset to item
function applyDecorationPreset(item, presetId) {
  if (!item) return;
  
  captureStateForUndo('decoration', { itemId: item.id, oldDecoration: item.decoration });
  
  if (presetId === null || presetId === 'none') {
    item.decoration = null;
  } else {
    item.decoration = { presetId };
  }
  
  // Find the content element for this item
  const li = list.querySelector(`li[data-id="${item.id}"]`);
  const content = li ? li.querySelector('.task-content') : null;
  
  // Save current focus state
  const wasFocused = content && document.activeElement === content;
  const selection = wasFocused ? window.getSelection() : null;
  let savedRange = null;
  
  if (wasFocused && selection && selection.rangeCount > 0) {
    savedRange = selection.getRangeAt(0).cloneRange();
  }
  
  // Update decoration styles directly without re-rendering
  if (content) {
    // Clear existing decoration styles
    content.style.fontWeight = '';
    content.style.fontStyle = '';
    content.style.textDecoration = '';
    content.style.color = '';
    content.classList.remove('decorated');
    
    // Apply new decoration if present
    if (item.decoration && item.decoration.presetId) {
      const preset = getPreset(item.decoration.presetId);
      if (preset) {
        if (preset.bold) content.style.fontWeight = 'bold';
        if (preset.italic) content.style.fontStyle = 'italic';
        if (preset.underline) content.style.textDecoration = 'underline';
        if (preset.color) content.style.color = preset.color;
        content.classList.add('decorated');
      }
    }
    
    // Restore focus and selection
    if (wasFocused) {
      content.focus();
      if (savedRange && selection) {
        try {
          selection.removeAllRanges();
          selection.addRange(savedRange);
        } catch (e) {
          // If restoration fails, just keep focus
          console.warn('Could not restore selection:', e);
        }
      }
    }
  }
  
  updateItem(item.id, { decoration: item.decoration }, undefined, { skipReload: true });
}

// Undo/Redo system
function captureStateForUndo(actionType, data) {
  // Create a deep copy of the current items state
  const stateCopy = items.map(item => ({...item}));
  
  undoStack.push({
    actionType,
    itemsSnapshot: stateCopy,
    actionData: data
  });
  
  // Clear redo stack when a new action is performed
  redoStack = [];
  
  // Limit undo stack size to prevent memory issues
  if (undoStack.length > 100) {
    undoStack.shift();
  }
}

function performUndo() {
  if (undoStack.length === 0) {
    return false;
  }
  
  // Save current state to redo stack before undo
  const currentState = items.map(item => ({...item}));
  
  // Get the last action from undo stack
  const lastAction = undoStack.pop();
  
  // Push current state to redo stack
  redoStack.push({
    actionType: lastAction.actionType,
    itemsSnapshot: currentState,
    actionData: lastAction.actionData
  });
  
  // Restore the previous state
  items = lastAction.itemsSnapshot.map(item => ({...item}));
  
  // Just render without syncing to backend
  // The state will be synced on next explicit operation
  render();
  
  return true;
}

function performRedo() {
  if (redoStack.length === 0) {
    return false;
  }
  
  // Save current state to undo stack before redo
  const currentState = items.map(item => ({...item}));
  
  // Get the last redo action
  const redoAction = redoStack.pop();
  
  // Push current state back to undo stack
  undoStack.push({
    actionType: redoAction.actionType,
    itemsSnapshot: currentState,
    actionData: redoAction.actionData
  });
  
  // Restore the redo state
  items = redoAction.itemsSnapshot.map(item => ({...item}));
  
  // Just render without syncing to backend
  // The state will be synced on next explicit operation
  render();
  
  return true;
}



const LINK_DETECTION_REGEX = /(?:https?:\/\/[^\s<>"']+|[A-Za-z]:[\\/][^\s<>"']+|\\\\[^\s<>"']+)/gi;

function addItemFromServer(data) {
  if (!data || typeof data.id === 'undefined') return;
  
  const newOrder = typeof data.sort_order === 'number' ? data.sort_order : getNextOrderValue();
  
  items = items.map(item => {
    if (typeof item.order === 'number' && item.order >= newOrder) {
      return {...item, order: item.order + 1};
    }
    return item;
  });
  
  const newItem = {
    id: data.id,
    type: data.type || 'text',
    text: data.text || '',
    checked: Number(data.done) === 1,
    order: newOrder,
    decoration: data.decoration || null,
    deadline: data.deadline || null,
    collapsed: Number(data.collapsed) === 1
  };
  
  items.push(newItem);
  items.sort((a, b) => a.order - b.order);
  render();
}

function getNextOrderValue() {
  if (items.length === 0) return 0;
  return Math.max(...items.map(i => i.order || 0)) + 1;
}

function getCaretOffset(content) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return content.textContent.length;
  }
  const range = selection.getRangeAt(0);
  if (!content.contains(range.startContainer)) {
    return content.textContent.length;
  }
  const preRange = range.cloneRange();
  preRange.selectNodeContents(content);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString().length;
}

function splitTextAtCaret(content) {
  const fullText = content.textContent || '';
  const caretOffset = getCaretOffset(content);
  return {
    before: fullText.slice(0, caretOffset),
    after: fullText.slice(caretOffset),
    atEnd: caretOffset >= fullText.length
  };
}

function splitHtmlAtCaret(content) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return {
      beforeHtml: content.innerHTML || '',
      afterHtml: '',
      atEnd: true
    };
  }
  
  const range = selection.getRangeAt(0);
  if (!content.contains(range.startContainer)) {
    return {
      beforeHtml: content.innerHTML || '',
      afterHtml: '',
      atEnd: true
    };
  }
  
  // Create a range from the start of content to the caret position
  const beforeRange = document.createRange();
  beforeRange.setStart(content, 0);
  beforeRange.setEnd(range.startContainer, range.startOffset);
  
  // Create a range from the caret position to the end of content
  const afterRange = document.createRange();
  afterRange.setStart(range.startContainer, range.startOffset);
  afterRange.setEnd(content, content.childNodes.length);
  
  // Extract HTML content from both ranges
  const beforeFragment = beforeRange.cloneContents();
  const afterFragment = afterRange.cloneContents();
  
  // Convert fragments to HTML strings
  const tempBefore = document.createElement('div');
  tempBefore.appendChild(beforeFragment);
  const beforeHtml = tempBefore.innerHTML;
  
  const tempAfter = document.createElement('div');
  tempAfter.appendChild(afterFragment);
  const afterHtml = tempAfter.innerHTML;
  
  // Check if we're at the end
  const atEnd = afterHtml.trim() === '';
  
  return {
    beforeHtml: beforeHtml,
    afterHtml: afterHtml,
    atEnd: atEnd
  };
}

function getRangeOffsetsWithin(container, range) {
  if (!container || !range) return { start: null, end: null };
  try {
    const startRange = range.cloneRange();
    startRange.selectNodeContents(container);
    startRange.setEnd(range.startContainer, range.startOffset);
    const start = startRange.toString().length;
    
    const endRange = range.cloneRange();
    endRange.selectNodeContents(container);
    endRange.setEnd(range.endContainer, range.endOffset);
    const end = endRange.toString().length;
    
    return { start, end };
  } catch {
    return { start: null, end: null };
  }
}

function resolveOffsetToRangePoint(container, targetOffset) {
  if (!container || targetOffset === null || targetOffset === undefined) return null;
  
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let current = 0;
  let node = walker.nextNode();
  
  while (node) {
    const length = node.textContent.length;
    if (targetOffset <= current + length) {
      return { node, offset: targetOffset - current };
    }
    current += length;
    node = walker.nextNode();
  }
  
  if (container.lastChild && container.lastChild.nodeType === Node.TEXT_NODE) {
    return { node: container.lastChild, offset: container.lastChild.textContent.length };
  }
  return { node: container, offset: container.childNodes.length };
}

function resolveSelectionContext(range, contextHint) {
  let container = contextHint || null;
  if (!container && range) {
    let candidate = range.commonAncestorContainer;
    if (candidate && candidate.nodeType !== Node.ELEMENT_NODE) {
      candidate = candidate.parentElement;
    }
    container = candidate;
  }
  if (container && container.closest) {
    const taskContent = container.closest('.task-content');
    if (taskContent) {
      container = taskContent;
    }
  }
  if (container && container.nodeType === Node.ELEMENT_NODE) {
    return container;
  }
  return null;
}

function captureSelection(selection, contextHint) {
  if (!selection || selection.rangeCount === 0) {
    return null;
  }
  const range = selection.getRangeAt(0);
  const context = resolveSelectionContext(range, contextHint);
  const offsets = context ? getRangeOffsetsWithin(context, range) : { start: null, end: null };
  return {
    range: range.cloneRange(),
    text: selection.toString(),
    context,
    start: offsets.start,
    end: offsets.end
  };
}

function unwrapElement(element) {
  if (!element || !element.parentNode) return;
  const parent = element.parentNode;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function saveSelectionSnapshot(selection, contextHint) {
  const snapshot = captureSelection(selection, contextHint);
  savedSelection = snapshot;
  return snapshot;
}

function restoreSelectionForContent(content) {
  const selection = window.getSelection();
  if (!selection) return false;
  if (!savedSelection) return false;
  
  const targetContent = content || savedSelection.context || null;
  const savedRange = savedSelection.range;
  
  if (savedRange && savedRange.startContainer && savedRange.startContainer.isConnected &&
      (!targetContent || targetContent.contains(savedRange.startContainer))) {
    selection.removeAllRanges();
    selection.addRange(savedRange.cloneRange());
    return true;
  }
  
  if (!targetContent || !targetContent.isConnected) {
    return false;
  }
  
  if (typeof savedSelection.start !== 'number' || typeof savedSelection.end !== 'number') {
    return false;
  }
  
  const totalLength = targetContent.textContent.length;
  const startOffset = Math.max(0, Math.min(savedSelection.start, totalLength));
  const endOffset = Math.max(startOffset, Math.min(savedSelection.end, totalLength));
  
  const startPoint = resolveOffsetToRangePoint(targetContent, startOffset);
  const endPoint = resolveOffsetToRangePoint(targetContent, endOffset);
  if (!startPoint || !endPoint || !startPoint.node || !endPoint.node) {
    return false;
  }
  
  try {
    const newRange = document.createRange();
    newRange.setStart(startPoint.node, startPoint.offset);
    newRange.setEnd(endPoint.node, endPoint.offset);
    selection.removeAllRanges();
    selection.addRange(newRange);
    savedSelection.range = newRange.cloneRange();
    savedSelection.context = targetContent;
    return true;
  } catch (err) {
    console.warn('Failed to restore selection from offsets:', err);
    return false;
  }
}

function refreshSavedSelection(content) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    savedSelection = null;
    return;
  }
  const range = selection.getRangeAt(0);
  if (content && !content.contains(range.commonAncestorContainer)) {
    return;
  }
  saveSelectionSnapshot(selection, content);
}

function getSelectionRangeWithinContent(content) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer)) return null;
  if (range.collapsed) return null;
  return range;
}

function findExactWrapper(range, content, predicate) {
  if (!range) return null;
  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) {
    node = node.parentElement;
  }
  while (node && node !== content) {
    if (predicate(node)) {
      const candidateRange = document.createRange();
      candidateRange.selectNodeContents(node);
      if (candidateRange.compareBoundaryPoints(Range.START_TO_START, range) === 0 &&
          candidateRange.compareBoundaryPoints(Range.END_TO_END, range) === 0) {
        return node;
      }
    }
    node = node.parentElement;
  }
  return null;
}

function toggleBoldSelection(content) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  if (!content.contains(range.commonAncestorContainer) || range.collapsed) {
    return false;
  }

  const offsets = getRangeOffsetsWithin(content, range);
  const startOffset = offsets.start;
  const endOffset = offsets.end;

  if (typeof startOffset !== 'number' || typeof endOffset !== 'number') {
    return false;
  }

  // Analyze the actual DOM range, not a cloned fragment
  const analysis = analyzeBoldInRange(range, content);
  if (!analysis.hasText) {
    return false;
  }

  const extracted = range.extractContents();
  let insertedNodes = [];

  stripBoldTagsFromFragment(extracted);

  if (!analysis.allBold) {
    const wrapper = document.createElement('strong');
    while (extracted.firstChild) {
      wrapper.appendChild(extracted.firstChild);
    }
    if (wrapper.firstChild) {
      range.insertNode(wrapper);
      insertedNodes = [wrapper];
    }
  } else {
    const nodesToInsert = Array.from(extracted.childNodes);
    if (nodesToInsert.length === 0) {
      const placeholder = document.createTextNode('');
      extracted.appendChild(placeholder);
      nodesToInsert.push(placeholder);
    }
    range.insertNode(extracted);
    insertedNodes = nodesToInsert.filter(node => node.parentNode);
    liftNodesOutOfBold(insertedNodes);
  }

  content.normalize();

  const startPoint = resolveOffsetToRangePoint(content, startOffset);
  const endPoint = resolveOffsetToRangePoint(content, endOffset);
  if (!startPoint || !endPoint || !startPoint.node || !endPoint.node) {
    return false;
  }

  try {
    const newRange = document.createRange();
    newRange.setStart(startPoint.node, startPoint.offset);
    newRange.setEnd(endPoint.node, endPoint.offset);
    selection.removeAllRanges();
    selection.addRange(newRange);
    saveSelectionSnapshot(selection, content);
    return true;
  } catch (err) {
    console.warn('選択範囲の復元に失敗:', err);
    return false;
  }
}

function analyzeBoldInRange(range, content) {
  // Analyze by checking actual DOM nodes within the range
  // This is more reliable than cloning contents
  let hasText = false;
  let allBold = true;
  
  // Get the start and end containers
  let startNode = range.startContainer;
  let endNode = range.endContainer;
  
  // If containers are elements, get the text nodes
  if (startNode.nodeType === Node.ELEMENT_NODE && startNode.childNodes.length > 0) {
    startNode = startNode.childNodes[range.startOffset] || startNode;
  }
  if (endNode.nodeType === Node.ELEMENT_NODE && endNode.childNodes.length > 0) {
    const childIndex = Math.max(0, range.endOffset - 1);
    endNode = endNode.childNodes[childIndex] || endNode;
  }
  
  // Handle single text node selection
  if (startNode === endNode && startNode.nodeType === Node.TEXT_NODE) {
    const selectedText = startNode.textContent.substring(range.startOffset, range.endOffset);
    if (selectedText.trim().length > 0) {
      hasText = true;
      allBold = isTextNodeWithinBold(startNode);
    }
    return { hasText, allBold };
  }
  
  // Handle multi-node selection
  // Walk through all text nodes in the content
  const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT, null);
  let node = walker.nextNode();
  
  while (node) {
    // Check if this node is within the range
    if (range.intersectsNode(node)) {
      let text = node.textContent || '';
      let startIdx = 0;
      let endIdx = text.length;
      
      // If this is the start node, only consider text after startOffset
      if (node === range.startContainer) {
        startIdx = range.startOffset;
      }
      // If this is the end node, only consider text before endOffset
      if (node === range.endContainer) {
        endIdx = range.endOffset;
      }
      
      // Extract the relevant portion of text
      text = text.substring(startIdx, endIdx);
      
      if (text.trim().length > 0) {
        hasText = true;
        if (!isTextNodeWithinBold(node)) {
          allBold = false;
        }
      }
    }
    node = walker.nextNode();
  }
  
  return { hasText, allBold };
}

function analyzeBoldFragment(fragment) {
  let hasText = false;
  let allBold = true;
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    const textNode = walker.currentNode;
    if (!textNode) continue;
    const text = textNode.textContent || '';
    if (text.trim().length === 0) {
      continue;
    }
    hasText = true;
    if (!isTextNodeWithinBold(textNode)) {
      allBold = false;
    }
  }
  return { hasText, allBold };
}

function isTextNodeWithinBold(node) {
  let current = node.parentNode;
  while (current) {
    if (current.nodeType === Node.ELEMENT_NODE) {
      const tag = current.tagName;
      if (tag === 'STRONG' || tag === 'B') {
        return true;
      }
    }
    current = current.parentNode;
  }
  return false;
}

function stripBoldTagsFromFragment(fragment) {
  if (!fragment || typeof fragment.querySelectorAll !== 'function') return;
  const boldNodes = Array.from(fragment.querySelectorAll('strong, b'));
  boldNodes.forEach(node => unwrapElement(node));
}

function isBoldElement(node) {
  return node && node.nodeType === Node.ELEMENT_NODE && (node.tagName === 'STRONG' || node.tagName === 'B');
}

function liftNodesOutOfBold(nodes) {
  nodes.forEach(node => liftNodeOutOfBold(node));
}

function liftNodeOutOfBold(node) {
  let current = node;
  while (current && current.parentNode && isBoldElement(current.parentNode)) {
    const boldParent = current.parentNode;
    const grandParent = boldParent.parentNode;
    if (!grandParent) break;

    const afterClone = boldParent.cloneNode(false);
    while (current.nextSibling) {
      afterClone.appendChild(current.nextSibling);
    }

    const referenceNode = boldParent.nextSibling;
    grandParent.insertBefore(current, referenceNode);
    if (afterClone.firstChild) {
      grandParent.insertBefore(afterClone, referenceNode);
    }

    if (!boldParent.firstChild) {
      boldParent.remove();
    }
  }
}

function clearColorElement(element) {
  if (!element) return;
  element.removeAttribute('data-text-color');
  element.removeAttribute('style');
  unwrapElement(element);
}

function clearColorRange(content, range) {
  if (!range) return;
  const spans = Array.from(content.querySelectorAll('span[data-text-color]'));
  spans.forEach(span => {
    if (typeof range.intersectsNode === 'function') {
      if (range.intersectsNode(span)) {
        clearColorElement(span);
      }
      return;
    }
    const spanRange = document.createRange();
    spanRange.selectNodeContents(span);
    if (range.compareBoundaryPoints(Range.END_TO_START, spanRange) >= 0 &&
        range.compareBoundaryPoints(Range.START_TO_END, spanRange) <= 0) {
      clearColorElement(span);
    }
  });
  content.normalize();
}

function applyColorToSelection(content, colorId) {
  const range = getSelectionRangeWithinContent(content);
  if (!range) return false;
  
  if (colorId === 'default') {
    // Save range offsets before clearing
    const offsets = getRangeOffsetsWithin(content, range);
    if (typeof offsets.start !== 'number' || typeof offsets.end !== 'number') {
      return false;
    }
    
    clearColorRange(content, range);
    content.normalize();
    
    // Reconstruct range using saved offsets
    const startPoint = resolveOffsetToRangePoint(content, offsets.start);
    const endPoint = resolveOffsetToRangePoint(content, offsets.end);
    if (!startPoint || !endPoint || !startPoint.node || !endPoint.node) {
      return false;
    }
    
    try {
      const newRange = document.createRange();
      newRange.setStart(startPoint.node, startPoint.offset);
      newRange.setEnd(endPoint.node, endPoint.offset);
      
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(newRange);
      }
      return true;
    } catch (err) {
      console.warn('Failed to restore selection after color removal:', err);
      return false;
    }
  }
  
  const hex = TEXT_COLOR_MAP[colorId];
  if (!hex) {
    return false;
  }
  
  // Save range offsets before clearing to reconstruct range after clearing
  const offsets = getRangeOffsetsWithin(content, range);
  
  // Always clear existing colors before applying new color
  // This allows changing from one color to another
  clearColorRange(content, range);
  content.normalize();
  
  // Reconstruct range using saved offsets
  const startPoint = resolveOffsetToRangePoint(content, offsets.start);
  const endPoint = resolveOffsetToRangePoint(content, offsets.end);
  if (!startPoint || !endPoint || !startPoint.node || !endPoint.node) {
    return false;
  }
  
  const newRange = document.createRange();
  newRange.setStart(startPoint.node, startPoint.offset);
  newRange.setEnd(endPoint.node, endPoint.offset);
  
  const fragment = newRange.extractContents();
  const span = document.createElement('span');
  span.setAttribute('data-text-color', colorId);
  span.style.color = hex;
  span.appendChild(fragment);
  newRange.insertNode(span);
  
  const selection = window.getSelection();
  if (selection) {
    const finalRange = document.createRange();
    finalRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(finalRange);
  }
  content.normalize();
  
  return true;
}

function commitFormattingChange(content, item, options = {}) {
  // Capture state before formatting change
  captureStateForUndo('formatting', { itemId: item.id, oldText: item.text });
  
  const selection = window.getSelection();
  const selectionSnapshot = (options.keepSelection && selection && selection.rangeCount > 0 && content.contains(selection.getRangeAt(0).commonAncestorContainer))
    ? captureSelection(selection, content)
    : null;

  sanitizeContentInPlace(content);
  const sanitizedContent = sanitizeHtml(content.innerHTML);

  if (selectionSnapshot) {
    savedSelection = selectionSnapshot;
  }

  const restoreSelectionAsync = () => {
    if (selectionSnapshot) {
      savedSelection = selectionSnapshot;
      restoreSelectionForContent(content);
      refreshSavedSelection(content);
    }
  };

  if ((item.text || '') === sanitizedContent) {
    content.focus();
    requestAnimationFrame(restoreSelectionAsync);
    return;
  }
  const updatePayload = { text: sanitizedContent };
  if (options.skipAutoLink) {
    updatePayload.skipAutoLink = true;
  }
  updateItem(item.id, updatePayload, undefined, { skipReload: true });
  item.text = sanitizedContent;
  content.focus();
  requestAnimationFrame(restoreSelectionAsync);
}

// Load from SQLite3 via API
function loadItems(callback) {
  fetch(addUIDToURL('api.php?action=list'), {cache: 'no-store'})
    .then(r => r.json())
    .then(data => {
      items = data.map(row => ({
        id: row.id,
        type: row.type || 'text',
        text: row.text || '',
        checked: Number(row.done) === 1,
        order: row.sort_order || 0,
        decoration: row.decoration ? JSON.parse(row.decoration) : null,
        deadline: row.deadline || null,
        collapsed: Number(row.collapsed) === 1
      }));
      render();
      if (typeof callback === 'function') callback();
    })
    .catch(err => {
      console.error('Failed to load items:', err);
      items = [];
      render();
    });
}

// Save operations use API endpoints
// No general saveItems() - each operation calls its specific endpoint

// Create new item via API
function createItem(type = 'text', text = '', afterId = null, callback, options = {}) {
  text = text.trim();
  // Allow empty text for hr, checkbox, and list types
  if (!text && !options.allowEmpty && !['hr', 'checkbox', 'list'].includes(type)) {
    if (callback) callback();
    return;
  }
  
  // Capture state before creating
  captureStateForUndo('create', { type, text, afterId });
  
  const preparedText = prepareTextForStorage(text);
  
  const params = new URLSearchParams({text: preparedText, type});
  if (afterId) params.append('after_id', afterId);
  if (options.allowEmpty) params.append('allow_empty', '1');

  fetch(addUIDToURL('api.php?action=add'), {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body: params
  })
  .then(response => {
    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return null;
  })
  .then(data => {
    if (options.skipReload && data) {
      addItemFromServer(data);
      if (typeof callback === 'function') callback(data);
      return;
    }
    loadItems(() => {
      if (typeof callback === 'function') callback(data);
    });
  })
  .catch(err => console.error('Failed to create item:', err));
}

// Update item via API
function updateItem(id, updates, callback, options = {}) {
  const item = items.find(i => i.id === id);
  if (!item) return;

  // Capture state before updating
  // skipUndoCapture option available for future use if undo/redo operations need to update without capturing
  if (!options.skipUndoCapture) {
    captureStateForUndo('update', { id, updates });
  }

  const skipAutoLink = updates && updates.skipAutoLink === true;
  if (updates && 'skipAutoLink' in updates) {
    delete updates.skipAutoLink;
  }
  const shouldSkipReload = options && options.skipReload;
  
  // Handle checked state separately
  if (updates.checked !== undefined && Object.keys(updates).length === 1) {
    const params = new URLSearchParams({
      id: id.toString(),
      done: updates.checked ? '1' : '0'
    });
    
    fetch(addUIDToURL('api.php?action=toggle'), {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
      body: params
    })
    .then(() => loadItems(callback))
    .catch(err => console.error('Failed to toggle item:', err));
    return;
  }
  
  // Handle text or type or decoration updates via edit endpoint
  const params = new URLSearchParams({id: id.toString()});
  let preparedText;
  
  if (updates.text !== undefined) {
    preparedText = skipAutoLink ? updates.text : prepareTextForStorage(updates.text);
    params.append('text', preparedText);
  } else if (item.text) {
    params.append('text', item.text);
  }
  
  if (updates.type !== undefined) {
    params.append('type', updates.type);
  }
  
  if (updates.decoration !== undefined) {
    params.append('decoration', updates.decoration ? JSON.stringify(updates.decoration) : '');
  }
  
  if (updates.deadline !== undefined) {
    params.append('deadline', updates.deadline || '');
  }
  
  if (updates.collapsed !== undefined) {
    params.append('collapsed', updates.collapsed ? '1' : '0');
  }
  
  fetch(addUIDToURL('api.php?action=edit'), {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body: params
  })
  .then(() => {
    if (shouldSkipReload) {
      if (preparedText !== undefined) {
        item.text = preparedText;
      }
      if (updates.type !== undefined) {
        item.type = updates.type;
      }
      if (updates.decoration !== undefined) {
        item.decoration = updates.decoration;
      }
      if (updates.deadline !== undefined) {
        item.deadline = updates.deadline;
      }
      if (updates.collapsed !== undefined) {
        item.collapsed = updates.collapsed;
      }
      if (typeof callback === 'function') {
        callback();
      }
    } else {
      loadItems(() => {
        if (typeof callback === 'function') {
          callback();
        }
      });
    }
  })
  .catch(err => console.error('Failed to update item:', err));
}

// Delete item via API
function deleteItem(id) {
  const index = items.findIndex(i => i.id === id);
  if (index !== -1) {
    // Capture state before deleting
    captureStateForUndo('delete', { id });
    
    const params = new URLSearchParams({id: id.toString()});
    fetch(addUIDToURL('api.php?action=delete'), {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
      body: params
    })
    .then(() => {
      // Also delete children on client side (server should handle this too)
      return loadItems();
    })
    .catch(err => console.error('Failed to delete item:', err));
  }
}



// Insert item at position via API
function insertItemAfter(afterId, type = 'text', text = '', callback, options = {}) {
  createItem(type, text, afterId, callback, options);
}

// Reorder items based on DOM order via API
function reorderItems(callback) {
  // Capture state before reordering
  captureStateForUndo('reorder', {});
  
  const lis = Array.from(list.querySelectorAll('li[data-id]'));
  const order = lis.map(li => li.dataset.id);
  
  const params = new URLSearchParams({order: JSON.stringify(order)});
  
  fetch(addUIDToURL('api.php?action=reorder'), {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body: params
  })
  .then(() => loadItems(callback))
  .catch(err => console.error('Failed to reorder items:', err));
}

// Context menu state
let contextMenu = null;
let savedSelection = null;
let colorMenu = null;
let colorMenuContext = null;
let selectedColorIndex = 0;

function closeColorMenu() {
  if (colorMenu) {
    colorMenu.remove();
    colorMenu = null;
    colorMenuContext = null;
    selectedColorIndex = 0;
  }
  document.removeEventListener('click', handleColorMenuOutside, true);
  document.removeEventListener('keydown', handleColorMenuKeydown);
}

function handleColorMenuOutside(event) {
  if (!colorMenu) return;
  if (colorMenu.contains(event.target)) return;
  closeColorMenu();
}

function updateColorMenuSelection() {
  if (!colorMenu) return;
  const options = colorMenu.querySelectorAll('.context-color-option');
  options.forEach((opt, index) => {
    if (index === selectedColorIndex) {
      opt.classList.add('selected');
    } else {
      opt.classList.remove('selected');
    }
  });
}

function handleColorMenuKeydown(event) {
  if (!colorMenu) return;
  
  const key = event.key.toLowerCase();
  
  // Handle arrow keys for navigation
  if (key === 'arrowdown' || key === 'arrowup') {
    event.preventDefault();
    if (key === 'arrowdown') {
      selectedColorIndex = (selectedColorIndex + 1) % TEXT_COLOR_OPTIONS.length;
    } else {
      selectedColorIndex = (selectedColorIndex - 1 + TEXT_COLOR_OPTIONS.length) % TEXT_COLOR_OPTIONS.length;
    }
    updateColorMenuSelection();
    return;
  }
  
  // Handle Enter to apply selected color
  if (key === 'enter') {
    event.preventDefault();
    const option = TEXT_COLOR_OPTIONS[selectedColorIndex];
    if (option) {
      applyColorChoice(option.id);
    }
    return;
  }
  
  // Handle Escape to close menu
  if (key === 'escape') {
    event.preventDefault();
    closeColorMenu();
    return;
  }
  
  // Handle shortcut keys
  const shortcutOption = TEXT_COLOR_OPTIONS.find(opt => opt.shortcut.toLowerCase() === key);
  if (shortcutOption) {
    event.preventDefault();
    applyColorChoice(shortcutOption.id);
    return;
  }
}

function openColorMenu(position, content, item) {
  closeColorMenu();
  
  if (!restoreSelectionForContent(content)) {
    return;
  }
  
  colorMenu = document.createElement('div');
  colorMenu.className = 'context-color-menu';
  colorMenu.setAttribute('tabindex', '-1');
  colorMenu.setAttribute('role', 'menu');
  colorMenu.setAttribute('aria-label', '色を変更');
  colorMenuContext = { content, item };
  selectedColorIndex = 0;
  
  TEXT_COLOR_OPTIONS.forEach((option, index) => {
    const optionElement = document.createElement('div');
    optionElement.className = 'context-color-option';
    optionElement.setAttribute('data-color-id', option.id);
    optionElement.setAttribute('data-index', index);
    optionElement.setAttribute('role', 'menuitem');
    optionElement.setAttribute('aria-label', `${option.label} (${option.shortcut})`);
    
    const swatch = document.createElement('span');
    swatch.className = 'context-color-swatch';
    if (option.color) {
      swatch.style.backgroundColor = option.color;
    } else {
      swatch.classList.add('context-color-swatch-default');
    }
    
    const label = document.createElement('span');
    label.className = 'context-color-label';
    label.textContent = option.label;
    
    const shortcut = document.createElement('span');
    shortcut.className = 'context-color-shortcut';
    shortcut.textContent = option.shortcut;
    
    optionElement.appendChild(swatch);
    optionElement.appendChild(label);
    optionElement.appendChild(shortcut);
    
    optionElement.addEventListener('click', () => {
      applyColorChoice(option.id);
    });
    
    colorMenu.appendChild(optionElement);
  });
  
  document.body.appendChild(colorMenu);
  
  const menuRect = colorMenu.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollX = window.pageXOffset || window.scrollX || 0;
  const scrollY = window.pageYOffset || window.scrollY || 0;
  let left = position.x;
  let top = position.y;
  
  if (left + menuRect.width > scrollX + viewportWidth) {
    left = Math.max(scrollX + 8, scrollX + viewportWidth - menuRect.width - 8);
  }
  if (top + menuRect.height > scrollY + viewportHeight) {
    top = Math.max(scrollY + 8, scrollY + viewportHeight - menuRect.height - 8);
  }
  
  colorMenu.style.left = `${left}px`;
  colorMenu.style.top = `${top}px`;
  
  // Set initial selection highlight
  updateColorMenuSelection();
  
  // Add keyboard event listener
  document.addEventListener('keydown', handleColorMenuKeydown);
  
  setTimeout(() => document.addEventListener('click', handleColorMenuOutside, true), 0);
  
  // Focus the menu to receive keyboard events
  colorMenu.focus();
}

function applyColorChoice(colorId) {
  if (!colorMenuContext) {
    closeColorMenu();
    return;
  }
  const { content, item } = colorMenuContext;
  if (!restoreSelectionForContent(content)) {
    closeColorMenu();
    return;
  }
  if (applyColorToSelection(content, colorId)) {
    commitFormattingChange(content, item);
  }
  closeColorMenu();
}

// Calculate days until deadline
function calculateDeadlineDays(deadlineStr) {
  if (!deadlineStr) return null;
  
  try {
    const deadline = new Date(deadlineStr);
    const today = new Date();
    
    // Reset time to midnight for accurate day comparison
    deadline.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    
    const diffTime = deadline - today;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (err) {
    console.error('Failed to calculate deadline:', err);
    return null;
  }
}

// Get deadline display text and color
function getDeadlineDisplay(deadlineStr) {
  const days = calculateDeadlineDays(deadlineStr);
  if (days === null) return null;
  
  let text, textColor, backgroundColor, tooltip;
  // Tooltip: always show deadline as YYYY/MM/DD
  let tooltipDate = '';
  if (deadlineStr) {
    // Accepts YYYY-MM-DD or YYYYMMDD
    let y, m, d;
    if (/^\d{8}$/.test(deadlineStr)) {
      y = deadlineStr.slice(0,4);
      m = deadlineStr.slice(4,6);
      d = deadlineStr.slice(6,8);
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(deadlineStr)) {
      [y, m, d] = deadlineStr.split('-');
    }
    if (y && m && d) {
      tooltipDate = `${y}/${m}/${d}`;
    } else {
      tooltipDate = deadlineStr;
    }
  }
  tooltip = tooltipDate;

  if (days < 0) {
    // After deadline: +Xd, purple
    text = `+${Math.abs(days)}d`;
    textColor = '#ff8c00ff';
    backgroundColor = '#a705a7ff';
  } else if (days === 0 || days === 1) {
    // -0d or -1d: red
    text = `-${days}d`;
    textColor = '#000000';
    backgroundColor = '#FF0000';
  } else if (days >= 2 && days <= 7) {
    // -2d to -7d: yellow
    text = `-${days}d`;
    textColor = '#000000';
    backgroundColor = '#ffea00ff';
  } else {
    // More than 7 days before: white
    text = `-${days}d`;
    textColor = '#000000';
    backgroundColor = '#00e1ffff';
  }
  return { text, textColor, backgroundColor, tooltip };
}

// Set deadline for an item
function setDeadline(item, deadlineStr) {
  if (!item) return;
  
  captureStateForUndo('deadline', { itemId: item.id, oldDeadline: item.deadline });
  
  item.deadline = deadlineStr;
  updateItem(item.id, { deadline: deadlineStr }, undefined, { skipReload: true });
  
  // Re-render to show deadline indicator
  render();
}

// Prompt for deadline
function promptForDeadline(item) {
  if (!item) return;
  
  // Calculate default deadline: 7 days from now
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 7);
  const defaultYear = defaultDate.getFullYear();
  const defaultMonth = String(defaultDate.getMonth() + 1).padStart(2, '0');
  const defaultDay = String(defaultDate.getDate()).padStart(2, '0');
  const defaultDeadline = `${defaultYear}${defaultMonth}${defaultDay}`;
  
  // Convert existing deadline from YYYY-MM-DD to YYYYMMDD format if needed
  let currentDeadlineFormatted = item.deadline;
  if (currentDeadlineFormatted && currentDeadlineFormatted.includes('-')) {
    currentDeadlineFormatted = currentDeadlineFormatted.replace(/-/g, '');
  }
  
  // Create a date picker dialog using <input type="date">
  const overlay = document.createElement('div');
  overlay.className = 'preset-settings-overlay deadline-dialog-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100vw';
  overlay.style.height = '100vh';
  overlay.style.background = 'rgba(0,0,0,0.18)';
  overlay.style.zIndex = '9999';

  const dialog = document.createElement('div');
  dialog.className = 'preset-settings-dialog deadline-dialog';
  dialog.style.background = '#fff';
  dialog.style.borderRadius = '12px';
  dialog.style.boxShadow = '0 4px 24px rgba(0,0,0,0.22)';
  dialog.style.padding = '10px 10px 8px 10px';
  dialog.style.maxWidth = '260px';
  dialog.style.margin = '40px auto';
  dialog.style.position = 'relative';
  dialog.style.display = 'flex';
  dialog.style.flexDirection = 'column';
  dialog.style.gap = '6px';

  const header = document.createElement('div');
  header.className = 'preset-settings-header deadline-dialog-header';
  header.innerHTML = '<h2 style="margin:0;font-size:1em;font-weight:bold;">納期設定</h2>';
  dialog.appendChild(header);

  const input = document.createElement('input');
  input.type = 'date';
  input.className = 'deadline-dialog-date-input';
  input.style.fontSize = '15px';
  input.style.padding = '4px 8px';
  input.style.width = '100%';
  input.style.border = '1px solid #bbb';
  input.style.borderRadius = '6px';
  input.style.marginBottom = '0';
  input.style.background = '#f8f8fa';
  input.style.boxSizing = 'border-box';
  // Set default value
  let defaultValue = '';
  if (item.deadline) {
    if (/^\d{8}$/.test(currentDeadlineFormatted)) {
      defaultValue = `${currentDeadlineFormatted.slice(0,4)}-${currentDeadlineFormatted.slice(4,6)}-${currentDeadlineFormatted.slice(6,8)}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(currentDeadlineFormatted)) {
      defaultValue = currentDeadlineFormatted;
    }
  } else {
    defaultValue = `${defaultYear}-${defaultMonth}-${defaultDay}`;
  }
  input.value = defaultValue;
  input.min = '2000-01-01';
  input.max = '2099-12-31';
  dialog.appendChild(input);

  const error = document.createElement('div');
  error.className = 'deadline-dialog-error';
  error.style.color = '#d00';
  error.style.fontSize = '13px';
  error.style.margin = '6px 0 0 0';
  dialog.appendChild(error);

  const actions = document.createElement('div');
  actions.className = 'preset-settings-actions deadline-dialog-actions';
  actions.style.display = 'flex';
  actions.style.justifyContent = 'space-between';
  actions.style.gap = '6px';

  // 左側: クリアボタン
  const leftActions = document.createElement('div');
  leftActions.style.display = 'flex';
  leftActions.style.justifyContent = 'flex-start';
  leftActions.style.gap = '6px';

  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'クリア';
  clearBtn.type = 'button';
  clearBtn.className = 'preset-settings-btn deadline-dialog-btn-clear';
  clearBtn.style.fontSize = '13px';
  clearBtn.style.padding = '3px 10px';
  clearBtn.style.borderRadius = '4px';
  clearBtn.style.minWidth = 'auto';
  clearBtn.onclick = () => {
    setDeadline(item, null);
    overlay.remove();
  };
  leftActions.appendChild(clearBtn);

  // 右側: OKとキャンセル
  const rightActions = document.createElement('div');
  rightActions.style.display = 'flex';
  rightActions.style.justifyContent = 'flex-end';
  rightActions.style.gap = '6px';

  const okBtn = document.createElement('button');
  okBtn.textContent = 'OK';
  okBtn.type = 'button';
  okBtn.className = 'preset-settings-btn deadline-dialog-btn-ok';
  okBtn.style.fontWeight = 'bold';
  okBtn.style.fontSize = '13px';
  okBtn.style.padding = '3px 10px';
  okBtn.style.borderRadius = '4px';
  okBtn.style.minWidth = 'auto';
  okBtn.onclick = () => {
    if (!input.value) {
      setDeadline(item, null);
      overlay.remove();
      return;
    }
    // Validate date format YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.value)) {
      error.textContent = '有効な日付を選択してください。';
      return;
    }
    setDeadline(item, input.value);
    overlay.remove();
  };
  rightActions.appendChild(okBtn);

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'キャンセル';
  cancelBtn.type = 'button';
  cancelBtn.className = 'preset-settings-btn deadline-dialog-btn-cancel';
  cancelBtn.style.fontSize = '13px';
  cancelBtn.style.padding = '3px 10px';
  cancelBtn.style.borderRadius = '4px';
  cancelBtn.style.minWidth = 'auto';
  cancelBtn.onclick = () => {
    overlay.remove();
  };
  rightActions.appendChild(cancelBtn);

  actions.appendChild(leftActions);
  actions.appendChild(rightActions);
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  input.focus();
}

// Handle context menu for decoration presets and hyperlinks
function handleContextMenu(e, content, item) {
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';
  const anchorTarget = findAnchorFromEventTarget(e.target);
  const hasAnchorTarget = !!anchorTarget;
  
  // Show context menu for text selection (hyperlink) or existing hyperlink
  if (!selectedText && !hasAnchorTarget) {
    // No selection and no hyperlink - show decoration preset menu
    e.preventDefault();
    showDecorationPresetsMenu(e, item);
    return;
  }
  
  e.preventDefault();
  
  if (selectedText && selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (content.contains(range.commonAncestorContainer)) {
      saveSelectionSnapshot(selection, content);
    } else {
      savedSelection = null;
    }
  } else {
    savedSelection = null;
  }
  
  if (contextMenu) {
    contextMenu.remove();
  }
  contextMenu = null;
  
  const menuItems = [];
  if (selectedText) {
    menuItems.push({
      label: 'ハイパーリンクを追加',
      shortcut: 'Ctrl+K',
      action: () => {
        removeContextMenu();
        if (!restoreSelectionForContent(content)) return;
        promptForHyperlink(content, item);
      }
    });
  }
  if (hasAnchorTarget) {
    menuItems.push({
      label: 'ハイパーリンクを削除',
      action: () => {
        removeContextMenu();
        removeHyperlink(anchorTarget, content, item);
      }
    });
  }
  
  if (menuItems.length === 0) {
    contextMenu = null;
    return;
  }
  
  contextMenu = document.createElement('div');
  contextMenu.className = 'hyperlink-context-menu';
  
  menuItems.forEach(({label, shortcut, action}) => {
    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'context-menu-item-label';
    labelSpan.textContent = label;
    menuItem.appendChild(labelSpan);
    
    if (shortcut) {
      const shortcutSpan = document.createElement('span');
      shortcutSpan.className = 'context-menu-shortcut';
      shortcutSpan.textContent = shortcut;
      menuItem.appendChild(shortcutSpan);
    }
    
    menuItem.addEventListener('click', () => {
      action();
    });
    contextMenu.appendChild(menuItem);
  });
  
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;
  
  document.body.appendChild(contextMenu);
  
  function removeContextMenu() {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
    }
    closeColorMenu();
    document.removeEventListener('click', closeMenu);
  }
  
  const closeMenu = (event) => {
    if (contextMenu && !contextMenu.contains(event.target)) {
      removeContextMenu();
      closeColorMenu();
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Show decoration presets menu
function showDecorationPresetsMenu(e, item) {
  if (contextMenu) {
    contextMenu.remove();
  }
  contextMenu = null;
  
  contextMenu = document.createElement('div');
  contextMenu.className = 'hyperlink-context-menu decoration-preset-menu';
  
  // Add "None" option to remove decoration
  const noneItem = document.createElement('div');
  noneItem.className = 'context-menu-item';
  if (!item.decoration) {
    noneItem.classList.add('selected');
  }
  
  const noneLabel = document.createElement('span');
  noneLabel.className = 'context-menu-item-label';
  noneLabel.textContent = '装飾なし';
  noneItem.appendChild(noneLabel);
  
  const noneShortcut = document.createElement('span');
  noneShortcut.className = 'context-menu-shortcut';
  noneShortcut.textContent = 'Ctrl+0';
  noneItem.appendChild(noneShortcut);
  
  noneItem.addEventListener('click', () => {
    applyDecorationPreset(item, null);
    removeContextMenu();
  });
  contextMenu.appendChild(noneItem);
  
  // Add preset options
  decorationPresets.forEach(preset => {
    const menuItem = document.createElement('div');
    menuItem.className = 'context-menu-item decoration-preset-item';
    
    const isSelected = item.decoration && item.decoration.presetId === preset.id;
    if (isSelected) {
      menuItem.classList.add('selected');
    }
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'context-menu-item-label';
    labelSpan.textContent = preset.name;
    
    // Apply decoration styles to label for preview
    if (preset.bold) labelSpan.style.fontWeight = 'bold';
    if (preset.italic) labelSpan.style.fontStyle = 'italic';
    if (preset.underline) labelSpan.style.textDecoration = 'underline';
    if (preset.color) labelSpan.style.color = preset.color;
    
    menuItem.appendChild(labelSpan);
    
    if (preset.shortcut) {
      const shortcutSpan = document.createElement('span');
      shortcutSpan.className = 'context-menu-shortcut';
      shortcutSpan.textContent = `Ctrl+${preset.shortcut}`;
      menuItem.appendChild(shortcutSpan);
    }
    
    menuItem.addEventListener('click', () => {
      applyDecorationPreset(item, preset.id);
      removeContextMenu();
    });
    contextMenu.appendChild(menuItem);
  });
  
  // Add settings button
  const settingsItem = document.createElement('div');
  settingsItem.className = 'context-menu-item';
  
  const settingsLabel = document.createElement('span');
  settingsLabel.className = 'context-menu-item-label';
  settingsLabel.textContent = '装飾設定...';
  settingsItem.appendChild(settingsLabel);
  
  settingsItem.addEventListener('click', () => {
    removeContextMenu();
    openPresetSettings();
  });
  contextMenu.appendChild(settingsItem);
  
  // Add separator before deadline
  const separator = document.createElement('div');
  separator.className = 'context-menu-inline-separator';
  contextMenu.appendChild(separator);
  
  // Add deadline menu item
  const deadlineItem = document.createElement('div');
  deadlineItem.className = 'context-menu-item';
  
  const deadlineLabel = document.createElement('span');
  deadlineLabel.className = 'context-menu-item-label';
  deadlineLabel.textContent = '納期設定...';
  deadlineItem.appendChild(deadlineLabel);
  
  const deadlineShortcut = document.createElement('span');
  deadlineShortcut.className = 'context-menu-shortcut';
  deadlineShortcut.textContent = 'Ctrl+D';
  deadlineItem.appendChild(deadlineShortcut);
  
  deadlineItem.addEventListener('click', () => {
    removeContextMenu();
    promptForDeadline(item);
  });
  contextMenu.appendChild(deadlineItem);

  const formatSeparator = document.createElement('div');
  formatSeparator.className = 'context-menu-inline-separator';
  contextMenu.appendChild(formatSeparator);

  if (FORMAT_MENU_OPTIONS.length > 0) {
    const formattingItem = document.createElement('div');
    formattingItem.className = 'context-menu-item has-submenu formatting-menu-item';
  
    const formattingLabel = document.createElement('span');
    formattingLabel.className = 'context-menu-item-label';
    formattingLabel.textContent = '書式設定';
    formattingItem.appendChild(formattingLabel);
  
    const arrow = document.createElement('span');
    arrow.className = 'context-submenu-arrow';
    arrow.textContent = '›';
    formattingItem.appendChild(arrow);
  
    const submenu = document.createElement('div');
    submenu.className = 'context-submenu';
  
    FORMAT_MENU_OPTIONS.forEach(option => {
      const submenuItem = document.createElement('div');
      submenuItem.className = 'context-submenu-item';
  
      const label = document.createElement('span');
      label.className = 'context-menu-item-label';
      label.textContent = option.label;
      submenuItem.appendChild(label);
  
      const shortcut = document.createElement('span');
      shortcut.className = 'context-menu-shortcut';
      shortcut.textContent = option.command;
      submenuItem.appendChild(shortcut);
  
      submenuItem.addEventListener('click', (event) => {
        event.stopPropagation();
        const shouldClear = option.type === 'hr';
        convertItemFormat(item, option.type, { clearText: shouldClear });
        removeContextMenu();
      });
  
      submenu.appendChild(submenuItem);
    });
  
    formattingItem.appendChild(submenu);
    contextMenu.appendChild(formattingItem);
  }
  
  contextMenu.style.left = `${e.pageX}px`;
  contextMenu.style.top = `${e.pageY}px`;
  
  document.body.appendChild(contextMenu);
  
  function removeContextMenu() {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
    }
    document.removeEventListener('click', closeMenu);
  }
  
  const closeMenu = (event) => {
    if (contextMenu && !contextMenu.contains(event.target)) {
      removeContextMenu();
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Open preset settings dialog
function openPresetSettings() {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'preset-settings-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '装飾プリセット設定');
  
  // Create dialog
  const dialog = document.createElement('div');
  dialog.className = 'preset-settings-dialog';
  
  // Header
  const header = document.createElement('div');
  header.className = 'preset-settings-header';
  header.innerHTML = '<h2>装飾設定</h2>';
  dialog.appendChild(header);
  
  // Preset list
  const listContainer = document.createElement('div');
  listContainer.className = 'preset-settings-list';
  
  decorationPresets.forEach((preset, index) => {
    const presetItem = createPresetItem(preset, index);
    listContainer.appendChild(presetItem);
  });
  
  dialog.appendChild(listContainer);
  
  // Buttons
  const actions = document.createElement('div');
  actions.className = 'preset-settings-actions';
  
  const addBtn = document.createElement('button');
  addBtn.textContent = '+';
  addBtn.className = 'preset-settings-btn preset-settings-btn-add';
  addBtn.setAttribute('title', '新しいプリセットを追加');
  addBtn.addEventListener('click', () => {
    addNewPreset(listContainer);
  });
  actions.appendChild(addBtn);
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '閉じる';
  closeBtn.className = 'preset-settings-btn preset-settings-btn-close';
  closeBtn.addEventListener('click', () => {
    overlay.remove();
  });
  actions.appendChild(closeBtn);
  
  dialog.appendChild(actions);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  
  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

function createPresetItem(preset, index) {
  const item = document.createElement('div');
  item.className = 'preset-settings-item';
  
  // Name input
  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = preset.name;
  nameInput.className = 'preset-settings-input preset-name-input';
  nameInput.placeholder = '装飾名..';
  nameInput.addEventListener('change', () => {
    preset.name = nameInput.value;
    savePresets();
    render();
  });
  item.appendChild(nameInput);
  
  // Style checkboxes
  const styleContainer = document.createElement('div');
  styleContainer.className = 'preset-style-options';
  
  const boldCheck = createCheckbox('太字', preset.bold, (checked) => {
    preset.bold = checked;
    savePresets();
    render();
  });
  styleContainer.appendChild(boldCheck);
  
  const italicCheck = createCheckbox('斜体', preset.italic, (checked) => {
    preset.italic = checked;
    savePresets();
    render();
  });
  styleContainer.appendChild(italicCheck);
  
 /*  const underlineCheck = createCheckbox('下線', preset.underline, (checked) => {
    preset.underline = checked;
    savePresets();
    render();
  });
  styleContainer.appendChild(underlineCheck); */
  
  item.appendChild(styleContainer);
  
  // Color palette selector
  const colorPalette = document.createElement('div');
  colorPalette.className = 'preset-color-palette';
  
  const commonColors = ['#FF0000', '#FF6600', '#FFCC00', '#00FF00', '#0066FF', '#6600FF', '#FF00FF', '#000000', '#666666', '#CCCCCC'];
  
  commonColors.forEach(color => {
    const colorBtn = document.createElement('button');
    colorBtn.type = 'button';
    colorBtn.className = 'preset-color-btn';
    colorBtn.style.backgroundColor = color;
    colorBtn.setAttribute('title', color);
    if (preset.color === color) {
      colorBtn.classList.add('selected');
    }
    colorBtn.addEventListener('click', () => {
      preset.color = color;
      savePresets();
      render();
      // Update selection
      colorPalette.querySelectorAll('.preset-color-btn').forEach(btn => btn.classList.remove('selected'));
      colorBtn.classList.add('selected');
    });
    colorPalette.appendChild(colorBtn);
  });
  
  item.appendChild(colorPalette);
  
  // Shortcut input with Ctrl+ prefix
  const shortcutContainer = document.createElement('div');
  shortcutContainer.className = 'preset-shortcut-container';
  
  const shortcutPrefix = document.createElement('span');
  shortcutPrefix.className = 'preset-shortcut-prefix';
  shortcutPrefix.textContent = 'Ctrl+';
  shortcutContainer.appendChild(shortcutPrefix);
  
  const shortcutInput = document.createElement('input');
  shortcutInput.type = 'text';
  shortcutInput.value = preset.shortcut || '';
  shortcutInput.className = 'preset-settings-input preset-shortcut-input';
  shortcutInput.placeholder = '';
  shortcutInput.maxLength = 1;
  shortcutInput.addEventListener('change', () => {
    preset.shortcut = shortcutInput.value.toUpperCase();
    savePresets();
  });
  shortcutContainer.appendChild(shortcutInput);
  
  item.appendChild(shortcutContainer);
  
  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.textContent = '削除';
  deleteBtn.className = 'preset-settings-btn preset-settings-btn-delete';
  deleteBtn.addEventListener('click', () => {
    if (confirm(`プリセット「${preset.name}」を削除しますか？`)) {
      decorationPresets.splice(index, 1);
      savePresets();
      render();
      item.remove();
    }
  });
  item.appendChild(deleteBtn);
  
  return item;
}

function createCheckbox(label, checked, onChange) {
  const container = document.createElement('label');
  container.className = 'preset-checkbox-label';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = checked;
  checkbox.addEventListener('change', () => onChange(checkbox.checked));
  
  container.appendChild(checkbox);
  container.appendChild(document.createTextNode(label));
  
  return container;
}

function addNewPreset(listContainer) {
  const newPreset = {
    id: 'preset_' + Date.now(),
    name: '',
    bold: false,
    italic: false,
    underline: false,
    color: '#000000',
    shortcut: ''
  };
  decorationPresets.push(newPreset);
  savePresets();
  
  const presetItem = createPresetItem(newPreset, decorationPresets.length - 1);
  listContainer.appendChild(presetItem);
}

// Validate URL to prevent XSS attacks
function isValidUrl(url) {
  if (!url) return false;
  
  const trimmed = url.trim();
  if (isLocalFilePath(trimmed)) {
    return true;
  }
  
  try {
    const parsed = new URL(trimmed);
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalFilePath(url) {
  if (!url) return false;
  const trimmed = url.trim();
  const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
  return /^[a-zA-Z]:[\\/]/.test(withoutProtocol) || /^\\\\/.test(withoutProtocol);
}

function extractLocalFilePath(url) {
  if (!url) return '';
  if (!isLocalFilePath(url)) return '';
  const trimmed = url.trim();
  return trimmed.replace(/^https?:\/\//i, '');
}

function decorateAnchor(anchor, originalHref) {
  if (!anchor || !originalHref) return;
  
  const trimmedHref = originalHref.trim();
  anchor.setAttribute('data-original-href', trimmedHref);
  
  if (isLocalFilePath(trimmedHref)) {
    const localPath = extractLocalFilePath(trimmedHref);
    anchor.setAttribute('data-link-type', 'local-file');
    if (localPath) {
      anchor.setAttribute('data-local-path', localPath);
    } else {
      anchor.removeAttribute('data-local-path');
    }
    anchor.removeAttribute('target');
    anchor.removeAttribute('rel');
  } else {
    anchor.setAttribute('data-link-type', 'web');
    anchor.removeAttribute('data-local-path');
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
  }
}

async function copyPathToClipboard(path) {
  if (!path) return false;
  
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(path);
      return true;
    } catch (err) {
      console.error('Standard clipboard write failed, falling back:', err);
    }
  }
  
  return fallbackCopyToClipboard(path);
}

function fallbackCopyToClipboard(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    copied = false;
  } finally {
    document.body.removeChild(textarea);
  }
  
  return copied;
}

function isTextNodeWithinAnchor(node) {
  if (!node) return false;
  const parent = node.parentElement;
  if (!parent) return false;
  return parent.closest('a') !== null;
}

function splitLinkTextAndTrailingPunctuation(text) {
  if (!text) return { linkText: text, trailing: '' };
  let linkText = text;
  let trailing = '';
  while (linkText.length > 0 && /[).,;!?]$/.test(linkText)) {
    trailing = linkText.slice(-1) + trailing;
    linkText = linkText.slice(0, -1);
  }
  if (linkText.length === 0) {
    return { linkText: text, trailing: '' };
  }
  return { linkText, trailing };
}

function autoLinkContent(root) {
  if (!root || (root.dataset && root.dataset.disableAutoLink === 'true')) return;
  
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  const textNodes = [];
  let current;
  while ((current = walker.nextNode()) !== null) {
    if (!current.nodeValue || !current.nodeValue.trim()) continue;
    if (isTextNodeWithinAnchor(current)) continue;
    textNodes.push(current);
  }
  
  textNodes.forEach(node => {
    const text = node.nodeValue;
    LINK_DETECTION_REGEX.lastIndex = 0;
    let match;
    let lastIndex = 0;
    let hasMatch = false;
    const fragment = document.createDocumentFragment();
    
    while ((match = LINK_DETECTION_REGEX.exec(text)) !== null) {
      const matchedText = match[0];
      const matchIndex = match.index;
      
      if (matchIndex > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, matchIndex)));
      }
      
      const { linkText, trailing } = splitLinkTextAndTrailingPunctuation(matchedText);
      if (!linkText) {
        fragment.appendChild(document.createTextNode(matchedText));
        lastIndex = matchIndex + matchedText.length;
        continue;
      }
      
      if (!isValidUrl(linkText)) {
        fragment.appendChild(document.createTextNode(matchedText));
        lastIndex = matchIndex + matchedText.length;
        continue;
      }
      
      const anchor = document.createElement('a');
      anchor.textContent = linkText;
      anchor.setAttribute('href', linkText);
      decorateAnchor(anchor, linkText);
      fragment.appendChild(anchor);
      
      if (trailing) {
        fragment.appendChild(document.createTextNode(trailing));
      }
      
      lastIndex = matchIndex + matchedText.length;
      hasMatch = true;
    }
    
    if (!hasMatch) return;
    
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    
    node.replaceWith(fragment);
  });
}

function linkifyPlainText(text) {
  if (!text) return text;
  if (!LINK_DETECTION_REGEX.test(text)) {
    LINK_DETECTION_REGEX.lastIndex = 0;
    return text;
  }
  LINK_DETECTION_REGEX.lastIndex = 0;
  const temp = document.createElement('div');
  temp.textContent = text;
  autoLinkContent(temp);
  return sanitizeHtml(temp.innerHTML);
}

function prepareTextForStorage(text) {
  if (typeof text !== 'string' || text === '') {
    return typeof text === 'string' ? text : '';
  }
  if (text.includes('<')) {
    return text;
  }
  return linkifyPlainText(text);
}

async function openWebLink(url) {
  if (!url) return;
  try {
    const params = new URLSearchParams({ url });
    const response = await fetch(addUIDToURL('api.php?action=open_link'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: params
    });
    if (!response.ok) {
      throw new Error(`Network response was not ok (status ${response.status})`);
    }
    const data = await response.json().catch(() => ({}));
    if (!data.success) {
      throw new Error(data.error || 'open_link_failed');
    }
  } catch (err) {
    console.error('Failed to open link via OS default browser, falling back to window.open:', err);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

let toastContainer = null;
let toastStylesInjected = false;

function injectToastStyles() {
  if (toastStylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
.toast-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 9999;
}
.toast {
  min-width: clamp(160px, calc(100vw - 48px), 240px);
  max-width: clamp(160px, calc(100vw - 48px), 360px);
  padding: 12px 16px;
  background: rgba(34, 34, 34, 0.9);
  color: #fff;
  font-size: 12px;
  border-radius: 6px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transform: translateY(10px);
  transition: opacity 150ms ease, transform 150ms ease;
  word-break: break-all;
  overflow-wrap: anywhere;
}
.toast.toast-error {
  background: rgba(220, 38, 38, 0.9);
}
.toast.visible {
  opacity: 1;
  transform: translateY(0);
}
`;
  document.head.appendChild(style);
  toastStylesInjected = true;
}

function showToast(message, type = 'info', duration = 3000) {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  
  injectToastStyles();
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });
  
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      toast.remove();
      if (toastContainer && toastContainer.childElementCount === 0) {
        toastContainer.remove();
        toastContainer = null;
      }
    }, 200);
  }, duration);
}

let linkTooltip = null;
let linkTooltipStylesInjected = false;
let currentTooltipAnchor = null;

function getAnchorOriginalHref(anchor) {
  if (!anchor) return '';
  return anchor.getAttribute('data-original-href') || anchor.getAttribute('href') || '';
}

function injectLinkTooltipStyles() {
  if (linkTooltipStylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
.link-tooltip {
  position: fixed;
  padding: 4px 8px;
  background: rgba(34, 34, 34, 0.9);
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  transition: opacity 120ms ease;
  max-width: 360px;
  word-break: break-all;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}
.link-tooltip.visible {
  opacity: 1;
}
`;
  document.head.appendChild(style);
  linkTooltipStylesInjected = true;
}

function ensureLinkTooltip() {
  if (linkTooltip) return linkTooltip;
  injectLinkTooltipStyles();
  linkTooltip = document.createElement('div');
  linkTooltip.className = 'link-tooltip';
  document.body.appendChild(linkTooltip);
  return linkTooltip;
}

function showLinkTooltipForAnchor(anchor) {
  if (!anchor) return;
  const tooltip = ensureLinkTooltip();
  const originalHref = getAnchorOriginalHref(anchor).trim();
  if (!originalHref) {
    hideLinkTooltip();
    return;
  }
  
  const displayHref = isLocalFilePath(originalHref)
    ? (anchor.getAttribute('data-local-path') || extractLocalFilePath(originalHref))
    : originalHref;
  
  if (!displayHref) {
    hideLinkTooltip();
    return;
  }
  
  currentTooltipAnchor = anchor;
  tooltip.classList.remove('visible');
  tooltip.textContent = displayHref;
  
  // Measure tooltip to position it within viewport
  tooltip.style.left = '0px';
  tooltip.style.top = '0px';
  const rect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 8;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  
  let left = rect.left + window.scrollX;
  if (left + tooltipRect.width + margin > window.scrollX + viewportWidth) {
    left = window.scrollX + viewportWidth - tooltipRect.width - margin;
  }
  if (left < window.scrollX + margin) {
    left = window.scrollX + margin;
  }
  const top = rect.bottom + window.scrollY + margin;
  
  tooltip.style.left = `${Math.max(left, margin)}px`;
  tooltip.style.top = `${top}px`;
  
  requestAnimationFrame(() => {
    if (currentTooltipAnchor === anchor) {
      tooltip.classList.add('visible');
    }
  });
}

function hideLinkTooltip() {
  currentTooltipAnchor = null;
  if (linkTooltip) {
    linkTooltip.classList.remove('visible');
  }
}

function findAnchorFromEventTarget(target) {
  if (!target) return null;
  if (target.nodeType === Node.TEXT_NODE) {
    target = target.parentElement;
  }
  return target ? target.closest('a') : null;
}

window.addEventListener('scroll', hideLinkTooltip, true);
window.addEventListener('blur', hideLinkTooltip);

let hyperlinkDialogElements = null;
let hyperlinkDialogStylesInjected = false;
let hyperlinkDialogState = null;
let hyperlinkDialogPreviousActiveElement = null;

let deadlineDialogElements = null;
let deadlineDialogStylesInjected = false;
let deadlineDialogState = null;
let deadlineDialogPreviousActiveElement = null;

function injectHyperlinkDialogStyles() {
  if (hyperlinkDialogStylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
.hyperlink-dialog-overlay {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.35);
  z-index: 10001;
  overflow: auto;
}
.hyperlink-dialog-overlay.visible {
  display: flex;
}
.hyperlink-dialog {
  width: min(400px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: #fff;
  color: #222;
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  padding: 20px;
  font-size: 14px;
}
.hyperlink-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hyperlink-dialog-label {
  font-size: 14px;
  font-weight: 600;
}
.hyperlink-dialog-input {
  width: 100%;
  padding: 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.hyperlink-dialog-input::placeholder {
  font-size: 12px;
}
.hyperlink-dialog-input:focus {
  border-color: #4aa3ff;
  outline: none;
  box-shadow: 0 0 0 2px rgba(74, 163, 255, 0.2);
}
.hyperlink-dialog-error {
  min-height: 16px;
  font-size: 12px;
  color: #dc2626;
}
.hyperlink-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.hyperlink-dialog-actions button {
  min-width: 72px;
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}
.hyperlink-dialog-cancel {
  background: #f2f2f2;
  color: #333;
}
.hyperlink-dialog-cancel:hover {
  background: #e5e5e5;
}
.hyperlink-dialog-submit {
  background: #4aa3ff;
  color: #fff;
}
.hyperlink-dialog-submit:hover {
  background: #2589f5;
}
`;
  document.head.appendChild(style);
  hyperlinkDialogStylesInjected = true;
}

function ensureHyperlinkDialog() {
  if (hyperlinkDialogElements) return hyperlinkDialogElements;
  injectHyperlinkDialogStyles();
  
  const overlay = document.createElement('div');
  overlay.className = 'hyperlink-dialog-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="hyperlink-dialog" role="dialog" aria-modal="true" aria-label="リンク先の入力">
      <form class="hyperlink-dialog-form">
        <label class="hyperlink-dialog-label" for="hyperlink-dialog-input">リンク先</label>
        <input id="hyperlink-dialog-input" class="hyperlink-dialog-input" type="text" autocomplete="off" spellcheck="false" />
        <div class="hyperlink-dialog-error" aria-live="polite"></div>
        <div class="hyperlink-dialog-actions">
          <button type="button" class="hyperlink-dialog-cancel">キャンセル</button>
          <button type="submit" class="hyperlink-dialog-submit">追加</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const dialog = overlay.querySelector('.hyperlink-dialog');
  const form = overlay.querySelector('.hyperlink-dialog-form');
  const input = overlay.querySelector('.hyperlink-dialog-input');
  const error = overlay.querySelector('.hyperlink-dialog-error');
  const cancelButton = overlay.querySelector('.hyperlink-dialog-cancel');
  
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!hyperlinkDialogState || typeof hyperlinkDialogState.onSubmit !== 'function') {
      closeHyperlinkDialog('submit');
      return;
    }
    
    const value = input.value || '';
    const helpers = {
      setError: (message) => {
        error.textContent = message || '';
      },
      close: () => closeHyperlinkDialog('submit')
    };
    
    try {
      const result = hyperlinkDialogState.onSubmit(value, helpers);
      if (result && typeof result.then === 'function') {
        result.then((shouldClose) => {
          if (shouldClose !== false) {
            closeHyperlinkDialog('submit');
          }
        }).catch(err => {
          console.error('Hyperlink dialog submit failed:', err);
        });
      } else if (result !== false) {
        closeHyperlinkDialog('submit');
      }
    } catch (err) {
      console.error('Hyperlink dialog submit threw an error:', err);
      closeHyperlinkDialog('submit');
    }
  });
  
  cancelButton.addEventListener('click', () => {
    if (hyperlinkDialogState && typeof hyperlinkDialogState.onCancel === 'function') {
      hyperlinkDialogState.onCancel();
    }
    closeHyperlinkDialog('cancel');
  });
  
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      if (hyperlinkDialogState && typeof hyperlinkDialogState.onCancel === 'function') {
        hyperlinkDialogState.onCancel();
      }
      closeHyperlinkDialog('cancel');
    }
  });
  
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (hyperlinkDialogState && typeof hyperlinkDialogState.onCancel === 'function') {
        hyperlinkDialogState.onCancel();
      }
      closeHyperlinkDialog('cancel');
    }
  });
  
  hyperlinkDialogElements = { overlay, dialog, form, input, error, cancelButton };
  return hyperlinkDialogElements;
}

function openHyperlinkDialog(options = {}) {
  const elements = ensureHyperlinkDialog();
  const { overlay, input, error } = elements;
  
  hyperlinkDialogState = {
    onSubmit: typeof options.onSubmit === 'function' ? options.onSubmit : null,
    onCancel: typeof options.onCancel === 'function' ? options.onCancel : null
  };
  
  hyperlinkDialogPreviousActiveElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  
  const placeholder = options.placeholder || '例: https://example.com または C:\\path\\file.txt';
  input.setAttribute('placeholder', placeholder);
  input.value = options.defaultValue || '';
  error.textContent = '';
  
  overlay.classList.add('visible');
  overlay.setAttribute('aria-hidden', 'false');
  
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });
}

function closeHyperlinkDialog() {
  if (!hyperlinkDialogElements) return;
  const { overlay, error, input } = hyperlinkDialogElements;
  
  overlay.classList.remove('visible');
  overlay.setAttribute('aria-hidden', 'true');
  error.textContent = '';
  input.value = '';
  
  hyperlinkDialogState = null;
  
  if (hyperlinkDialogPreviousActiveElement && typeof hyperlinkDialogPreviousActiveElement.focus === 'function') {
    hyperlinkDialogPreviousActiveElement.focus();
  }
  hyperlinkDialogPreviousActiveElement = null;
}

// Deadline dialog functions
function injectDeadlineDialogStyles() {
  if (deadlineDialogStylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
.deadline-dialog-overlay {
  position: fixed;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(0, 0, 0, 0.35);
  z-index: 10001;
  overflow: auto;
}
.deadline-dialog-overlay.visible {
  display: flex;
}
.deadline-dialog {
  width: min(400px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  overflow-y: auto;
  background: #fff;
  color: #222;
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  padding: 20px;
  font-size: 14px;
}
.deadline-dialog-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.deadline-dialog-label {
  font-size: 14px;
  font-weight: 600;
}
.deadline-dialog-input {
  width: 100%;
  padding: 10px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-family: monospace;
}
.deadline-dialog-input::placeholder {
  color: #999;
  font-size: 13px;
}
.deadline-dialog-input:focus {
  border-color: #4aa3ff;
  outline: none;
  box-shadow: 0 0 0 2px rgba(74, 163, 255, 0.2);
}
.deadline-dialog-error {
  min-height: 16px;
  font-size: 12px;
  color: #dc2626;
}
.deadline-dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.deadline-dialog-actions button {
  min-width: 72px;
  padding: 6px 12px;
  font-size: 13px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
}
.deadline-dialog-clear {
  background: #f2f2f2;
  color: #333;
  margin-right: auto;
}
.deadline-dialog-clear:hover {
  background: #e5e5e5;
}
.deadline-dialog-cancel {
  background: #f2f2f2;
  color: #333;
}
.deadline-dialog-cancel:hover {
  background: #e5e5e5;
}
.deadline-dialog-submit {
  background: #4aa3ff;
  color: #fff;
}
.deadline-dialog-submit:hover {
  background: #2589f5;
}
`;
  document.head.appendChild(style);
  deadlineDialogStylesInjected = true;
}

function ensureDeadlineDialog() {
  if (deadlineDialogElements) return deadlineDialogElements;
  injectDeadlineDialogStyles();
  
  const overlay = document.createElement('div');
  overlay.className = 'deadline-dialog-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="deadline-dialog" role="dialog" aria-modal="true" aria-label="納期の設定">
      <form class="deadline-dialog-form">
        <label class="deadline-dialog-label" for="deadline-dialog-input">納期</label>
        <input id="deadline-dialog-input" class="deadline-dialog-input" type="text" placeholder="YYYYMMDD (例: 20251231)" />
        <div class="deadline-dialog-error" aria-live="polite"></div>
        <div class="deadline-dialog-actions">
          <button type="button" class="deadline-dialog-clear">クリア</button>
          <button type="button" class="deadline-dialog-cancel">キャンセル</button>
          <button type="submit" class="deadline-dialog-submit">設定</button>
        </div>
      </form>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  const dialog = overlay.querySelector('.deadline-dialog');
  const form = overlay.querySelector('.deadline-dialog-form');
  const input = overlay.querySelector('.deadline-dialog-input');
  const error = overlay.querySelector('.deadline-dialog-error');
  const clearButton = overlay.querySelector('.deadline-dialog-clear');
  const cancelButton = overlay.querySelector('.deadline-dialog-cancel');
  
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!deadlineDialogState || typeof deadlineDialogState.onSubmit !== 'function') {
      closeDeadlineDialog('submit');
      return;
    }
    
    const value = input.value || '';
    const helpers = {
      setError: (message) => {
        error.textContent = message || '';
      },
      close: () => closeDeadlineDialog('submit')
    };
    
    try {
      const result = deadlineDialogState.onSubmit(value, helpers);
      if (result && typeof result.then === 'function') {
        result.then((shouldClose) => {
          if (shouldClose !== false) {
            closeDeadlineDialog('submit');
          }
        }).catch(err => {
          console.error('Deadline dialog submit failed:', err);
        });
      } else if (result !== false) {
        closeDeadlineDialog('submit');
      }
    } catch (err) {
      console.error('Deadline dialog submit threw an error:', err);
      closeDeadlineDialog('submit');
    }
  });
  
  clearButton.addEventListener('click', () => {
    if (deadlineDialogState && typeof deadlineDialogState.onSubmit === 'function') {
      const helpers = {
        setError: () => {},
        close: () => closeDeadlineDialog('clear')
      };
      deadlineDialogState.onSubmit(null, helpers);
    }
    closeDeadlineDialog('clear');
  });
  
  cancelButton.addEventListener('click', () => {
    if (deadlineDialogState && typeof deadlineDialogState.onCancel === 'function') {
      deadlineDialogState.onCancel();
    }
    closeDeadlineDialog('cancel');
  });
  
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      if (deadlineDialogState && typeof deadlineDialogState.onCancel === 'function') {
        deadlineDialogState.onCancel();
      }
      closeDeadlineDialog('cancel');
    }
  });
  
  overlay.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (deadlineDialogState && typeof deadlineDialogState.onCancel === 'function') {
        deadlineDialogState.onCancel();
      }
      closeDeadlineDialog('cancel');
    }
  });
  
  deadlineDialogElements = { overlay, dialog, form, input, error, clearButton, cancelButton };
  return deadlineDialogElements;
}

function openDeadlineDialog(options = {}) {
  const elements = ensureDeadlineDialog();
  const { overlay, input, error } = elements;
  
  deadlineDialogState = {
    onSubmit: typeof options.onSubmit === 'function' ? options.onSubmit : null,
    onCancel: typeof options.onCancel === 'function' ? options.onCancel : null
  };
  
  deadlineDialogPreviousActiveElement = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  
  input.value = options.currentDeadline || '';
  error.textContent = '';
  
  overlay.classList.add('visible');
  overlay.setAttribute('aria-hidden', 'false');
  
  requestAnimationFrame(() => {
    input.focus();
  });
}

function closeDeadlineDialog() {
  if (!deadlineDialogElements) return;
  const { overlay, error, input } = deadlineDialogElements;
  
  overlay.classList.remove('visible');
  overlay.setAttribute('aria-hidden', 'true');
  error.textContent = '';
  input.value = '';
  
  deadlineDialogState = null;
  
  if (deadlineDialogPreviousActiveElement && typeof deadlineDialogPreviousActiveElement.focus === 'function') {
    deadlineDialogPreviousActiveElement.focus();
  }
  deadlineDialogPreviousActiveElement = null;
}

// Sanitize HTML to only allow anchor tags with safe attributes
function sanitizeContentInPlace(root) {
  if (!root) return '';

  // Remove old character-level formatting (bold, color spans)
  const boldElements = Array.from(root.querySelectorAll('b, strong'));
  boldElements.forEach(el => {
    unwrapElement(el);
  });

  const spanNodes = Array.from(root.querySelectorAll('span'));
  spanNodes.forEach(span => {
    unwrapElement(span);
  });

  // Sanitize anchors
  const anchors = Array.from(root.querySelectorAll('a'));
  anchors.forEach(anchor => {
    const original = anchor.getAttribute('data-original-href') || anchor.getAttribute('href') || '';
    if (!original || !isValidUrl(original)) {
      anchor.replaceWith(document.createTextNode(anchor.textContent));
    } else {
      decorateAnchor(anchor, original);
    }
  });

  // Remove other disallowed elements
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  const toClean = [];
  let node;
  while ((node = walker.nextNode()) !== null) {
    if (node === root) continue;
    const tag = node.tagName;
    if (tag === 'A') {
      continue;
    }
    toClean.push(node);
  }
  toClean.forEach(node => {
    node.replaceWith(document.createTextNode(node.textContent));
  });

  return root.innerHTML;
}

function sanitizeHtml(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  const anchors = temp.querySelectorAll('a');
  anchors.forEach(anchor => {
    const existingOriginalHref = anchor.getAttribute('data-original-href');
    const href = existingOriginalHref || anchor.getAttribute('href') || '';
    if (!href || !isValidUrl(href)) {
      anchor.replaceWith(document.createTextNode(anchor.textContent));
    } else {
      const trimmed = href.trim();
      Array.from(anchor.getAttributeNames()).forEach(attr => {
        if (!['href', 'data-original-href', 'data-link-type', 'data-local-path', 'target', 'rel'].includes(attr)) {
          anchor.removeAttribute(attr);
        }
      });
      anchor.setAttribute('href', trimmed);
      decorateAnchor(anchor, trimmed);
    }
  });
  
  // Remove old character-level formatting (bold, color spans)
  // since we now use item-level decoration
  const boldElements = temp.querySelectorAll('b, strong');
  boldElements.forEach(el => {
    unwrapElement(el);
  });
  
  const spanElements = Array.from(temp.querySelectorAll('span'));
  spanElements.forEach(span => {
    // Remove all formatting spans - we use item-level decoration now
    unwrapElement(span);
  });
  
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_ELEMENT);
  const nodesToClean = [];
  let node;
  while ((node = walker.nextNode()) !== null) {
    const tag = node.tagName;
    if (tag === 'A' || tag === 'STRONG') continue;
    if (tag === 'SPAN' && node.getAttribute('data-text-color')) continue;
    nodesToClean.push(node);
  }
  nodesToClean.forEach(node => {
    if (node.tagName === 'SPAN' || node.tagName === 'STRONG') {
      unwrapElement(node);
    } else {
      node.replaceWith(document.createTextNode(node.textContent));
    }
  });
  
  return temp.innerHTML;
}

// Prompt for hyperlink URL
function promptForHyperlink(content, item) {
  if (!savedSelection) return;
  openHyperlinkDialog({
    placeholder: '例: https://example.com または C:\\path\\file.txt',
    onSubmit: (value, helpers) => {
      const trimmedUrl = (value || '').trim();
      if (!trimmedUrl) {
        helpers.setError('リンク先を入力してください。');
        return false;
      }
      if (!isValidUrl(trimmedUrl)) {
        helpers.setError('有効なURL（http(s)のWebリンク、またはローカルパス）を入力してください。');
        return false;
      }
      insertHyperlink(content, item, trimmedUrl);
      savedSelection = null;
      return true;
    },
    onCancel: () => {
      savedSelection = null;
    }
  });
}

// Insert hyperlink into content
function insertHyperlink(content, item, url) {
  if (!savedSelection) return;
  
  // Capture state before inserting hyperlink
  captureStateForUndo('hyperlink', { itemId: item.id, oldText: item.text });
  
  try {
    // Restore selection with validation
    const selection = window.getSelection();
    selection.removeAllRanges();
    
    // Validate that the range is still valid
    if (!savedSelection.range.startContainer.isConnected) {
      console.error('Saved range is no longer valid');
      return;
    }
    
    selection.addRange(savedSelection.range);
    
    // Create anchor element
    const anchor = document.createElement('a');
    anchor.textContent = savedSelection.text;
    anchor.setAttribute('href', url);
    decorateAnchor(anchor, url);
    
    // Replace selected text with anchor
    savedSelection.range.deleteContents();
    savedSelection.range.insertNode(anchor);
    
    // Select the newly created link
    const newRange = document.createRange();
    newRange.selectNodeContents(anchor);
    selection.removeAllRanges();
    selection.addRange(newRange);
    
    // Sanitize and update the item text with the new HTML content
    const sanitizedContent = sanitizeHtml(content.innerHTML);
    updateItem(item.id, { text: sanitizedContent }, undefined, { skipReload: true });
    item.text = sanitizedContent;
  } catch (err) {
    console.error('Failed to insert hyperlink:', err);
    alert('ハイパーリンクの追加に失敗しました。もう一度お試しください。');
  }
}

function removeHyperlink(anchor, content, item) {
  if (!anchor || !content) return;
  
  // Capture state before removing hyperlink
  captureStateForUndo('remove_hyperlink', { itemId: item.id, oldText: item.text });
  
  const textNode = document.createTextNode(anchor.textContent);
  anchor.replaceWith(textNode);
  
  const selection = window.getSelection();
  if (selection) {
    const newRange = document.createRange();
    newRange.selectNodeContents(textNode);
    selection.removeAllRanges();
    selection.addRange(newRange);
  }
  
  if (content.dataset) {
    content.dataset.disableAutoLink = 'true';
  }
  
  const sanitizedContent = sanitizeHtml(content.innerHTML);
  updateItem(item.id, { text: sanitizedContent, skipAutoLink: true }, undefined, { skipReload: true });
  content.focus();
  savedSelection = null;
}

// Toggle collapse state for a collapsible heading
function toggleCollapse(headingId) {
  const item = items.find(i => i.id === headingId);
  if (!item || item.type !== 'collapsible-heading') return;
  
  const newCollapsedState = !item.collapsed;
  item.collapsed = newCollapsedState;
  
  updateItem(item.id, { collapsed: newCollapsedState }, () => {
    render();
  }, { skipReload: true });
}

// Get items that should be hidden when a heading is collapsed
function getCollapsibleChildren(headingId) {
  const headingIndex = items.findIndex(i => i.id === headingId);
  if (headingIndex === -1) return [];
  
  const children = [];
  for (let i = headingIndex + 1; i < items.length; i++) {
    const item = items[i];
    // Stop at next heading, collapsible-heading, or horizontal rule
    if (item.type === 'heading' || item.type === 'collapsible-heading' || item.type === 'hr') {
      break;
    }
    children.push(item.id);
  }
  return children;
}

// Render all items
function render() {
  list.innerHTML = '';
  
  // Sort items by order
  items.sort((a, b) => a.order - b.order);
  
  // Build a map of collapsed sections
  const collapsedSections = new Map();
  items.forEach(item => {
    if (item.type === 'collapsible-heading' && item.collapsed) {
      const children = getCollapsibleChildren(item.id);
      collapsedSections.set(item.id, children);
    }
  });
  
  // Render all items, hiding those in collapsed sections
  items.forEach(item => {
    // Check if this item should be hidden
    let shouldHide = false;
    for (const [headingId, childIds] of collapsedSections) {
      if (childIds.includes(item.id)) {
        shouldHide = true;
        break;
      }
    }
    
    if (!shouldHide) {
      renderItem(item);
    }
  });
  
  // If no items exist, show single input row
  if (items.length === 0) {
    addEmptyRow();
  }
  
  // Re-enable drag and drop if in reorder mode
  if (reorderMode) {
    enableDragAndDrop();
  }
}

// Render single item
function renderItem(item) {
  const li = document.createElement('li');
  li.dataset.id = item.id;
  li.dataset.type = item.type;
  li.setAttribute('tabindex', '0');
  li.setAttribute('role', 'listitem');
  
  if (item.checked && item.type === 'checkbox') {
    li.classList.add('completed');
  }
  
  // Horizontal rule is special
  if (item.type === 'hr') {
    li.classList.add('hr');
    const deleteBtn = createDeleteButton(item.id);
    li.appendChild(deleteBtn);
    
    list.appendChild(li);
    return;
  }
  
  // Checkbox for checkbox type
  if (item.type === 'checkbox') {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.checked;
    checkbox.setAttribute('aria-label', 'タスク完了');
    checkbox.addEventListener('change', (e) => {
      updateItem(item.id, { checked: e.target.checked });
      li.classList.toggle('completed', e.target.checked);
    });
    li.appendChild(checkbox);
  }
  
  // Bullet for list type
  if (item.type === 'list') {
    const bullet = document.createElement('span');
    bullet.className = 'list-bullet';
    bullet.textContent = '•';
    bullet.setAttribute('aria-hidden', 'true');
    li.appendChild(bullet);
  }
  
  let collapseIcon = null;
  // Collapse icon for collapsible-heading type
  if (item.type === 'collapsible-heading') {
    collapseIcon = document.createElement('span');
    collapseIcon.className = 'collapse-icon';
    collapseIcon.textContent = COLLAPSE_ICON_GLYPH;
    collapseIcon.classList.toggle('is-collapsed', item.collapsed);
    collapseIcon.classList.toggle('is-expanded', !item.collapsed);
    collapseIcon.setAttribute('aria-pressed', (!item.collapsed).toString());
    collapseIcon.setAttribute('aria-label', item.collapsed ? '展開' : '折りたたみ');
    collapseIcon.setAttribute('role', 'button');
    collapseIcon.setAttribute('tabindex', '0');
    collapseIcon.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCollapse(item.id);
    });
    collapseIcon.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        toggleCollapse(item.id);
      }
    });
  }
  
  // Content (contenteditable)
  const content = document.createElement('div');
  content.className = 'task-content';
  content.contentEditable = 'true';
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-label', getAriaLabel(item.type));
  
  // Apply decoration if present
  if (item.decoration && item.decoration.presetId) {
    const preset = getPreset(item.decoration.presetId);
    if (preset) {
      if (preset.bold) content.style.fontWeight = 'bold';
      if (preset.italic) content.style.fontStyle = 'italic';
      if (preset.underline) content.style.textDecoration = 'underline';
      if (preset.color) content.style.color = preset.color;
      content.classList.add('decorated');
    }
  }
  
  // Use innerHTML to support hyperlinks, with sanitization to prevent XSS
  if (item.text) {
    // Check if text contains HTML tags
    if (item.text.includes('<') && item.text.includes('>')) {
      // Has HTML content - sanitize and render
      content.innerHTML = sanitizeHtml(item.text);
    } else {
      // Plain text only
      content.textContent = item.text;
    }
  }
  if (!item.text) {
    content.setAttribute('data-placeholder', getPlaceholder());
  } else {
    content.removeAttribute('data-placeholder');
  }

  // --- Patch: Make anchor clicks open in new window ---
  content.addEventListener('click', function(e) {
    const anchor = e.target.closest('a');
    if (anchor && content.contains(anchor)) {
      e.preventDefault();
      const href = anchor.getAttribute('href');
      if (href) {
        window.open(href, '_blank', 'noopener');
      }
    }
  });
  
  // Setup content event handlers
  setupContentHandlers(content, item, li);
  
  if (item.type === 'collapsible-heading' && collapseIcon) {
    const headingWrapper = document.createElement('div');
    headingWrapper.className = 'collapsible-heading-wrapper';
    headingWrapper.appendChild(content);
    headingWrapper.appendChild(collapseIcon);
    li.appendChild(headingWrapper);
  } else {
    li.appendChild(content);
  }
  
  // Deadline indicator
  if (item.deadline) {
    const deadlineDisplay = getDeadlineDisplay(item.deadline);
    if (deadlineDisplay) {
      const deadlineSpan = document.createElement('span');
      deadlineSpan.className = 'deadline-indicator';
      deadlineSpan.textContent = deadlineDisplay.text;
      deadlineSpan.style.color = deadlineDisplay.textColor;
      deadlineSpan.style.backgroundColor = deadlineDisplay.backgroundColor;
      deadlineSpan.setAttribute('data-tooltip', deadlineDisplay.tooltip || `納期: ${item.deadline}`);
      deadlineSpan.addEventListener('mouseenter', function () {
        showDeadlineTooltipForElement(deadlineSpan, deadlineSpan.getAttribute('data-tooltip'));
      });
      deadlineSpan.addEventListener('mouseleave', function () {
        hideDeadlineTooltip();
      });
      li.appendChild(deadlineSpan);
    }
  }
// --- Deadline Tooltip ---
let deadlineTooltip = null;
let deadlineTooltipStylesInjected = false;
let currentDeadlineTooltipTarget = null;

function injectDeadlineTooltipStyles() {
  if (deadlineTooltipStylesInjected) return;
  const style = document.createElement('style');
  style.textContent = `
.deadline-tooltip {
  position: fixed;
  padding: 4px 8px;
  background: rgba(34, 34, 34, 0.9);
  color: #fff;
  font-size: 12px;
  border-radius: 4px;
  pointer-events: none;
  z-index: 9999;
  opacity: 0;
  transition: opacity 120ms ease;
  max-width: 360px;
  word-break: break-all;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
}
.deadline-tooltip.visible {
  opacity: 1;
}
`;
  document.head.appendChild(style);
  deadlineTooltipStylesInjected = true;
}

function ensureDeadlineTooltip() {
  if (deadlineTooltip) return deadlineTooltip;
  injectDeadlineTooltipStyles();
  deadlineTooltip = document.createElement('div');
  deadlineTooltip.className = 'deadline-tooltip';
  document.body.appendChild(deadlineTooltip);
  return deadlineTooltip;
}

function showDeadlineTooltipForElement(element, text) {
  if (!element || !text) return;
  const tooltip = ensureDeadlineTooltip();
  currentDeadlineTooltipTarget = element;
  tooltip.classList.remove('visible');
  tooltip.textContent = text;

  // Position tooltip below the element, within viewport
  tooltip.style.left = '0px';
  tooltip.style.top = '0px';
  const rect = element.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const margin = 8;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  let left = rect.left + window.scrollX;
  if (left + tooltipRect.width + margin > window.scrollX + viewportWidth) {
    left = window.scrollX + viewportWidth - tooltipRect.width - margin;
  }
  if (left < window.scrollX + margin) {
    left = window.scrollX + margin;
  }
  const top = rect.bottom + window.scrollY + margin;

  tooltip.style.left = `${Math.max(left, margin)}px`;
  tooltip.style.top = `${top}px`;

  requestAnimationFrame(() => {
    if (currentDeadlineTooltipTarget === element) {
      tooltip.classList.add('visible');
    }
  });
}

function hideDeadlineTooltip() {
  currentDeadlineTooltipTarget = null;
  if (deadlineTooltip) {
    deadlineTooltip.classList.remove('visible');
  }
}

window.addEventListener('scroll', hideDeadlineTooltip, true);
window.addEventListener('blur', hideDeadlineTooltip);
  
  // Delete button
  const deleteBtn = createDeleteButton(item.id);
  li.appendChild(deleteBtn);
  
  // Append to DOM
  list.appendChild(li);
}

// Get aria label based on type
function getAriaLabel(type) {
  switch(type) {
    case 'heading': return '見出し';
    case 'collapsible-heading': return '折りたたみ見出し';
    case 'checkbox': return 'チェックボックス';
    case 'list': return 'リスト項目';
    default: return 'テキスト';
  }
}

// Get placeholder based on type
function getPlaceholder() {
  return '[/h]Header, [/b]Collapsible, [/c]Check, [/-]List, [/_]Line';
}

// Setup content event handlers
function setupContentHandlers(content, item, li) {
  let originalText = item.text;
  
  content.addEventListener('focus', () => {
    originalText = content.textContent;
  });
  
  content.addEventListener('blur', () => {
    handleContentBlur(content, item, li);
  });
  
  content.addEventListener('input', () => {
    if (content.dataset && content.dataset.disableAutoLink) {
      delete content.dataset.disableAutoLink;
    }
    const text = content.textContent;
    if (text) {
      content.removeAttribute('data-placeholder');
    } else {
      content.setAttribute('data-placeholder', getPlaceholder());
    }
    
    // Check for slash commands
    if (text.startsWith('/')) {
      handleSlashCommand(text, item, li, content);
    }
  });
  
  content.addEventListener('keydown', (e) => {
    handleKeyDown(e, content, item, li);
  });
  
  // Paste handling - strip formatting
  content.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
  });
  
  // Context menu for hyperlinks
  content.addEventListener('contextmenu', (e) => {
    handleContextMenu(e, content, item);
  });
  
  // Handle clicks on hyperlinks
  content.addEventListener('click', async (e) => {
    const anchor = findAnchorFromEventTarget(e.target);
    if (!anchor) return;
    
    const originalHref = getAnchorOriginalHref(anchor);
    const isLocal = isLocalFilePath(originalHref);
    
    if (isLocal) {
      e.preventDefault();
      hideLinkTooltip();
      const localPath = anchor.getAttribute('data-local-path') || extractLocalFilePath(originalHref);
      const copied = await copyPathToClipboard(localPath);
      hideLinkTooltip();
      if (copied) {
        showToast(`${localPath} をクリップボードにコピーしました`, 'info', 3500);
      } else {
        showToast('パスのコピーに失敗しました。', 'error', 3500);
      }
      return;
    }
    
    // For web links, validate URL and allow default behavior (target="_blank") to open in OS default browser
    // This is especially important for webview contexts where target="_blank" opens in external browser
    if (originalHref && !isValidUrl(originalHref)) {
      // Invalid URL - prevent default to avoid security issues
      e.preventDefault();
      console.warn('Invalid URL detected, blocked:', originalHref);
      return;
    }
    // Valid web link - don't prevent default, let the browser/webview handle it naturally with target="_blank"
  });
  
  content.addEventListener('mousemove', (e) => {
    const anchor = findAnchorFromEventTarget(e.target);
    if (anchor) {
      showLinkTooltipForAnchor(anchor);
    } else {
      hideLinkTooltip();
    }
  });
  
  content.addEventListener('mouseleave', () => {
    hideLinkTooltip();
  });
}

function convertItemFormat(item, formatType, options = {}) {
  if (!item) return;
  const { clearText = false } = options;
  const updates = { type: formatType };
  
  if (formatType === 'collapsible-heading') {
    updates.collapsed = false;
    item.collapsed = false;
  }
  
  if (formatType === 'checkbox') {
    updates.checked = false;
    item.checked = false;
  }
  
  if (clearText || formatType === 'hr') {
    updates.text = '';
    item.text = '';
  }
  
  const focusAfterUpdate = () => {
    if (formatType === 'hr') {
      const nextItem = items.find(i => i.order > item.order);
      if (nextItem) {
        setTimeout(() => focusItem(nextItem.id), 100);
      }
    } else {
      setTimeout(() => focusItem(item.id), 100);
    }
  };
  
  updateItem(item.id, updates, focusAfterUpdate);
}

// Handle slash commands
function handleSlashCommand(text, item, li, content) {
  const trimmed = text.trim();
  const formatType = SLASH_COMMAND_MAP[trimmed];
  if (!formatType) return;
  
  content.textContent = '';
  item.text = '';
  convertItemFormat(item, formatType, { clearText: true });
}

// Handle keydown events
function handleKeyDown(e, content, item, li) {
  const isModifier = (e.ctrlKey || e.metaKey) && !e.altKey;
  if (isModifier && !e.shiftKey) {
    const key = e.key.toLowerCase();
    
    // Check for decoration preset shortcuts
    const preset = decorationPresets.find(p => p.shortcut && p.shortcut.toLowerCase() === key);
    if (preset) {
      e.preventDefault();
      applyDecorationPreset(item, preset.id);
      return;
    }
    
    // Ctrl+0 to remove decoration
    if (key === '0') {
      e.preventDefault();
      applyDecorationPreset(item, null);
      return;
    }
    
    // Keep Ctrl+K for hyperlink
    if (key === 'k') {
      e.preventDefault();
      const range = getSelectionRangeWithinContent(content);
      if (!range) return;
      saveSelectionSnapshot(window.getSelection(), content);
      promptForHyperlink(content, item);
      return;
    }
    
    // Ctrl+D for deadline setting
    if (key === 'd') {
      e.preventDefault();
      promptForDeadline(item);
      return;
    }
  }
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleEnter(item, li, content);
  } else if (e.key === 'Enter' && e.shiftKey) {
    // Shift+Enter: insert line break within same block
    // This is handled by default contenteditable behavior
    // but we need to ensure it doesn't trigger Enter
    return;
  } else if (e.key === 'Escape') {
    e.preventDefault();
    content.blur();
    render();
  } else if (e.key === 'ArrowLeft') {
    const caret = getCaretOffset(content);
    if (caret === 0) {
      e.preventDefault();
      focusPreviousItem(item.id, { position: 'end' });
    }
  } else if (e.key === 'ArrowRight') {
    const caret = getCaretOffset(content);
    if (caret === content.textContent.length) {
      e.preventDefault();
      focusNextItem(item.id, { position: 'start' });
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    // Get cursor position once
    const caret = getCaretOffset(content);
    if (e.shiftKey) {
      // Shift+Up: select from cursor to beginning
      selectFromCursorToStart(content);
      return;
    }
    // Preserve cursor position when moving up
    focusPreviousItem(item.id, { offset: caret });
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    // Get cursor position once
    const caret = getCaretOffset(content);
    if (e.shiftKey) {
      // Shift+Down: select from cursor to end
      selectFromCursorToEnd(content);
      return;
    }
    // Preserve cursor position when moving down
    focusNextItem(item.id, { offset: caret });
  } else if (e.key === 'Backspace' && getCaretOffset(content) === 0) {
    e.preventDefault();
    handleEmptyLineBackspace(item, content);
  } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    // Undo within content editing context
    e.preventDefault();
    performUndo();
  } else if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
    // Redo within content editing context
    e.preventDefault();
    performRedo();
  }
}

// Handle Backspace/Delete on empty line or at start
function handleEmptyLineBackspace(item, content) {
  if (['heading', 'list', 'checkbox'].includes(item.type)) {
    const newType = 'text';
    updateItem(item.id, { type: newType }, () => {
      setTimeout(() => focusItem(item.id, { position: 'start' }), 50);
    });
    return;
  }
  
  if (item.type === 'text') {
    mergeWithPreviousLine(item, content);
  }
}

function mergeWithPreviousLine(item, content) {
  const index = items.findIndex(i => i.id === item.id);
  if (index <= 0) return;
  const prevItem = items[index - 1];
  if (!prevItem) return;
  
  const prevContent = list.querySelector(`li[data-id="${prevItem.id}"] .task-content`);
  const prevText = prevContent ? prevContent.textContent : (prevItem.text || '');
  const currentText = content ? content.textContent : (item.text || '');
  const combinedText = prevText + currentText;
  
  if (prevContent) {
    prevContent.textContent = combinedText;
  }
  
  updateItem(prevItem.id, { text: combinedText }, () => {
    deleteItem(item.id);
    setTimeout(() => focusItem(prevItem.id, { position: 'end' }), 120);
  });
}

function resolveNextType(item) {
  if (item.type === 'checkbox') return 'checkbox';
  if (item.type === 'list') return 'list';
  return 'text';
}

// Handle Enter key
function handleEnter(item, li, content) {
  if (!content) return;
  const { beforeHtml, afterHtml, atEnd } = splitHtmlAtCaret(content);
  
  // Sanitize the HTML content
  const sanitizedBefore = sanitizeHtml(beforeHtml);
  const sanitizedAfter = sanitizeHtml(afterHtml);
  
  // Get plain text versions for checking if content is empty
  const tempBefore = document.createElement('div');
  tempBefore.innerHTML = sanitizedBefore;
  const beforeText = tempBefore.textContent.trim();
  
  const tempAfter = document.createElement('div');
  tempAfter.innerHTML = sanitizedAfter;
  const afterText = tempAfter.textContent.trim();

  const insertNextRow = (nextTypeValue, textForNextRow) => {
    insertItemAfter(item.id, nextTypeValue, textForNextRow, (data) => {
      const newId = data && data.id;
      if (newId) {
        setTimeout(() => focusItem(newId, { position: 'start' }), 150);
        return;
      }
      const currentIndex = items.findIndex(i => i.id === item.id);
      if (currentIndex !== -1 && currentIndex < items.length - 1) {
        const nextItem = items[currentIndex + 1];
        if (nextItem) {
          setTimeout(() => focusItem(nextItem.id, { position: 'start' }), 100);
        }
      }
    }, { allowEmpty: true, skipReload: true });
  };

  const commitAndInsert = (updatedText, nextTypeValue, textForNextRow) => {
    const proceed = () => insertNextRow(nextTypeValue, textForNextRow);
    if (updatedText !== item.text) {
      updateItem(item.id, { text: updatedText }, proceed);
    } else {
      proceed();
    }
  };
  
  if (!atEnd) {
    // Update current line with the content before caret (preserving HTML)
    content.innerHTML = sanitizedBefore;
    if (beforeText) {
      content.removeAttribute('data-placeholder');
    } else {
      content.setAttribute('data-placeholder', getPlaceholder());
    }
    const nextType = (item.type === 'heading') ? 'text' : resolveNextType(item);
    // Pass HTML content to next row
    commitAndInsert(sanitizedBefore, nextType, sanitizedAfter);
    return;
  }
  
  // At end of line - keep current content as is
  const currentHtml = sanitizeHtml(content.innerHTML);
  if (beforeText) {
    content.removeAttribute('data-placeholder');
  } else {
    content.setAttribute('data-placeholder', getPlaceholder());
  }
  const nextType = resolveNextType(item);
  commitAndInsert(currentHtml, nextType, '');
}

// Handle content blur
function handleContentBlur(content, item, li) {
  const autoLinkDisabled = content.dataset && content.dataset.disableAutoLink === 'true';
  
  if (!autoLinkDisabled) {
    autoLinkContent(content);
  }

  sanitizeContentInPlace(content);
  const sanitizedContent = sanitizeHtml(content.innerHTML);
  
  if (sanitizedContent) {
    content.removeAttribute('data-placeholder');
  } else {
    content.setAttribute('data-placeholder', getPlaceholder());
  }
  
  const oldContent = item.text || '';
  if (sanitizedContent !== oldContent) {
    updateItem(item.id, { text: sanitizedContent, skipAutoLink: autoLinkDisabled });
  }
  
  if (autoLinkDisabled) {
    delete content.dataset.disableAutoLink;
  }
}

// Create delete button
function createDeleteButton(id) {
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'delete';
  deleteBtn.textContent = '×';
  deleteBtn.title = '削除';
  deleteBtn.setAttribute('aria-label', '削除');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteItem(id);
  });
  return deleteBtn;
}

// Add empty row at the end
function addEmptyRow() {
  const li = document.createElement('li');
  li.className = 'empty-row';
  li.setAttribute('tabindex', '0');
  
  const content = document.createElement('div');
  content.className = 'task-content';
  content.contentEditable = 'true';
  content.setAttribute('data-placeholder', getPlaceholder());
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-label', '新しい行');
  
  content.addEventListener('input', () => {
    const text = content.textContent.trim();
    if (text) {
      // Create new item
      createItem('text', text, null, (data) => {
        if (data && data.id) {
          setTimeout(() => focusItem(data.id), 100);
        }
      }, { skipReload: true });
    }
  });
  
  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = content.textContent.trim();
      if (text) {
        createItem('text', text, null, (data) => {
          if (data && data.id) {
            setTimeout(() => focusItem(data.id), 100);
          }
        }, { skipReload: true });
      }
    }
  });
  
  li.appendChild(content);
  list.appendChild(li);
}

// Select entire content of an element
function selectEntireContent(content) {
  if (!content) return;
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(content);
  sel.removeAllRanges();
  sel.addRange(range);
}

// Select from cursor position to start of content
function selectFromCursorToStart(content) {
  if (!content) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  
  const currentRange = sel.getRangeAt(0);
  if (!content.contains(currentRange.startContainer)) return;
  
  const range = document.createRange();
  range.setStart(content, 0);
  range.setEnd(currentRange.startContainer, currentRange.startOffset);
  
  sel.removeAllRanges();
  sel.addRange(range);
}

// Select from cursor position to end of content
function selectFromCursorToEnd(content) {
  if (!content) return;
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;
  
  const currentRange = sel.getRangeAt(0);
  if (!content.contains(currentRange.startContainer)) return;
  
  const range = document.createRange();
  range.setStart(currentRange.startContainer, currentRange.startOffset);
  range.setEndAfter(content.lastChild || content);
  
  sel.removeAllRanges();
  sel.addRange(range);
}

// Focus item by id
function focusItem(id, options = {}) {
  const position = options.position || 'end';
  const offset = options.offset;
  setTimeout(() => {
    const li = list.querySelector(`li[data-id="${id}"]`);
    if (li) {
      const content = li.querySelector('.task-content');
      if (content) {
        content.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        
        // If offset is specified, try to position cursor at that offset
        if (typeof offset === 'number') {
          const targetOffset = Math.min(offset, content.textContent.length);
          const point = resolveOffsetToRangePoint(content, targetOffset);
          if (point && point.node) {
            range.setStart(point.node, point.offset);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            return;
          }
        }
        
        // Otherwise use position-based focusing
        if (position === 'start') {
          range.setStart(content, 0);
        } else if (content.childNodes.length > 0) {
          range.setStart(content.childNodes[0], content.textContent.length);
        } else {
          range.setStart(content, 0);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, 50);
}

// Focus previous item

function focusPreviousItem(currentId, options = {}) {
  let currentIndex = items.findIndex(i => i.id === currentId);
  let prevIndex = currentIndex - 1;
  while (prevIndex >= 0) {
    const prev = items[prevIndex];
    if (!(prev.type === 'checkbox' && prev.checked)) {
      focusItem(prev.id, options);
      return;
    }
    prevIndex--;
  }
}

// Focus next item

function focusNextItem(currentId, options = {}) {
  let currentIndex = items.findIndex(i => i.id === currentId);
  let nextIndex = currentIndex + 1;
  while (nextIndex < items.length) {
    const next = items[nextIndex];
    if (!(next.type === 'checkbox' && next.checked)) {
      focusItem(next.id, options);
      return;
    }
    nextIndex++;
  }
}

// Reorder mode state
let reorderMode = false;
let draggedElement = null;
let draggedOverElement = null;

// Toggle reorder mode
function toggleReorderMode() {
  reorderMode = !reorderMode;
  const toggleBtn = document.getElementById('reorderToggle');
  if (!toggleBtn) return;

  const activeLabel = '並び替えモードを終了';
  const inactiveLabel = '並び替えモード';
  toggleBtn.classList.toggle('active', reorderMode);
  toggleBtn.setAttribute('aria-pressed', reorderMode ? 'true' : 'false');
  toggleBtn.setAttribute('aria-label', reorderMode ? activeLabel : inactiveLabel);
  toggleBtn.setAttribute('title', reorderMode ? activeLabel : inactiveLabel);
  
  if (reorderMode) {
    document.body.classList.add('reorder-mode');
    enableDragAndDrop();
  } else {
    document.body.classList.remove('reorder-mode');
    disableDragAndDrop();
  }
}

// Enable drag and drop for all list items
function enableDragAndDrop() {
  const lis = list.querySelectorAll('li[data-id]');
  lis.forEach(li => {
    // Set draggable and add listeners
    // Note: Elements are recreated on render, so no duplicate listeners
    li.setAttribute('draggable', 'true');
    li.addEventListener('dragstart', handleDragStart);
    li.addEventListener('dragend', handleDragEnd);
    li.addEventListener('dragover', handleDragOver);
    li.addEventListener('dragenter', handleDragEnter);
    li.addEventListener('dragleave', handleDragLeave);
    li.addEventListener('drop', handleDrop);
    
    // Disable content editing
    const content = li.querySelector('.task-content');
    if (content) {
      content.contentEditable = 'false';
    }
  });
}

// Disable drag and drop
function disableDragAndDrop() {
  const lis = list.querySelectorAll('li[data-id]');
  lis.forEach(li => {
    li.removeAttribute('draggable');
    li.removeEventListener('dragstart', handleDragStart);
    li.removeEventListener('dragend', handleDragEnd);
    li.removeEventListener('dragover', handleDragOver);
    li.removeEventListener('dragenter', handleDragEnter);
    li.removeEventListener('dragleave', handleDragLeave);
    li.removeEventListener('drop', handleDrop);
    li.classList.remove('dragging', 'drag-over', 'drag-over-bottom');
    
    // Re-enable content editing
    const content = li.querySelector('.task-content');
    if (content) {
      content.contentEditable = 'true';
    }
  });
}

// Drag event handlers
function handleDragStart(e) {
  draggedElement = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  // Set a simple identifier instead of HTML content for security
  e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  
  // Remove all drag-over classes
  const lis = list.querySelectorAll('li[data-id]');
  lis.forEach(li => {
    li.classList.remove('drag-over', 'drag-over-bottom');
  });
  
  draggedElement = null;
  draggedOverElement = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  if (this === draggedElement) return;
  
  const rect = this.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  
  // Remove previous drag-over classes
  const lis = list.querySelectorAll('li[data-id]');
  lis.forEach(li => {
    li.classList.remove('drag-over', 'drag-over-bottom');
  });
  
  // Determine if we're dragging over top or bottom half
  if (e.clientY < midpoint) {
    this.classList.add('drag-over');
  } else {
    this.classList.add('drag-over-bottom');
  }
  
  draggedOverElement = this;
}

function handleDragLeave(e) {
  // Check if we're leaving the current element (not just a child)
  const rect = this.getBoundingClientRect();
  if (e.clientX < rect.left || e.clientX >= rect.right ||
      e.clientY < rect.top || e.clientY >= rect.bottom) {
    this.classList.remove('drag-over', 'drag-over-bottom');
  }
}

function handleDrop(e) {
  e.stopPropagation();
  e.preventDefault();
  
  if (draggedElement === this) {
    return false;
  }
  
  const rect = this.getBoundingClientRect();
  const midpoint = rect.top + rect.height / 2;
  const insertBefore = e.clientY < midpoint;
  
  // Move the dragged element in the DOM
  if (insertBefore) {
    this.parentNode.insertBefore(draggedElement, this);
  } else {
    this.parentNode.insertBefore(draggedElement, this.nextSibling);
  }
  
  // Update order in the backend
  reorderItems();
  
  return false;
}

// Initialize
window.addEventListener('load', () => {
  // Check if user is logged in
  fetch('api.php?action=check_session')
    .then(r => r.json())
    .then(data => {
      if (data.logged_in && data.uid) {
        // User is already logged in
        userID = data.uid;
        isLoggedIn = true;
        initializeApp();
      } else {
        // Show login screen
        showLoginScreen();
      }
    })
    .catch(() => {
      // Error checking session, show login screen
      showLoginScreen();
    });
  
  // Setup reorder toggle button
  const toggleBtn = document.getElementById('reorderToggle');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.addEventListener('click', toggleReorderMode);
  }
  
  // Setup settings button
  const settingsBtn = document.getElementById('settingsToggle');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', showSettingsDialog);
  }
  
  // Setup global keyboard shortcuts for undo/redo (when not focused on editable elements)
  // This is separate from the content-specific handlers to provide global shortcuts
  document.addEventListener('keydown', (e) => {
    // Only handle if not in an input, textarea, or contenteditable
    const target = e.target;
    const isEditable = target.isContentEditable || 
                      target.tagName === 'INPUT' || 
                      target.tagName === 'TEXTAREA';
    
    // Undo: Ctrl+Z (or Cmd+Z on Mac)
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !isEditable) {
      e.preventDefault();
      performUndo();
    }
    // Redo: Ctrl+Y or Ctrl+Shift+Z (or Cmd+Y / Cmd+Shift+Z on Mac)
    else if (((e.key === 'y' && (e.ctrlKey || e.metaKey)) || 
              (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) && !isEditable) {
      e.preventDefault();
      performRedo();
    }
  });
});
