
const list = document.getElementById('todoList');

// callback: 再描画後に呼ばれる関数（任意）
function loadTodos(callback){
  fetch('api.php?action=list', {cache:'no-store'})
    .then(r=>r.json())
    .then(data=>{
      list.innerHTML='';
      // 逆順で表示（新しいものが下に来る）
      data.reverse().forEach(todo=>{
        addTaskElement(todo.text, todo.id, Number(todo.done)===1);
      });
      // タスクが0件なら空白行を1つ追加
      if(data.length === 0) {
        addTaskElement('', null, false, true);
      }
      if(typeof callback === 'function') callback();
    })
    .catch(()=>{});
}


// 新規タスクをサーバーに登録
function addTask(text, callback) {
  text = text.trim();
  if(!text) return;
  fetch('api.php?action=add',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body:new URLSearchParams({text})
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
function addTaskElement(text, id, done, focusNew = false, insertAfter = null) {
  const li = document.createElement('li');
  if(id) li.dataset.id = id;
  if(done) li.classList.add('completed');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = done;
  cb.onchange = () => {
    if(id) toggle(id, cb.checked);
  };

  const input = document.createElement('input');
  input.type = 'text';
  input.value = text;
  input.className = 'task-edit';
  if(done) input.disabled = true;

  input.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') {
      e.preventDefault();
      const val = input.value.trim();
      if(!id && val !== '') {
        // 新規行で値が入っていればサーバー登録→完了後に空欄追加
        addTask(val, () => {
          // サーバー登録後、値がvalのinputにフォーカス
          const items = Array.from(list.querySelectorAll('li'));
          let idx = items.findIndex(item => {
            const inp = item.querySelector('input.task-edit');
            return inp && inp.value.trim() === val;
          });
          let targetInput = null;
          if(idx !== -1) {
            targetInput = items[idx].querySelector('input.task-edit');
            addTaskElement('', null, false, false, items[idx]);
          } else {
            addTaskElement('', null, false, false);
          }
          if(targetInput) setTimeout(()=>targetInput.focus(), 0);
        });
      } else if(id && val !== text) {
        // 既存タスク編集→完了後に空欄追加
        updateTask(id, val, () => {
          const items = Array.from(list.querySelectorAll('li'));
          let idx = items.findIndex(item => item.dataset.id == id);
          if(idx !== -1) {
            addTaskElement('', null, false, true, items[idx]);
          } else {
            addTaskElement('', null, false, true);
          }
        });
      } else {
        // 空欄や既存タスクでEnterのみ→下に空欄
        addTaskElement('', null, false, true, li);
      }
    }
  });

  input.addEventListener('blur', function() {
    if(!id && input.value.trim() !== '') {
      // 新規行で値が入ったらサーバー登録
      addTask(input.value);
    } else if(id && input.value.trim() !== text) {
      updateTask(id, input.value);
    }
  });

  const del = document.createElement('button');
  del.textContent = '×';
  del.className = 'delete';
  del.onclick = () => { if(id) delTodo(id); };

  li.appendChild(cb);
  li.appendChild(input);
  li.appendChild(del);
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

function updateTask(id, text, callback) {
  text = text.trim();
  if(!text) return;
  fetch('api.php?action=edit',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body:new URLSearchParams({id, text})
  }).then(() => {
    if(typeof callback === 'function') {
      callback();
    } else {
      loadTodos();
    }
  });
}

window.onload = loadTodos;
