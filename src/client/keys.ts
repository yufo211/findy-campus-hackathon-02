/**
 * Enterキーを「送信」とみなしてよいかの判定。
 *
 * 日本語入力では変換を確定するのにEnterを押すので、素直に onKeyDown で拾うと
 * 変換確定のつもりが送信されてしまう。判定に使える手がかりはブラウザによって違う:
 *
 *   Chrome / Firefox … 変換確定のkeydownは nativeEvent.isComposing === true
 *   Safari           … 変換中のkeydownは keyCode === 229 で来る
 *   compositionstart / compositionend … 発火順がブラウザで前後するので単独では不十分
 *
 * どれか1つでも「変換中」を示していたら送信しない、という積み重ねで守る。
 */
export type EnterGuardEvent = {
  key: string
  keyCode: number
  nativeEvent: { isComposing: boolean }
}

export function isSubmitEnter(e: EnterGuardEvent, composing: boolean): boolean {
  if (e.key !== 'Enter') return false
  if (composing) return false
  if (e.nativeEvent.isComposing) return false
  if (e.keyCode === 229) return false
  return true
}
