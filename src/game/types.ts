/** 回答を生成するAIモデルの数。実体（モデルIDとプロンプト）はサーバー側の src/game/ai.ts が持つ */
export const AI_COUNT = 3

/** 話し合いの目安時間。カウントダウンを表示するだけで、進行を強制はしない */
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
