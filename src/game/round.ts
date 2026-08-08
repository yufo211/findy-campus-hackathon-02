import type { Answer } from './types'

const KEYS = ['A', 'B', 'C', 'D', 'E', 'F']

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * 回答者の回答とAIの回答を混ぜてシャッフルし、A/B/C… のキーを振る。
 * 並び順が固定だと人間の位置がバレるので、毎回ここで混ぜる。
 */
export function buildAnswers(humanText: string, ai: { text: string; label: string }[]): Answer[] {
  const mixed: Omit<Answer, 'key'>[] = [
    { text: humanText, kind: 'human', model: null },
    ...ai.map((a) => ({ text: a.text, kind: 'ai' as const, model: a.label }))
  ]
  return shuffle(mixed).map((a, i) => ({ ...a, key: KEYS[i] }))
}

/** 回答者が書いた回答のキー。答え合わせで使う */
export function humanKeyOf(answers: Answer[]): string | undefined {
  return answers.find((a) => a.kind === 'human')?.key
}
