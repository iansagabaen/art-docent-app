import fetch from 'node-fetch'

export default async (req, context) => {
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

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'max-age=3600'
      }
    })
  } catch (err) {
    console.error('Error fetching CSV:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}
