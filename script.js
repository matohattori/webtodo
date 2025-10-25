// Data structure: { id, type, text, checked, order }
// type: 'text' | 'checkbox' | 'list' | 'hr' | 'heading'

let items = [];
let undoStack = [];

const list = document.getElementById('todoList');

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
function createItem(type = 'text', text = '', afterId = null, callback) {
  text = text.trim();
  // Allow empty text for hr, checkbox, and list types
  if (!text && !['hr', 'checkbox', 'list'].includes(type)) {
    if (callback) callback();
    return;
  }
  
  const params = new URLSearchParams({text, type});
  if (afterId) params.append('after_id', afterId);
  
  fetch('api.php?action=add', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body: params
  })
  .then(() => loadItems(callback))
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
function insertItemAfter(afterId, type = 'text', callback) {
  createItem(type, '', afterId, callback);
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
  
  // Add final empty row for new input
  addEmptyRow();
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
      const content = li.querySelector('.task-content');
      if (content) {
        content.contentEditable = e.target.checked ? 'false' : 'true';
      }
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
  content.contentEditable = (item.type === 'checkbox' && item.checked) ? 'false' : 'true';
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-label', getAriaLabel(item.type));
  content.textContent = item.text;
  
  if (!item.text) {
    content.setAttribute('data-placeholder', getPlaceholder(item.type));
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
function getPlaceholder(type) {
  switch(type) {
    case 'heading': return '見出しを入力...';
    case 'checkbox': return 'タスクを入力...';
    case 'list': return 'リスト項目を入力...';
    default: return 'テキストを入力...';
  }
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
    content.setAttribute('data-placeholder', text ? '' : getPlaceholder(item.type));
    
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
  if (text === '/c') {
    // Convert to checkbox
    content.textContent = '';
    updateItem(item.id, { type: 'checkbox', text: '' }, () => {
      setTimeout(() => focusItem(item.id), 100);
    });
  } else if (text === '/h') {
    // Convert to heading and add hr below
    content.textContent = '';
    updateItem(item.id, { type: 'heading', text: '' }, () => {
      // Create hr after this item
      createItem('hr', '', item.id, () => {
        setTimeout(() => focusItem(item.id), 100);
      });
    });
  } else if (text === '/-') {
    // Convert to list
    content.textContent = '';
    updateItem(item.id, { type: 'list', text: '' }, () => {
      setTimeout(() => focusItem(item.id), 100);
    });
  } else if (text === '/_') {
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
    handleEnter(item, li);
  } else if (e.key === 'Enter' && e.shiftKey) {
    // Shift+Enter: insert line break within same block
    // This is handled by default contenteditable behavior
    // but we need to ensure it doesn't trigger Enter
    return;
  } else if (e.key === 'Escape') {
    e.preventDefault();
    content.blur();
    render();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusPreviousItem(item.id);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusNextItem(item.id);
  } else if ((e.key === 'Backspace' || e.key === 'Delete') && content.textContent === '') {
    e.preventDefault();
    handleEmptyLineBackspace(item);
  } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    undoDelete();
  }
}

// Handle Backspace/Delete on empty line
function handleEmptyLineBackspace(item) {
  if (item.type === 'list' || item.type === 'checkbox') {
    // Convert to text
    updateItem(item.id, { type: 'text' }, () => {
      setTimeout(() => focusItem(item.id), 100);
    });
  } else if (item.type === 'text') {
    // Delete the line
    deleteItem(item.id);
  }
  // For heading and hr, do nothing (or could delete them too)
}

// Handle Enter key
function handleEnter(item, li) {
  const content = li.querySelector('.task-content');
  if (content) {
    const text = content.textContent.trim();
    if (text !== item.text) {
      updateItem(item.id, { text: text });
    }
  }
  
  // Determine the type for the next line based on current type
  let nextType = 'text';
  if (item.type === 'checkbox') {
    nextType = 'checkbox';
  } else if (item.type === 'list') {
    nextType = 'list';
  }
  // For heading and text, next line is text
  // For hr, this shouldn't be called as hr is not editable
  
  // Create new item below
  insertItemAfter(item.id, nextType, () => {
    // Focus on newly created item
    const currentIndex = items.findIndex(i => i.id === item.id);
    if (currentIndex !== -1 && currentIndex < items.length - 1) {
      setTimeout(() => focusItem(items[currentIndex + 1].id), 100);
    }
  });
}

// Handle content blur
function handleContentBlur(content, item, li) {
  const text = content.textContent.trim();
  if (text !== item.text) {
    updateItem(item.id, { text: text });
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
  content.setAttribute('data-placeholder', 'テキストを入力...');
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-label', '新しい行');
  
  content.addEventListener('input', () => {
    const text = content.textContent.trim();
    if (text) {
      // Create new item
      createItem('text', text, null, () => {
        // Focus on newly created item (last one)
        if (items.length > 0) {
          setTimeout(() => focusItem(items[items.length - 1].id), 100);
        }
      });
    }
  });
  
  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = content.textContent.trim();
      if (text) {
        createItem('text', text, null, () => {
          // Focus on newly created item (last one)
          if (items.length > 0) {
            setTimeout(() => focusItem(items[items.length - 1].id), 100);
          }
        });
      }
    }
  });
  
  li.appendChild(content);
  list.appendChild(li);
}

// Focus item by id
function focusItem(id) {
  setTimeout(() => {
    const li = list.querySelector(`li[data-id="${id}"]`);
    if (li) {
      const content = li.querySelector('.task-content');
      if (content) {
        content.focus();
        // Place cursor at end
        const range = document.createRange();
        const sel = window.getSelection();
        if (content.childNodes.length > 0) {
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
function focusPreviousItem(currentId) {
  const currentIndex = items.findIndex(i => i.id === currentId);
  if (currentIndex > 0) {
    focusItem(items[currentIndex - 1].id);
  }
}

// Focus next item
function focusNextItem(currentId) {
  const currentIndex = items.findIndex(i => i.id === currentId);
  if (currentIndex < items.length - 1) {
    focusItem(items[currentIndex + 1].id);
  }
}

// Initialize
window.addEventListener('load', () => {
  loadItems();
});
