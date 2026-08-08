const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'

/**
 * AIには「面白い回答」ではなく「人間が書いたと錯覚させる回答」を作らせる。
 * 優等生的な整った文章はいちばんの手がかりになるので、そこを潰すのが肝。
 */
const SYSTEM = `あなたは日本の大喜利に参加している一般人プレイヤーです。
匿名の回答が並べられ、他の参加者から「どれがAIか」を当てられるゲームをしています。
AIだとバレたら負けです。人間が勢いで書いたような回答を1つだけ返してください。

ルール:
- 出力は回答そのものだけ。説明・前置き・補足・箇条書き・引用符は一切つけない
- 25文字以内。長い文章はAIだとバレる
- タメ口。「〜です」「〜ます」は使わない
- 説明しすぎない。オチだけ言い切って終わる
- 「面白いですね」「いかがでしょうか」のようなメタな言葉は禁止
- 具体的な固有名詞や生活感のある単語を混ぜると人間っぽい`

const FALLBACKS = [
  '店主が全部忘れる',
  'なんか2階から音する',
  '会費が高い',
  '母親に聞いてくれ',
  '結局それ去年もやった'
]

function sanitize(raw: string): string {
  const line =
    raw
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.length > 0) ?? ''

  return line
    .replace(/^(回答|答え|A|Answer)\s*[:：.]\s*/i, '')
    .replace(/^["'「『”“]+|["'」』”“]+$/g, '')
    .trim()
    .slice(0, 40)
}

export async function generateAiAnswer(ai: Ai, topic: string): Promise<string> {
  try {
    const res = (await ai.run(MODEL, {
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `お題: ${topic}` }
      ],
      max_tokens: 120,
      temperature: 0.95,
      top_p: 0.95
    })) as { response?: string }

    const text = sanitize(res.response ?? '')
    if (text.length > 0) return text
  } catch (e) {
    console.error('AI answer generation failed', e)
  }
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)]
}
