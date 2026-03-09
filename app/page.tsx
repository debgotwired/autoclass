'use client'

import { useState, useEffect, useCallback } from 'react'
import './globals.css'

interface Ticket {
  id: number
  text: string
  category?: string
}

interface ClassificationResult {
  id: number
  text: string
  category: string
  error?: string
}

export default function Home() {
  const [apiKey, setApiKey] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [results, setResults] = useState<ClassificationResult[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [customCategories, setCustomCategories] = useState<string[]>([])

  // Load API key from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('autoclass_api_key')
    if (saved) {
      setApiKey(saved)
      setKeySaved(true)
    }
  }, [])

  const saveApiKey = () => {
    if (apiKey.startsWith('sk-')) {
      localStorage.setItem('autoclass_api_key', apiKey)
      setKeySaved(true)
    }
  }

  const clearApiKey = () => {
    localStorage.removeItem('autoclass_api_key')
    setApiKey('')
    setKeySaved(false)
  }

  const parseCSV = (text: string): Ticket[] => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []

    const header = lines[0].toLowerCase()
    const headers = header.split(',').map(h => h.trim().replace(/"/g, ''))

    // Find the text column
    const textIndex = headers.findIndex(h =>
      ['text', 'ticket_text', 'message', 'content', 'description', 'body', 'ticket'].includes(h)
    )

    if (textIndex === -1) {
      // If no header found, assume single column
      return lines.slice(1).map((line, i) => ({
        id: i + 1,
        text: line.replace(/^"|"$/g, '').trim()
      })).filter(t => t.text.length > 0)
    }

    const tickets: Ticket[] = []
    for (let i = 1; i < lines.length; i++) {
      // Simple CSV parsing (handles basic quoted fields)
      const values = lines[i].match(/("([^"]*)"|[^,]+)/g) || []
      const text = values[textIndex]?.replace(/^"|"$/g, '').trim()
      if (text) {
        tickets.push({ id: i, text })
      }
    }
    return tickets
  }

  const handleFile = useCallback((file: File) => {
    setError('')
    setResults([])

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const parsed = parseCSV(text)
      if (parsed.length === 0) {
        setError('Could not parse CSV. Make sure it has a "text" column.')
        return
      }
      setTickets(parsed)
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const classify = async () => {
    if (!apiKey || tickets.length === 0) return

    setIsProcessing(true)
    setError('')
    setProgress(0)
    setResults([])

    try {
      // Process in chunks to show progress
      const chunkSize = 20
      const allResults: ClassificationResult[] = []

      for (let i = 0; i < tickets.length; i += chunkSize) {
        const chunk = tickets.slice(i, i + chunkSize)

        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tickets: chunk,
            apiKey,
            categories: customCategories.length > 0 ? customCategories : undefined
          })
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Classification failed')
        }

        allResults.push(...data.results)
        setProgress(Math.round((allResults.length / tickets.length) * 100))
        setResults([...allResults])
      }

    } catch (err: any) {
      setError(err.message || 'Classification failed')
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadCSV = () => {
    if (results.length === 0) return

    const csv = [
      'text,category',
      ...results.map(r =>
        `"${r.text.replace(/"/g, '""')}","${r.category}"`
      )
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'classified_tickets.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Calculate category distribution
  const categoryStats = results.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sortedCategories = Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="container">
      <h1>autoclass</h1>
      <p className="subtitle">Bulk classify support tickets with AI. BYOK.</p>

      {/* API Key Section */}
      <div className="key-section">
        <label>OpenAI API Key</label>
        <div className="key-input-row">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setKeySaved(false)
            }}
            placeholder="sk-..."
          />
          {keySaved ? (
            <button className="secondary" onClick={clearApiKey}>Clear</button>
          ) : (
            <button onClick={saveApiKey} disabled={!apiKey.startsWith('sk-')}>Save</button>
          )}
        </div>
        {keySaved && (
          <p className="key-status saved">Key saved in browser (never sent to our servers)</p>
        )}
      </div>

      {error && <div className="error">{error}</div>}

      {/* Upload Zone */}
      {results.length === 0 && (
        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''} ${!keySaved ? 'disabled' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => {
            if (!keySaved) return
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.csv'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) handleFile(file)
            }
            input.click()
          }}
        >
          <div className="upload-icon">📄</div>
          <div className="upload-text">
            {tickets.length > 0
              ? `${tickets.length} tickets loaded`
              : 'Drop CSV here or click to browse'}
          </div>
          <div className="upload-hint">
            {!keySaved
              ? 'Add your API key first'
              : 'CSV should have a "text" column'}
          </div>
        </div>
      )}

      {/* Ready to classify */}
      {tickets.length > 0 && results.length === 0 && !isProcessing && (
        <div className="progress-section">
          <p style={{ marginBottom: '1rem' }}>
            Ready to classify <strong>{tickets.length}</strong> tickets
          </p>
          <button onClick={classify}>Classify All</button>
          <button
            className="secondary"
            style={{ marginLeft: '0.5rem' }}
            onClick={() => setTickets([])}
          >
            Clear
          </button>
        </div>
      )}

      {/* Processing */}
      {isProcessing && (
        <div className="progress-section">
          <div className="progress-header">
            <span>Classifying...</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-text">
            {results.length} / {tickets.length} tickets processed
          </p>
        </div>
      )}

      {/* Results */}
      {results.length > 0 && !isProcessing && (
        <div className="results-section">
          <div className="results-header">
            <h2>Results</h2>
            <button onClick={downloadCSV}>Download CSV</button>
          </div>

          <div className="results-stats">
            <div className="stat">
              <div className="stat-value">{results.length}</div>
              <div className="stat-label">Tickets</div>
            </div>
            <div className="stat">
              <div className="stat-value">{sortedCategories.length}</div>
              <div className="stat-label">Categories</div>
            </div>
          </div>

          <div className="categories">
            {sortedCategories.map(([cat, count]) => (
              <span key={cat} className="category-tag">
                {cat}<span className="count">{count}</span>
              </span>
            ))}
          </div>

          <table className="preview-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 10).map((r) => (
                <tr key={r.id}>
                  <td>{r.text}</td>
                  <td className="category-cell">{r.category}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {results.length > 10 && (
            <p className="progress-text">
              Showing 10 of {results.length} results. Download CSV for full data.
            </p>
          )}

          <div style={{ marginTop: '1rem' }}>
            <button
              className="secondary"
              onClick={() => {
                setTickets([])
                setResults([])
              }}
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      <footer>
        <p>
          Your API key stays in your browser.{' '}
          <a href="https://github.com/karpathy/autoresearch">Inspired by autoresearch</a>
        </p>
      </footer>
    </div>
  )
}
