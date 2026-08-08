/**
 * プレイヤー識別は sessionStorage に持つ。
 * タブごとに別IDになるので、1台のPCで2タブ開けばマッチングを試せる。
 */
const ID_KEY = 'ogiri.playerId'
const NAME_KEY = 'ogiri.playerName'

const NAMES = ['たぬき', 'ねこじゃらし', 'こんぶ', 'まくら', 'ハンバーグ', 'ちくわ', 'せんぷうき', 'みかん']

export function getPlayerId(): string {
  let id = sessionStorage.getItem(ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(ID_KEY, id)
  }
  return id
}

export function loadName(): string {
  const saved = sessionStorage.getItem(NAME_KEY)
  if (saved) return saved
  return NAMES[Math.floor(Math.random() * NAMES.length)]
}

export function saveName(name: string) {
  sessionStorage.setItem(NAME_KEY, name)
}
