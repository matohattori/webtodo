
const list = document.getElementById('todoList');
let draggedElement = null;

// callback: 再描画後に呼ばれる関数（任意）
function loadTodos(callback){
  fetch('api.php?action=list', {cache:'no-store'})
    .then(r=>r.json())
    .then(data=>{
      list.innerHTML='';
      // 表示順で表示（sort_orderでソート済み）
      data.forEach(todo=>{
        addTaskElement(
          todo.text, 
          todo.id, 
          Number(todo.done)===1, 
          todo.type || 'task',
          todo.parent_id
        );
      });
      // 常に末尾に空白行を1つ追加（新規入力用）
      addTaskElement('', null, false, 'task', null, false);
      if(typeof callback === 'function') callback();
    })
    .catch(()=>{});
}


// 新規タスクをサーバーに登録
function addTask(text, type = 'task', parent_id = null, callback) {
  text = text.trim();
  if(!text && type !== 'divider') return;
  const params = new URLSearchParams({text, type});
  if(parent_id) params.append('parent_id', parent_id);
  
  fetch('api.php?action=add',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body: params
  }).then(()=>{
    loadTodos(callback);
  });
}

function toggle(id, done){
  fetch('api.php?action=toggle',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body:new URLSearchParams({id, done: done?1:0})
  }).then(loadTodos);
}

function delTodo(id){
  fetch('api.php?action=delete',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body:new URLSearchParams({id})
  }).then(loadTodos);
}


// タスク要素を生成しリストに追加
function addTaskElement(text, id, done, type = 'task', parent_id = null, focusNew = false, insertAfter = null) {
  const li = document.createElement('li');
  if(id) li.dataset.id = id;
  if(done) li.classList.add('completed');
  li.dataset.type = type;
  if(parent_id) {
    li.dataset.parentId = parent_id;
    li.classList.add('subtask');
  }
  
  // Add type-specific class
  if(type === 'heading') li.classList.add('heading');
  if(type === 'divider') li.classList.add('divider');
  
  // Divider is special - no content, just a line
  if(type === 'divider') {
    li.draggable = true;
    setupDragAndDrop(li);
    const del = document.createElement('button');
    del.textContent = '×';
    del.className = 'delete';
    del.onclick = () => { if(id) delTodo(id); };
    li.appendChild(del);
    
    if(insertAfter && insertAfter.parentNode === list) {
      if(insertAfter.nextSibling) {
        list.insertBefore(li, insertAfter.nextSibling);
      } else {
        list.appendChild(li);
      }
    } else {
      list.appendChild(li);
    }
    return;
  }

  // Drag handle
  const dragHandle = document.createElement('span');
  dragHandle.textContent = '≡';
  dragHandle.className = 'drag-handle';
  li.appendChild(dragHandle);

  // Checkbox (only for tasks)
  let cb = null;
  if(type === 'task') {
    cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = done;
    cb.onchange = () => {
      if(id) toggle(id, cb.checked);
    };
    li.appendChild(cb);
  }

  // Input field
  const input = document.createElement('input');
  input.type = 'text';
  input.value = text;
  input.className = 'task-edit';
  if(done) input.disabled = true;
  
  if(!id && text === '') {
    input.placeholder = type === 'heading' ? '見出しを入力...' : 'タスクを入力...';
  }

  // Detect shortcuts like /h for heading, /hr for divider
  input.addEventListener('input', function(e) {
    const val = input.value.trim();
    if(!id && val === '/h') {
      input.value = '';
      input.placeholder = '見出しを入力...';
      li.dataset.type = 'heading';
      li.classList.add('heading');
      if(cb) {
        cb.remove();
        cb = null;
      }
    } else if(!id && val === '/hr') {
      // Create divider immediately
      input.value = '';
      addTask('', 'divider', null, () => {
        loadTodos();
      });
    }
  });

  let isSubmitting = false;
  
  input.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') {
      e.preventDefault();
      if(isSubmitting) return;
      
      const val = input.value.trim();
      const currentType = li.dataset.type || 'task';
      
      if(!id && val !== '') {
        // 新規行で値が入っていればサーバー登録
        isSubmitting = true;
        addTask(val, currentType, parent_id, () => {
          isSubmitting = false;
          // Focus on the new empty row added by loadTodos
          const emptyInputs = Array.from(list.querySelectorAll('input.task-edit')).filter(inp => !inp.value && !inp.closest('li').dataset.id);
          if(emptyInputs.length > 0) {
            setTimeout(() => emptyInputs[0].focus(), 50);
          }
        });
      } else if(id && val !== text) {
        // 既存タスク編集
        isSubmitting = true;
        updateTask(id, val, currentType, () => {
          isSubmitting = false;
        });
      } else if(!val) {
        // 空欄でEnter→何もしない（次のフィールドに移動）
        const items = Array.from(list.querySelectorAll('li'));
        const currentIdx = items.indexOf(li);
        if(currentIdx < items.length - 1) {
          const nextInput = items[currentIdx + 1].querySelector('input.task-edit');
          if(nextInput) nextInput.focus();
        }
      }
    } else if(e.key === 'Delete' && e.ctrlKey && id) {
      // Ctrl+Delete で削除
      e.preventDefault();
      delTodo(id);
    }
  });

  input.addEventListener('blur', function() {
    if(isSubmitting) return;
    
    const currentType = li.dataset.type || 'task';
    if(!id && input.value.trim() !== '') {
      // 新規行で値が入ったらサーバー登録
      addTask(input.value, currentType, parent_id);
    } else if(id && input.value.trim() !== text) {
      updateTask(id, input.value, currentType);
    }
  });

  li.appendChild(input);

  // Delete button
  const del = document.createElement('button');
  del.textContent = '×';
  del.className = 'delete';
  del.onclick = () => { if(id) delTodo(id); };
  li.appendChild(del);

  // Make draggable
  li.draggable = true;
  setupDragAndDrop(li);

  if(insertAfter && insertAfter.parentNode === list) {
    // 指定liの直後に挿入
    if(insertAfter.nextSibling) {
      list.insertBefore(li, insertAfter.nextSibling);
    } else {
      list.appendChild(li);
    }
  } else {
    list.appendChild(li);
  }
  
  if(focusNew) {
    setTimeout(()=>input.focus(), 0);
  }
}

function setupDragAndDrop(li) {
  li.addEventListener('dragstart', function(e) {
    draggedElement = li;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });

  li.addEventListener('dragend', function(e) {
    li.classList.remove('dragging');
    draggedElement = null;
    
    // Save new order
    const items = Array.from(list.querySelectorAll('li[data-id]'));
    const order = items.map(item => item.dataset.id);
    reorderTasks(order);
  });

  li.addEventListener('dragover', function(e) {
    e.preventDefault();
    if(draggedElement && draggedElement !== li) {
      const bounding = li.getBoundingClientRect();
      const offset = bounding.y + (bounding.height / 2);
      if(e.clientY - offset > 0) {
        li.parentNode.insertBefore(draggedElement, li.nextSibling);
      } else {
        li.parentNode.insertBefore(draggedElement, li);
      }
    }
  });
}

function updateTask(id, text, type = null, callback) {
  text = text.trim();
  if(!text && type !== 'divider') return;
  const params = new URLSearchParams({id, text});
  if(type) params.append('type', type);
  
  fetch('api.php?action=edit',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body: params
  }).then(() => {
    if(typeof callback === 'function') {
      callback();
    } else {
      loadTodos();
    }
  });
}

function reorderTasks(order) {
  fetch('api.php?action=reorder',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body: new URLSearchParams({order: JSON.stringify(order)})
  });
}

window.onload = loadTodos;
