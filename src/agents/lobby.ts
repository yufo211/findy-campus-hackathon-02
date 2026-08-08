import { Agent, callable, getAgentByName } from 'agents'
import { pickTopic } from '../game/topics'
import { HUMANS_PER_ROOM, type LobbyState } from '../game/types'
import type { RoomAgent } from './room'

type QueueRow = { player_id: string; name: string }

/** キューに残ったままの幽霊エントリを掃除する猶予 */
const STALE_MS = 120_000

/**
 * マッチング専用のグローバルDO（インスタンス名は 'global' 固定）。
 * 待機キューを1箇所に集約することで、誰と誰を組ませるかの判断を直列化できる。
 */
export class LobbyAgent extends Agent<CloudflareBindings, LobbyState> {
  initialState: LobbyState = { waitingCount: 0, matches: [] }

  private ensureTables() {
    this.sql`
      CREATE TABLE IF NOT EXISTS queue (
        player_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        joined_at INTEGER NOT NULL
      )
    `
  }

  async onStart() {
    this.ensureTables()
  }

  private syncWaitingCount() {
    const [row] = this.sql<{ n: number }>`SELECT COUNT(*) AS n FROM queue`
    this.setState({ ...this.state, waitingCount: row?.n ?? 0 })
  }

  @callable()
  async join(playerId: string, name: string): Promise<string | null> {
    this.ensureTables()
    this.sql`DELETE FROM queue WHERE joined_at < ${Date.now() - STALE_MS}`

    const clean = name.trim().slice(0, 12) || '名無し'
    this.sql`
      INSERT OR REPLACE INTO queue (player_id, name, joined_at)
      VALUES (${playerId}, ${clean}, ${Date.now()})
    `

    const waiting = this.sql<QueueRow>`
      SELECT player_id, name FROM queue ORDER BY joined_at ASC LIMIT ${HUMANS_PER_ROOM}
    `
    if (waiting.length < HUMANS_PER_ROOM) {
      this.syncWaitingCount()
      return null
    }

    const players = waiting.map((r) => ({ id: r.player_id, name: r.name }))
    for (const p of players) {
      this.sql`DELETE FROM queue WHERE player_id = ${p.id}`
    }

    const roomId = crypto.randomUUID().slice(0, 8)
    // お題はロビー側で決めて注入する。将来ここを「出題者が入力したお題」に差し替える
    const room = await getAgentByName<CloudflareBindings, RoomAgent>(this.env.RoomAgent, roomId)
    await room.setup(players, pickTopic())

    const at = Date.now()
    const matches = [...this.state.matches, ...players.map((p) => ({ playerId: p.id, roomId, at }))]
    const [row] = this.sql<{ n: number }>`SELECT COUNT(*) AS n FROM queue`
    this.setState({
      waitingCount: row?.n ?? 0,
      matches: matches.slice(-20) // 直近ぶんだけ保持
    })

    return players.some((p) => p.id === playerId) ? roomId : null
  }

  @callable()
  async leave(playerId: string) {
    this.ensureTables()
    this.sql`DELETE FROM queue WHERE player_id = ${playerId}`
    this.syncWaitingCount()
  }
}
