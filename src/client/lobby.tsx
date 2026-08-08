import { useEffect, useRef, useState } from 'react'
import { useAgent } from 'agents/react'
import type { LobbyAgent } from '../agents/lobby'
import { HUMANS_PER_ROOM, type LobbyState } from '../game/types'
import { loadName, saveName } from './identity'

type Props = {
  playerId: string
  onMatched: (roomId: string) => void
}

export function Lobby({ playerId, onMatched }: Props) {
  const [name, setName] = useState(loadName)
  const [waiting, setWaiting] = useState(false)
  const [waitingCount, setWaitingCount] = useState(0)
  // マウント前に成立していた古いマッチに反応しないための基準時刻
  const since = useRef(Date.now())
  const onMatchedRef = useRef(onMatched)
  onMatchedRef.current = onMatched

  const agent = useAgent<LobbyAgent, LobbyState>({
    agent: 'LobbyAgent',
    name: 'global',
    onStateUpdate: (state) => {
      setWaitingCount(state.waitingCount)
      const match = state.matches.find((m) => m.playerId === playerId && m.at >= since.current)
      if (match) onMatchedRef.current(match.roomId)
    }
  })

  // タブを閉じたときに幽霊エントリを残さない
  useEffect(() => {
    const bail = () => {
      if (waiting) agent.stub.leave(playerId)
    }
    window.addEventListener('beforeunload', bail)
    return () => window.removeEventListener('beforeunload', bail)
  }, [agent, playerId, waiting])

  const join = async () => {
    saveName(name)
    setWaiting(true)
    const roomId = await agent.stub.join(playerId, name)
    if (roomId) onMatchedRef.current(roomId)
  }

  const cancel = async () => {
    setWaiting(false)
    await agent.stub.leave(playerId)
  }

  return (
    <div className="card lobby">
      <h1 className="title">
        ニンゲン<span className="accent">か</span>AIか
      </h1>
      <p className="lead">
        {HUMANS_PER_ROOM}人でマッチングして大喜利。回答にはAIが1体しれっと混ざります。
        <br />
        全員の回答が出そろったら、<strong>どれがAIかを当ててください。</strong>
      </p>

      {!waiting ? (
        <>
          <label className="field">
            <span>ニックネーム</span>
            <input value={name} maxLength={12} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn primary" onClick={join} disabled={name.trim().length === 0}>
            マッチングを開始
          </button>
        </>
      ) : (
        <>
          <div className="pulse">
            対戦相手を探しています… <b>{waitingCount}</b> / {HUMANS_PER_ROOM}人
          </div>
          <p className="hint">
            1人で試すときは、このページをもう1つのタブで開いて同じようにマッチングを開始してください。
          </p>
          <button className="btn ghost" onClick={cancel}>
            キャンセル
          </button>
        </>
      )}

      <ul className="rules">
        <li>AIを正しく見抜いた → +2点</li>
        <li>人間なのに他人からAI認定された → +1点</li>
      </ul>
    </div>
  )
}
