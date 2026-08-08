/** 回答を生成するAIモデルの数。実体（モデルIDとプロンプト）はサーバー側の src/game/ai.ts が持つ */
export const AI_COUNT = 3

/**
 * 目安時間。どちらもカウントダウンを表示するだけで、0になっても何も起きない
 * （進行はボタンで決める）
 */
export const WRITE_SECONDS = 60
export const DISCUSSION_SECONDS = 180

export const MAX_ANSWER_LENGTH = 40

export type AnswerKind = 'human' | 'ai'

/**
 * 場に並ぶ1つの回答。
 * kind と model は「答え合わせ」画面まで表示しない（1台を回して遊ぶので、
 * 秘密はサーバーではなく画面遷移で守る）。
 */
export type Answer = {
  key: string // 'A' | 'B' | 'C' | 'D'
  text: string
  kind: AnswerKind
  /** AIのときだけモデルの表示名が入る */
  model: string | null
}

/** POST /api/ai-answers のレスポンス */
export type AiAnswersResponse = {
  answers: { modelId: string; label: string; text: string }[]
}
