// Data structure: { id, type, text, checked, parentId, order }
// type: 'task' | 'heading' | 'divider'
// parentId: ID of parent task (for subtasks)

let items = [];
let nextId = 1;
let undoStack = [];

const list = document.getElementById('todoList');

// Load from localStorage
function loadItems() {
  const saved = localStorage.getItem('todoItems');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      items = parsed.items || [];
      nextId = parsed.nextId || 1;
    } catch (e) {
      items = [];
      nextId = 1;
    }
  }
  render();
}

// Save to localStorage
function saveItems() {
  localStorage.setItem('todoItems', JSON.stringify({
    items: items,
    nextId: nextId
  }));
}

// Create new item
function createItem(type = 'task', text = '', parentId = null) {
  const item = {
    id: nextId++,
    type: type,
    text: text,
    checked: false,
    parentId: parentId,
    order: items.length
  };
  items.push(item);
  saveItems();
  return item;
}

// Update item
function updateItem(id, updates) {
  const item = items.find(i => i.id === id);
  if (item) {
    Object.assign(item, updates);
    saveItems();
  }
}

// Delete item
function deleteItem(id) {
  const index = items.findIndex(i => i.id === id);
  if (index !== -1) {
    undoStack.push({ action: 'delete', item: { ...items[index] } });
    items.splice(index, 1);
    // Also delete children
    items = items.filter(i => i.parentId !== id);
    saveItems();
    render();
  }
}

// Undo last delete
function undoDelete() {
  if (undoStack.length > 0) {
    const lastAction = undoStack.pop();
    if (lastAction.action === 'delete') {
      items.push(lastAction.item);
      items.sort((a, b) => a.order - b.order);
      saveItems();
      render();
    }
  }
}

// Insert item at position
function insertItemAfter(afterId, type = 'task', parentId = null) {
  const afterIndex = items.findIndex(i => i.id === afterId);
  const newOrder = afterIndex !== -1 ? items[afterIndex].order + 0.5 : items.length;
  
  const item = {
    id: nextId++,
    type: type,
    text: '',
    checked: false,
    parentId: parentId,
    order: newOrder
  };
  
  items.push(item);
  reorderItems();
  saveItems();
  return item;
}

// Reorder items based on DOM order
function reorderItems() {
  const lis = Array.from(list.querySelectorAll('li[data-id]'));
  lis.forEach((li, index) => {
    const id = parseInt(li.dataset.id);
    const item = items.find(i => i.id === id);
    if (item) {
      item.order = index;
      // Update parentId based on DOM nesting
      const parent = li.parentElement.closest('li[data-id]');
      item.parentId = parent ? parseInt(parent.dataset.id) : null;
    }
  });
  items.sort((a, b) => a.order - b.order);
  saveItems();
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
      const newItem = insertItemAfter(item.id, 'task', item.id);
      render();
      focusItem(newItem.id);
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
    updateItem(item.id, { type: 'task', text: '' });
    render();
    focusItem(item.id);
  } else if (text === '/h') {
    // Convert to heading
    content.textContent = '';
    updateItem(item.id, { type: 'heading', text: '' });
    li.dataset.type = 'heading';
    content.setAttribute('data-placeholder', '見出しを入力...');
  } else if (text === '/-' || text === '/- ') {
    // Create divider
    updateItem(item.id, { type: 'divider', text: '' });
    render();
    // Focus next item
    const nextItem = items.find(i => i.order > item.order && !i.parentId);
    if (nextItem) {
      focusItem(nextItem.id);
    }
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
    updateItem(item.id, { text: text });
  }
  
  // Create new item below
  const newItem = insertItemAfter(item.id, 'task', item.parentId);
  render();
  focusItem(newItem.id);
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
        updateItem(item.id, { parentId: items[i].id });
        render();
        focusItem(item.id);
        return;
      }
    }
  }
}

// Handle Shift+Tab (unindent)
function handleUnindent(item) {
  if (!item.parentId) return; // Not a subtask
  
  updateItem(item.id, { parentId: null });
  render();
  focusItem(item.id);
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
    const newItem = insertItemAfter(afterId, 'task', afterItem ? afterItem.parentId : null);
    render();
    focusItem(newItem.id);
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
      const item = createItem('task', text);
      render();
      focusItem(item.id);
    }
  });
  
  content.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = content.textContent.trim();
      if (text) {
        const item = createItem('task', text);
        render();
        focusItem(item.id);
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
      
      // Reorder and re-render
      setTimeout(() => {
        reorderItems();
        render();
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
