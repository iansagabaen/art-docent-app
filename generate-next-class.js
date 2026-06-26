import fetch from 'node-fetch'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Parse CSV line handling quoted fields with commas
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

// Format date for display (e.g., "Jan 13")
function formatShortDate(dateStr) {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  return `${month} ${day}`
}

async function generateNextClassJson() {
  try {
    console.error('📋 Generating next-class.json from Google Sheets...')

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

    const csvText = await response.text()

    if (csvText.includes('<!DOCTYPE') || csvText.includes('<html')) {
      throw new Error('Got HTML instead of CSV')
    }

    // Parse CSV
    const lines = csvText.split('\n').filter(line => line.trim())
    const headers = parseCSVLine(lines[0])

    const rows = lines.slice(1).map(line => {
      const values = parseCSVLine(line)
      const obj = {}
      headers.forEach((header, index) => {
        obj[header] = values[index] || ''
      })
      return obj
    })

    // Filter rows where Ian appears in any role
    const ianRows = rows.filter(row => {
      const lead = row['Lead'] || ''
      const assist = row['Assist'] || ''
      const assist2 = row['Assist 2'] || ''
      return lead.includes('Ian') || assist.includes('Ian') || assist2.includes('Ian')
    })

    // Find upcoming classes (future dates)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const upcoming = ianRows.filter(row => {
      const dateStr = row['Date']
      if (!dateStr) return false
      const classDate = new Date(dateStr)
      classDate.setHours(0, 0, 0, 0)
      return classDate > today
    })

    upcoming.sort((a, b) => new Date(a['Date']) - new Date(b['Date']))

    // Build the next-class object
    const nextClass = upcoming.length > 0 ? {
      date: formatShortDate(upcoming[0]['Date']),
      time: upcoming[0]['Time'] || '',
      lesson: upcoming[0]['Lesson'] || '',
      teacher: upcoming[0]['Teacher'] || '',
      school: upcoming[0]['School'] || '',
      grade: upcoming[0]['Grade'] || '',
      lead: upcoming[0]['Lead'] || '',
      assist: upcoming[0]['Assist'] || '',
      assist2: upcoming[0]['Assist 2'] || ''
    } : null

    // Create output directory if it doesn't exist
    const publicDir = path.join(__dirname, 'public')
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true })
    }

    // Write JSON file
    const outputPath = path.join(publicDir, 'next-class.json')
    const output = {
      nextClass: nextClass,
      generatedAt: new Date().toISOString(),
      upcoming: upcoming.slice(0, 5).map(row => ({
        date: formatShortDate(row['Date']),
        lesson: row['Lesson'] || '',
        teacher: row['Teacher'] || ''
      }))
    }

    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2))
    console.log(`✅ Generated ${outputPath}`)
    console.log(`📅 Next class: ${nextClass ? nextClass.lesson + ' on ' + nextClass.date : 'No upcoming classes'}`)

  } catch (err) {
    console.error('❌ Error generating next-class.json:', err.message)
    process.exit(1)
  }
}

generateNextClassJson()
