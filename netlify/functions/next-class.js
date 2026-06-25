const fetch = require('node-fetch')

exports.handler = async (event, context) => {
  try {
    const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQj04ZOaev6TJ1MTMeEphGMNps96WhCnB29JpzUGx1cr3wJjWCsGC2x5cVMDier6PXQNkZzIA_DlmmJ/pub?output=csv'

    const response = await fetch(csvUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/csv, */*',
        'Referer': 'https://docs.google.com/'
      },
      redirect: 'follow'
    })

    if (!response.ok) {
      throw new Error(`Google Sheets returned ${response.status}`)
    }

    const csv = await response.text()

    if (csv.includes('<!DOCTYPE') || csv.includes('<html')) {
      throw new Error('Got HTML instead of CSV')
    }

    // Simple CSV line parser
    function parseCSVLine(line) {
      const result = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        const nextChar = line[i + 1]

        if (char === '"') {
          if (inQuotes && nextChar === '"') {
            current += '"'
            i++
          } else {
            inQuotes = !inQuotes
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    // Parse CSV
    const lines = csv.split('\n').filter(line => line.trim())
    const headers = parseCSVLine(lines[0])

    const rows = lines.slice(1).map(line => {
      const values = parseCSVLine(line)
      const obj = {}
      headers.forEach((header, index) => {
        obj[header] = values[index] || ''
      })
      return obj
    })

    // Filter for Ian's classes
    const ianRows = rows.filter(row => {
      const lead = row['Lead'] || ''
      const assist = row['Assist'] || ''
      const assist2 = row['Assist 2'] || ''
      return lead.includes('Ian') || assist.includes('Ian') || assist2.includes('Ian')
    })

    // Find next class
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const nextClass = ianRows.find(row => {
      const dateStr = row['Date']
      if (!dateStr) return false
      const classDate = new Date(dateStr)
      classDate.setHours(0, 0, 0, 0)
      return classDate >= today
    })

    if (!nextClass) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'max-age=3600'
        },
        body: JSON.stringify({
          nextClass: null,
          message: 'No upcoming classes'
        })
      }
    }

    // Format date without leading zeros
    const dateObj = new Date(nextClass['Date'])
    const month = dateObj.toLocaleDateString('en-US', { month: 'short' })
    const day = dateObj.getDate()
    const formattedDate = `${month} ${day}`

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'max-age=3600'
      },
      body: JSON.stringify({
        nextClass: {
          date: formattedDate,
          time: nextClass['Time'],
          lesson: nextClass['Lesson'],
          teacher: nextClass['Teacher'],
          school: nextClass['School'],
          grade: nextClass['Grade'],
          lead: nextClass['Lead'],
          assist: nextClass['Assist'],
          assist2: nextClass['Assist 2']
        }
      })
    }
  } catch (err) {
    console.error('Error:', err)
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: err.message })
    }
  }
}
