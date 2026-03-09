'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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

type Step = 'upload' | 'preview' | 'categories' | 'classifying' | 'results'

// Cost per 1M tokens for gpt-4o-mini (input + output avg)
const COST_PER_1M_TOKENS = 0.15
const AVG_TOKENS_PER_TICKET = 100 // rough estimate

function estimateCost(ticketCount: number): string {
  const tokens = ticketCount * AVG_TOKENS_PER_TICKET
  const cost = (tokens / 1_000_000) * COST_PER_1M_TOKENS
  if (cost < 0.01) return '<$0.01'
  return `~$${cost.toFixed(2)}`
}

// Proper CSV parsing that handles quotes and newlines
function parseCSV(text: string): Ticket[] {
  const tickets: Ticket[] = []
  const lines: string[] = []
  let currentLine = ''
  let insideQuotes = false

  const chars = text.replace(/\r\n/g, '\n').split('')

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]

    if (char === '"') {
      if (insideQuotes && chars[i + 1] === '"') {
        currentLine += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
        currentLine += char
      }
    } else if (char === '\n' && !insideQuotes) {
      lines.push(currentLine)
      currentLine = ''
    } else {
      currentLine += char
    }
  }
  if (currentLine) {
    lines.push(currentLine)
  }

  if (lines.length < 2) return []

  const header = lines[0].toLowerCase()
  const headers = header.split(',').map(h => h.trim().replace(/^"|"$/g, ''))

  const textIndex = headers.findIndex(h =>
    ['text', 'ticket_text', 'message', 'content', 'description', 'body', 'ticket'].includes(h)
  )

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue

    const values: string[] = []
    let currentValue = ''
    let inQuotes = false

    for (let j = 0; j < line.length; j++) {
      const char = line[j]

      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          currentValue += '"'
          j++
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim())
        currentValue = ''
      } else {
        currentValue += char
      }
    }
    values.push(currentValue.trim())

    const text = textIndex === -1 ? values[0] : values[textIndex]
    if (text && text.trim()) {
      tickets.push({ id: i, text: text.trim() })
    }
  }

  return tickets
}

export default function Home() {
  const [apiKey, setApiKey] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [results, setResults] = useState<ClassificationResult[]>([])
  const [step, setStep] = useState<Step>('upload')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isParsing, setIsParsing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastRequestTime = useRef<number>(0)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('autoclass_api_key')
      if (saved) {
        setApiKey(saved)
        setKeySaved(true)
      }
    } catch {
      // localStorage not available
    }
  }, [])

  const saveApiKey = () => {
    if (apiKey.startsWith('sk-')) {
      try {
        localStorage.setItem('autoclass_api_key', apiKey)
        setKeySaved(true)
      } catch {
        setError('Could not save API key - localStorage not available')
      }
    }
  }

  const clearApiKey = () => {
    try {
      localStorage.removeItem('autoclass_api_key')
    } catch {
      // ignore
    }
    setApiKey('')
    setKeySaved(false)
  }

  const handleFile = useCallback((file: File) => {
    setError('')
    setResults([])
    setCategories([])
    setStep('upload')
    setIsParsing(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setTimeout(() => {
        const parsed = parseCSV(text)
        setIsParsing(false)
        if (parsed.length === 0) {
          setError('Could not parse CSV. Make sure it has a "text" column with data.')
          return
        }
        setTickets(parsed)
        setStep('preview')
      }, 10)
    }
    reader.onerror = () => {
      setIsParsing(false)
      setError('Failed to read file')
    }
    reader.readAsText(file)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX
    const y = e.clientY
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOver(false)
    }
  }, [])

  // Rate limiting helper
  const rateLimitedFetch = async (url: string, options: RequestInit) => {
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime.current
    const minInterval = 100 // 100ms between requests

    if (timeSinceLastRequest < minInterval) {
      await new Promise(resolve => setTimeout(resolve, minInterval - timeSinceLastRequest))
    }

    lastRequestTime.current = Date.now()
    return fetch(url, options)
  }

  const generateCategories = async () => {
    if (!apiKey || tickets.length === 0 || isGenerating) return

    setIsGenerating(true)
    setError('')

    try {
      const sampleSize = Math.min(50, tickets.length)
      const step = Math.max(1, Math.floor(tickets.length / sampleSize))
      const sampledTickets: Ticket[] = []
      for (let i = 0; i < tickets.length && sampledTickets.length < sampleSize; i += step) {
        sampledTickets.push(tickets[i])
      }

      const response = await rateLimitedFetch('/api/generate-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tickets: sampledTickets,
          apiKey,
          totalCount: tickets.length
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate categories')
      }

      if (!Array.isArray(data.categories) || data.categories.length === 0) {
        throw new Error('No categories generated')
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
    const trimmed = newCategoryName.trim()
    if (!trimmed) return

    const name = trimmed.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!name) {
      setError('Category name must contain letters or numbers')
      return
    }
    if (categories.some(c => c.name === name)) {
      setError('Category already exists')
      return
    }
    setError('')
    setCategories([...categories, { name, description: 'Custom category' }])
    setNewCategoryName('')
  }

  const removeCategory = (name: string) => {
    setCategories(categories.filter(c => c.name !== name))
  }

  const startEditCategory = (name: string) => {
    setEditingCategory(name)
    setEditValue(name)
    setError('')
  }

  const saveEditCategory = () => {
    if (!editingCategory) return

    const newName = editValue.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!newName) {
      setError('Category name must contain letters or numbers')
      return
    }
    if (newName !== editingCategory && categories.some(c => c.name === newName)) {
      setError('Category already exists')
      return
    }

    setCategories(categories.map(c =>
      c.name === editingCategory ? { ...c, name: newName } : c
    ))
    setEditingCategory(null)
    setEditValue('')
    setError('')
  }

  const cancelEditCategory = () => {
    setEditingCategory(null)
    setEditValue('')
  }

  const cancelClassification = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsProcessing(false)
    setStep('categories')
    setError('Classification cancelled')
  }

  const classify = async () => {
    if (!apiKey || tickets.length === 0 || categories.length === 0) return

    setStep('classifying')
    setIsProcessing(true)
    setError('')
    setProgress(0)
    setResults([])

    abortControllerRef.current = new AbortController()

    try {
      const chunkSize = 20
      const allResults: ClassificationResult[] = []
      const categoryNames = categories.map(c => c.name)

      for (let i = 0; i < tickets.length; i += chunkSize) {
        if (abortControllerRef.current?.signal.aborted) {
          throw new Error('Cancelled')
        }

        const chunk = tickets.slice(i, i + chunkSize)

        const response = await rateLimitedFetch('/api/classify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tickets: chunk,
            apiKey,
            categories: categoryNames
          }),
          signal: abortControllerRef.current?.signal
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
      if (err.name === 'AbortError' || err.message === 'Cancelled') {
        return
      }
      setError(err.message || 'Classification failed')
      setStep('categories')
    } finally {
      setIsProcessing(false)
      abortControllerRef.current = null
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
    const timestamp = new Date().toISOString().slice(0, 10)
    a.download = `classified_tickets_${timestamp}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const startOver = () => {
    if (results.length > 0 && !confirm('This will clear your results. Continue?')) {
      return
    }
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
        <label htmlFor="api-key-input">OpenAI API Key</label>
        <div className="key-input-row">
          <input
            id="api-key-input"
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              setKeySaved(false)
            }}
            placeholder="sk-..."
            aria-describedby="key-status"
          />
          {keySaved ? (
            <button className="secondary" onClick={clearApiKey}>Clear</button>
          ) : (
            <button onClick={saveApiKey} disabled={!apiKey.startsWith('sk-')}>Save</button>
          )}
        </div>
        {keySaved && (
          <p id="key-status" className="key-status saved">Key saved locally (sent only to OpenAI via our API)</p>
        )}
      </div>

      {error && <div className="error" role="alert">{error}</div>}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''} ${!keySaved ? 'disabled' : ''}`}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDrop={keySaved ? handleDrop : undefined}
          onClick={() => {
            if (!keySaved || isParsing) return
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.csv'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) handleFile(file)
            }
            input.click()
          }}
          role="button"
          tabIndex={keySaved ? 0 : -1}
          aria-label="Upload CSV file"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.currentTarget.click()
            }
          }}
        >
          <div className="upload-icon">{isParsing ? '⏳' : '📄'}</div>
          <div className="upload-text">
            {isParsing
              ? 'Parsing CSV...'
              : 'Drop CSV here or click to browse'}
          </div>
          <div className="upload-hint">
            {!keySaved
              ? 'Add your API key first'
              : 'CSV should have a "text" column. No file size limit.'}
          </div>
        </div>
      )}

      {/* Step 2: Preview */}
      {step === 'preview' && (
        <div className="preview-section">
          <h2>Preview Tickets</h2>
          <p className="subtitle" style={{ marginBottom: '1rem' }}>
            Loaded <strong>{tickets.length.toLocaleString()}</strong> tickets. Here's a sample:
          </p>

          <div className="ticket-preview">
            {tickets.slice(0, 5).map((t, i) => (
              <div key={t.id} className="ticket-preview-item">
                <span className="ticket-num">#{i + 1}</span>
                <span className="ticket-text">{t.text}</span>
              </div>
            ))}
            {tickets.length > 5 && (
              <div className="ticket-preview-more">
                +{(tickets.length - 5).toLocaleString()} more tickets
              </div>
            )}
          </div>

          <div className="cost-estimate">
            <span>Estimated cost:</span>
            <strong>{estimateCost(tickets.length)}</strong>
            <span className="cost-note">(gpt-4o-mini)</span>
          </div>

          <div className="action-buttons">
            <button onClick={generateCategories} disabled={isGenerating}>
              {isGenerating ? 'Analyzing...' : 'Generate Categories'}
            </button>
            <button className="secondary" onClick={() => { setTickets([]); setStep('upload') }}>
              Upload Different File
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review Categories */}
      {step === 'categories' && (
        <div className="categories-section">
          <h2>Review Categories</h2>
          <p className="subtitle" style={{ marginBottom: '1.5rem' }}>
            Generated from your {tickets.length.toLocaleString()} tickets. Click a category name to edit.
          </p>

          <div className="category-list">
            {categories.map((cat) => (
              <div key={cat.name} className="category-item">
                <div className="category-info">
                  {editingCategory === cat.name ? (
                    <div className="category-edit">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditCategory()
                          if (e.key === 'Escape') cancelEditCategory()
                        }}
                        autoFocus
                        aria-label="Edit category name"
                      />
                      <button className="small" onClick={saveEditCategory}>Save</button>
                      <button className="small secondary" onClick={cancelEditCategory}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <span
                        className="category-name editable"
                        onClick={() => startEditCategory(cat.name)}
                        title="Click to edit"
                      >
                        {cat.name}
                      </span>
                      <span className="category-desc">{cat.description}</span>
                    </>
                  )}
                </div>
                {editingCategory !== cat.name && (
                  <button
                    className="remove-btn"
                    onClick={() => removeCategory(cat.name)}
                    title="Remove category"
                    aria-label={`Remove ${cat.name} category`}
                  >
                    ×
                  </button>
                )}
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
              aria-label="New category name"
            />
            <button onClick={addCategory} disabled={!newCategoryName.trim()}>Add</button>
          </div>

          <div className="cost-estimate">
            <span>Estimated cost:</span>
            <strong>{estimateCost(tickets.length)}</strong>
            <span className="cost-note">for {tickets.length.toLocaleString()} tickets</span>
          </div>

          <div className="action-buttons">
            <button onClick={classify} disabled={categories.length === 0}>
              Classify {tickets.length.toLocaleString()} Tickets
            </button>
            <button className="secondary" onClick={() => setStep('preview')}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Classifying */}
      {step === 'classifying' && (
        <div className="progress-section">
          <div className="progress-header">
            <span>Classifying...</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="progress-text">
            {results.length.toLocaleString()} / {tickets.length.toLocaleString()} tickets processed
          </p>
          <button
            className="secondary"
            style={{ marginTop: '1rem' }}
            onClick={cancelClassification}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Step 5: Results */}
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
                  <td title={r.text}>{r.text}</td>
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
          <a href="https://github.com/debgotwired/autoclass" target="_blank" rel="noopener noreferrer">GitHub</a>
        </p>
      </footer>
    </div>
  )
}
