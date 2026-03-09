'use client'

import { useState, useEffect, useCallback } from 'react'
import './globals.css'

interface Ticket {
  id: number
  text: string
}

interface Category {
  name: string
  description: string
}

interface ClassificationResult {
  id: number
  text: string
  category: string
  error?: string
}

type Step = 'upload' | 'categories' | 'classifying' | 'results'

export default function Home() {
  const [apiKey, setApiKey] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [results, setResults] = useState<ClassificationResult[]>([])
  const [step, setStep] = useState<Step>('upload')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

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

    const textIndex = headers.findIndex(h =>
      ['text', 'ticket_text', 'message', 'content', 'description', 'body', 'ticket'].includes(h)
    )

    if (textIndex === -1) {
      return lines.slice(1).map((line, i) => ({
        id: i + 1,
        text: line.replace(/^"|"$/g, '').trim()
      })).filter(t => t.text.length > 0)
    }

    const tickets: Ticket[] = []
    for (let i = 1; i < lines.length; i++) {
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
    setCategories([])
    setStep('upload')

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

  const generateCategories = async () => {
    if (!apiKey || tickets.length === 0) return

    setIsGenerating(true)
    setError('')

    try {
      const response = await fetch('/api/generate-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickets, apiKey })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate categories')
      }

      setCategories(data.categories)
      setStep('categories')

    } catch (err: any) {
      setError(err.message || 'Failed to generate categories')
    } finally {
      setIsGenerating(false)
    }
  }

  const addCategory = () => {
    if (!newCategoryName.trim()) return
    const name = newCategoryName.trim().toLowerCase().replace(/\s+/g, '_')
    if (categories.some(c => c.name === name)) {
      setError('Category already exists')
      return
    }
    setCategories([...categories, { name, description: 'Custom category' }])
    setNewCategoryName('')
  }

  const removeCategory = (name: string) => {
    setCategories(categories.filter(c => c.name !== name))
  }

  const classify = async () => {
    if (!apiKey || tickets.length === 0 || categories.length === 0) return

    setStep('classifying')
    setIsProcessing(true)
    setError('')
    setProgress(0)
    setResults([])

    try {
      const chunkSize = 20
      const allResults: ClassificationResult[] = []
      const categoryNames = categories.map(c => c.name)

      for (let i = 0; i < tickets.length; i += chunkSize) {
        const chunk = tickets.slice(i, i + chunkSize)

        const response = await fetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tickets: chunk,
            apiKey,
            categories: categoryNames
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

      setStep('results')

    } catch (err: any) {
      setError(err.message || 'Classification failed')
      setStep('categories')
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

  const startOver = () => {
    setTickets([])
    setCategories([])
    setResults([])
    setStep('upload')
    setError('')
  }

  const categoryStats = results.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const sortedCategories = Object.entries(categoryStats)
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="container">
      <h1>autoclass</h1>
      <p className="subtitle">Bulk classify support tickets with AI. Categories auto-generated from your data.</p>

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

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <>
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
                ? `${tickets.length.toLocaleString()} tickets loaded`
                : 'Drop CSV here or click to browse'}
            </div>
            <div className="upload-hint">
              {!keySaved
                ? 'Add your API key first'
                : 'CSV should have a "text" column. No file size limit.'}
            </div>
          </div>

          {tickets.length > 0 && (
            <div className="progress-section">
              <p style={{ marginBottom: '1rem' }}>
                <strong>{tickets.length.toLocaleString()}</strong> tickets ready
              </p>
              <button onClick={generateCategories} disabled={isGenerating}>
                {isGenerating ? 'Analyzing tickets...' : 'Generate Categories'}
              </button>
              <button
                className="secondary"
                style={{ marginLeft: '0.5rem' }}
                onClick={() => setTickets([])}
              >
                Clear
              </button>
            </div>
          )}
        </>
      )}

      {/* Step 2: Review Categories */}
      {step === 'categories' && (
        <div className="categories-section">
          <h2>Review Categories</h2>
          <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
            Generated from your {tickets.length.toLocaleString()} tickets. Add, remove, or edit before classifying.
          </p>

          <div className="category-list">
            {categories.map((cat) => (
              <div key={cat.name} className="category-item">
                <div className="category-info">
                  <span className="category-name">{cat.name}</span>
                  <span className="category-desc">{cat.description}</span>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => removeCategory(cat.name)}
                  title="Remove category"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <div className="add-category">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Add custom category..."
              onKeyDown={(e) => e.key === 'Enter' && addCategory()}
            />
            <button onClick={addCategory} disabled={!newCategoryName.trim()}>Add</button>
          </div>

          <div className="action-buttons">
            <button onClick={classify} disabled={categories.length === 0}>
              Classify {tickets.length.toLocaleString()} Tickets
            </button>
            <button className="secondary" onClick={() => setStep('upload')}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Classifying */}
      {step === 'classifying' && (
        <div className="progress-section">
          <div className="progress-header">
            <span>Classifying...</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-text">
            {results.length.toLocaleString()} / {tickets.length.toLocaleString()} tickets processed
          </p>
        </div>
      )}

      {/* Step 4: Results */}
      {step === 'results' && (
        <div className="results-section">
          <div className="results-header">
            <h2>Results</h2>
            <button onClick={downloadCSV}>Download CSV</button>
          </div>

          <div className="results-stats">
            <div className="stat">
              <div className="stat-value">{results.length.toLocaleString()}</div>
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
              Showing 10 of {results.length.toLocaleString()} results. Download CSV for full data.
            </p>
          )}

          <div style={{ marginTop: '1rem' }}>
            <button className="secondary" onClick={startOver}>
              Start Over
            </button>
          </div>
        </div>
      )}

      <footer>
        <p>
          Your API key stays in your browser. Open source on{' '}
          <a href="https://github.com/debgotwired/autoclass">GitHub</a>
        </p>
      </footer>
    </div>
  )
}
