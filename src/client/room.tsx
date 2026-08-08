import { useEffect, useState } from 'react'
import { useAgent } from 'agents/react'
import type { RoomAgent } from '../agents/room'
import type { RoomState } from '../game/types'

type Props = {
  roomId: string
  playerId: string
  onExit: () => void
}

function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (deadline === null) return
    const timer = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(timer)
  }, [deadline])
  if (deadline === null) return null
  return Math.max(0, Math.ceil((deadline - now) / 1000))
}

export function Room({ roomId, playerId, onExit }: Props) {
  const [state, setState] = useState<RoomState | null>(null)
  const [draft, setDraft] = useState('')
  const [myAnswer, setMyAnswer] = useState('')
  const [myVote, setMyVote] = useState<string | null>(null)

  const agent = useAgent<RoomAgent, RoomState>({
    agent: 'RoomAgent',
    name: roomId,
    onStateUpdate: setState
  })

  const remaining = useCountdown(state?.deadline ?? null)

  // ラウンドが変わったらローカルの入力状態をリセット
  const round = state?.round ?? 0
  useEffect(() => {
    setDraft('')
    setMyAnswer('')
    setMyVote(null)
  }, [round])

  if (!state || state.round === 0) {
    return <div className="card">ルームを準備しています…</div>
  }

  const submitted = state.submitted.includes(playerId)
  const me = state.players.find((p) => p.id === playerId)

  const submit = async () => {
    const text = draft.trim()
    if (!text) return
    setMyAnswer(text)
    await agent.stub.submitAnswer(playerId, text)
  }

  const vote = async (key: string) => {
    setMyVote(key)
    await agent.stub.vote(playerId, key)
  }

  return (
    <div className="room">
      <header className="topbar">
        <span className="badge">ROUND {state.round}</span>
        <span className="scores">
          {state.players.map((p) => (
            <span key={p.id} className={p.id === playerId ? 'score self' : 'score'}>
              {p.name} <b>{p.score}</b>
            </span>
          ))}
        </span>
        {remaining !== null && <span className={remaining <= 10 ? 'timer hot' : 'timer'}>{remaining}s</span>}
      </header>

      <div className="card topic">
        <span className="label">お題</span>
        <h2>{state.topic}</h2>
      </div>

      {state.phase === 'answering' && (
        <div className="card">
          <div className="phase-title">回答を書く</div>
          {!submitted ? (
            <>
              <input
                className="answer-input"
                value={draft}
                maxLength={60}
                placeholder="ここに回答（60文字まで）"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submit()
                }}
                autoFocus
              />
              <button className="btn primary" onClick={submit} disabled={draft.trim().length === 0}>
                提出する
              </button>
            </>
          ) : (
            <p className="submitted-note">
              提出しました:「{myAnswer}」<br />
              <span className="hint">ほかの回答者を待っています…</span>
            </p>
          )}

          <ul className="status-list">
            {state.players.map((p) => (
              <li key={p.id}>
                {state.submitted.includes(p.id) ? '✅' : '✏️'} {p.name}
                {p.id === playerId && '（あなた）'}
              </li>
            ))}
            <li className="ai-row">
              {state.aiReady ? '✅' : '🤖'} 謎のもう1人{state.aiReady ? '' : '（執筆中…）'}
            </li>
          </ul>
        </div>
      )}

      {state.phase === 'guessing' && (
        <div className="card">
          <div className="phase-title">この中に1つ、AIの回答があります</div>
          <ul className="answers">
            {state.answers.map((a) => {
              const isMine = a.text === myAnswer
              const picked = myVote === a.key
              return (
                <li key={a.key}>
                  <button
                    className={`answer ${picked ? 'picked' : ''} ${isMine ? 'mine' : ''}`}
                    disabled={isMine || myVote !== null}
                    onClick={() => vote(a.key)}
                  >
                    <span className="key">{a.key}</span>
                    <span className="text">{a.text}</span>
                    {isMine && <span className="tag">あなた</span>}
                    {picked && <span className="tag pick">これがAI</span>}
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="hint">
            投票済み {state.voted.length} / {state.players.length}人
          </p>
        </div>
      )}

      {state.phase === 'result' && state.reveal && (
        <div className="card">
          <div className="phase-title">正体は…</div>
          <ul className="answers reveal">
            {state.answers.map((a) => {
              const author = state.reveal!.authors.find((x) => x.key === a.key)
              const isAi = a.key === state.reveal!.aiKey
              const voters = state.reveal!.votes.filter((v) => v.key === a.key)
              return (
                <li key={a.key}>
                  <div className={`answer static ${isAi ? 'is-ai' : ''}`}>
                    <span className="key">{a.key}</span>
                    <span className="text">{a.text}</span>
                    <span className={isAi ? 'tag ai' : 'tag human'}>{isAi ? '🤖 AI' : `🧑 ${author?.name}`}</span>
                  </div>
                  {voters.length > 0 && (
                    <p className="voters">AI認定: {voters.map((v) => v.voterName).join('、')}</p>
                  )}
                </li>
              )
            })}
          </ul>

          <ul className="gains">
            {state.reveal.gains.map((g) => {
              const p = state.players.find((x) => x.id === g.playerId)
              return (
                <li key={g.playerId}>
                  <b>{p?.name}</b> {g.delta > 0 ? `+${g.delta}` : '±0'}
                  {g.reasons.length > 0 && <span className="reasons">（{g.reasons.join(' / ')}）</span>}
                </li>
              )
            })}
          </ul>

          <div className="actions">
            <button className="btn primary" onClick={() => agent.stub.nextRound(playerId)}>
              次のお題へ
            </button>
            <button className="btn ghost" onClick={onExit}>
              退出する
            </button>
          </div>
        </div>
      )}

      <p className="roomid">
        room: {roomId} / you: {me?.name}
      </p>
    </div>
  )
}
