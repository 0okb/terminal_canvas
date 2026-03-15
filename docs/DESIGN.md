# Terminal Canvas - 設計ドキュメント

## 概要

macOS向けの複数コンソール管理ツール。無限キャンバス上に複数のターミナルを自由配置し、パン・ズーム操作で俯瞰的に監視できる。主な用途は複数のClaude Codeインスタンスの同時進捗監視。

Claude Codeのステータス（思考中・ツール実行中・許可待ちなど）をリアルタイムで検知し、各ターミナルペインに視覚的に表示する。セッションごとのコスト（トークン使用量）を追跡し、タイムラインで状態遷移を可視化する。

将来的にWindows/Linux対応も予定。

---

## 技術スタック

| レイヤー | 技術 | 理由 |
|---|---|---|
| フレームワーク | Tauri v2 | 軽量、クロスプラットフォーム、ネイティブWebView |
| Frontend | TypeScript + Solid.js 1.9 | 軽量、高パフォーマンス、リアクティブ |
| ターミナル | xterm.js 6 + @xterm/addon-fit | 成熟したWebターミナルエミュレータ |
| Backend | Rust | Tauri標準、システムレベルのPTY操作 |
| PTY | portable-pty 0.9.0 | クロスプラットフォームPTYライブラリ |
| ビルド/配布 | Tauri CLI + Vite 6 | `.dmg` (macOS) / `.msi` (Windows) 生成 |

---

## アーキテクチャ

```
┌────────────────────────────────────────────────────────────────┐
│  Tauri Window (Native WebView) 1200x800                        │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Toolbar                                                  │  │
│  │  [+ New] [Recent ▼] | [Timeline]                          │  │
│  │                                    Total: $0.1234  100%   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Canvas Layer (CSS transform)                             │  │
│  │  transform: translate(x,y) scale(z)                       │  │
│  │  transform-origin: 0 0                                    │  │
│  │                                                           │  │
│  │  ┌──────────────────┐   ┌──────────────────┐             │  │
│  │  │ TerminalPane      │   │ TerminalPane      │            │  │
│  │  │ ┌──────────────┐ │   │ ┌──────────────┐ │            │  │
│  │  │ │ titlebar     │ │   │ │ titlebar     │ │            │  │
│  │  │ ├──────────────┤ │   │ ├──────────────┤ │            │  │
│  │  │ │ xterm.js     │ │   │ │ xterm.js     │ │            │  │
│  │  │ │ pty_id:1     │ │   │ │ pty_id:2     │ │            │  │
│  │  │ ├──────────────┤ │   │ ├──────────────┤ │            │  │
│  │  │ │ ● Thinking.. │ │   │ │ ● Idle $0.05 │ │            │  │
│  │  │ └──────────────┘ │   │ └──────────────┘ │            │  │
│  │  └──────────────────┘   └──────────────────┘             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Timeline Panel (トグル表示, 180px)                       │  │
│  │  ┌────────┬───────────────────────────────────────────┐  │  │
│  │  │ ~/proj │ ███████░░░░░░████████░░░░░████████████    │  │  │
│  │  │ ~/app  │ ░░░░░░██████░░░░░░░░░████████░░░░░░░░░   │  │  │
│  │  ├────────┼───────────────────────────────────────────┤  │  │
│  │  │        30m ago     20m ago     10m ago        now   │  │  │
│  │  └────────┴───────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│  Tauri IPC (invoke / event)                                    │
├────────────────────────────────────────────────────────────────┤
│  Rust Backend                                                  │
│                                                                │
│  PtyManager                                                    │
│  ├─ sessions: Arc<Mutex<HashMap<u32, PtySession>>>             │
│  ├─ create_pty(shell?, cwd?, cols, rows) -> pty_id             │
│  ├─ write_pty(pty_id, data)                                    │
│  ├─ resize_pty(pty_id, cols, rows)                             │
│  └─ close_pty(pty_id)                                          │
│                                                                │
│  PtySession                                                    │
│  ├─ master: Box<dyn MasterPty + Send>                          │
│  ├─ writer: Box<dyn Write + Send>                              │
│  ├─ output thread -> emit("pty-output")                        │
│  └─ exit thread -> emit("pty-exit")                            │
│                                                                │
│  HooksManager                                                  │
│  ├─ setup_hooks() -> Claude settings.json更新                   │
│  └─ status_watcher thread -> emit("claude-status" + cost)      │
│                                                                │
│  ThemeManager                                                  │
│  └─ load_theme() -> Theme (terminal + ui + status)             │
│                                                                │
│  HistoryManager                                                │
│  ├─ load_history() -> Vec<String>                              │
│  └─ add_directory(dir)                                         │
│                                                                │
│  WorkspaceManager                                              │
│  ├─ save(WorkspaceData) -> 永続化                               │
│  └─ load() -> Option<WorkspaceData>                            │
└────────────────────────────────────────────────────────────────┘
```

---

## コンポーネント設計

### Frontend

#### 1. App (ルートコンポーネント)
- テーマの読み込みとCSS変数への適用 (`loadTheme` → `applyUiTheme`)
- テーマ読み込み完了まで `<Show>` ゲートで描画を遅延
- **ワークスペース自動復元**: 起動時に前回のワークスペースを復元（ターミナル配置・キャンバス状態）
- **ワークスペース自動保存**: 30秒間隔で自動保存 + ウィンドウ閉じ時にも保存
- Toolbar + Canvas + TimelinePanel（トグル表示）をマウント

#### 2. Canvas
- **役割**: 無限キャンバスの実装
- **パン操作**: キャンバス背景を左クリックドラッグ / トラックパッド2本指スクロール（ターミナルペイン外のみ）
- **ズーム操作**: Ctrl+スクロール (macOSではCmd+スクロールも対応)。ターミナルペイン上でも動作
- **実装方法**: 親要素に `overflow: hidden`、子要素 `.canvas-content` に `transform: translate(panX, panY) scale(zoom)` を適用。`transform-origin: 0 0`、`will-change: transform` でGPUアクセラレーション
- **ズーム範囲**: 0.1 〜 3.0
- **ズーム計算**: マウスカーソル位置を中心にズーム（パン値をスケール比で補正）
- **背景**: ドットグリッドパターン (`radial-gradient`、20px間隔)
- **スクロール挙動**: ターミナルペイン上の通常スクロールはxterm.jsにパススルー

#### 3. TerminalPane
- **役割**: 個別ターミナルのコンテナ
- **構造**: タイトルバー → ターミナルコンテンツ → ステータスバー → リサイズハンドル
- **ドラッグ移動**: タイトルバー部分を左ドラッグ（ズームレベルを考慮した座標補正あり）
- **リサイズ**: 右下角のリサイズハンドルをドラッグ（ズームレベルを考慮）
- **ステータス表示**: ボーダー色がステータスに連動。thinking/tool_running/permission時はパルスアニメーション
- **ステータスバー**: ステータスインジケーター（丸ドット）+ ステータスラベル + コスト表示（右寄せ）
- **閉じるボタン**: タイトルバー右端の「x」ボタン
- **状態**:
  ```typescript
  interface TerminalPaneData {
    id: string;           // "terminal-{nextId}" 形式
    ptyId: number;        // PTY プロセスID
    x: number;            // キャンバス上のX座標 (px)
    y: number;            // キャンバス上のY座標 (px)
    width: number;        // 幅 (px, デフォルト600, 最小300)
    height: number;       // 高さ (px, デフォルト400, 最小200)
    title: string;        // シェルOSCシーケンスから取得、ディレクトリパス形式のみ受け入れ
    cwd: string;          // 作業ディレクトリ（ワークスペース保存・フック紐付けに使用）
    status: ClaudeStatus; // 現在のステータス
    statusDetail: string; // tool_running時のツール名
    cost: number;         // セッションのコスト (USD)
  }
  ```
- **アクティブ状態**: `activeTerminalId` シグナルで別管理（TerminalPaneData外）

#### 4. TerminalView
- **役割**: xterm.jsのラッパー
- xterm.js Terminal インスタンスを管理（fontSize: 14, fontFamily: Menlo/Monaco, scrollback: 5000, cursorBlink: true）
- xterm-addon-fit で親コンテナにフィット
- Tauri IPC経由でPTYとデータ送受信
- ResizeObserverでリサイズ検知 → fitAddon.fit() → resize_pty呼び出し
- `onTitleChange` でシェルのOSCタイトル変更を検知。ディレクトリパス形式（`~` or `/` 始まり）のみ受け入れ、`cwd` フィールドにも保存
- **Claude Codeステータス検知** (デュアル戦略):
  1. **フック経由 (Primary)**: `claude-status` イベントをリッスンし、session_idまたはcwdで対象ターミナルと紐付け。コスト情報も取得
  2. **スクリーンスクレイピング (Fallback)**: フックが3秒以上無反応の場合、500ms間隔でxterm.jsの画面内容をパターンマッチ

#### 5. statusDetector
- **役割**: xterm.jsの画面内容からClaude Codeのステータスをパターンマッチで検出（フォールバック用）
- **検出優先順位** (先にマッチしたものが優先):
  1. `permission`: Allow/Deny、確認プロンプト、y/nプロンプト、overwrite、Are you sure
  2. `error`: Error、ERROR、Failed、Panic
  3. `tool_running`: スピナー文字（ブレイル文字 ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏ など）
  4. `thinking`: "Thinking" キーワード
  5. `idle`: パターン不一致時のデフォルト
- **実装**: `terminal.buffer.active` から全行を読み取り、正規表現でマッチ

#### 6. Toolbar
- **役割**: 操作UI
- **左側グループ**:
  - 「+ New Terminal」ボタン: デフォルトサイズ (80x24) でPTY作成、カスケード配置 (30pxオフセット)
  - 「Recent」ドロップダウン: 最近使用したディレクトリ一覧。選択するとそのディレクトリでターミナルを開く
    - パス表示の短縮: `/Users/username/...` → `~/...`
    - ドロップダウン外クリックで閉じる
  - セパレーター
  - 「Timeline」トグルボタン: タイムラインパネルの表示/非表示
- **右側グループ** (flex spacerで右寄せ):
  - 合計コスト表示: `Total: $X.XXXX`（コスト > 0 の場合のみ表示）
  - ズームレベル表示 (パーセント)
  - 「Reset View」ボタン: パン・ズームをリセット (0, 0, 1.0)

#### 7. TimelinePanel
- **役割**: ステータス遷移のタイムライン可視化
- **表示切替**: Toolbarの「Timeline」ボタンでトグル
- **レイアウト**: 画面下部、固定高さ180px
- **構造**:
  - ヘッダー: "Timeline (30min)" ラベル
  - トラック領域: 各ターミナルの横棒。左にターミナル名、右に色付きセグメント
  - 時間軸: 5分刻みの目盛り（"30m ago" 〜 "now"）
- **セグメント**: `TimelineEntry` のステータスに応じた色（`theme.status` から取得）
- **自動更新**: 1秒ごとに `now` を更新し、現在進行中のセグメント幅が伸びる
- **データ保持**: 直近30分。古いエントリは自動削除

### Stores (状態管理)

#### canvasStore
- SolidJSシグナルで `panX`, `panY`, `zoom` を管理
- `applyZoom(delta, centerX, centerY)`: カーソル中心ズーム（パン補正計算あり）
- `resetView()`: 初期状態へリセット
- 全setter (`setPanX`, `setPanY`, `setZoom`) をexport（ワークスペース復元で使用）

#### terminalStore
- SolidJS Store + `produce` でイミュータブル更新
- `terminals`: TerminalPaneData配列
- `activeTerminalId`: 現在アクティブなターミナルID（シグナル）
- `nextId`: 自動インクリメントID
- 関数: `addTerminal` (opts: width/height指定可), `updateTerminalPosition`, `updateTerminalSize`, `updateTerminalTitle`, `updateTerminalCwd`, `updateTerminalStatus` (timelineStoreへも記録), `updateTerminalCost`, `totalCost`, `removeTerminal`, `clearAllTerminals`
- `updateTerminalStatus` は `timelineStore.recordStatusChange` を呼び出してタイムラインデータも更新

#### themeStore
- Tauriバックエンドから `get_theme` でテーマを取得
- CSS変数として `:root` に適用 (20個のUI変数)
- `themeLoaded` シグナルで読み込み完了を通知

#### timelineStore
- `timelineData`: `Record<string, TimelineEntry[]>` — ターミナルIDごとのステータス遷移履歴
- `timelineVisible`: タイムラインパネルの表示状態（シグナル）
- `toggleTimeline()`: 表示切替
- `recordStatusChange(terminalId, status)`: ステータス変更を記録。前のエントリを閉じ、新エントリを追加。30分超のデータは自動削除

### 型定義 (types.ts)

```typescript
type ClaudeStatus =
  | "idle"           // 待機中
  | "thinking"       // 思考中
  | "tool_running"   // ツール実行中
  | "permission"     // ユーザー確認待ち
  | "error"          // エラー発生
  | "completed"      // プロセス終了

interface PtyOutput {
  pty_id: number;
  data: string;
}

interface PtyExit {
  pty_id: number;
  code: number;
}

interface ClaudeStatusEvent {
  session_id: string;
  status: string;
  tool_name: string;
  cwd: string;
  timestamp: number;
  cost: number;          // セッションコスト (USD, Stopイベント時に取得)
}

interface TimelineEntry {
  status: ClaudeStatus;
  startTime: number;     // Date.now() ミリ秒
  endTime: number | null; // null = 現在進行中
}

interface WorkspaceTerminal {
  x: number;
  y: number;
  width: number;
  height: number;
  cwd: string;
}

interface WorkspaceCanvas {
  pan_x: number;
  pan_y: number;
  zoom: number;
}

interface WorkspaceData {
  canvas: WorkspaceCanvas;
  terminals: WorkspaceTerminal[];
}

interface Theme {
  terminal: TerminalColors;  // xterm.js用カラー (22色)
  ui: UiColors;              // UIコンポーネント用カラー (20色)
  status: StatusColors;      // ステータスインジケーター用カラー (6色)
}
```

### Backend (Rust)

#### 1. PtyManager (`pty_manager.rs`)
- PTYセッションの生成・管理・破棄
- セッションIDの採番 (`AtomicU32`)
- スレッドセーフ: `Arc<Mutex<HashMap<u32, PtySession>>>`
- PTY作成時に2つのバックグラウンドスレッドを生成:
  - **出力リーダースレッド**: 4096バイトバッファで連続読み取り → `pty-output` イベント発行
  - **終了監視スレッド**: `child.wait()` で終了待ち → `pty-exit` イベント発行
- デフォルトシェル: `SHELL` 環境変数、未設定時は `/bin/zsh`
- ログインシェルとして起動 (`-l` フラグ)
- `cwd` パラメータでPTYの作業ディレクトリを指定可能

#### 2. Hooks (`hooks.rs`)
- **役割**: Claude Codeのフック設定とステータス監視
- `setup_hooks()`:
  - `~/.terminal-canvas/hooks/status-hook.sh` にフックスクリプトを配置
  - `~/.claude/settings.json` にフックエントリを追加 (PreToolUse, PostToolUse, Stop, Notification)
  - フックタイムアウト: 5秒
  - `/tmp/terminal-canvas/` ディレクトリを作成
- `start_status_watcher(app_handle)`:
  - バックグラウンドスレッドで300ms間隔のポーリング
  - `/tmp/terminal-canvas/*.json` を監視
  - 新規・更新されたステータスファイルを検知 → `claude-status` イベント発行（`cost` フィールド含む）
  - cwdを自動的に最近のディレクトリに追加
  - 1時間以上経過したステータスファイルを自動クリーンアップ

#### 3. Theme (`theme.rs`)
- テーマ設定の読み込みと提供
- 設定ファイルパス:
  - macOS: `~/Library/Application Support/terminal-canvas/theme.json`
  - Windows: `%APPDATA%\terminal-canvas\theme.json`
  - Linux: `~/.config/terminal-canvas/theme.json`
- ファイルが存在しない場合はデフォルトテーマを生成して保存
- テーマ構造: TerminalColors (22色) + UiColors (20色) + StatusColors (6色)

#### 4. History (`history.rs`)
- 最近使用したディレクトリの履歴管理
- 最大10件、重複時は先頭に移動
- 設定ファイルパス: プラットフォーム別configディレクトリの `recent_directories.json`

#### 5. Workspace (`workspace.rs`)
- ワークスペースの保存・復元
- 保存データ: キャンバス状態（panX, panY, zoom）+ ターミナル配列（x, y, width, height, cwd）
- 設定ファイルパス: プラットフォーム別configディレクトリの `workspace.json`
- **自動保存**: Frontendから30秒間隔 + ウィンドウ閉じ時（手動Save/Loadボタンなし）
- **自動復元**: アプリ起動時に前回のワークスペースを自動復元

#### 6. Tauri Commands (IPC)
| コマンド | 引数 | 戻り値 | 説明 |
|---|---|---|---|
| `create_pty` | shell?: String, cwd?: String, cols: u16, rows: u16 | Result<u32, String> | 新規PTYセッション作成 |
| `write_pty` | pty_id: u32, data: String | Result<(), String> | PTYにデータ書き込み |
| `resize_pty` | pty_id: u32, cols: u16, rows: u16 | Result<(), String> | PTYサイズ変更 |
| `close_pty` | pty_id: u32 | Result<(), String> | PTYセッション終了 |
| `get_theme` | なし | Theme | テーマ設定取得 |
| `setup_claude_hooks` | なし | Result<String, String> | Claude Codeフック設定 |
| `get_recent_directories` | なし | Vec<String> | 最近のディレクトリ一覧取得 |
| `add_recent_directory` | dir: String | () | ディレクトリを履歴に追加 |
| `save_workspace` | data: WorkspaceData | Result<(), String> | ワークスペース保存 |
| `load_workspace` | なし | Option<WorkspaceData> | ワークスペース復元 |

#### 7. Tauri Events (Backend → Frontend)
| イベント | ペイロード | 説明 |
|---|---|---|
| `pty-output` | { pty_id: u32, data: String } | PTYからの出力データ |
| `pty-exit` | { pty_id: u32, code: i32 } | PTYプロセス終了 (0=成功, 1=失敗, -1=エラー) |
| `claude-status` | { session_id: String, status: String, tool_name: String, cwd: String, timestamp: u64, cost: f64 } | Claude Codeステータス変更 + コスト情報 |

#### 8. ステータスフックスクリプト (`resources/status-hook.sh`)
- Claude Codeのフックイベントから呼び出されるシェルスクリプト
- stdinからJSON入力を受け取り、イベント種別をステータスにマッピング:
  - `PreToolUse` → `"tool_running"`
  - `PostToolUse` → `"thinking"`
  - `Stop` → `"idle"` + `cost.total_cost_usd` を取得
  - `Notification` (permission_prompt) → `"permission"`
- `/tmp/terminal-canvas/$SESSION_ID.json` にステータスファイルを書き出し（costフィールド含む）

---

## データフロー

### ユーザー入力 → PTY
```
KeyPress → xterm.js onData → invoke("write_pty", {ptyId, data}) → Rust → PTY stdin
```

### PTY出力 → 画面表示
```
PTY stdout → Rust reader thread (4096B buffer) → emit("pty-output", {pty_id, data}) → Frontend listener → xterm.js write(data)
```

### ターミナルリサイズ
```
TerminalPane resize → ResizeObserver → fitAddon.fit() → proposeDimensions() → invoke("resize_pty", {ptyId, cols, rows}) → Rust → PTY resize
```

### Claude Codeステータス検知 (フック経由)
```
Claude Code → フックイベント → status-hook.sh → /tmp/terminal-canvas/$SESSION_ID.json (status + cost)
→ Rust status_watcher (300msポーリング) → emit("claude-status", event) → Frontend listener
→ session_id or cwd でターミナルと紐付け → updateTerminalStatus() + updateTerminalCost()
→ timelineStore.recordStatusChange() でタイムラインにも記録
```

### Claude Codeステータス検知 (フォールバック)
```
500ms interval → readScreenContent(terminal.buffer) → パターンマッチ (detectStatus) → updateTerminalStatus()
※ フックが3秒以上無反応の場合のみ作動
```

### ワークスペース保存/復元
```
保存: terminals + canvasState → WorkspaceData → invoke("save_workspace") → workspace.json
復元: invoke("load_workspace") → WorkspaceData → setPan/setZoom + create_pty × N → addTerminal × N
自動保存: 30秒間隔のsetInterval + beforeunload イベント
自動復元: App.onMount 時に load_workspace → ターミナル再作成
```

### コスト集計
```
claude-status event (cost > 0) → updateTerminalCost(terminalId, cost)
→ TerminalPane statusbar に個別コスト表示
→ Toolbar に totalCost() 表示 (全ターミナルの合計)
```

### タイムライン記録
```
updateTerminalStatus() → recordStatusChange(terminalId, status)
→ 前エントリの endTime を確定 + 新エントリ追加
→ TimelinePanel が1秒ごとに再描画（now更新）
```

---

## キャンバス操作仕様

### パン (視点移動)
- **トリガー**: キャンバス背景を左クリックドラッグ / トラックパッド2本指スクロール（ターミナルペイン外のみ）
- **動作**: キャンバス全体を平行移動
- **カーソル**: パン中は `cursor: grabbing`

### ズーム (拡大縮小)
- **トリガー**: Ctrl+スクロール / Cmd+スクロール (macOS) ※ターミナルペイン上でも動作
- **動作**: マウスカーソル位置を中心にズーム（パン値をスケール比率で補正）
- **範囲**: 0.1x 〜 3.0x
- **ステップ**: `-deltaY * 0.005`

### ターミナル操作
- **移動**: タイトルバーを左ドラッグ（ズームレベル考慮済み）
- **リサイズ**: 右下角のリサイズハンドル（ズームレベル考慮済み）
- **フォーカス**: タイトルバーをドラッグするとそのターミナルがアクティブに
- **最小サイズ**: 300x200 px
- **デフォルトサイズ**: 600x400 px
- **新規作成配置**: (50 + N*30, 50 + N*30) のカスケード配置 (N = 既存ターミナル数)
- **閉じる**: タイトルバーの「x」ボタン → PTYクローズ + ペイン削除

---

## スレッド管理

| スレッド | スコープ | 役割 |
|---|---|---|
| PTY出力リーダー | PTYごと | PTYからの出力を読み取り `pty-output` イベントを発行 |
| PTY終了監視 | PTYごと | プロセス終了を検知し `pty-exit` イベントを発行 |
| ステータスウォッチャー | グローバル (1つ) | `/tmp/terminal-canvas/` を300ms間隔でポーリングし `claude-status` イベントを発行 |

---

## 永続化ファイル一覧

全てプラットフォーム別configディレクトリ (`~/Library/Application Support/terminal-canvas/` on macOS) に保存。

| ファイル | 内容 | 更新タイミング |
|---|---|---|
| `theme.json` | UI・ターミナル・ステータスの全色設定 | 初回起動時にデフォルト生成。ユーザーが手動編集 |
| `workspace.json` | キャンバス状態 + ターミナル配置 | 30秒自動保存 + ウィンドウ閉じ時 + 手動Save |
| `recent_directories.json` | 最近使用したディレクトリ (最大10件) | ターミナル開設時 + フックイベント検知時 |

---

## ディレクトリ構成

```
terminal-canvas/
├── src-tauri/               # Rust Backend
│   ├── src/
│   │   ├── main.rs          # エントリポイント
│   │   ├── lib.rs           # Tauriアプリ初期化、コマンド登録、setup
│   │   ├── commands.rs      # Tauri IPCコマンドハンドラ (10コマンド)
│   │   ├── pty_manager.rs   # PTYセッション管理
│   │   ├── hooks.rs         # Claude Codeフック設定・ステータス監視
│   │   ├── history.rs       # 最近のディレクトリ履歴管理
│   │   ├── theme.rs         # テーマ設定管理
│   │   └── workspace.rs     # ワークスペース保存・復元
│   ├── resources/
│   │   └── status-hook.sh   # Claude Codeステータスフックスクリプト
│   ├── capabilities/
│   │   └── default.json     # ウィンドウ権限設定
│   ├── icons/               # アプリケーションアイコン
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/                     # Frontend (Solid.js + TypeScript)
│   ├── index.tsx            # エントリポイント
│   ├── App.tsx              # ルートコンポーネント (テーマ・ワークスペース復元・自動保存)
│   ├── App.css              # グローバルスタイル
│   ├── types.ts             # 型定義
│   ├── statusDetector.ts    # 画面スクレイピングによるステータス検出
│   ├── components/
│   │   ├── Canvas.tsx       # 無限キャンバス (パン・ズーム)
│   │   ├── TerminalPane.tsx # ターミナルペイン (ドラッグ・リサイズ・ステータス・コスト表示)
│   │   ├── TerminalView.tsx # xterm.js統合 + ステータス検知 + コスト追跡
│   │   ├── Toolbar.tsx      # ツールバー (新規作成・最近のディレクトリ・Save/Load・Timeline・コスト合計・ズーム)
│   │   └── TimelinePanel.tsx # タイムラインパネル (ステータス遷移可視化)
│   └── stores/
│       ├── canvasStore.ts   # キャンバス状態 (panX, panY, zoom)
│       ├── terminalStore.ts # ターミナル一覧・アクティブ状態・コスト集計
│       ├── themeStore.ts    # テーマ読み込み・CSS変数適用
│       └── timelineStore.ts # タイムラインデータ・表示状態
├── docs/
│   └── DESIGN.md            # 本ドキュメント
├── public/                  # 静的アセット
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 制約・前提

- macOS最優先、後からWindows/Linux対応
- ターミナルはフルPTY (Claude Codeの対話型UIが動作すること)
- Electronは使用しない
- 配布を前提とした設計 (コード署名・公証対応)
- テーマ設定はプラットフォーム別のconfigディレクトリに保存
- Claude Codeとの連携は `~/.claude/settings.json` のフック機構を利用
- ワークスペースは自動保存/復元（手動Save/Loadも可能）
- タイムラインデータはメモリ内のみ（直近30分、永続化しない）
- コスト情報はClaude Code Stopイベントのみから取得（セッション累計コスト）
