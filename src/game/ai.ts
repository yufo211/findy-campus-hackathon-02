export type AiModel = {
  id: string
  /** 正体開示で表示する名前 */
  label: string
  /**
   * gpt-oss のように内部で推論トークンを消費するモデルは、
   * max_tokens が小さいと思考の途中で打ち切られて本文が空で返ってくる。
   */
  maxTokens: number
}

/**
 * 回答を生成する3モデル。ベンダーを分散させると開示のときに盛り上がる。
 *
 * 選定時に落としたモデル（いずれも推論に全トークンを使い切って本文が空になる）:
 *   @cf/google/gemma-4-26b-a4b-it … max_tokens 1200 でも finish_reason: length
 *   @cf/zai-org/glm-4.7-flash     … 同上
 */
export const AI_MODELS: AiModel[] = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', label: 'Llama 3.3 70B / Meta', maxTokens: 120 },
  {
    id: '@cf/mistralai/mistral-small-3.1-24b-instruct',
    label: 'Mistral Small 3.1 24B / Mistral AI',
    maxTokens: 120
  },
  // gpt-oss は本文の前に推論トークンを消費する。600 だと稀に本文が空になったので余裕を持たせる
  { id: '@cf/openai/gpt-oss-20b', label: 'gpt-oss 20B / OpenAI', maxTokens: 1500 }
]

/**
 * このゲームではAIは「自分のまま」答える。人間の方がAIに寄せてくる側なので、
 * ここで人間らしさを演出する必要はない。
 * ただし体裁だけは揃えないと、文字数や句読点で人間の回答が一発でバレる。
 */
const SYSTEM = `あなたは日本の大喜利に回答するAIです。お題に対する回答を1つだけ出してください。

出力の決まり:
- 回答そのものだけを出力する。説明・前置き・補足・箇条書き・引用符・絵文字は一切つけない
- 25文字以内、改行なしの1行
- 文末に句点（。）をつけない
- 「面白いですね」「いかがでしょうか」のようなメタな言葉は禁止`

const FALLBACKS = [
  '全部セルフサービス',
  '店主が数を数えられない',
  'なぜか毎回2階から音がする',
  '会費だけ先に取られる',
  '去年もまったく同じことをした',
  '看板だけ立派'
]

function sanitize(raw: string): string {
  const withoutThinking = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // 推論モデルの思考ブロックを落とす
    .replace(/<\/?[a-z_]+>/gi, '')

  const line =
    withoutThinking
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ''

  return line
    .replace(/^[-*・]\s*/, '') // 箇条書きの記号
    .replace(/^\d+[.)]\s*/, '')
    .replace(/^(回答|答え|A|Answer)\s*[:：.]\s*/i, '')
    .replace(/^["'「『”“]+|["'」』”“]+$/g, '')
    .replace(/。$/, '')
    .trim()
    .slice(0, 40)
}

/**
 * モデルによって本文の置き場所が違う。
 *   Llama / Mistral … トップレベルの response（choices にも同じものが入る）
 *   gpt-oss         … choices[0].message.content のみ（response は無い）
 */
function extractText(res: unknown): string {
  const r = res as {
    response?: string
    choices?: { message?: { content?: string } }[]
  }
  return r.response ?? r.choices?.[0]?.message?.content ?? ''
}

async function runModel(ai: Ai, model: AiModel, topic: string): Promise<string> {
  const res = await ai.run(model.id as Parameters<Ai['run']>[0], {
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `お題: ${topic}` }
    ],
    max_tokens: model.maxTokens,
    temperature: 0.95,
    top_p: 0.95
  })

  return sanitize(extractText(res))
}

/** 指定モデル群を並列実行する。取れなかったものは空文字で返す */
async function runAll(ai: Ai, topic: string, models: AiModel[]): Promise<string[]> {
  const settled = await Promise.allSettled(models.map((m) => runModel(ai, m, topic)))
  return settled.map((result, i) => {
    if (result.status === 'rejected') {
      console.error(`AI answer failed: ${models[i].id}`, result.reason)
      return ''
    }
    if (result.value.length === 0) {
      console.error(`AI answer empty: ${models[i].id}（本文が空。推論で打ち切られた可能性）`)
    }
    return result.value
  })
}

/**
 * 3モデルを並列で走らせる。
 *
 * 取れなかったモデルは1度だけリトライする。gpt-oss は稀に推論が長引いて本文が空で返るが、
 * 定型のフォールバック文が混ざると「いかにも」な手がかりになってゲームが壊れるため。
 * それでもダメなら重複しないフォールバックで埋める。
 */
export async function generateAiAnswers(
  ai: Ai,
  topic: string
): Promise<{ modelId: string; label: string; text: string }[]> {
  const texts = await runAll(ai, topic, AI_MODELS)

  const missing = texts.flatMap((t, i) => (t.length === 0 ? [i] : []))
  if (missing.length > 0) {
    const retried = await runAll(
      ai,
      topic,
      missing.map((i) => AI_MODELS[i])
    )
    missing.forEach((modelIndex, k) => {
      if (retried[k].length > 0) texts[modelIndex] = retried[k]
    })
  }

  const used = new Set<string>()
  const fallbacks = [...FALLBACKS].sort(() => Math.random() - 0.5)

  return AI_MODELS.map((model, i) => {
    // 空のまま、または他モデルと丸かぶり（同じ文面が2つ並ぶと壊れて見える）ならフォールバック
    let text = texts[i]
    if (text.length === 0 || used.has(text)) {
      text = fallbacks.find((f) => !used.has(f)) ?? `${text || '回答なし'}…`
    }
    used.add(text)
    return { modelId: model.id, label: model.label, text }
  })
}
