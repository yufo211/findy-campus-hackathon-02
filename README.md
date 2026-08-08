# 大喜利人狼

**1台のスマホを回して遊ぶ**パーティゲーム。**回答者**が1人だけ「AIっぽい回答」をこっそり入力し、そこに3体のAIの回答が混ざります。**判断者**のみんなで話し合って、どれが回答者の回答かを当ててください。

Cloudflare Workers + Workers AI で動く PoC です。

## ゲームの流れ

1. **回答者を1人決める** — 決まったら、その人だけが次の画面を見る
2. **回答の入力** — 回答者だけがお題を見て、AIが書きそうな回答を入力（お題の引き直し可）
3. **AIが回答** — 3モデルが同じお題に並列で回答
4. **一斉表示** — 4つの回答が匿名・シャッフルで並ぶ。ここで端末をみんなに見せる
5. **話し合い**（オフライン） — 判断者だけで相談。目安の3分カウントダウンを表示（強制はしません）
6. **結論を入力** — 判断者の答えをタップ
7. **答え合わせ** — 回答者はどれだったか、AIはそれぞれどのモデルだったかを開示

名前の登録も得点もありません。回答者と判断者という役割だけで進みます。

## 動かす

```sh
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # 型チェック
npm run deploy     # Cloudflareへ公開
```

Workers AI のバインディングはローカル開発でもリモートを叩くので、`npx wrangler login` が必要です。

## 構成

```
ブラウザ（React・ゲームの状態はすべてここ）
   │  POST /api/ai-answers  { topic }
   ↓
Cloudflare Workers (Hono)  ── ステートレス
   └─→ Workers AI × 3モデル並列
```

**サーバーは3モデルを叩くAPI 1本だけ**です。1台の端末で完結する遊びなので、部屋の同期もマッチングも要りません。Durable Objects も WebSocket も使っていません。

回答者の回答は端末から出しません（サーバーに往復させる必要がないため）。AIの回答だけを取ってきて、混ぜてシャッフルするのはブラウザ側です。

| レイヤ | 選定 | 理由 |
| --- | --- | --- |
| 進行 | Reactのローカルステート | 1端末で完結するので、サーバーに状態を置く理由がない |
| API | Hono on Workers | `POST /api/ai-answers` のみ。ステートレスなのでスケールの心配もない |
| AI回答 | Workers AI 3モデル並列 | APIキー不要・無料枠あり。ベンダーが違うと文体が散って難易度が上がる |

### AIモデルの選定

`src/game/ai.ts` の `AI_MODELS`。ベンダーを分散させると正体開示が盛り上がります。

**Workers AI に日本語特化の生成モデルはありません**（`@cf/pfnet/plamo-embedding-1b` は Preferred Networks の日本語モデルですが埋め込み専用で、生成には使えません）。そのため多言語モデルを実際に大喜利へ回答させて比較しています。

| モデル | 応答 | 備考 |
| --- | --- | --- |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 0.5〜1.7s | `response` に本文。回答の幅は広いが、たまに日本語が崩れる |
| `@cf/nvidia/nemotron-3-120b-a12b` | 3.7〜13s | 日本語が最も自然で、毎回違う回答を返す。推論モデルなので `max_tokens: 1500` |
| `@cf/openai/gpt-oss-20b` | 1〜3s | **`response` を持たず `choices[0].message.content` にだけ入る**。推論トークンを消費するので `max_tokens: 1500` |

選定時に落としたモデル:

| モデル | 落とした理由 |
| --- | --- |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 「着巻きおにぎり」「ついに鳴門巻きがやってきたね」など日本語が壊れる |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | 日本語は自然で最速(0.5s)だが、**同じお題にほぼ同じ回答**を返す（seedを振っても5回中4回同一）。繰り返し遊ぶと「これはAI」と覚えられてしまう |
| `@cf/google/gemma-4-26b-a4b-it` | 推論に全トークンを使い切り、`max_tokens: 1200` でも `finish_reason: "length"` で本文が空 |
| `@cf/zai-org/glm-4.7-flash` | 同上 |
| `@cf/qwen/qwq-32b` | 1回23秒 |
| `@cf/moonshotai/kimi-k2.5` / `@cf/zai-org/glm-5.2` | Workers 無料プランでは使えない（エラー5035） |

生成が空だったモデルは1度だけリトライします。定型のフォールバック文が混ざると、それ自体がゲームの手がかりになってしまうためです。

モデルを差し替えるときは、`{ messages }` を受けて `response` か `choices[0].message.content` のどちらかに本文を返すこと、そして**推論モデルなら `max_tokens` を大きく取ること**を確認してください。埋め込みモデルを指定すると毎回エラーになり、フォールバック文が出続けます。

AIのプロンプトとモデルIDはサーバー側に閉じていて、クライアントバンドルには入りません。

### 秘密の守り方

1台の端末を回して遊ぶので、秘密は**画面遷移で守ります**。

- 回答の入力画面は回答者だけが見る（その前に「渡してください」の画面を挟む）
- 話し合いの画面にも投票画面にも、正体もモデル名も出さない
- 結論を入力してから初めて答え合わせ画面に進む

正体は結果表示までブラウザのメモリ上にあります。devtools を開けば見えますが、みんなで1台を覗き込む遊びなので、そこは割り切っています（隠したい場合は、答え合わせ時にサーバーへ問い合わせる形に変えられます）。

### ファイル

| パス | 役割 |
| --- | --- |
| `src/index.tsx` | Hono。`POST /api/ai-answers` とHTMLの配信 |
| `src/game/ai.ts` | 3モデルの定義・プロンプト・本文抽出・リトライ（サーバー専用） |
| `src/game/round.ts` | 回答のシャッフルとキー割り当て（純粋関数） |
| `src/game/topics.ts` | 固定のお題リスト |
| `src/game/types.ts` | 共有の型とゲーム定数 |
| `src/client/app.tsx` | 画面遷移のステートマシン |
| `src/client/screens.tsx` | 各画面の見た目 |

## これから拡張するなら

- **人間が出題する**: `pickTopic()` を出題者の入力に差し替えるだけ。お題は `WritingScreen` に渡しているだけなので影響範囲が狭い
- **AIを増減させる**: `AI_MODELS` に足し引きする。回答キーは `A`〜`F` まで用意済み

---

このリポジトリは [Findy Campus Hackathon #2](https://www.craftstadium.com/hackathon/findy-campus-hackathon-202608) のスターター（[hono-agents-starter](https://github.com/yusukebe/hono-agents-starter) ベース）から作られています。エージェント用スキルは `npm run setup:skills` で入れ直せます。
