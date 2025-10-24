const list = document.getElementById('todoList');
const input = document.getElementById('taskInput');
const addBtn = document.getElementById('addBtn');

function loadTodos(){
  fetch('api.php?action=list', {cache:'no-store'})
    .then(r=>r.json())
    .then(data=>{
      list.innerHTML='';
      data.forEach(todo=>{
        const li=document.createElement('li');
        li.dataset.id=todo.id;
        if(Number(todo.done)===1) li.classList.add('completed');

        const cb=document.createElement('input');
        cb.type='checkbox';
        cb.checked=Number(todo.done)===1;
        cb.onchange=()=>toggle(todo.id, cb.checked);

        const span=document.createElement('span');
        span.textContent=todo.text;

        const del=document.createElement('button');
        del.textContent='×';
        del.className='delete';
        del.onclick=()=>delTodo(todo.id);

        li.appendChild(cb);
        li.appendChild(span);
        li.appendChild(del);
        list.appendChild(li);
      });
    })
    .catch(()=>{});
}

function add(){
  const text=input.value.trim();
  if(!text) return;
  fetch('api.php?action=add',{
    method:'POST',
    headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8'},
    body:new URLSearchParams({text})
  }).then(()=>{ input.value=''; loadTodos(); });
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

addBtn.onclick=add;
input.addEventListener('keydown', e=>{ if(e.key==='Enter') add(); });
window.onload=loadTodos;
