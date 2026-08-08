import { useCallback, useState } from 'react'
import { Lobby } from './lobby'
import { Room } from './room'
import { getPlayerId } from './identity'

function App() {
  const [playerId] = useState(getPlayerId)
  const [roomId, setRoomId] = useState<string | null>(null)

  const onMatched = useCallback((id: string) => setRoomId(id), [])
  const onExit = useCallback(() => setRoomId(null), [])

  return (
    <main className="app">
      {roomId === null ? (
        <Lobby playerId={playerId} onMatched={onMatched} />
      ) : (
        <Room roomId={roomId} playerId={playerId} onExit={onExit} />
      )}
    </main>
  )
}

export default App
