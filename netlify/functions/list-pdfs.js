import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export default async (req, context) => {
  try {
    // In Netlify, the public folder is available at runtime
    const pdfDir = path.join(process.cwd(), 'public', 'pdfs')

    let files = []
    try {
      files = fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf'))
    } catch (err) {
      // Fallback: return empty list if directory doesn't exist
      files = []
    }

    return new Response(JSON.stringify({ pdfs: files }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=300'
      }
    })
  } catch (err) {
    console.error('Error listing PDFs:', err)
    return new Response(JSON.stringify({ error: err.message, pdfs: [] }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
