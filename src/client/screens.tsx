import { useEffect, useRef, useState } from 'react'
import { humanKeyOf } from '../game/round'
import {
  AI_COUNT,
  DISCUSSION_SECONDS,
  MAX_ANSWER_LENGTH,
  WRITE_SECONDS,
  type Answer
} from '../game/types'
import { isSubmitEnter } from './keys'

/** 0で止まるだけのカウントダウン。進行は止めない */
function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds)
  useEffect(() => {
    const timer = setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000)
    return () => clearInterval(timer)
  }, [])
  return left
}

function formatTime(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/* --- 1. 遊び方 --- */

export function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="card">
      <h1 className="title">
        大喜利<span className="accent">人狼</span>
      </h1>
      <p className="lead">
        1台のスマホを回して遊びます。
        <br />
        <strong>回答者</strong>が1人だけ、お題に対して<strong>「AIっぽい回答」</strong>を入力。
        そこに<strong>{AI_COUNT}体のAI</strong>の回答が混ざって並びます。
        <br />
        <strong>判断者</strong>のみんなで話し合って、<strong>どれが回答者の回答か</strong>
        を当ててください。
      </p>
      <button className="btn primary big" onClick={onStart}>
        はじめる
      </button>
    </div>
  )
}

/* --- 2. 端末の受け渡し --- */

export function HandoffScreen({ onReady }: { onReady: () => void }) {
  return (
    <div className="card center">
      <p className="handoff-lead">回答者を1人決めてください</p>
      <div className="handoff-icon">✍️</div>
      <p className="handoff-lead">
        決まったら、スマホを回答者に渡します。
        <br />
        <strong>判断者は画面を見ないように。</strong>
      </p>
      <button className="btn primary big" onClick={onReady}>
        回答者です。お題を見る
      </button>
    </div>
  )
}

/* --- 3. 回答の入力（回答者だけが見る） --- */

export function WritingScreen({
  topic,
  value,
  onChange,
  onSubmit,
  onReroll
}: {
  topic: string
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onReroll: () => void
}) {
  const left = useCountdown(WRITE_SECONDS)
  // 日本語変換中かどうか。再レンダリングを挟まずイベント時点の値を読みたいのでrefで持つ
  const composing = useRef(false)

  return (
    <>
      <div className="card topic">
        <span className="label">お題</span>
        <h2>{topic}</h2>
        <button className="btn link" onClick={onReroll}>
          お題を引き直す
        </button>
      </div>

      <div className="card">
        <div className="phase-head">
          <div className="phase-title">
            <strong>AIが書きそうな回答</strong>を入力してください
          </div>
          <div className={left === 0 ? 'timer small hot' : 'timer small'}>{formatTime(left)}</div>
        </div>
        <input
          className="answer-input"
          value={value}
          maxLength={MAX_ANSWER_LENGTH}
          placeholder={`AIっぽい回答（${MAX_ANSWER_LENGTH}文字まで）`}
          onChange={(e) => onChange(e.target.value)}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
          onKeyDown={(e) => {
            if (isSubmitEnter(e, composing.current)) onSubmit()
          }}
          autoFocus
        />
        <button className="btn primary big" onClick={onSubmit} disabled={value.trim().length === 0}>
          決定
        </button>
        <p className="hint">
          AI側は「25文字以内・1行・句点なし」で回答します。体裁を合わせると紛れやすくなります。
        </p>
      </div>
    </>
  )
}

/* --- 4. 生成待ち --- */

export function GeneratingScreen() {
  return (
    <div className="card center">
      <div className="spinner" />
      <p className="pulse">{AI_COUNT}体のAIが回答中…</p>
    </div>
  )
}

export function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="card center">
      <p className="verdict lose">AIの回答を取得できませんでした</p>
      <p className="hint">{message}</p>
      <button className="btn primary big" onClick={onRetry}>
        もう一度試す
      </button>
    </div>
  )
}

/* --- 5. 回答を並べて話し合い（オフライン） --- */

export function AnswersScreen({
  topic,
  answers,
  onDone
}: {
  topic: string
  answers: Answer[]
  onDone: () => void
}) {
  const left = useCountdown(DISCUSSION_SECONDS)

  return (
    <>
      <div className="card topic">
        <span className="label">お題</span>
        <h2>{topic}</h2>
      </div>

      <div className="card">
        <div className="phase-title">
          この中の1つが<strong>回答者</strong>の回答です
        </div>
        <ul className="answers">
          {answers.map((a) => (
            <li key={a.key}>
              <div className="answer static">
                <span className="key">{a.key}</span>
                <span className="text">{a.text}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="hint">判断者だけで話し合ってください。回答者は黙っていること。</p>
      </div>

      <div className="card center">
        <div className={left === 0 ? 'timer hot' : 'timer'}>{formatTime(left)}</div>
        <button className="btn primary big" onClick={onDone}>
          結論が出た
        </button>
      </div>
    </>
  )
}

/* --- 6. 判断者の結論を入力 --- */

export function VerdictScreen({
  answers,
  onPick
}: {
  answers: Answer[]
  onPick: (key: string) => void
}) {
  return (
    <div className="card">
      <div className="phase-title">
        どれが<strong>回答者</strong>の回答だと思いますか？
      </div>
      <ul className="answers">
        {answers.map((a) => (
          <li key={a.key}>
            <button className="answer" onClick={() => onPick(a.key)}>
              <span className="key">{a.key}</span>
              <span className="text">{a.text}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="hint">タップすると答え合わせになります</p>
    </div>
  )
}

/* --- 7. 答え合わせ --- */

export function ResultScreen({
  answers,
  pick,
  onNext,
  onFinish
}: {
  answers: Answer[]
  pick: string
  onNext: () => void
  onFinish: () => void
}) {
  const correct = pick === humanKeyOf(answers)

  return (
    <div className="card">
      <div className={correct ? 'verdict win' : 'verdict lose'}>
        {correct ? '正解！ 判断者が回答者を見抜きました' : '不正解。回答者がAIに紛れ切りました'}
      </div>

      <ul className="answers reveal">
        {answers.map((a) => {
          const isHuman = a.kind === 'human'
          return (
            <li key={a.key}>
              <div
                className={`answer static ${isHuman ? 'is-human' : ''} ${a.key === pick ? 'picked' : ''}`}
              >
                <span className="key">{a.key}</span>
                <span className="text">{a.text}</span>
                <span className={isHuman ? 'tag human' : 'tag ai'}>
                  {isHuman ? '🧑 回答者' : `🤖 ${a.model}`}
                </span>
              </div>
              {a.key === pick && <p className="voters">判断者の結論</p>}
            </li>
          )
        })}
      </ul>

      <div className="actions">
        <button className="btn primary" onClick={onNext}>
          次のお題へ
        </button>
        <button className="btn ghost" onClick={onFinish}>
          終わる
        </button>
      </div>
    </div>
  )
}
