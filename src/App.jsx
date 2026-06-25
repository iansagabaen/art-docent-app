import React, { useState, useEffect } from 'react'

// Curriculum links - add your Google Docs and PDF URLs here
// Qualified lessons (3+): add Google Doc URLs
// Potentially qualified/Single (1-2): add PDF URLs
const CURRICULUM_LINKS = {
  // Qualified lessons - Google Docs
  'Cityscape: A Lesson in Architecture': 'https://docs.google.com/document/d/1n33yu75263k9_NQcGCeutMddw8N60gbyPJcmPx4DMI4/edit?tab=t.0#heading=h.t4jioe7i6ng',
  'Photography': 'https://docs.google.com/document/d/1Xx6sdYhi3drzeERLK22ieKCOzbfa6hYw6mCJItCXctg/edit?tab=t.0#heading=h.t4jioe7i6ng',
  'Art That Speaks': null, // TODO: Add URL
  'Tidal Zone Prints': 'https://docs.google.com/document/d/YOUR-DOC-ID/edit', // TODO: Add URL

  // Potentially qualified/Single - PDFs (using school district filenames)
  'Clay Wickiups': null, // TODO: Add when available
  'Mixed Moods': '/pdfs/Mixed Moods_5.pdf',
  'Positively Negative': '/pdfs/PositivelyNegative_5.pdf',
  'Reflections on Buildings': '/pdfs/Reflections on Buildings_2.pdf',
  'Pigment of Imagination': null, // TODO: Add when available
  'Clay Bears & Quail': '/pdfs/Clay Bears & Quail_3.pdf',
  'Drawing Still Life': '/pdfs/Drawing Still Life.pdf',
  'Egyptian Bird Masks': '/pdfs/EgyptianBirdMasks_6.pdf',
  'Fauve Landscape': '/pdfs/Fauve_2 (1).pdf',
  'Finding Balance': null, // TODO: Add when available
  'Heads & Faces': '/pdfs/Heads & Faces_2.pdf',
  'Human Form': null, // TODO: Add when available
  'Lights, Color, Collage': null, // TODO: Add when available
  'Pleasing Pastels': null, // TODO: Add when available
  'Printmaking': null, // TODO: Add when available
  'See Shells': null, // TODO: Add when available
  'Watercolor Ecospheres': null, // TODO: Add when available
  'Watercolor Seascapes': '/pdfs/Watercolor Seascapes_5.pdf',
  'Watercolor Still Life': '/pdfs/WatercolorStillLife_5.pdf',
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
  const [availablePdfs, setAvailablePdfs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchAndProcessData()
    fetchAvailablePdfs()
  }, [])

  // Auto-discover PDFs in the public/pdfs folder
  const fetchAvailablePdfs = async () => {
    try {
      const response = await fetch('/api/list-pdfs')
      if (response.ok) {
        const data = await response.json()
        setAvailablePdfs(data.pdfs || [])
      }
    } catch (err) {
      console.log('PDF listing not available (expected in dev mode)')
    }
  }

  // Helper to find PDF for a lesson by filename matching
  const getPdfUrlForLesson = (lessonName) => {
    if (!availablePdfs.length) {
      return CURRICULUM_LINKS[lessonName] // Fallback to manual links
    }

    // Try to find a matching PDF in the available files
    const matchedPdf = availablePdfs.find(pdf => {
      // Normalize names for matching (remove punctuation, make lowercase)
      const pdfNorm = pdf.toLowerCase().replace(/[_\s\.]/g, '')
      const lessonNorm = lessonName.toLowerCase().replace(/[_\s\.]/g, '')
      return pdfNorm.includes(lessonNorm) || lessonNorm.includes(pdfNorm.replace('.pdf', ''))
    })

    if (matchedPdf) {
      return `/pdfs/${matchedPdf}`
    }

    return CURRICULUM_LINKS[lessonName] // Fallback to manual links
  }

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
            {upcomingClasses.map((cls, idx) => {
              const isNext = idx === 0
              return (
                <div
                  key={idx}
                  style={{
                    background: isNext ? '#d946a6' : '#374151',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    color: '#fff',
                    border: isNext ? 'none' : '0.5px solid #4b5563',
                    transform: isNext ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isNext ? '0 4px 12px rgba(217, 70, 166, 0.3)' : 'none',
                  }}
                >
                  {isNext && (
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.5rem', color: '#fda4af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🎯 Next Class
                    </div>
                  )}
                  <div style={{ fontSize: '0.875rem', opacity: isNext ? 0.9 : 0.7, marginBottom: '0.25rem' }}>
                    {cls['Date']} • {cls['Time']}
                  </div>
                  {getPdfUrlForLesson(cls['Lesson']) ? (
                    <a
                      href={getPdfUrlForLesson(cls['Lesson'])}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        fontSize: isNext ? '1.125rem' : '1rem',
                        fontWeight: '600',
                        marginBottom: '0.25rem',
                        display: 'block',
                        textDecoration: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        opacity: 0.9,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = '0.7'}
                      onMouseLeave={(e) => e.target.style.opacity = '0.9'}
                    >
                      {cls['Lesson']}
                    </a>
                  ) : (
                    <div style={{ fontSize: isNext ? '1.125rem' : '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                      {cls['Lesson']}
                    </div>
                  )}

                  <div style={{ fontSize: '0.9rem', opacity: isNext ? 0.9 : 0.7, marginBottom: '0.5rem' }}>
                    {cls['Teacher']} @ {cls['School']}
                    {cls['Grade'] && ` (Grade ${cls['Grade']})`}
                  </div>

                  {/* Leads and Assists */}
                  <div style={{ fontSize: '0.85rem', opacity: isNext ? 0.85 : 0.65, marginBottom: '0.5rem', lineHeight: '1.4' }}>
                    {(() => {
                      const lead = cls['Lead']?.trim() || ''
                      const assist1 = cls['Assist']?.trim() || ''
                      const assist2 = cls['Assist 2']?.trim() || ''

                      const ianIsLead = lead.includes('Ian')
                      const hasLead = lead.length > 0

                      return (
                        <div>
                          {!hasLead && (
                            <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                              ⚠️ No lead assigned
                            </div>
                          )}
                          {lead && (
                            <div style={{
                              color: ianIsLead ? (isNext ? '#fda4af' : '#86efac') : '#e5e7eb',
                              fontWeight: ianIsLead ? '600' : 'normal'
                            }}>
                              {lead}
                            </div>
                          )}
                          {assist1 && (
                            <div style={{ color: '#d1d5db', fontSize: '0.85rem' }}>
                              {assist1}
                            </div>
                          )}
                          {assist2 && (
                            <div style={{ color: '#d1d5db', fontSize: '0.85rem' }}>
                              {assist2}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
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
          <div style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
            Started: <span style={{ fontWeight: '600', color: '#f3f4f6' }}>October 2024</span>
          </div>
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
                const curriculumUrl = getPdfUrlForLesson(item.lesson)
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
                const curriculumUrl = getPdfUrlForLesson(item.lesson)
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
                const curriculumUrl = getPdfUrlForLesson(item.lesson)
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
