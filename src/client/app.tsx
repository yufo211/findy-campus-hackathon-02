import { useState } from 'react'
import { buildAnswers } from '../game/round'
import { pickTopic } from '../game/topics'
import { MAX_ANSWER_LENGTH, type AiAnswersResponse, type Answer } from '../game/types'
import {
  AnswersScreen,
  ErrorScreen,
  GeneratingScreen,
  HandoffScreen,
  IntroScreen,
  ResultScreen,
  VerdictScreen,
  WritingScreen
} from './screens'

type Phase =
  | 'intro' // 遊び方
  | 'handoff' // 端末を回答者に渡す
  | 'writing' // 回答者だけが見て入力する
  | 'generating' // AIの回答待ち
  | 'error' // 生成に失敗
  | 'answers' // 全員に見せて話し合う（オフライン）
  | 'verdict' // 話し合いの結論を入力
  | 'result' // 答え合わせ

function App() {
  const [phase, setPhase] = useState<Phase>('intro')
  const [topic, setTopic] = useState('')
  const [humanAnswer, setHumanAnswer] = useState('')
  const [answers, setAnswers] = useState<Answer[]>([])
  const [pick, setPick] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  /** お題を引き直して、回答者への受け渡し画面に戻る */
  const newRound = () => {
    setTopic((prev) => pickTopic(prev))
    setHumanAnswer('')
    setAnswers([])
    setPick(null)
    setPhase('handoff')
  }

  /** 回答者の回答は端末から出さず、AIぶんだけ取りに行ってこちらで混ぜる */
  const fetchAnswers = async (humanText: string, currentTopic: string) => {
    setPhase('generating')
    try {
      const res = await fetch('/api/ai-answers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: currentTopic })
      })
      if (!res.ok) throw new Error(`サーバーが ${res.status} を返しました`)

      const data = (await res.json()) as AiAnswersResponse
      setAnswers(buildAnswers(humanText, data.answers))
      setPhase('answers')
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }

  const submit = () => {
    const text = humanAnswer.trim().replace(/\s+/g, ' ').slice(0, MAX_ANSWER_LENGTH)
    if (!text) return
    setHumanAnswer(text)
    fetchAnswers(text, topic)
  }

  return (
    <main className="app">
      {phase === 'intro' && <IntroScreen onStart={newRound} />}

      {phase === 'handoff' && <HandoffScreen onReady={() => setPhase('writing')} />}

      {phase === 'writing' && (
        <WritingScreen
          topic={topic}
          value={humanAnswer}
          onChange={setHumanAnswer}
          onSubmit={submit}
          onReroll={() => setTopic((prev) => pickTopic(prev))}
        />
      )}

      {phase === 'generating' && <GeneratingScreen />}

      {phase === 'error' && (
        <ErrorScreen message={errorMessage} onRetry={() => fetchAnswers(humanAnswer, topic)} />
      )}

      {phase === 'answers' && (
        <AnswersScreen topic={topic} answers={answers} onDone={() => setPhase('verdict')} />
      )}

      {phase === 'verdict' && (
        <VerdictScreen
          answers={answers}
          onPick={(key) => {
            setPick(key)
            setPhase('result')
          }}
        />
      )}

      {phase === 'result' && pick !== null && (
        <ResultScreen
          answers={answers}
          pick={pick}
          onNext={newRound}
          onFinish={() => setPhase('intro')}
        />
      )}
    </main>
  )
}

export default App
