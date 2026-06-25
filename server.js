import express from 'express'
import fetch from 'node-fetch'

const app = express()
const PORT = 3002

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') {
    res.sendStatus(200)
  } else {
    next()
  }
})

// Proxy endpoint for Google Sheets CSV
app.get('/api/sheets-csv', async (req, res) => {
  try {
    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQj04ZOaev6TJ1MTMeEphGMNps96WhCnB29JpzUGx1cr3wJjWCsGC2x5cVMDier6PXQNkZzIA_DlmmJ/pub?output=csv'
    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/csv, */*',
        'Referer': 'https://docs.google.com/'
      },
      redirect: 'follow',
      timeout: 10000
    })

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`)
    }

    const csv = await response.text()
    if (csv.includes('<!DOCTYPE') || csv.includes('<html')) {
      throw new Error('Got HTML instead of CSV - Google Sheets might be blocking the request')
    }

    res.type('text/csv').send(csv)
  } catch (err) {
    console.error('Error fetching CSV:', err)
    res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`CSV proxy server listening on port ${PORT}`)
})
