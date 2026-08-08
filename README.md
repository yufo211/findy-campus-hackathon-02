# ニンゲンかAIか — 大喜利

人間同士がマッチングして大喜利をする。**そこにAIが1体しれっと混ざっていて、最後に「どれがAIか」を当てる。**

Cloudflare Workers + Durable Objects + Workers AI で動く、リアルタイム対戦アプリの PoC です。

## 遊び方

1. ニックネームを入れて「マッチングを開始」
2. 2人揃うとルームが立ち、お題が出る（60秒で回答）
3. 回答が匿名・シャッフルされて並ぶ。**この中の1つがAIの回答**（45秒で投票）
4. 正体開示と採点

| ルール | 点 |
| --- | --- |
| AIを正しく見抜いた | +2 |
| 人間なのに他人からAI認定された | +1 |

> 1人で試すときは、同じページを **2つのタブ** で開いてください。プレイヤーIDは `sessionStorage` に持つので、タブごとに別人として扱われます。

## 動かす

```sh
npm install
npm run dev     # http://localhost:5173
```

Workers AI のバインディングはローカル開発でもリモートを叩くので、`npx wrangler login` が必要です。

```sh
npm run deploy  # Cloudflareへ公開
```

## 構成

```
ブラウザ (React)
  │  WebSocket (Agents SDK)
  ├─→ LobbyAgent   … グローバル単一DO。待機キューを直列化してマッチングを成立させる
  └─→ RoomAgent    … ルームごとに1DO。ゲーム進行・採点・AI回答の生成をすべて内包
                        └─→ Workers AI (env.AI)
```

| レイヤ | 選定 | 理由 |
| --- | --- | --- |
| ルーム/進行 | Durable Objects (Agents SDK `Agent`) | 部屋=1インスタンスで状態が単一化される。`setState` が接続中の全クライアントへ自動ブロードキャストされるので、同期処理を自前で書かなくてよい |
| マッチング | `LobbyAgent`（インスタンス名 `global`） | 待機キューを1箇所に集約。DOはシングルスレッドなので「誰と誰を組ませるか」に競合が起きない |
| タイマー | `this.schedule()`（DOアラーム） | 全員が切断しても締切が進む。クライアントのタイマーに依存しない |
| 永続化 | DO内蔵SQLite | PoCではD1不要。状態がDOに閉じる |
| AI回答 | Workers AI `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | APIキー不要・無料枠あり。バインディング1つで済む |

### 設計上いちばん大事なところ

`setState()` は **接続中の全クライアントにブロードキャストされる**。つまり state に入れた瞬間、全員に見える。

そこで「誰がどの回答を書いたか」「誰がどこへ投票したか」は state に載せず、Durable Object 内の SQLite だけに持つ（`src/agents/room.ts` の `answers` / `votes` テーブル）。state に置くのは *そのフェーズで全員に見せてよい情報だけ* で、正体は `result` フェーズになって初めて `state.reveal` に載る。

サーバー側で弾いているもの（クライアントを信用しない）:

- 自分の回答への投票
- ルームのプレイヤー以外からの回答・投票
- フェーズ外の操作
- `RoomAgent.setup()` は `@callable()` を付けていないので、ブラウザからは呼べない（`LobbyAgent` からの DO RPC 専用）

### ファイル

| パス | 役割 |
| --- | --- |
| `src/agents/lobby.ts` | マッチング |
| `src/agents/room.ts` | ゲーム本体（フェーズ遷移・採点） |
| `src/game/ai.ts` | AI回答の生成とプロンプト |
| `src/game/topics.ts` | 固定のお題リスト |
| `src/game/types.ts` | 公開ステートの型とゲーム定数 |
| `src/client/` | React UI |

## これから拡張するなら

- **人間が出題する**: お題は `LobbyAgent` が決めて `RoomAgent.setup(players, topic)` に注入する形になっている。`pickTopic()` の代わりに出題者の入力を渡せば、`RoomAgent` 側は変更なしで済む
- **人数を増やす**: `src/game/types.ts` の `HUMANS_PER_ROOM` を変える。回答キーは `A`〜`F` まで用意済み
- **AIを複数体にする**: `writeAiAnswer` を複数行インサートに変え、採点を「AIの集合」に対する判定へ広げる
- **モデルを変える**: `src/game/ai.ts` の `MODEL` 定数。プロンプトは「面白い回答」ではなく「人間だと錯覚させる回答」を狙って書いてある

---

このリポジトリは [Findy Campus Hackathon #2](https://www.craftstadium.com/hackathon/findy-campus-hackathon-202608) のスターター（[hono-agents-starter](https://github.com/yusukebe/hono-agents-starter) ベース）から作られています。エージェント用スキルは `npm run setup:skills` で入れ直せます。
