import { Agent, callable } from 'agents'
import { generateAiAnswer } from '../game/ai'
import { pickTopic } from '../game/topics'
import {
  AI_AUTHOR,
  ANSWER_SECONDS,
  VOTE_SECONDS,
  type AnonAnswer,
  type Player,
  type Reveal,
  type RoomState
} from '../game/types'

type AnswerRow = { id: string; author: string; text: string; key: string | null }

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
 * 1ルーム = 1 Durable Object。ゲーム進行のすべてをここに閉じ込める。
 *
 * 秘密の扱い:
 *   - 「誰がどの回答を書いたか」「誰がどこに投票したか」は SQLite にだけ持つ
 *   - state は全クライアントにブロードキャストされるので、公開してよい情報だけを載せる
 *   - 正体は result フェーズで初めて state.reveal に載る
 */
export class RoomAgent extends Agent<CloudflareBindings, RoomState> {
  initialState: RoomState = {
    round: 0,
    phase: 'answering',
    topic: '',
    players: [],
    deadline: null,
    submitted: [],
    answers: [],
    voted: [],
    reveal: null,
    aiReady: false
  }

  private ensureTables() {
    this.sql`
      CREATE TABLE IF NOT EXISTS answers (
        round INTEGER NOT NULL,
        id TEXT PRIMARY KEY,
        author TEXT NOT NULL,
        text TEXT NOT NULL,
        key TEXT
      )
    `
    this.sql`
      CREATE TABLE IF NOT EXISTS votes (
        round INTEGER NOT NULL,
        voter TEXT NOT NULL,
        key TEXT NOT NULL,
        PRIMARY KEY (round, voter)
      )
    `
  }

  async onStart() {
    this.ensureTables()
  }

  /**
   * LobbyAgent から Durable Object RPC で呼ばれる。
   * @callable() を付けていないので、ブラウザからは呼べない。
   */
  async setup(players: { id: string; name: string }[], topic: string) {
    if (this.state.round > 0) return // 二重セットアップを防ぐ
    await this.startRound(
      1,
      topic,
      players.map((p) => ({ ...p, score: 0 }))
    )
  }

  private async startRound(round: number, topic: string, players: Player[]) {
    this.ensureTables()
    this.sql`DELETE FROM answers WHERE round = ${round}`
    this.sql`DELETE FROM votes WHERE round = ${round}`

    this.setState({
      round,
      phase: 'answering',
      topic,
      players,
      deadline: Date.now() + ANSWER_SECONDS * 1000,
      submitted: [],
      answers: [],
      voted: [],
      reveal: null,
      aiReady: false
    })

    // AI生成もDOのアラーム経由。全員が切断しても回答は生成される
    await this.schedule(1, 'writeAiAnswer', { round })
    await this.schedule(ANSWER_SECONDS, 'closeAnswers', { round })
  }

  /** スケジュール実行。古いラウンドの残骸が発火しても無視する */
  async writeAiAnswer(payload: { round: number }) {
    if (payload.round !== this.state.round || this.state.phase !== 'answering') return

    const text = await generateAiAnswer(this.env.AI, this.state.topic)
    if (payload.round !== this.state.round || this.state.phase !== 'answering') return

    this.ensureTables()
    this.sql`
      INSERT OR REPLACE INTO answers (round, id, author, text, key)
      VALUES (${payload.round}, ${`r${payload.round}-ai`}, ${AI_AUTHOR}, ${text}, NULL)
    `
    this.setState({ ...this.state, aiReady: true })
    await this.maybeCloseAnswers()
  }

  @callable()
  async submitAnswer(playerId: string, text: string) {
    if (this.state.phase !== 'answering') return
    if (!this.state.players.some((p) => p.id === playerId)) return

    const clean = text.trim().replace(/\s+/g, ' ').slice(0, 60)
    if (clean.length === 0) return

    this.ensureTables()
    this.sql`
      INSERT OR REPLACE INTO answers (round, id, author, text, key)
      VALUES (${this.state.round}, ${`r${this.state.round}-${playerId}`}, ${playerId}, ${clean}, NULL)
    `
    if (!this.state.submitted.includes(playerId)) {
      this.setState({ ...this.state, submitted: [...this.state.submitted, playerId] })
    }
    await this.maybeCloseAnswers()
  }

  /** 全員（人間＋AI）が出揃ったら締切を待たずに次へ */
  private async maybeCloseAnswers() {
    if (this.state.phase !== 'answering') return
    const humansDone = this.state.players.every((p) => this.state.submitted.includes(p.id))
    if (humansDone && this.state.aiReady) {
      await this.closeAnswers({ round: this.state.round })
    }
  }

  async closeAnswers(payload: { round: number }) {
    if (payload.round !== this.state.round || this.state.phase !== 'answering') return
    this.ensureTables()

    // 時間切れの人間にはプレースホルダを入れて、回答数を揃える
    for (const p of this.state.players) {
      if (!this.state.submitted.includes(p.id)) {
        this.sql`
          INSERT OR IGNORE INTO answers (round, id, author, text, key)
          VALUES (${payload.round}, ${`r${payload.round}-${p.id}`}, ${p.id}, ${'……（時間切れ）'}, NULL)
        `
      }
    }

    // AI生成が間に合わなかった場合はここで取り切る
    if (!this.state.aiReady) {
      const text = await generateAiAnswer(this.env.AI, this.state.topic)
      this.sql`
        INSERT OR REPLACE INTO answers (round, id, author, text, key)
        VALUES (${payload.round}, ${`r${payload.round}-ai`}, ${AI_AUTHOR}, ${text}, NULL)
      `
    }

    const rows = this.sql<AnswerRow>`SELECT id, author, text, key FROM answers WHERE round = ${payload.round}`
    const answers: AnonAnswer[] = []
    shuffle(rows).forEach((row, i) => {
      const key = KEYS[i]
      this.sql`UPDATE answers SET key = ${key} WHERE id = ${row.id}`
      answers.push({ key, text: row.text })
    })

    this.setState({
      ...this.state,
      phase: 'guessing',
      aiReady: true,
      answers,
      deadline: Date.now() + VOTE_SECONDS * 1000
    })
    await this.schedule(VOTE_SECONDS, 'closeVotes', { round: payload.round })
  }

  @callable()
  async vote(playerId: string, key: string) {
    if (this.state.phase !== 'guessing') return
    if (!this.state.players.some((p) => p.id === playerId)) return

    this.ensureTables()
    const [target] = this.sql<{ author: string }>`
      SELECT author FROM answers WHERE round = ${this.state.round} AND key = ${key}
    `
    // 存在しないキー、または自分の回答への投票は弾く
    if (!target || target.author === playerId) return

    this.sql`
      INSERT OR REPLACE INTO votes (round, voter, key)
      VALUES (${this.state.round}, ${playerId}, ${key})
    `
    if (!this.state.voted.includes(playerId)) {
      this.setState({ ...this.state, voted: [...this.state.voted, playerId] })
    }

    if (this.state.players.every((p) => this.state.voted.includes(p.id))) {
      await this.closeVotes({ round: this.state.round })
    }
  }

  async closeVotes(payload: { round: number }) {
    if (payload.round !== this.state.round || this.state.phase !== 'guessing') return
    this.ensureTables()

    const rows = this.sql<AnswerRow>`SELECT id, author, text, key FROM answers WHERE round = ${payload.round}`
    const voteRows = this.sql<{ voter: string; key: string }>`
      SELECT voter, key FROM votes WHERE round = ${payload.round}
    `
    const nameOf = (id: string) => this.state.players.find((p) => p.id === id)?.name ?? '???'

    const aiKey = rows.find((r) => r.author === AI_AUTHOR)?.key ?? ''
    const authors = rows.map((r) => ({
      key: r.key ?? '?',
      playerId: r.author === AI_AUTHOR ? null : r.author,
      name: r.author === AI_AUTHOR ? 'AI' : nameOf(r.author)
    }))
    const votes = voteRows.map((v) => ({ voterId: v.voter, voterName: nameOf(v.voter), key: v.key }))

    // 採点: AIを見抜いたら +2 / 人間なのにAI認定されたら +1（AIより機械的だった称号）
    const gains = new Map<string, { delta: number; reasons: string[] }>()
    for (const p of this.state.players) gains.set(p.id, { delta: 0, reasons: [] })

    for (const v of votes) {
      if (v.key === aiKey) {
        const g = gains.get(v.voterId)
        if (g) {
          g.delta += 2
          g.reasons.push('AIを見抜いた +2')
        }
      } else {
        const victim = authors.find((a) => a.key === v.key)
        if (victim?.playerId) {
          const g = gains.get(victim.playerId)
          if (g) {
            g.delta += 1
            g.reasons.push(`${v.voterName} にAI認定された +1`)
          }
        }
      }
    }

    const reveal: Reveal = {
      aiKey,
      authors,
      votes,
      gains: [...gains.entries()].map(([playerId, g]) => ({ playerId, ...g }))
    }

    this.setState({
      ...this.state,
      phase: 'result',
      deadline: null,
      reveal,
      players: this.state.players.map((p) => ({
        ...p,
        score: p.score + (gains.get(p.id)?.delta ?? 0)
      }))
    })
  }

  @callable()
  async nextRound(playerId: string) {
    if (this.state.phase !== 'result') return
    if (!this.state.players.some((p) => p.id === playerId)) return
    await this.startRound(this.state.round + 1, pickTopic(this.state.topic), this.state.players)
  }
}
