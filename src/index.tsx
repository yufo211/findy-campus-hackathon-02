import { Hono } from 'hono'
import { agentsMiddleware } from 'hono-agents'
import { renderToReadableStream } from 'react-dom/server'
import { Script, Link, ViteClient, ReactRefresh } from 'vite-ssr-components/react'
export { LobbyAgent } from './agents/lobby'
export { RoomAgent } from './agents/room'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('*', agentsMiddleware())

app.get('/', async (c) => {
  c.header('Content-Type', 'text/html')
  return c.body(
    await renderToReadableStream(
      <html lang="ja">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>ニンゲンかAIか — 大喜利</title>
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
