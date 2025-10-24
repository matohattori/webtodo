<?php
// Simple PHP + SQLite3 API (PDOなし)
declare(strict_types=1);

header('Access-Control-Allow-Origin: *');

$dbPath = __DIR__ . DIRECTORY_SEPARATOR . 'todo.db';
$db = new SQLite3($dbPath);
$db->exec('CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, text TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0)');

$action = $_GET['action'] ?? '';

switch ($action) {
  case 'list':
    $res = $db->query('SELECT id, text, done FROM todos ORDER BY id DESC');
    $rows = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) { $rows[] = $row; }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    break;

  case 'add':
    $text = trim((string)($_POST['text'] ?? ''));
    if ($text !== '') {
      $stmt = $db->prepare('INSERT INTO todos (text, done) VALUES (:text, 0)');
      // 公式マニュアルの書式に従い bindValue を使用
      // https://www.php.net/manual/en/sqlite3stmt.bindvalue.php
      $stmt->bindValue(':text', $text, SQLITE3_TEXT);
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
    if ($id && $text !== '') {
      $stmt = $db->prepare('UPDATE todos SET text = :text WHERE id = :id');
      $stmt->bindValue(':text', $text, SQLITE3_TEXT);
      $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
      $stmt->execute();
    }
    break;

  case 'delete':
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $db->prepare('DELETE FROM todos WHERE id = :id');
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    break;

  default:
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "unknown action";
}
