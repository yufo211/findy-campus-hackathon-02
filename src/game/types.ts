/** ゲーム設定 */
export const HUMANS_PER_ROOM = 2
export const ANSWER_SECONDS = 60
export const VOTE_SECONDS = 45
export const AI_AUTHOR = '__AI__'

export type Phase = 'answering' | 'guessing' | 'result'

export type Player = {
  id: string
  name: string
  score: number
}

/** 匿名化された回答。誰が書いたかは含まない */
export type AnonAnswer = {
  key: string // 'A' | 'B' | 'C'
  text: string
}

export type Reveal = {
  aiKey: string
  /** key -> 作者。playerId が null なら AI */
  authors: { key: string; playerId: string | null; name: string }[]
  votes: { voterId: string; voterName: string; key: string }[]
  gains: { playerId: string; delta: number; reasons: string[] }[]
}

/**
 * RoomAgent の公開ステート。
 * setState() は接続中の全クライアントにブロードキャストされるため、
 * 「そのフェーズで全員に見せてよい情報」だけをここに置く。
 * 回答の作者マッピングは DO 内の SQLite に隠し、result フェーズで初めて reveal に載せる。
 */
export type RoomState = {
  round: number
  phase: Phase
  topic: string
  players: Player[]
  /** フェーズの締切 (epoch ms)。null ならカウントダウンなし */
  deadline: number | null
  /** 回答を提出済みのプレイヤーID（内容は含まない） */
  submitted: string[]
  /** guessing 以降のみ埋まる。シャッフル済み・匿名 */
  answers: AnonAnswer[]
  /** 投票済みのプレイヤーID（投票先は含まない） */
  voted: string[]
  /** result フェーズでのみ埋まる */
  reveal: Reveal | null
  aiReady: boolean
}

export type LobbyState = {
  /** マッチング待ちの人数だけを見せる */
  waitingCount: number
  /** 成立したマッチ。クライアントは自分の playerId を探して遷移する */
  matches: { playerId: string; roomId: string; at: number }[]
}
