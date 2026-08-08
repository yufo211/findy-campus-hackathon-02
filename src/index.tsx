import { Hono } from 'hono'
import { renderToReadableStream } from 'react-dom/server'
import { Script, Link, ViteClient, ReactRefresh } from 'vite-ssr-components/react'
import { generateAiAnswers } from './game/ai'

const app = new Hono<{ Bindings: CloudflareBindings }>()

/**
 * サーバーの仕事はこれだけ。お題を受け取って3モデル分の回答を返す。
 * 人間の回答は端末から出さない（この画面をみんなで覗き込む遊びなので、
 * わざわざサーバーに往復させる意味がない）。
 */
app.post('/api/ai-answers', async (c) => {
  const body = await c.req.json<{ topic?: string }>().catch(() => ({ topic: undefined }))
  const topic = body.topic?.trim()
  if (!topic) {
    return c.json({ error: 'topic is required' }, 400)
  }

  const answers = await generateAiAnswers(c.env.AI, topic.slice(0, 200))
  return c.json({ answers })
})

app.get('/', async (c) => {
  c.header('Content-Type', 'text/html')
  return c.body(
    await renderToReadableStream(
      <html lang="ja">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>大喜利人狼</title>
          <ViteClient />
          <ReactRefresh />
          <Script src="/src/client/index.tsx" />
          <Link href="/src/style.css" rel="stylesheet" />
        </head>
        <body>
          <div id="root" />
        </body>
      </html>
    )
  )
})

export default app
