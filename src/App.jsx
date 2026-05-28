import React, { useState, useEffect } from 'react'

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
      // Fetch CSV from Google Sheets
      const csvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQj04ZOaev6TJ1MTMeEphGMNps96WhCnB29JpzUGx1cr3wJjWCsGC2x5cVMDier6PXQNkZzIA_DlmmJ/pub?output=csv'
      const response = await fetch(csvUrl)
      const csvText = await response.text()

      // Parse CSV (tab-separated)
      const lines = csvText.split('\n').filter(line => line.trim())
      const headers = lines[0].split('\t')
      
      // Create array of objects from CSV
      const rows = lines.slice(1).map(line => {
        const values = line.split('\t')
        const obj = {}
        headers.forEach((header, index) => {
          obj[header.trim()] = values[index]?.trim() || ''
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

      // Calculate years as docent
      const firstDate = new Date('2024-10-22')
      const today = new Date()
      const yearsElapsed = Math.floor((today - firstDate) / (1000 * 60 * 60 * 24 * 365.25))
      setYearsAsDocent(yearsElapsed >= 2 ? yearsElapsed : 2)

      // Filter upcoming classes (future dates)
      const today2 = new Date()
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

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {qualifiedLessons.map((item, idx) => (
                <div key={idx} style={{ fontSize: '0.95rem', color: '#e5e7eb' }}>
                  {item.lesson} <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>({item.count}x)</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>None yet</div>
          )}
        </div>

        {/* Potentially Qualified */}
        <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '0.5px solid #374151' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.75rem', color: '#fbbf24' }}>
            ⭐ Potentially Qualified (1-2 times)
          </h3>
          {potentiallyQualifiedLessons.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {potentiallyQualifiedLessons.map((item, idx) => (
                <div key={idx} style={{ fontSize: '0.95rem', color: '#e5e7eb' }}>
                  {item.lesson} <span style={{ color: '#9ca3af', fontSize: '0.875rem' }}>({item.count}x)</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>None yet</div>
          )}
        </div>

        {/* Single Experience */}
        {singleExperienceLessons.length > 0 && (
          <div>
            <h3 style={{ fontSize: '0.95rem', fontWeight: '600', marginBottom: '0.75rem', color: '#60a5fa' }}>
              ✨ Single Experience
            </h3>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '0.5rem',
              fontSize: '0.875rem',
              color: '#9ca3af',
            }}>
              {singleExperienceLessons.map((item, idx) => (
                <div key={idx}>{item.lesson}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer spacer */}
      <div style={{ height: '2rem' }} />
    </div>
  )
}
