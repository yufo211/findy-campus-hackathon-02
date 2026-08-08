import { useEffect, useMemo, useState } from 'react'

const sampleAnswers = [
  {
    name: 'ミナト',
    role: 'citizen',
    answer: '審査員だけが全員ミュートで拍手している',
    votes: 3
  },
  {
    name: 'リオ',
    role: 'werewolf',
    answer: '提出フォームの「任意」が一番怖い',
    votes: 5
  },
  {
    name: 'カイ',
    role: 'citizen',
    answer: '休憩時間だけスポンサーLTが始まる',
    votes: 2
  }
]

const prompts = [
  'こんなハッカソンは嫌だ',
  '未来の大喜利AIが最初に覚えた余計な機能',
  'エンジニア人狼でだけ通じる怪しい発言'
]

function createRoomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const values = new Uint8Array(6)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

function RoomControls({ currentRoomCode }: { currentRoomCode?: string }) {
  const [roomCode, setRoomCode] = useState('')
  const roomUrl = currentRoomCode ? `${window.location.origin}/rooms/${currentRoomCode}` : ''

  const createRoom = () => {
    window.history.pushState(null, '', `/rooms/${createRoomCode()}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const joinRoom = () => {
    const code = roomCode.trim().toUpperCase()
    if (!code) return
    window.history.pushState(null, '', `/rooms/${code}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  return (
    <section className="room-panel" aria-label="Room controls">
      <div>
        <p className="eyebrow">Room</p>
        <h1>Ogiri Werewolf</h1>
      </div>

      {currentRoomCode ? (
        <div className="share-box">
          <span className="room-badge">{currentRoomCode}</span>
          <input aria-label="共有URL" readOnly value={roomUrl} />
          <button onClick={() => navigator.clipboard.writeText(roomUrl)}>Copy</button>
        </div>
      ) : (
        <button className="primary-button" onClick={createRoom}>
          Create room
        </button>
      )}

      <div className="join-row">
        <input
          aria-label="ルームコード"
          value={roomCode}
          onChange={(event) => setRoomCode(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') joinRoom()
          }}
          placeholder="ROOM CODE"
        />
        <button onClick={joinRoom}>Join</button>
      </div>
    </section>
  )
}

function OgiriBoard() {
  const [selectedPrompt, setSelectedPrompt] = useState(prompts[0])
  const [answer, setAnswer] = useState('')
  const [roleVisible, setRoleVisible] = useState(false)
  const [phase, setPhase] = useState<'lobby' | 'answering' | 'voting'>('answering')

  const phaseLabel = useMemo(() => {
    if (phase === 'lobby') return 'Lobby'
    if (phase === 'answering') return 'Answer'
    return 'Vote'
  }, [phase])

  return (
    <section className="game-grid" aria-label="Ogiri werewolf game">
      <div className="play-surface">
        <div className="toolbar">
          <div className="segmented" aria-label="Game phase">
            {(['lobby', 'answering', 'voting'] as const).map((item) => (
              <button
                key={item}
                className={phase === item ? 'active' : ''}
                onClick={() => setPhase(item)}
              >
                {item === 'lobby' ? 'Lobby' : item === 'answering' ? 'Answer' : 'Vote'}
              </button>
            ))}
          </div>
          <span className="timer">02:40</span>
        </div>

        <div className="prompt-box">
          <p className="eyebrow">Current prompt</p>
          <h2>{selectedPrompt}</h2>
          <select
            aria-label="お題"
            value={selectedPrompt}
            onChange={(event) => setSelectedPrompt(event.target.value)}
          >
            {prompts.map((prompt) => (
              <option key={prompt}>{prompt}</option>
            ))}
          </select>
        </div>

        <div className="answer-composer">
          <div>
            <p className="eyebrow">Your answer</p>
            <textarea
              aria-label="回答"
              maxLength={54}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="短く、具体的に、ちょっとズラす"
            />
          </div>
          <div className="composer-footer">
            <span>{answer.length}/54</span>
            <button className="primary-button">Submit</button>
          </div>
        </div>

        <div className="answers-list">
          {sampleAnswers.map((item) => (
            <article key={item.name} className="answer-card">
              <div>
                <span className="player-name">{item.name}</span>
                <p>{item.answer}</p>
              </div>
              <button aria-label={`${item.name}に投票`}>{item.votes}</button>
            </article>
          ))}
        </div>
      </div>

      <aside className="side-panel">
        <div className="role-card">
          <p className="eyebrow">Secret role</p>
          <button className="role-toggle" onClick={() => setRoleVisible((value) => !value)}>
            {roleVisible ? 'Ogiri Werewolf' : 'Tap to reveal'}
          </button>
          <p className="role-note">
            {roleVisible
              ? '少しだけズレた答えで、正体を隠しながら票を集める。'
              : '他の人に見えない場所で確認してください。'}
          </p>
        </div>

        <div className="players-panel">
          <div className="panel-heading">
            <p className="eyebrow">Players</p>
            <strong>4 / 6</strong>
          </div>
          {['ミナト', 'リオ', 'カイ', 'あなた'].map((name, index) => (
            <div className="player-row" key={name}>
              <span>{name}</span>
              <small>{index === 3 ? 'writing' : 'ready'}</small>
            </div>
          ))}
        </div>

        <div className="round-panel">
          <p className="eyebrow">Round</p>
          <strong>{phaseLabel}</strong>
          <div className="progress-bar">
            <span style={{ width: phase === 'lobby' ? '22%' : phase === 'answering' ? '62%' : '86%' }} />
          </div>
        </div>
      </aside>
    </section>
  )
}

function OgiriApp({ roomCode }: { roomCode?: string }) {
  return (
    <main className="app-shell">
      <RoomControls currentRoomCode={roomCode} />
      <OgiriBoard />
    </main>
  )
}

function App() {
  const [path, setPath] = useState(window.location.pathname)

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname)
    window.addEventListener('popstate', updatePath)
    return () => window.removeEventListener('popstate', updatePath)
  }, [])

  const roomMatch = path.match(/^\/rooms\/([A-Z0-9-]+)$/i)
  if (roomMatch) return <OgiriApp roomCode={roomMatch[1].toUpperCase()} />

  return <OgiriApp />
}

export default App
