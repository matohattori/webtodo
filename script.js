// Data structure: { id, type, text, checked, order }
// type: 'text' | 'checkbox' | 'list' | 'hr' | 'heading'

let items = [];
let undoStack = [];

const list = document.getElementById('todoList');

const LINK_DETECTION_REGEX = /(?:https?:\/\/[^\s<>"']+|[A-Za-z]:[\\/][^\s<>"']+|\\\\[^\s<>"']+)/gi;
const TEXT_COLOR_OPTIONS = [
  { id: 'default', label: '標準', color: '' },
  { id: 'red', label: '赤', color: '#FF0000' },
  { id: 'orange', label: 'オレンジ', color: '#FF8000' },
  { id: 'yellow', label: '黄', color: '#FFFF00' },
  { id: 'green', label: '緑', color: '#00FF00' },
  { id: 'blue', label: '青', color: '#0000FF' },
  { id: 'purple', label: '紫', color: '#800080' },
  { id: 'pink', label: 'ピンク', color: '#FF00FF' },
  { id: 'gray', label: 'グレー', color: '#808080' }
];

const TEXT_COLOR_MAP = TEXT_COLOR_OPTIONS.reduce((acc, option) => {
  if (option.color) {
    acc[option.id] = option.color;
  }
  return acc;
}, {});

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

function unwrapElement(element) {
  if (!element || !element.parentNode) return;
  const parent = element.parentNode;
  while (element.firstChild) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

function saveSelectionSnapshot(selection, contextHint) {
  if (!selection || selection.rangeCount === 0) {
    savedSelection = null;
    return;
  }
  const range = selection.getRangeAt(0);
  const context = resolveSelectionContext(range, contextHint);
  const offsets = context ? getRangeOffsetsWithin(context, range) : { start: null, end: null };
  
  savedSelection = {
    range: range.cloneRange(),
    text: selection.toString(),
    context,
    start: offsets.start,
    end: offsets.end
  };
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
  const range = getSelectionRangeWithinContent(content);
  if (!range) return false;
  const initialSelection = window.getSelection();
  if (initialSelection && typeof document.execCommand === 'function') {
    try {
      const result = document.execCommand('bold', false, null);
      if (result !== false) {
        content.normalize();
        saveSelectionSnapshot(initialSelection);
        refreshSavedSelection(content);
        return true;
      }
    } catch (err) {
      console.warn('execCommand("bold") failed, falling back to manual handling:', err);
    }
  }

  const existing = findExactWrapper(range, content, (node) => node.tagName === 'STRONG');
  if (existing) {
    // Save selection offsets before unwrapping
    const offsets = getRangeOffsetsWithin(content, range);
    unwrapElement(existing);
    content.normalize();
    
    // Restore selection using saved offsets
    const removalSelection = window.getSelection();
    if (removalSelection && typeof offsets.start === 'number' && typeof offsets.end === 'number') {
      const startPoint = resolveOffsetToRangePoint(content, offsets.start);
      const endPoint = resolveOffsetToRangePoint(content, offsets.end);
      if (startPoint && endPoint && startPoint.node && endPoint.node) {
        try {
          const newRange = document.createRange();
          newRange.setStart(startPoint.node, startPoint.offset);
          newRange.setEnd(endPoint.node, endPoint.offset);
          removalSelection.removeAllRanges();
          removalSelection.addRange(newRange);
        } catch (err) {
          console.warn('Failed to restore selection after unbold:', err);
        }
      }
    }
    return true;
  }
  
  const fragment = range.extractContents();
  const wrapper = document.createElement('strong');
  wrapper.appendChild(fragment);
  range.insertNode(wrapper);
  
  const insertionSelection = window.getSelection();
  if (insertionSelection) {
    const newRange = document.createRange();
    newRange.selectNodeContents(wrapper);
    insertionSelection.removeAllRanges();
    insertionSelection.addRange(newRange);
  }
  content.normalize();
  
  return true;
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
    clearColorRange(content, range);
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    content.normalize();
    return true;
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
  const selection = window.getSelection();
  let shouldRestoreSelection = false;
  if (options.keepSelection && selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (content.contains(range.commonAncestorContainer)) {
      saveSelectionSnapshot(selection);
      shouldRestoreSelection = true;
    }
  }

  const sanitizedContent = sanitizeHtml(content.innerHTML);
  if (content.innerHTML !== sanitizedContent) {
    content.innerHTML = sanitizedContent;
  }

  if (shouldRestoreSelection) {
    restoreSelectionForContent(content);
  }

  if ((item.text || '') === sanitizedContent) {
    content.focus();
    if (shouldRestoreSelection) {
      restoreSelectionForContent(content);
    }
    refreshSavedSelection(content);
    return;
  }
  const updatePayload = { text: sanitizedContent };
  if (options.skipAutoLink) {
    updatePayload.skipAutoLink = true;
  }
  updateItem(item.id, updatePayload, undefined, { skipReload: true });
  item.text = sanitizedContent;
  content.focus();
  if (shouldRestoreSelection) {
    restoreSelectionForContent(content);
  }
  refreshSavedSelection(content);
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
  
  const preparedText = prepareTextForStorage(text);
  
  const params = new URLSearchParams({text: preparedText, type});
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
function updateItem(id, updates, callback, options = {}) {
  const item = items.find(i => i.id === id);
  if (!item) return;

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
  
  fetch('api.php?action=edit', {
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
let colorMenu = null;
let colorMenuContext = null;

function closeColorMenu() {
  if (colorMenu) {
    colorMenu.remove();
    colorMenu = null;
    colorMenuContext = null;
  }
  document.removeEventListener('click', handleColorMenuOutside, true);
}

function handleColorMenuOutside(event) {
  if (!colorMenu) return;
  if (colorMenu.contains(event.target)) return;
  closeColorMenu();
}

function openColorMenu(position, content, item) {
  closeColorMenu();
  
  if (!restoreSelectionForContent(content)) {
    return;
  }
  
  colorMenu = document.createElement('div');
  colorMenu.className = 'context-color-menu';
  colorMenuContext = { content, item };
  
  TEXT_COLOR_OPTIONS.forEach(option => {
    const optionElement = document.createElement('div');
    optionElement.className = 'context-color-option';
    optionElement.setAttribute('data-color-id', option.id);
    
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
    
    optionElement.appendChild(swatch);
    optionElement.appendChild(label);
    
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
  
  setTimeout(() => document.addEventListener('click', handleColorMenuOutside, true), 0);
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

// Handle context menu for hyperlinks and formatting
function handleContextMenu(e, content, item) {
  closeColorMenu();
  const selection = window.getSelection();
  const selectedText = selection ? selection.toString().trim() : '';
  const anchorTarget = findAnchorFromEventTarget(e.target);
  const hasAnchorTarget = !!anchorTarget;
  
  if (!selectedText && !hasAnchorTarget) {
    savedSelection = null;
    return;
  }
  
  e.preventDefault();
  
  if (selectedText && selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (content.contains(range.commonAncestorContainer)) {
      saveSelectionSnapshot(selection);
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
      label: '太字',
      shortcut: 'Ctrl+B',
      action: () => {
        removeContextMenu();
        if (!restoreSelectionForContent(content)) return;
        if (toggleBoldSelection(content)) {
          commitFormattingChange(content, item, { keepSelection: true });
        }
      }
    });
    menuItems.push({
      label: '色を変更',
      shortcut: 'Ctrl+Q',
      action: () => {
        const menuRect = contextMenu ? contextMenu.getBoundingClientRect() : null;
        const scrollX = window.pageXOffset || window.scrollX || 0;
        const scrollY = window.pageYOffset || window.scrollY || 0;
        const position = menuRect
          ? {
              x: menuRect.right + scrollX + 8,
              y: menuRect.top + scrollY
            }
          : { x: e.pageX + 8, y: e.pageY };
        removeContextMenu();
        if (!restoreSelectionForContent(content)) return;
        openColorMenu(position, content, item);
      }
    });
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
    const response = await fetch('api.php?action=open_link', {
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

// Sanitize HTML to only allow anchor tags with safe attributes
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
  
  const boldElements = temp.querySelectorAll('b, strong');
  boldElements.forEach(el => {
    let target = el;
    if (el.tagName === 'B') {
      const strong = document.createElement('strong');
      while (el.firstChild) {
        strong.appendChild(el.firstChild);
      }
      el.replaceWith(strong);
      target = strong;
    }
    Array.from(target.attributes).forEach(attr => target.removeAttribute(attr.name));
  });
  
  const spanElements = Array.from(temp.querySelectorAll('span'));
  spanElements.forEach(span => {
    const colorId = span.getAttribute('data-text-color');
    if (colorId && TEXT_COLOR_MAP[colorId]) {
      const hex = TEXT_COLOR_MAP[colorId];
      Array.from(span.getAttributeNames()).forEach(attr => {
        if (attr !== 'data-text-color' && attr !== 'style') {
          span.removeAttribute(attr);
        }
      });
      span.setAttribute('data-text-color', colorId);
      span.style.color = hex;
    } else {
      span.removeAttribute('data-text-color');
      span.removeAttribute('style');
      unwrapElement(span);
    }
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
    
    // Move cursor after the link
    savedSelection.range.setStartAfter(anchor);
    savedSelection.range.setEndAfter(anchor);
    selection.removeAllRanges();
    selection.addRange(savedSelection.range);
    
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
  
  const textNode = document.createTextNode(anchor.textContent);
  anchor.replaceWith(textNode);
  
  const selection = window.getSelection();
  if (selection) {
    const newRange = document.createRange();
    newRange.selectNodeContents(textNode);
    newRange.collapse(false);
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
    
    e.preventDefault();
    hideLinkTooltip();
    
    const originalHref = getAnchorOriginalHref(anchor);
    const isLocal = isLocalFilePath(originalHref);
    
    if (isLocal) {
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
    
    // Validate URL protocol before opening (defense-in-depth)
    if (originalHref && isValidUrl(originalHref)) {
      await openWebLink(originalHref);
    }
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
  const isModifier = (e.ctrlKey || e.metaKey) && !e.altKey;
  if (isModifier && !e.shiftKey) {
    const key = e.key.toLowerCase();
    if (key === 'b') {
      e.preventDefault();
      closeColorMenu();
      if (toggleBoldSelection(content)) {
        commitFormattingChange(content, item, { keepSelection: true });
      }
      return;
    }
    if (key === 'q') {
      e.preventDefault();
      const range = getSelectionRangeWithinContent(content);
      if (!range) return;
      saveSelectionSnapshot(window.getSelection());
      const rect = range.getBoundingClientRect();
      const scrollX = window.pageXOffset || window.scrollX || 0;
      const scrollY = window.pageYOffset || window.scrollY || 0;
      const position = {
        x: rect.right + scrollX + 8,
        y: rect.top + scrollY
      };
      openColorMenu(position, content, item);
      return;
    }
    if (key === 'k') {
      e.preventDefault();
      closeColorMenu();
      const range = getSelectionRangeWithinContent(content);
      if (!range) return;
      saveSelectionSnapshot(window.getSelection());
      promptForHyperlink(content, item);
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
  const autoLinkDisabled = content.dataset && content.dataset.disableAutoLink === 'true';
  
  if (!autoLinkDisabled) {
    autoLinkContent(content);
  }
  
  const sanitizedContent = sanitizeHtml(content.innerHTML);
  
  if (content.innerHTML !== sanitizedContent) {
    content.innerHTML = sanitizedContent;
  }
  
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
