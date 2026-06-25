# Findy Campus Hackathon #2 — 参加者キット

[Findy Campus Hackathon #2](https://www.craftstadium.com/en/hackathon/findy-campus-hackathon)の参加者向けキットです。コーディングエージェントに入れて使う伴走スキルを提供します。

## これは何？

- `skills/findy-hackathon/` — エージェントに入れると、作りたいものに合わせて（Cloudflareを使うか、AIを足すか、デプロイするか）最適な既存スキルとスターターを案内し、公開まで伴走してくれるスキルです。決め打ちは求めず、走りながら決められます。

## 前提

### 最低限

- Node.js (v20+) — `node -v` で確認。`npx` / `npm` を使います。
- コーディングエージェント（強く推奨）— このキットのスキルはエージェント前提。Claude Code / Cursor / GitHub Copilot / Gemini CLI など。 無料で使えるものもあります。

### デプロイする場合に追加で

- Cloudflareアカウント（無料枠でOK / Workers AI も無料枠あり）。[こちら](https://www.cloudflare.com/ja-jp/)から登録できます。

### コーディングエージェントを持っていない人へ

このキットの伴走スキルはコーディングエージェントの上で動きます。まだ持っていなくても用意できます。いずれも `npx skills add` に対応しています。

無料で始めたいなら:

- GitHub Copilot Free — 誰でも無料（月あたりの利用上限あり）。VS Code / JetBrains で使える。
- Cursor — 無料枠ありのAIエディタ。
- Gemini CLI — 無料枠の大きいターミナル系エージェント。

Claude Code を使う場合は有料です（Pro / Max、または API 従量課金。新規アカウントに少額の無料クレジットあり）。

## 始め方

Cloudflare で作るなら、自分でディレクトリを作るより、スターターをダウンロードしてからスキルを入れるのが早いです。AIを使わないふつうのWebアプリでも、このスターターで始めてOKです。

```sh
# 1. 全部入りスターターを取得して動かす（Hono + Vite + React + Agents SDK）
npx degit yusukebe/hono-agents-starter my-app
cd my-app && npm install && npm run dev
```

```sh
# 2. このプロジェクトに伴走スキルと、必要な既存スキルを入れる
npx skills add yusukebe/findy-campus-hackathon-02
npx skills add yusukebe/hono-skill
npx skills add cloudflare/skills --skill cloudflare --skill wrangler --skill workers-best-practices --skill agents-sdk
```

あとはエージェントに「ハッカソンのアプリを作りたい」と伝えれば、選択肢を踏まえて進めてくれます。

## アプリの例

- memo2task - <https://github.com/yusukebe/memo2task>

## 関連

- 勉強会・発表スライド: <https://workshop.yusuke.run/>
- Cloudflare 公式スキル: <https://github.com/cloudflare/skills>
- Hono スキル: <https://github.com/yusukebe/hono-skill>
