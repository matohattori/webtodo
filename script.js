// Data structure: { id, type, text, checked, order }
// type: 'text' | 'checkbox' | 'list' | 'hr' | 'heading'

let items = [];
let undoStack = [];

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

// Context menu state
let contextMenu = null;
let savedSelection = null;

// Handle context menu for hyperlinks
function handleContextMenu(e, content, item) {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();
  
  // Only show context menu if text is selected
  if (!selectedText) {
    return;
  }
  
  e.preventDefault();
  
  // Save the selection
  savedSelection = {
    range: selection.getRangeAt(0).cloneRange(),
    text: selectedText
  };
  
  // Remove existing context menu if any
  if (contextMenu) {
    contextMenu.remove();
  }
  
  // Create context menu
  contextMenu = document.createElement('div');
  contextMenu.className = 'hyperlink-context-menu';
  contextMenu.innerHTML = '<div class="context-menu-item">ハイパーリンクを追加</div>';
  
  // Position the menu
  contextMenu.style.left = e.pageX + 'px';
  contextMenu.style.top = e.pageY + 'px';
  
  // Add click handler
  const menuItem = contextMenu.querySelector('.context-menu-item');
  menuItem.addEventListener('click', () => {
    contextMenu.remove();
    contextMenu = null;
    promptForHyperlink(content, item);
  });
  
  document.body.appendChild(contextMenu);
  
  // Close menu when clicking elsewhere
  const closeMenu = (event) => {
    if (contextMenu && !contextMenu.contains(event.target)) {
      contextMenu.remove();
      contextMenu = null;
      document.removeEventListener('click', closeMenu);
    }
  };
  setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Validate URL to prevent XSS attacks
function isValidUrl(url) {
  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

// Sanitize HTML to only allow anchor tags with safe attributes
function sanitizeHtml(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Get all anchor tags
  const anchors = temp.querySelectorAll('a');
  
  // Validate and sanitize each anchor
  anchors.forEach(anchor => {
    const href = anchor.getAttribute('href');
    if (!href || !isValidUrl(href)) {
      // Remove invalid anchor, keep text content
      anchor.replaceWith(document.createTextNode(anchor.textContent));
    } else {
      // Keep only safe attributes
      const safeAnchor = document.createElement('a');
      safeAnchor.href = href;
      safeAnchor.textContent = anchor.textContent;
      safeAnchor.target = '_blank';
      safeAnchor.rel = 'noopener noreferrer';
      anchor.replaceWith(safeAnchor);
    }
  });
  
  // Remove all other tags except text and anchors
  const walker = document.createTreeWalker(temp, NodeFilter.SHOW_ELEMENT);
  const nodesToReplace = [];
  let node;
  while (node = walker.nextNode()) {
    if (node.tagName !== 'A') {
      nodesToReplace.push(node);
    }
  }
  nodesToReplace.forEach(node => {
    node.replaceWith(document.createTextNode(node.textContent));
  });
  
  return temp.innerHTML;
}

// Prompt for hyperlink URL
function promptForHyperlink(content, item) {
  if (!savedSelection) return;
  
  const url = prompt('リンク先URLを入力してください:', 'https://');
  
  if (url && url.trim()) {
    const trimmedUrl = url.trim();
    if (isValidUrl(trimmedUrl)) {
      insertHyperlink(content, item, trimmedUrl);
    } else {
      alert('有効なURL（http://またはhttps://）を入力してください。');
    }
  }
  
  savedSelection = null;
}

// Insert hyperlink into content
function insertHyperlink(content, item, url) {
  if (!savedSelection) return;
  
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
    anchor.href = url;
    anchor.textContent = savedSelection.text;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    
    // Replace selected text with anchor
    savedSelection.range.deleteContents();
    savedSelection.range.insertNode(anchor);
    
    // Move cursor after the link
    savedSelection.range.setStartAfter(anchor);
    savedSelection.range.setEndAfter(anchor);
    selection.removeAllRanges();
    selection.addRange(savedSelection.range);
    
    // Update the item text with the new HTML content
    updateItem(item.id, { text: content.innerHTML });
  } catch (err) {
    console.error('Failed to insert hyperlink:', err);
    alert('ハイパーリンクの追加に失敗しました。もう一度お試しください。');
  }
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
  
  // Content (contenteditable)
  const content = document.createElement('div');
  content.className = 'task-content';
  content.contentEditable = 'true';
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-label', getAriaLabel(item.type));
  // Use innerHTML to support hyperlinks, with sanitization to prevent XSS
  if (item.text) {
    // Check if text contains HTML by trying to parse it
    const temp = document.createElement('div');
    temp.innerHTML = item.text;
    const hasHtmlContent = temp.querySelector('a') !== null;
    
    if (hasHtmlContent) {
      // Sanitize HTML content before rendering
      content.innerHTML = sanitizeHtml(item.text);
    } else {
      content.textContent = item.text;
    }
  }
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
  
  // Context menu for hyperlinks
  content.addEventListener('contextmenu', (e) => {
    handleContextMenu(e, content, item);
  });
  
  // Handle clicks on hyperlinks
  content.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      e.preventDefault();
      const url = e.target.href;
      // Validate URL protocol before opening (defense-in-depth)
      if (url && isValidUrl(url)) {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    }
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
    const currentText = trimmedCurrent;
    content.textContent = currentText;
    if (currentText) {
      content.removeAttribute('data-placeholder');
    } else {
      content.setAttribute('data-placeholder', getPlaceholder());
    }
    const nextType = (item.type === 'heading') ? 'text' : resolveNextType(item);
    commitAndInsert(currentText, nextType, trailingText);
    return;
  }
  
  const text = content.textContent.trim();
  if (text) {
    content.removeAttribute('data-placeholder');
  } else {
    content.setAttribute('data-placeholder', getPlaceholder());
  }
  const nextType = resolveNextType(item);
  commitAndInsert(text, nextType, '');
}

// Handle content blur
function handleContentBlur(content, item, li) {
  // Check if content has hyperlinks
  const hasHyperlinks = content.querySelector('a') !== null;
  const newContent = hasHyperlinks ? content.innerHTML : content.textContent.trim();
  
  // Compare with existing content
  const oldContent = item.text || '';
  if (newContent !== oldContent) {
    updateItem(item.id, { text: newContent });
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
  loadItems();
  
  // Setup reorder toggle button
  const toggleBtn = document.getElementById('reorderToggle');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', 'false');
    toggleBtn.addEventListener('click', toggleReorderMode);
  }
});
