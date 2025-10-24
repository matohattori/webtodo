# Sticky ToDo (Web + PHP + SQLite3, PDOなし)

## 使い方
1. このフォルダでPHPビルトインサーバーを起動:
   ```bash
   php -S localhost:8000
   ```
2. ブラウザで http://localhost:8000 を開く

## 付箋風の小ウィンドウ化（Windows）
- Chrome/Edge: 右上メニュー → 「保存と共有」→「ショートカットを作成」→「ウィンドウとして開く」

## 構成
- `index.html` : UI
- `style.css`  : スタイル
- `script.js`  : フロントロジック
- `api.php`    : CRUD API（SQLite3, PDOなし）
- `todo.db`    : 初回アクセス時に自動生成
