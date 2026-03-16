# Terminal Canvas

無限キャンバス上に複数のターミナルを自由配置できるデスクトップアプリケーション。複数のClaude Codeインスタンスを同時に監視するために設計されています。

```
┌──────────────────────────────────────────────────┐
│ [+ New] [Recent ▼]                        100%   │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────────┐   ┌──────────────────┐     │
│  │ ~/project-a      │   │ ~/project-b      │     │
│  │          Running │   │  Awaiting Perm.. │     │
│  │ ┌──────────────┐ │   │ ┌──────────────┐ │     │
│  │ │ $ claude     │ │   │ │ $ claude     │ │     │
│  │ │ ...          │ │   │ │ Allow? [Y/n] │ │     │
│  │ └──────────────┘ │   │ └──────────────┘ │     │
│  └──────────────────┘   └──────────────────┘     │
│                                                  │
└──────────────────────────────────────────────────┘
```

## 主な機能

- **無限キャンバス** — パン・ズームでターミナルを自由に配置
- **ステータス検知** — PTY出力の活性度とClaude Code hooksで3状態を検出
  - **Running** (黄) — Claude Codeが実行中（思考・応答・ツール実行すべて）
  - **Awaiting Permission** (赤) — ユーザーの承認待ち
  - **Idle** (グレー) — 完了、次の入力待ち
- **ステータス連動の枠色** — 各ターミナルの枠線とタイトルバーのバッジがステータスに応じて変化
- **ワークスペース自動保存** — ターミナルの配置とキャンバス状態をアプリ終了時に保存し、次回起動時に復元
- **最近のディレクトリ** — 直近10件のディレクトリに素早くアクセス
- **テーマカスタマイズ** — UI・ターミナルの全色をJSONファイルで変更可能
- **クロスプラットフォーム** — macOS / Windows 対応

## 動作環境

- macOS または Windows
- [Rust](https://rustup.rs/) 1.70以上
- [Node.js](https://nodejs.org/) 18以上
- [jq](https://jqlang.github.io/jq/)（macOS/Linuxのみ。Windowsでは不要）

## セットアップ

### macOS / Linux

```bash
git clone git@github.com:0okb/terminal_canvas.git
cd terminal_canvas
npm install
npm run tauri dev
```

### Windows

[Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)（「C++ によるデスクトップ開発」ワークロード）と [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) が必要です。詳細は [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) を参照してください。

```powershell
git clone git@github.com:0okb/terminal_canvas.git
cd terminal_canvas
npm install
npm run tauri dev
```

配布用ビルドは `npm run tauri build` で生成できます（macOS: `.dmg`、Windows: `.msi`）。

初回起動時、Claude Codeのhooks設定が `~/.claude/settings.json` に自動で追加されます。macOS/Linuxではシェルスクリプト、WindowsではPowerShellスクリプトが使用されます。

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

### ステータス検知

ターミナル内で `claude` を実行すると、ステータスが自動検知されタイトルバーにバッジ表示されます。

| ステータス | 枠色 | 検出方法 |
|---|---|---|
| **Running** | 黄（パルスアニメーション） | PTY出力の活性度（出力がある＝実行中） |
| **Awaiting Permission** | 赤（速いパルス） | Claude Code hook (`Notification/permission_prompt`) |
| **Idle** | グレー | Claude Code hook (`Stop`) / PTY出力が3秒途絶 |

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
- **ステータス検知**: PTY出力活性度（Running）+ Claude Code hooks（Permission / Idle）
- **hooks**: macOS/Linux = シェルスクリプト + jq、Windows = PowerShellスクリプト

## ライセンス

MIT
