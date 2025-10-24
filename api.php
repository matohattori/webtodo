<?php
// Simple PHP + SQLite3 API (PDOなし)
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');

$dbPath = __DIR__ . DIRECTORY_SEPARATOR . 'todo.db';
$db = new SQLite3($dbPath);

// Create table if not exists
$db->exec('CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, 
  text TEXT NOT NULL, 
  done INTEGER NOT NULL DEFAULT 0
)');

// Add new columns if they don't exist (migration)
$result = $db->query("PRAGMA table_info(todos)");
$columns = [];
while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
  $columns[] = $row['name'];
}

if (!in_array('type', $columns)) {
  $db->exec('ALTER TABLE todos ADD COLUMN type TEXT NOT NULL DEFAULT "task"');
}
if (!in_array('sort_order', $columns)) {
  $db->exec('ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
  // Set initial sort_order based on id
  $db->exec('UPDATE todos SET sort_order = id WHERE sort_order = 0');
}
if (!in_array('parent_id', $columns)) {
  $db->exec('ALTER TABLE todos ADD COLUMN parent_id INTEGER DEFAULT NULL');
}

$action = $_GET['action'] ?? '';

switch ($action) {
  case 'list':
    $res = $db->query('SELECT id, text, done, type, sort_order, parent_id FROM todos ORDER BY sort_order ASC, id ASC');
    $rows = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) { $rows[] = $row; }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    break;

  case 'add':
    $text = trim((string)($_POST['text'] ?? ''));
    $type = (string)($_POST['type'] ?? 'task');
    $parent_id = isset($_POST['parent_id']) ? (int)$_POST['parent_id'] : null;
    $after_id = isset($_POST['after_id']) ? (int)$_POST['after_id'] : null;
    
    if ($text !== '' || $type === 'divider') {
      if ($after_id) {
        // Insert after specific item - get its sort_order and increment all following items
        $afterOrder = $db->querySingle("SELECT sort_order FROM todos WHERE id = {$after_id}");
        if ($afterOrder !== null) {
          $db->exec("UPDATE todos SET sort_order = sort_order + 1 WHERE sort_order > {$afterOrder}");
          $newOrder = $afterOrder + 1;
        } else {
          $maxOrder = $db->querySingle('SELECT MAX(sort_order) FROM todos');
          $newOrder = ($maxOrder === null) ? 0 : $maxOrder + 1;
        }
      } else {
        // Get max sort_order and add 1
        $maxOrder = $db->querySingle('SELECT MAX(sort_order) FROM todos');
        $newOrder = ($maxOrder === null) ? 0 : $maxOrder + 1;
      }
      
      $stmt = $db->prepare('INSERT INTO todos (text, done, type, sort_order, parent_id) VALUES (:text, 0, :type, :sort_order, :parent_id)');
      $stmt->bindValue(':text', $text, SQLITE3_TEXT);
      $stmt->bindValue(':type', $type, SQLITE3_TEXT);
      $stmt->bindValue(':sort_order', $newOrder, SQLITE3_INTEGER);
      $stmt->bindValue(':parent_id', $parent_id, SQLITE3_INTEGER);
      $stmt->execute();
    }
    break;

  case 'toggle':
    $id = (int)($_POST['id'] ?? 0);
    $done = (int)($_POST['done'] ?? 0);
    $stmt = $db->prepare('UPDATE todos SET done = :done WHERE id = :id');
    $stmt->bindValue(':done', $done, SQLITE3_INTEGER);
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    break;

  case 'edit':
    $id = (int)($_POST['id'] ?? 0);
    $text = trim((string)($_POST['text'] ?? ''));
    $type = (string)($_POST['type'] ?? '');
    $parent_id = isset($_POST['parent_id']) ? (($_POST['parent_id'] === '' || $_POST['parent_id'] === 'null') ? null : (int)$_POST['parent_id']) : null;
    $updateParent = isset($_POST['parent_id']);
    
    if ($id) {
      // Build dynamic SQL based on what fields are being updated
      $updates = [];
      $params = [];
      
      if ($text !== '' || $type !== '' || $updateParent) {
        if ($text !== '') {
          $updates[] = 'text = :text';
          $params[':text'] = [$text, SQLITE3_TEXT];
        }
        if ($type !== '') {
          $updates[] = 'type = :type';
          $params[':type'] = [$type, SQLITE3_TEXT];
        }
        if ($updateParent) {
          $updates[] = 'parent_id = :parent_id';
          $params[':parent_id'] = [$parent_id, SQLITE3_INTEGER];
        }
        
        if (count($updates) > 0) {
          $sql = 'UPDATE todos SET ' . implode(', ', $updates) . ' WHERE id = :id';
          $stmt = $db->prepare($sql);
          foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value[0], $value[1]);
          }
          $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
          $stmt->execute();
        }
      }
    }
    break;

  case 'delete':
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $db->prepare('DELETE FROM todos WHERE id = :id');
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    break;

  case 'reorder':
    // Reorder items based on array of IDs
    $order = json_decode($_POST['order'] ?? '[]', true);
    if (is_array($order)) {
      $db->exec('BEGIN TRANSACTION');
      foreach ($order as $index => $id) {
        $stmt = $db->prepare('UPDATE todos SET sort_order = :order WHERE id = :id');
        $stmt->bindValue(':order', $index, SQLITE3_INTEGER);
        $stmt->bindValue(':id', (int)$id, SQLITE3_INTEGER);
        $stmt->execute();
      }
      $db->exec('COMMIT');
    }
    break;

  default:
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "unknown action";
}
