import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HOST = '127.0.0.1'
const PORT = 4173
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const CONTENT_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
}

function resolveRequestPath(urlPathname: string): string | null {
  const normalizedPath = urlPathname === '/' ? '/test-restriction.html' : urlPathname
  const filePath = path.resolve(ROOT, `.${normalizedPath}`)
  const relativePath = path.relative(ROOT, filePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) return null
  return filePath
}

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url ?? '/', `http://${HOST}:${PORT}`)
  const filePath = resolveRequestPath(requestUrl.pathname)

  if (!filePath) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  try {
    const file = await readFile(filePath)
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    response.end(file)
  } catch {
    response.writeHead(404)
    response.end('Not Found')
  }
})

server.listen(PORT, HOST, () => {
  console.log(`Test server running at http://${HOST}:${PORT}`)
})
