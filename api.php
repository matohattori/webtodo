<?php
// Simple PHP + SQLite3 API (PDOなし)
declare(strict_types=1);

// Start session for authentication
session_start();

header('Access-Control-Allow-Origin: *');

// Get and validate UID from query parameter
$uid = $_GET['uid'] ?? 'public';

// Validate UID: alphanumeric, hyphens only (security: prevent directory traversal)
if (!preg_match('/^[a-zA-Z0-9\-]+$/', $uid)) {
  http_response_code(400);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode(['error' => 'Invalid UID format']);
  exit;
}

// Create data directory if it doesn't exist
$dataDir = __DIR__ . DIRECTORY_SEPARATOR . 'data';
if (!is_dir($dataDir)) {
  mkdir($dataDir, 0755, true);
}

// User-specific database path
$dbPath = $dataDir . DIRECTORY_SEPARATOR . 'todo_' . $uid . '.db';
$db = new SQLite3($dbPath);

// Initialize database schema
function initializeDatabase($db): void {
  // Create todos table if not exists
  $db->exec('CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    text TEXT NOT NULL, 
    done INTEGER NOT NULL DEFAULT 0
  )');
  
  // Create user_meta table for password storage
  $db->exec('CREATE TABLE IF NOT EXISTS user_meta (
    uid TEXT PRIMARY KEY,
    pass_hash TEXT
  )');
  
  // Add new columns if they don't exist (migration)
  $result = $db->query("PRAGMA table_info(todos)");
  $columns = [];
  while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
    $columns[] = $row['name'];
  }
  
  if (!in_array('type', $columns)) {
    $db->exec('ALTER TABLE todos ADD COLUMN type TEXT NOT NULL DEFAULT "text"');
    // Migrate old 'task' type to 'checkbox' for backward compatibility
    $db->exec('UPDATE todos SET type = "checkbox" WHERE type = "task"');
  }
  if (!in_array('sort_order', $columns)) {
    $db->exec('ALTER TABLE todos ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0');
    // Set initial sort_order based on id
    $db->exec('UPDATE todos SET sort_order = id WHERE sort_order = 0');
  }
  if (!in_array('parent_id', $columns)) {
    $db->exec('ALTER TABLE todos ADD COLUMN parent_id INTEGER DEFAULT NULL');
  }
  if (!in_array('decoration', $columns)) {
    $db->exec('ALTER TABLE todos ADD COLUMN decoration TEXT DEFAULT NULL');
  }
  if (!in_array('deadline', $columns)) {
    $db->exec('ALTER TABLE todos ADD COLUMN deadline TEXT DEFAULT NULL');
  }
  if (!in_array('collapsed', $columns)) {
    $db->exec('ALTER TABLE todos ADD COLUMN collapsed INTEGER NOT NULL DEFAULT 0');
  }
}

// Check if password is set for this UID
function hasPassword($db, $uid): bool {
  $stmt = $db->prepare('SELECT pass_hash FROM user_meta WHERE uid = :uid');
  $stmt->bindValue(':uid', $uid, SQLITE3_TEXT);
  $result = $stmt->execute();
  $row = $result->fetchArray(SQLITE3_ASSOC);
  return $row !== false && !empty($row['pass_hash']);
}

// Verify password for this UID
function verifyPassword($db, $uid, $password): bool {
  $stmt = $db->prepare('SELECT pass_hash FROM user_meta WHERE uid = :uid');
  $stmt->bindValue(':uid', $uid, SQLITE3_TEXT);
  $result = $stmt->execute();
  $row = $result->fetchArray(SQLITE3_ASSOC);
  
  if ($row === false || empty($row['pass_hash'])) {
    return false;
  }
  
  return password_verify($password, $row['pass_hash']);
}

// Check if user is authenticated for this UID
function isAuthenticated($uid): bool {
  return isset($_SESSION['auth_' . $uid]) && $_SESSION['auth_' . $uid] === true;
}

// Require authentication - return 401 if not authenticated
function requireAuth($db, $uid): void {
  if (!hasPassword($db, $uid)) {
    // No password set, allow access
    return;
  }
  
  if (!isAuthenticated($uid)) {
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Authentication required', 'auth_required' => true]);
    exit;
  }
}

// Initialize database
initializeDatabase($db);

$action = $_GET['action'] ?? '';

function open_url_with_os(string $url): bool {
  if ($url === '' || !preg_match('/^https?:\/\//i', $url)) {
    return false;
  }
  
  // Normalize line endings/newlines to avoid command injection
  $url = str_replace(["\r", "\n"], '', $url);
  $osFamily = PHP_OS_FAMILY;
  
  if ($osFamily === 'Windows') {
    $escapedUrl = str_replace('"', '""', $url);
    $command = 'cmd /c start "" "' . $escapedUrl . '"';
    $handle = @popen($command, 'r');
    if ($handle !== false) {
      pclose($handle);
      return true;
    }
    
    // Fallback to PowerShell if cmd start fails (some PHP configs disable popen)
    $psCommand = 'Start-Process -FilePath "' . str_replace('"', '`"', $url) . '"';
    $ps = 'powershell -NoProfile -NonInteractive -WindowStyle Hidden -Command ' . escapeshellarg($psCommand);
    @exec($ps, $output, $code);
    return $code === 0;
  }
  
  $escaped = escapeshellarg($url);
  if ($osFamily === 'Darwin') {
    $command = 'open ' . $escaped . ' >/dev/null 2>&1 &';
  } else {
    $command = 'xdg-open ' . $escaped . ' >/dev/null 2>&1 &';
  }
  @shell_exec($command);
  return true;
}

switch ($action) {
  case 'check_session':
    // Check if user is logged in
    header('Content-Type: application/json; charset=utf-8');
    if (isset($_SESSION['user_id'])) {
      echo json_encode([
        'logged_in' => true,
        'uid' => $_SESSION['user_id']
      ]);
    } else {
      echo json_encode(['logged_in' => false]);
    }
    break;
  
  case 'login':
    // Login or register user
    $password = $_POST['password'] ?? '';
    
    if (empty($password)) {
      http_response_code(400);
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode(['error' => 'パスワードを入力してください']);
      break;
    }
    
    // Check if this is a new user (no password set) or existing user
    if (hasPassword($db, $uid)) {
      // Existing user - verify password
      if (verifyPassword($db, $uid, $password)) {
        $_SESSION['user_id'] = $uid;
        $_SESSION['auth_' . $uid] = true;
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['success' => true, 'message' => 'ログイン成功']);
      } else {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => 'パスワードが正しくありません']);
      }
    } else {
      // New user - register with this password
      $passHash = password_hash($password, PASSWORD_DEFAULT);
      $stmt = $db->prepare('INSERT INTO user_meta (uid, pass_hash) VALUES (:uid, :pass_hash)');
      $stmt->bindValue(':uid', $uid, SQLITE3_TEXT);
      $stmt->bindValue(':pass_hash', $passHash, SQLITE3_TEXT);
      $stmt->execute();
      
      $_SESSION['user_id'] = $uid;
      $_SESSION['auth_' . $uid] = true;
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode(['success' => true, 'message' => '新規登録が完了しました']);
    }
    break;
  
  case 'logout':
    // Logout user
    session_unset();
    session_destroy();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true]);
    break;
  
  case 'auth':
    // Authenticate user with password
    $password = $_POST['password'] ?? '';
    
    if (empty($password)) {
      http_response_code(400);
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode(['error' => 'Password required']);
      break;
    }
    
    if (verifyPassword($db, $uid, $password)) {
      $_SESSION['auth_' . $uid] = true;
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode(['success' => true, 'message' => 'Authenticated']);
    } else {
      http_response_code(401);
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode(['error' => 'Invalid password']);
    }
    break;
  
  case 'set_password':
    // Set or change password
    $newPassword = $_POST['newpass'] ?? '';
    $currentPassword = $_POST['current'] ?? '';
    
    if (empty($newPassword)) {
      http_response_code(400);
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode(['error' => 'New password required']);
      break;
    }
    
    // If password already exists, verify current password
    if (hasPassword($db, $uid)) {
      if (empty($currentPassword) || !verifyPassword($db, $uid, $currentPassword)) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['error' => '現在のパスワードが違います']);
        break;
      }
    }
    
    // Hash and store new password
    $passHash = password_hash($newPassword, PASSWORD_DEFAULT);
    $stmt = $db->prepare('INSERT OR REPLACE INTO user_meta (uid, pass_hash) VALUES (:uid, :pass_hash)');
    $stmt->bindValue(':uid', $uid, SQLITE3_TEXT);
    $stmt->bindValue(':pass_hash', $passHash, SQLITE3_TEXT);
    $stmt->execute();
    
    // Automatically authenticate after setting password
    $_SESSION['auth_' . $uid] = true;
    
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => true, 'message' => 'Password set successfully']);
    break;
  
  case 'check_auth':
    // Check if authentication is required and if user is authenticated
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
      'has_password' => hasPassword($db, $uid),
      'is_authenticated' => isAuthenticated($uid)
    ]);
    break;

  case 'list':
    requireAuth($db, $uid);
    $res = $db->query('SELECT id, text, done, type, sort_order, parent_id, decoration, deadline, collapsed FROM todos ORDER BY sort_order ASC, id ASC');
    $rows = [];
    while ($row = $res->fetchArray(SQLITE3_ASSOC)) { $rows[] = $row; }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($rows, JSON_UNESCAPED_UNICODE);
    break;

  case 'add':
    requireAuth($db, $uid);
    $text = trim((string)($_POST['text'] ?? ''));
    $type = (string)($_POST['type'] ?? 'text');
    $after_id = isset($_POST['after_id']) ? (int)$_POST['after_id'] : null;
    $allow_empty = isset($_POST['allow_empty']) && $_POST['allow_empty'] === '1';
    $deadline = isset($_POST['deadline']) ? $_POST['deadline'] : null;
    
    // Allow empty text for hr, checkbox, and list types
    if ($text !== '' || $allow_empty || in_array($type, ['hr', 'checkbox', 'list'])) {
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
      
      $stmt = $db->prepare('INSERT INTO todos (text, done, type, sort_order, parent_id, deadline) VALUES (:text, 0, :type, :sort_order, NULL, :deadline)');
      $stmt->bindValue(':text', $text, SQLITE3_TEXT);
      $stmt->bindValue(':type', $type, SQLITE3_TEXT);
      $stmt->bindValue(':sort_order', $newOrder, SQLITE3_INTEGER);
      $stmt->bindValue(':deadline', $deadline, SQLITE3_TEXT);
      $stmt->execute();

      $newId = $db->lastInsertRowID();
      header('Content-Type: application/json; charset=utf-8');
      echo json_encode([
        'id' => $newId,
        'text' => $text,
        'type' => $type,
        'done' => 0,
        'sort_order' => $newOrder,
        'deadline' => $deadline
      ], JSON_UNESCAPED_UNICODE);
    }
    break;

  case 'toggle':
    requireAuth($db, $uid);
    $id = (int)($_POST['id'] ?? 0);
    $done = (int)($_POST['done'] ?? 0);
    $stmt = $db->prepare('UPDATE todos SET done = :done WHERE id = :id');
    $stmt->bindValue(':done', $done, SQLITE3_INTEGER);
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    break;

  case 'edit':
    requireAuth($db, $uid);
    $id = (int)($_POST['id'] ?? 0);
    $textProvided = array_key_exists('text', $_POST);
    $text = $textProvided ? trim((string)$_POST['text']) : '';
    $typeProvided = array_key_exists('type', $_POST);
    $type = $typeProvided ? (string)$_POST['type'] : '';
    $decorationProvided = array_key_exists('decoration', $_POST);
    $decoration = $decorationProvided ? $_POST['decoration'] : null;
    $deadlineProvided = array_key_exists('deadline', $_POST);
    $deadline = $deadlineProvided ? $_POST['deadline'] : null;
    $collapsedProvided = array_key_exists('collapsed', $_POST);
    $collapsed = $collapsedProvided ? (int)$_POST['collapsed'] : 0;
    
    if ($id) {
      // Build dynamic SQL based on what fields are being updated
      $updates = [];
      $params = [];
      
      if ($textProvided) {
        $updates[] = 'text = :text';
        $params[':text'] = [$text, SQLITE3_TEXT];
      }
      if ($typeProvided && $type !== '') {
        $updates[] = 'type = :type';
        $params[':type'] = [$type, SQLITE3_TEXT];
      }
      if ($decorationProvided) {
        $updates[] = 'decoration = :decoration';
        $params[':decoration'] = [$decoration, SQLITE3_TEXT];
      }
      if ($deadlineProvided) {
        $updates[] = 'deadline = :deadline';
        $params[':deadline'] = [$deadline, SQLITE3_TEXT];
      }
      if ($collapsedProvided) {
        $updates[] = 'collapsed = :collapsed';
        $params[':collapsed'] = [$collapsed, SQLITE3_INTEGER];
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
    break;

  case 'delete':
    requireAuth($db, $uid);
    $id = (int)($_POST['id'] ?? 0);
    $stmt = $db->prepare('DELETE FROM todos WHERE id = :id');
    $stmt->bindValue(':id', $id, SQLITE3_INTEGER);
    $stmt->execute();
    break;

  case 'reorder':
    requireAuth($db, $uid);
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

  case 'open_link':
    requireAuth($db, $uid);
    $url = trim((string)($_POST['url'] ?? ''));
    $response = [
      'success' => false,
    ];
    if ($url === '' || !preg_match('/^https?:\/\//i', $url)) {
      $response['error'] = 'invalid_url';
    } else {
      $response['success'] = open_url_with_os($url);
      if (!$response['success']) {
        $response['error'] = 'launch_failed';
      }
    }
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($response, JSON_UNESCAPED_UNICODE);
    break;

  default:
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    echo "unknown action";
}
