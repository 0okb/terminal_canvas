# Terminal Canvas

無限キャンバス上に複数のターミナルを自由配置できるデスクトップアプリケーション。複数のClaude Codeインスタンスを同時に監視するために設計されています。

```
┌──────────────────────────────────────────────────┐
│ [+ New] [Recent ▼] | [Timeline]    $0.12  100%  │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐   ┌──────────────┐             │
│  │ ~/project-a  │   │ ~/project-b  │             │
│  │ ┌──────────┐ │   │ ┌──────────┐ │             │
│  │ │ claude.. │ │   │ │ claude.. │ │             │
│  │ ├──────────┤ │   │ ├──────────┤ │             │
│  │ │● 思考中  │ │   │ │● ツール  │ │             │
│  │ └──────────┘ │   │ └──────────┘ │             │
│  └──────────────┘   └──────────────┘             │
│                                                  │
├──────────────────────────────────────────────────┤
│ Timeline: ██░░████░░░███████  (30min)            │
└──────────────────────────────────────────────────┘
```

## 主な機能

- **無限キャンバス** — パン・ズームでターミナルを自由に配置
- **Claude Codeステータス検知** — hooksによるリアルタイム検知（思考中 / ツール実行中 / 許可待ち / エラー / 待機中）
- **ステータス連動の枠色** — 各ターミナルの枠線がステータスに応じて変化し、アクティブ時はパルスアニメーション
- **コスト追跡** — ターミナルごと・合計のセッションコストをツールバーに表示
- **タイムライン** — 直近30分のステータス遷移を色分けで可視化
- **ワークスペース自動保存** — ターミナルの配置とキャンバス状態をアプリ終了時に保存し、次回起動時に復元
- **最近のディレクトリ** — 直近10件のディレクトリに素早くアクセス
- **テーマカスタマイズ** — UI・ターミナル・ステータスの全色をJSONファイルで変更可能
- **クロスプラットフォーム** — macOS / Windows 対応

## 動作環境

- macOS または Windows
- [Rust](https://rustup.rs/) 1.70以上
- [Node.js](https://nodejs.org/) 18以上
- [jq](https://jqlang.github.io/jq/)（macOS/Linuxのみ。Claude Codeのhooksで使用。Windowsでは不要）

## セットアップ

### macOS / Linux

```bash
# リポジトリをクローン
git clone git@github.com:0okb/terminal_canvas.git
cd terminal_canvas

# 依存関係のインストール
npm install

# 開発モードで起動
npm run tauri dev

# 配布用ビルド (.dmg)
npm run tauri build
```

### Windows

```powershell
# リポジトリをクローン
git clone git@github.com:0okb/terminal_canvas.git
cd terminal_canvas

# 依存関係のインストール
npm install

# 開発モードで起動
npm run tauri dev

# 配布用ビルド (.msi)
npm run tauri build
```

Windowsでは [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) と [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) が必要です。詳細は [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) を参照してください。

初回起動時、Claude Codeのhooks設定が `~/.claude/settings.json` に自動で追加されます。macOS/Linuxではシェルスクリプト(`.sh`)、WindowsではPowerShellスクリプト(`.ps1`)が使用されます。

## 使い方

### キャンバス操作

| 操作 | 方法 |
|---|---|
| パン（移動） | キャンバス背景をスクロール / キャンバス背景をドラッグ |
| ズーム（拡大縮小） | Ctrl+スクロール（macOSではCmd+スクロール）※ターミナル上でも動作 |
| 表示リセット | ツールバーの「Reset View」をクリック |

### ターミナル操作

| 操作 | 方法 |
|---|---|
| 新規作成 | ツールバーの「+ New Terminal」をクリック |
| ディレクトリを指定して開く | 「Recent」をクリックしてディレクトリを選択 |
| 移動 | タイトルバーをドラッグ |
| リサイズ | 右下のハンドルをドラッグ |
| 閉じる | タイトルバーの「x」をクリック |
| ターミナル内スクロール | ターミナルペイン内でスクロール |

新規ターミナルはmacOS/Linuxではデフォルトシェル（`$SHELL`）、WindowsではPowerShellで起動します。

### Claude Codeのステータス

ターミナル内で `claude` を実行すると、ステータスが自動検知されます。

| ステータス | 枠色 | 意味 |
|---|---|---|
| Idle | グレー | 入力待ち |
| Thinking | 黄 | Claudeが応答を生成中 |
| Running Tool | 青 | ツール実行中（Bash, Read, Write など） |
| Awaiting Permission | 赤 | ユーザーの承認待ち |
| Error | 暗い赤 | エラーが発生 |
| Completed | 緑 | プロセスが終了 |

Thinking・Running Tool・Awaiting Permission の状態では、枠線がパルスアニメーションで点滅します。

### タイムライン

ツールバーの「Timeline」ボタンで表示を切り替えます。各ターミナルの横棒トラックに、直近30分間のステータス遷移が色分けで表示されます。

### コスト表示

各ターミナルのステータスバーにセッションコストが表示されます。ツールバー右側には全ターミナルの合計コストが表示されます。コスト情報はClaude Codeのセッション終了時に取得されます。

## テーマのカスタマイズ

初回起動時にデフォルトのテーマファイルが生成されます。

| OS | パス |
|---|---|
| macOS | `~/Library/Application Support/terminal-canvas/theme.json` |
| Windows | `%APPDATA%\terminal-canvas\theme.json` |
| Linux | `~/.config/terminal-canvas/theme.json` |

このファイルをテキストエディタで編集するとすべての色を変更できます。変更はアプリの再起動で反映されます。

```json
{
  "terminal": {
    "background": "#000000",
    "foreground": "#bbbbbb",
    ...
  },
  "ui": {
    "app_background": "#1a1a1a",
    "toolbar_background": "#111111",
    ...
  },
  "status": {
    "idle": "#555555",
    "thinking": "#f0c674",
    "tool_running": "#81a2be",
    "permission": "#cc6666",
    "error": "#a54242",
    "completed": "#8c9440"
  }
}
```

## データファイル

| OS | 保存先 |
|---|---|
| macOS | `~/Library/Application Support/terminal-canvas/` |
| Windows | `%APPDATA%\terminal-canvas\` |
| Linux | `~/.config/terminal-canvas/` |

| ファイル | 内容 |
|---|---|
| `theme.json` | カラーテーマ設定 |
| `workspace.json` | ターミナル配置（自動保存） |
| `recent_directories.json` | 最近使用したディレクトリ（最大10件） |

## 技術構成

- **Frontend**: Solid.js + TypeScript + xterm.js
- **Backend**: Rust (Tauri v2) + portable-pty
- **ステータス検知**: Claude Code hooks（主）+ 画面スクレイピング（フォールバック）
- **hooks**: macOS/Linux = シェルスクリプト + jq、Windows = PowerShellスクリプト

## ライセンス

MIT
