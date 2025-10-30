// Data structure: { id, type, text, checked, order }
// type: 'text' | 'checkbox' | 'list' | 'hr' | 'heading'

let items = [];
let undoStack = [];
let reorderModeEnabled = false;
let moveUndoData = null;

const list = document.getElementById('todoList');

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
    order: newOrder
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

// Load from SQLite3 via API
function loadItems(callback) {
  fetch('api.php?action=list', {cache: 'no-store'})
    .then(r => r.json())
    .then(data => {
      items = data.map(row => ({
        id: row.id,
        type: row.type || 'text',
        text: row.text || '',
        checked: Number(row.done) === 1,
        order: row.sort_order || 0
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
  
  const params = new URLSearchParams({text, type});
  if (afterId) params.append('after_id', afterId);
  if (options.allowEmpty) params.append('allow_empty', '1');

  fetch('api.php?action=add', {
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
function updateItem(id, updates, callback) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  
  // Handle checked state separately
  if (updates.checked !== undefined && Object.keys(updates).length === 1) {
    const params = new URLSearchParams({
      id: id.toString(),
      done: updates.checked ? '1' : '0'
    });
    
    fetch('api.php?action=toggle', {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
      body: params
    })
    .then(() => loadItems(callback))
    .catch(err => console.error('Failed to toggle item:', err));
    return;
  }
  
  // Handle text or type updates via edit endpoint
  const params = new URLSearchParams({id: id.toString()});
  
  if (updates.text !== undefined) {
    params.append('text', updates.text);
  } else if (item.text) {
    params.append('text', item.text);
  }
  
  if (updates.type !== undefined) {
    params.append('type', updates.type);
  }
  
  fetch('api.php?action=edit', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body: params
  })
  .then(() => loadItems(callback))
  .catch(err => console.error('Failed to update item:', err));
}

// Delete item via API
function deleteItem(id) {
  const index = items.findIndex(i => i.id === id);
  if (index !== -1) {
    undoStack.push({ action: 'delete', item: { ...items[index] } });
    
    const params = new URLSearchParams({id: id.toString()});
    fetch('api.php?action=delete', {
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

// Undo last delete (Note: This won't work perfectly with SQLite backend)
function undoDelete() {
  if (undoStack.length > 0) {
    const lastAction = undoStack.pop();
    if (lastAction.action === 'delete') {
      // Re-add the item via API
      createItem(lastAction.item.type, lastAction.item.text);
    }
  }
}

// Insert item at position via API
function insertItemAfter(afterId, type = 'text', text = '', callback, options = {}) {
  createItem(type, text, afterId, callback, options);
}

// Reorder items based on DOM order via API
function reorderItems(callback) {
  const lis = Array.from(list.querySelectorAll('li[data-id]'));
  const order = lis.map(li => li.dataset.id);
  
  const params = new URLSearchParams({order: JSON.stringify(order)});
  
  fetch('api.php?action=reorder', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body: params
  })
  .then(() => loadItems(callback))
  .catch(err => console.error('Failed to reorder items:', err));
}

// Render all items
function render() {
  list.innerHTML = '';
  
  // Sort items by order
  items.sort((a, b) => a.order - b.order);
  
  // Render all items
  items.forEach(item => {
    renderItem(item);
  });
  
  // Update reorder button states
  updateReorderButtonStates();
  
  // If no items exist, show single input row
  if (items.length === 0) {
    addEmptyRow();
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
  
  // Reorder buttons (↑↓) - only for normal items
  const reorderButtons = createReorderButtons(item);
  li.appendChild(reorderButtons);
  
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
  
  // Content (contenteditable)
  const content = document.createElement('div');
  content.className = 'task-content';
  content.contentEditable = 'true';
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-label', getAriaLabel(item.type));
  content.textContent = item.text;
  if (!item.text) {
    content.setAttribute('data-placeholder', getPlaceholder());
  } else {
    content.removeAttribute('data-placeholder');
  }
  
  // Setup content event handlers
  setupContentHandlers(content, item, li);
  
  li.appendChild(content);
  
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
    case 'checkbox': return 'チェックボックス';
    case 'list': return 'リスト項目';
    default: return 'テキスト';
  }
}

// Get placeholder based on type
function getPlaceholder() {
  return '[/h]Header, [/c]Check, [/-]List, [/_]Line';
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
}

// Handle slash commands
function handleSlashCommand(text, item, li, content) {
  const trimmed = text.trim();
  const commands = ['/c', '/c/', '/h', '/h/', '/-', '/-/', '/_', '/_/'];
  if (!commands.includes(trimmed)) return;

  const clearSlash = () => {
    content.textContent = '';
    item.text = '';
  };
  
  if (trimmed.startsWith('/c')) {
    // Convert to checkbox
    clearSlash();
    updateItem(item.id, { type: 'checkbox', text: '' }, () => {
      setTimeout(() => focusItem(item.id), 100);
    });
  } else if (trimmed.startsWith('/h')) {
    // Convert to heading without inserting hr
    clearSlash();
    updateItem(item.id, { type: 'heading', text: '' }, () => {
      setTimeout(() => focusItem(item.id), 100);
    });
  } else if (trimmed.startsWith('/-')) {
    // Convert to list
    clearSlash();
    updateItem(item.id, { type: 'list', text: '' }, () => {
      setTimeout(() => focusItem(item.id), 100);
    });
  } else if (trimmed.startsWith('/_')) {
    clearSlash();
    // Convert to horizontal rule
    updateItem(item.id, { type: 'hr', text: '' }, () => {
      // Focus next item
      const nextItem = items.find(i => i.order > item.order);
      if (nextItem) {
        setTimeout(() => focusItem(nextItem.id), 100);
      }
    });
  }
}

// Handle keydown events
function handleKeyDown(e, content, item, li) {
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
    focusPreviousItem(item.id);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusNextItem(item.id);
  } else if (e.key === 'Backspace' && getCaretOffset(content) === 0) {
    e.preventDefault();
    handleEmptyLineBackspace(item, content);
  } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    undoDelete();
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
  const { before, after, atEnd } = splitTextAtCaret(content);
  const trimmedCurrent = before.trim();
  const trailingText = after.trim();
  
  if (!atEnd) {
    const currentText = trimmedCurrent;
    content.textContent = currentText;
    if (currentText) {
      content.removeAttribute('data-placeholder');
    } else {
      content.setAttribute('data-placeholder', getPlaceholder());
    }
    if (currentText !== item.text) {
      updateItem(item.id, { text: currentText });
    }
    
    const nextType = (item.type === 'heading') ? 'text' : resolveNextType(item);
    
    insertItemAfter(item.id, nextType, trailingText, (data) => {
      const newId = data && data.id;
      if (newId) {
        setTimeout(() => focusItem(newId, { position: 'start' }), 150);
      }
    }, { allowEmpty: true, skipReload: true });
    return;
  }
  
  const text = content.textContent.trim();
  if (text !== item.text) {
    updateItem(item.id, { text: text });
  }
  
  const nextType = resolveNextType(item);
  
  insertItemAfter(item.id, nextType, '', (data) => {
    if (data && data.id) {
      setTimeout(() => focusItem(data.id, { position: 'start' }), 150);
      return;
    }
    const currentIndex = items.findIndex(i => i.id === item.id);
    if (currentIndex !== -1 && currentIndex < items.length - 1) {
      setTimeout(() => focusItem(items[currentIndex + 1].id, { position: 'start' }), 100);
    }
  }, { allowEmpty: true });
}

// Handle content blur
function handleContentBlur(content, item, li) {
  const text = content.textContent.trim();
  if (text !== item.text) {
    updateItem(item.id, { text: text });
  }
}

// Create reorder buttons (↑↓)
function createReorderButtons(item) {
  const container = document.createElement('div');
  container.className = 'reorder-buttons';
  
  const upBtn = document.createElement('button');
  upBtn.className = 'reorder-btn reorder-up';
  upBtn.textContent = '↑';
  upBtn.title = '上へ';
  upBtn.setAttribute('aria-label', '上へ移動');
  upBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    moveItemUp(item.id);
  });
  
  const downBtn = document.createElement('button');
  downBtn.className = 'reorder-btn reorder-down';
  downBtn.textContent = '↓';
  downBtn.title = '下へ';
  downBtn.setAttribute('aria-label', '下へ移動');
  downBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    moveItemDown(item.id);
  });
  
  container.appendChild(upBtn);
  container.appendChild(downBtn);
  
  return container;
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

// Focus item by id
function focusItem(id, options = {}) {
  const position = options.position || 'end';
  setTimeout(() => {
    const li = list.querySelector(`li[data-id="${id}"]`);
    if (li) {
      const content = li.querySelector('.task-content');
      if (content) {
        content.focus();
        const range = document.createRange();
        const sel = window.getSelection();
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

// Move item up in order
function moveItemUp(id) {
  const index = items.findIndex(i => i.id === id);
  if (index <= 0) return; // Already at top
  
  // Swap with previous item
  const item = items[index];
  const prevItem = items[index - 1];
  
  // Store undo data
  moveUndoData = {
    id: id,
    direction: 'down', // To undo, move down
    previousOrder: [...items.map(i => i.id)]
  };
  
  // Swap in array
  items[index] = prevItem;
  items[index - 1] = item;
  
  // Update DOM order
  render();
  
  // Save to server
  reorderItems(() => {
    showToast('1件上に移動しました', () => undoMove());
  });
}

// Move item down in order
function moveItemDown(id) {
  const index = items.findIndex(i => i.id === id);
  if (index < 0 || index >= items.length - 1) return; // Already at bottom
  
  // Swap with next item
  const item = items[index];
  const nextItem = items[index + 1];
  
  // Store undo data
  moveUndoData = {
    id: id,
    direction: 'up', // To undo, move up
    previousOrder: [...items.map(i => i.id)]
  };
  
  // Swap in array
  items[index] = nextItem;
  items[index + 1] = item;
  
  // Update DOM order
  render();
  
  // Save to server
  reorderItems(() => {
    showToast('1件下に移動しました', () => undoMove());
  });
}

// Undo last move
function undoMove() {
  if (!moveUndoData) return;
  
  const { previousOrder } = moveUndoData;
  
  // Restore original order
  const orderedItems = [];
  previousOrder.forEach(id => {
    const item = items.find(i => i.id === id);
    if (item) orderedItems.push(item);
  });
  items = orderedItems;
  
  // Update DOM
  render();
  
  // Save to server
  reorderItems();
  
  // Clear undo data
  moveUndoData = null;
  
  // Remove any existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
}

// Show toast notification
function showToast(message, onUndo) {
  // Remove any existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  const messageSpan = document.createElement('span');
  messageSpan.textContent = message;
  toast.appendChild(messageSpan);
  
  if (onUndo) {
    const undoBtn = document.createElement('button');
    undoBtn.className = 'toast-undo';
    undoBtn.textContent = '↩ 戻す';
    undoBtn.addEventListener('click', () => {
      onUndo();
      toast.remove();
    });
    toast.appendChild(undoBtn);
  }
  
  document.body.appendChild(toast);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 5000);
}

// Update reorder button states based on position
function updateReorderButtonStates() {
  items.forEach((item, index) => {
    const li = list.querySelector(`li[data-id="${item.id}"]`);
    if (!li) return;
    
    const upBtn = li.querySelector('.reorder-up');
    const downBtn = li.querySelector('.reorder-down');
    
    if (upBtn) upBtn.disabled = (index === 0);
    if (downBtn) downBtn.disabled = (index === items.length - 1);
  });
}

// Toggle reorder mode
function toggleReorderMode(enabled) {
  reorderModeEnabled = enabled;
  
  if (enabled) {
    document.body.classList.add('reorder-mode');
  } else {
    document.body.classList.remove('reorder-mode');
  }
  
  // Save state to localStorage
  localStorage.setItem('reorderModeEnabled', enabled ? '1' : '0');
}

// Load reorder mode state from localStorage
function loadReorderModeState() {
  const saved = localStorage.getItem('reorderModeEnabled');
  const enabled = saved === '1';
  
  const checkbox = document.getElementById('reorderMode');
  if (checkbox) {
    checkbox.checked = enabled;
    toggleReorderMode(enabled);
  }
}

// Initialize
window.addEventListener('load', () => {
  loadItems();
  loadReorderModeState();
  
  // Setup reorder mode toggle
  const reorderModeCheckbox = document.getElementById('reorderMode');
  if (reorderModeCheckbox) {
    reorderModeCheckbox.addEventListener('change', (e) => {
      toggleReorderMode(e.target.checked);
    });
  }
});
