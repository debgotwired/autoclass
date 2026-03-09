import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function POST(request: NextRequest) {
  try {
    const { tickets, apiKey, categories } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 })
    }

    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json({ error: 'No tickets provided' }, { status: 400 })
    }

    if (!categories || !Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json({ error: 'No categories provided' }, { status: 400 })
    }

    const client = new OpenAI({ apiKey })

    // Normalize categories for validation
    const normalizedCategories = categories.map((c: string) => c.toLowerCase().trim())
    const categorySet = new Set(normalizedCategories)

    const systemPrompt = `You are a customer support ticket classifier.

Given a customer message, classify it into ONE of these categories:
${categories.map((c: string) => `- ${c}`).join('\n')}

Rules:
- Respond with ONLY the category name exactly as shown above
- Pick the single best match
- If truly ambiguous, pick the most likely category
- Never respond with anything other than one of the listed categories`

    // Process tickets in parallel (with concurrency limit)
    const results = []
    const batchSize = 10

    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize)

      const batchResults = await Promise.all(
        batch.map(async (ticket: { text: string; id?: number }) => {
          try {
            const response = await client.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: ticket.text.slice(0, 2000) } // Limit input length
              ],
              temperature: 0,
              max_tokens: 50,
            })

            let category = response.choices[0]?.message?.content?.trim().toLowerCase() || ''

            // Validate category is in the list
            if (!categorySet.has(category)) {
              // Try to find closest match (handles minor variations)
              const found = normalizedCategories.find(c =>
                c === category ||
                category.includes(c) ||
                c.includes(category)
              )
              category = found || 'other'
            }

            // Use the original casing from the list
            const originalCategory = categories.find(
              (c: string) => c.toLowerCase().trim() === category
            ) || category

            return {
              id: ticket.id,
              text: ticket.text,
              category: originalCategory,
            }
          } catch (err: any) {
            return {
              id: ticket.id,
              text: ticket.text,
              category: 'error',
              error: err.message,
            }
          }
        })
      )

      results.push(...batchResults)
    }

    return NextResponse.json({ results })

  } catch (error: any) {
    console.error('Classification error:', error)

    // User-friendly error messages
    let message = 'Classification failed'
    if (error.message?.includes('401')) {
      message = 'Invalid API key'
    } else if (error.message?.includes('429')) {
      message = 'Rate limited - please wait and try again'
    } else if (error.message?.includes('insufficient_quota')) {
      message = 'API quota exceeded - check your OpenAI billing'
    }

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
