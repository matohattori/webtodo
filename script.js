// Data structure: { id, type, text, checked, parentId, order }
// type: 'task' | 'heading' | 'divider'
// parentId: ID of parent task (for subtasks)

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
        type: row.type || 'task',
        text: row.text || '',
        checked: Number(row.done) === 1,
        parentId: row.parent_id ? Number(row.parent_id) : null,
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
function createItem(type = 'task', text = '', parentId = null, afterId = null, callback) {
  text = text.trim();
  if (!text && type !== 'divider') {
    if (callback) callback();
    return;
  }
  
  const params = new URLSearchParams({text, type});
  if (parentId) params.append('parent_id', parentId);
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
  
  // Handle text, type, or parentId updates via edit endpoint
  const params = new URLSearchParams({id: id.toString()});
  
  if (updates.text !== undefined) {
    params.append('text', updates.text);
  } else if (item.text) {
    params.append('text', item.text);
  }
  
  if (updates.type !== undefined) {
    params.append('type', updates.type);
  }
  
  if (updates.parentId !== undefined) {
    params.append('parent_id', updates.parentId === null ? '' : updates.parentId.toString());
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
      createItem(lastAction.item.type, lastAction.item.text, lastAction.item.parentId);
    }
  }
}

// Insert item at position via API
function insertItemAfter(afterId, type = 'task', parentId = null, callback) {
  createItem(type, '', parentId, afterId, callback);
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
  
  // Render parent items
  items.forEach(item => {
    if (!item.parentId) {
      renderItem(item);
    }
  });
  
  // Add final empty row for new input
  addEmptyRow();
  
  // Setup SortableJS
  setupSortable();
}

// Render single item
function renderItem(item, parentLi = null) {
  const li = document.createElement('li');
  li.dataset.id = item.id;
  li.dataset.type = item.type;
  li.setAttribute('tabindex', '0');
  li.setAttribute('role', 'listitem');
  
  if (item.checked) {
    li.classList.add('completed');
  }
  
  if (item.parentId) {
    li.classList.add('subtask');
  }
  
  // Divider is special
  if (item.type === 'divider') {
    li.classList.add('divider');
    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.textContent = '≡';
    dragHandle.setAttribute('aria-label', 'ドラッグハンドル');
    li.appendChild(dragHandle);
    
    const deleteBtn = createDeleteButton(item.id);
    li.appendChild(deleteBtn);
    
    list.appendChild(li);
    addInsertBar(li);
    return;
  }
  
  // Drag handle
  const dragHandle = document.createElement('span');
  dragHandle.className = 'drag-handle';
  dragHandle.textContent = '≡';
  dragHandle.setAttribute('aria-label', 'ドラッグハンドル');
  li.appendChild(dragHandle);
  
  // Checkbox for tasks
  if (item.type === 'task') {
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
  
  // Content (contenteditable)
  const content = document.createElement('div');
  content.className = 'task-content';
  content.contentEditable = item.checked ? 'false' : 'true';
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-label', item.type === 'heading' ? '見出し' : 'タスク内容');
  content.textContent = item.text;
  
  if (!item.text) {
    content.setAttribute('data-placeholder', item.type === 'heading' ? '見出しを入力...' : 'タスクを入力...');
  }
  
  // Setup content event handlers
  setupContentHandlers(content, item, li);
  
  li.appendChild(content);
  
  // Add subtask button (only for parent tasks)
  if (item.type === 'task' && !item.parentId) {
    const addSubtaskBtn = document.createElement('button');
    addSubtaskBtn.className = 'add-subtask';
    addSubtaskBtn.textContent = '+';
    addSubtaskBtn.title = 'サブタスクを追加';
    addSubtaskBtn.setAttribute('aria-label', 'サブタスクを追加');
    addSubtaskBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      insertItemAfter(item.id, 'task', item.id, () => {
        // After item is created and loaded, focus on it
        // Find the newly created item (last subtask of this parent)
        const children = items.filter(i => i.parentId === item.id);
        if (children.length > 0) {
          const lastChild = children[children.length - 1];
          setTimeout(() => focusItem(lastChild.id), 100);
        }
      });
    });
    li.appendChild(addSubtaskBtn);
  }
  
  // Delete button
  const deleteBtn = createDeleteButton(item.id);
  li.appendChild(deleteBtn);
  
  // Append to DOM
  if (parentLi) {
    let sublist = parentLi.querySelector('ul.subtask-list');
    if (!sublist) {
      sublist = document.createElement('ul');
      sublist.className = 'subtask-list';
      parentLi.appendChild(sublist);
    }
    sublist.appendChild(li);
  } else {
    list.appendChild(li);
  }
  
  // Add insert bar after this item
  addInsertBar(li);
  
  // Render children
  const children = items.filter(i => i.parentId === item.id);
  children.forEach(child => renderItem(child, li));
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
    content.setAttribute('data-placeholder', text ? '' : (item.type === 'heading' ? '見出しを入力...' : 'タスクを入力...'));
    
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
  if (text === '/t') {
    // Convert to task
    content.textContent = '';
    updateItem(item.id, { type: 'task', text: '' }, () => {
      setTimeout(() => focusItem(item.id), 100);
    });
  } else if (text === '/h') {
    // Convert to heading
    content.textContent = '';
    updateItem(item.id, { type: 'heading', text: '' }, () => {
      li.dataset.type = 'heading';
      content.setAttribute('data-placeholder', '見出しを入力...');
    });
  } else if (text === '/-' || text === '/- ') {
    // Create divider
    updateItem(item.id, { type: 'divider', text: '' }, () => {
      // Focus next item
      const nextItem = items.find(i => i.order > item.order && !i.parentId);
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
  } else if (e.key === 'Escape') {
    e.preventDefault();
    content.blur();
    render();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      handleUnindent(item);
    } else {
      handleIndent(item);
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusPreviousItem(item.id);
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusNextItem(item.id);
  } else if ((e.key === 'Backspace' || e.key === 'Delete') && content.textContent === '') {
    e.preventDefault();
    deleteItem(item.id);
  } else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    undoDelete();
  }
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
  
  // Create new item below
  insertItemAfter(item.id, 'task', item.parentId, () => {
    // Focus on newly created item
    const currentIndex = items.findIndex(i => i.id === item.id);
    if (currentIndex !== -1 && currentIndex < items.length - 1) {
      setTimeout(() => focusItem(items[currentIndex + 1].id), 100);
    }
  });
}

// Handle Tab (indent to subtask)
function handleIndent(item) {
  if (item.parentId) return; // Already a subtask
  
  // Find previous sibling
  const index = items.findIndex(i => i.id === item.id);
  if (index > 0) {
    for (let i = index - 1; i >= 0; i--) {
      if (!items[i].parentId) {
        // Found a parent item
        updateItem(item.id, { parentId: items[i].id }, () => {
          setTimeout(() => focusItem(item.id), 100);
        });
        return;
      }
    }
  }
}

// Handle Shift+Tab (unindent)
function handleUnindent(item) {
  if (!item.parentId) return; // Not a subtask
  
  updateItem(item.id, { parentId: null }, () => {
    setTimeout(() => focusItem(item.id), 100);
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

// Add insert bar between items
function addInsertBar(afterLi) {
  const insertBar = document.createElement('div');
  insertBar.className = 'insert-bar';
  
  const insertBtn = document.createElement('button');
  insertBtn.className = 'insert-btn';
  insertBtn.textContent = '+';
  insertBtn.title = '新規タスクを挿入';
  insertBtn.setAttribute('aria-label', '新規タスクを挿入');
  
  insertBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const afterId = parseInt(afterLi.dataset.id);
    const afterItem = items.find(i => i.id === afterId);
    insertItemAfter(afterId, 'task', afterItem ? afterItem.parentId : null, () => {
      // Focus on newly created item
      const currentIndex = items.findIndex(i => i.id === afterId);
      if (currentIndex !== -1 && currentIndex < items.length - 1) {
        setTimeout(() => focusItem(items[currentIndex + 1].id), 100);
      }
    });
  });
  
  insertBar.appendChild(insertBtn);
  afterLi.insertAdjacentElement('afterend', insertBar);
}

// Add empty row at the end
function addEmptyRow() {
  const li = document.createElement('li');
  li.className = 'empty-row';
  li.setAttribute('tabindex', '0');
  
  const content = document.createElement('div');
  content.className = 'task-content';
  content.contentEditable = 'true';
  content.setAttribute('data-placeholder', 'タスクを入力...');
  content.setAttribute('role', 'textbox');
  content.setAttribute('aria-label', '新しいタスク');
  
  content.addEventListener('input', () => {
    const text = content.textContent.trim();
    if (text) {
      // Create new item
      createItem('task', text, null, null, () => {
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
        createItem('task', text, null, null, () => {
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

// Setup drag and drop (native implementation following SortableJS patterns)
function setupSortable() {
  let draggedElement = null;
  
  const draggableItems = list.querySelectorAll('li[data-id]');
  
  draggableItems.forEach(li => {
    // Make item draggable via handle
    const handle = li.querySelector('.drag-handle');
    if (!handle) return;
    
    handle.addEventListener('mousedown', (e) => {
      li.setAttribute('draggable', 'true');
    });
    
    handle.addEventListener('mouseup', (e) => {
      li.setAttribute('draggable', 'false');
    });
    
    li.addEventListener('dragstart', (e) => {
      draggedElement = li;
      li.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', li.innerHTML);
    });
    
    li.addEventListener('dragend', (e) => {
      li.classList.remove('dragging');
      li.setAttribute('draggable', 'false');
      draggedElement = null;
      
      // Reorder via API and re-render
      setTimeout(() => {
        reorderItems();
      }, 50);
    });
    
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!draggedElement || draggedElement === li) return;
      
      const bounding = li.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      
      if (e.clientY - offset > 0) {
        // Insert after
        if (li.nextSibling && li.nextSibling !== draggedElement) {
          li.parentNode.insertBefore(draggedElement, li.nextSibling);
        } else if (!li.nextSibling) {
          li.parentNode.appendChild(draggedElement);
        }
      } else {
        // Insert before
        if (li !== draggedElement) {
          li.parentNode.insertBefore(draggedElement, li);
        }
      }
    });
    
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
  });
}

// Initialize
window.addEventListener('load', () => {
  loadItems();
});
