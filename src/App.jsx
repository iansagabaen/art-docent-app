import React, { useState, useEffect } from 'react'

// Curriculum links - add your Google Docs and PDF URLs here
// Qualified lessons (3+): add Google Doc URLs
// Potentially qualified/Single (1-2): add PDF URLs
const CURRICULUM_LINKS = {
  // Qualified lessons - Google Docs
  'Cityscape: A Lesson in Architecture': 'https://docs.google.com/document/d/YOUR-DOC-ID/edit',
  'Photography': 'https://docs.google.com/document/d/YOUR-DOC-ID/edit',
  'Art That Speaks': 'https://docs.google.com/document/d/YOUR-DOC-ID/edit',
  'Tidal Zone Prints': 'https://docs.google.com/document/d/YOUR-DOC-ID/edit',

  // Potentially qualified/Single - PDFs or other URLs
  'Clay Wickiups': null, // TODO: Add PDF URL
  'Mixed Moods': null,
  'Positively Negative': null,
  'Reflections on Buildings': null,
  'Pigment of Imagination': null,
  // Add more as needed
}

// Helper: Get today's date, or use TEST_DATE if set
function getTodayDate() {
  const testDate = new URLSearchParams(window.location.search).get('testDate')
  if (testDate) {
    const d = new Date(testDate)
    if (!isNaN(d)) return d
  }
  return new Date()
}

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

export default function App() {
  const [upcomingClasses, setUpcomingClasses] = useState([])
  const [qualifiedLessons, setQualifiedLessons] = useState([])
  const [potentiallyQualifiedLessons, setPotentiallyQualifiedLessons] = useState([])
  const [singleExperienceLessons, setSingleExperienceLessons] = useState([])
  const [yearsAsDocent, setYearsAsDocent] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAndProcessData()
  }, [])

  const fetchAndProcessData = async () => {
    try {
      // Fetch CSV from backend proxy endpoint
      const response = await fetch('/api/sheets-csv')
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const csvText = await response.text()

      // Parse CSV (comma-separated, handling quoted fields)
      const lines = csvText.split('\n').filter(line => line.trim())
      const headers = parseCSVLine(lines[0])
      
      // Create array of objects from CSV
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

      // Count lessons
      const lessonCounts = {}
      ianRows.forEach(row => {
        const lesson = row['Lesson']
        if (lesson) {
          lessonCounts[lesson] = (lessonCounts[lesson] || 0) + 1
        }
      })

      // Categorize lessons
      const qualified = []
      const potentially = []
      const single = []

      Object.entries(lessonCounts).forEach(([lesson, count]) => {
        if (count >= 3) {
          qualified.push({ lesson, count })
        } else if (count === 2) {
          potentially.push({ lesson, count })
        } else {
          single.push({ lesson, count })
        }
      })

      // Sort
      setQualifiedLessons(qualified.sort((a, b) => b.count - a.count))
      setPotentiallyQualifiedLessons(potentially.sort((a, b) => b.count - a.count))
      setSingleExperienceLessons(single.sort((a, b) => a.lesson.localeCompare(b.lesson)))

      // Calculate years as docent (using test date if provided)
      const firstDate = new Date('2024-10-22')
      const today = getTodayDate()
      const yearsElapsed = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24 * 365.25))
      setYearsAsDocent(yearsElapsed >= 2 ? yearsElapsed : 2)

      // Filter upcoming classes (future dates, using test date if provided)
      const today2 = new Date(getTodayDate())
      today2.setHours(0, 0, 0, 0)
      const upcoming = ianRows.filter(row => {
        const dateStr = row['Date']
        if (!dateStr) return false
        const classDate = new Date(dateStr)
        classDate.setHours(0, 0, 0, 0)
        return classDate > today2
      })

      setUpcomingClasses(upcoming.sort((a, b) => new Date(a['Date']) - new Date(b['Date'])))
      setLoading(false)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError(err.message)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p>Loading your schedule...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '2rem', color: '#ef4444' }}>
        <p>Error loading data: {error}</p>
        <button onClick={fetchAndProcessData} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Try again
        </button>
      </div>
    )
  }

  const testDate = new URLSearchParams(window.location.search).get('testDate')

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {testDate && (
        <div style={{
          background: '#7c2d12',
          border: '1px solid #ea580c',
          borderRadius: '0.5rem',
          padding: '0.75rem',
          marginBottom: '1.5rem',
          fontSize: '0.875rem',
          color: '#fed7aa',
        }}>
          ⏰ Testing with date: {new Date(testDate).toDateString()}
        </div>
      )}

      {/* Header */}
      <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', fontWeight: '600' }}>
        Art Docent Schedule
      </h1>

      {/* Upcoming Classes */}
      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: '600' }}>
          📅 Upcoming Classes
        </h2>
        {upcomingClasses.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {upcomingClasses.map((cls, idx) => (
              <div
                key={idx}
                style={{
                  background: '#d946a6',
                  borderRadius: '0.5rem',
                  padding: '1rem',
                  color: '#fff',
                }}
              >
                <div style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.25rem' }}>
                  {cls['Date']} • {cls['Time']}
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                  {cls['Lesson']}
                </div>
                <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                  {cls['Teacher']} @ {cls['School']}
                  {cls['Grade'] && ` (Grade ${cls['Grade']})`}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            background: '#1f2937',
            border: '0.5px solid #374151',
            borderRadius: '0.5rem',
            padding: '1.5rem',
            textAlign: 'center',
            color: '#9ca3af',
          }}>
            🚀 No upcoming classes this season<br />
            <span style={{ fontSize: '0.875rem' }}>Check back in fall!</span>
          </div>
        )}
      </div>

      {/* Stats Card */}
      <div style={{
        background: '#1f2937',
        border: '0.5px solid #374151',
        borderRadius: '0.75rem',
        padding: '1.5rem',
      }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', fontWeight: '600' }}>
          📊 Your Stats
        </h2>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
            Years as docent: <span style={{ fontWeight: '600', color: '#f3f4f6', fontSize: '1rem' }}>
              {yearsAsDocent} {yearsAsDocent === 1 ? 'year' : 'years'}
            </span>
          </div>
        </div>

        {/* Qualified */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '0.5px solid #374151' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.75rem', color: '#4ade80' }}>
            🏆 Qualified to Lead (3+ times)
          </h3>
          {qualifiedLessons.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {qualifiedLessons.map((item, idx) => {
                const curriculumUrl = CURRICULUM_LINKS[item.lesson]
                return (
                  <div key={idx} style={{ fontSize: '0.95rem', color: '#e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span>{item.lesson}</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>({item.count}x)</span>
                      {curriculumUrl && curriculumUrl !== 'https://docs.google.com/document/d/YOUR-DOC-ID/edit' && (
                        <a href={curriculumUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#93c5fd', fontSize: '0.75rem', textDecoration: 'underline' }}>
                          📖 Curriculum
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>None yet</div>
          )}
        </div>

        {/* Potentially Qualified */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '0.5px solid #374151' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.75rem', color: '#fbbf24' }}>
            ⭐ Potentially Qualified (2 times)
          </h3>
          {potentiallyQualifiedLessons.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {potentiallyQualifiedLessons.map((item, idx) => {
                const curriculumUrl = CURRICULUM_LINKS[item.lesson]
                return (
                  <div key={idx} style={{ fontSize: '0.95rem', color: '#e5e7eb' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                      <span>{item.lesson}</span>
                      <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>({item.count}x)</span>
                      {curriculumUrl && curriculumUrl !== 'https://docs.google.com/document/d/YOUR-DOC-ID/edit' && (
                        <a href={curriculumUrl} target="_blank" rel="noopener noreferrer"
                          style={{ color: '#93c5fd', fontSize: '0.75rem', textDecoration: 'underline' }}>
                          📄 PDF
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>None yet</div>
          )}
        </div>

        {/* Single Experience */}
        {singleExperienceLessons.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.75rem', color: '#60a5fa' }}>
              ✨ Single Experience (1 time)
            </h3>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              fontSize: '0.875rem',
              color: '#9ca3af',
            }}>
              {singleExperienceLessons.map((item, idx) => {
                const curriculumUrl = CURRICULUM_LINKS[item.lesson]
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <span>{item.lesson}</span>
                    {curriculumUrl && curriculumUrl !== 'https://docs.google.com/document/d/YOUR-DOC-ID/edit' && (
                      <a href={curriculumUrl} target="_blank" rel="noopener noreferrer"
                        style={{ color: '#93c5fd', fontSize: '0.75rem', textDecoration: 'underline', marginLeft: 'auto' }}>
                        📄 PDF
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Footer spacer */}
      <div style={{ height: '2rem' }} />
    </div>
  )
}
