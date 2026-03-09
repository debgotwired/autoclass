import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const SYSTEM_PROMPT = `You are a customer support ticket classifier.

Given a customer message, classify it into the most appropriate category.
Respond with ONLY the category name in lowercase with underscores, nothing else.

Common categories include:
- billing_issue (charges, refunds, payments, invoices)
- account_access (login, password, account settings)
- order_issue (wrong item, damaged, missing)
- shipping_inquiry (tracking, delivery time, shipping options)
- cancellation (cancel order, cancel subscription)
- return_refund (return request, refund status)
- product_question (product info, availability, specs)
- technical_support (bugs, errors, app issues)
- feedback (complaints, suggestions, compliments)
- other (doesn't fit above categories)

If unsure, pick the closest match. Always respond with a single category.`

export async function POST(request: NextRequest) {
  try {
    const { tickets, apiKey, categories } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 })
    }

    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json({ error: 'No tickets provided' }, { status: 400 })
    }

    const client = new OpenAI({ apiKey })

    // Build custom prompt if categories provided
    let systemPrompt = SYSTEM_PROMPT
    if (categories && categories.length > 0) {
      systemPrompt = `You are a customer support ticket classifier.

Given a customer message, classify it into ONE of these categories:
${categories.map((c: string) => `- ${c}`).join('\n')}

Respond with ONLY the category name exactly as shown above, nothing else.`
    }

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
                { role: 'user', content: ticket.text }
              ],
              temperature: 0,
              max_tokens: 50,
            })

            const category = response.choices[0]?.message?.content?.trim().toLowerCase() || 'other'

            return {
              id: ticket.id,
              text: ticket.text,
              category,
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
    return NextResponse.json(
      { error: error.message || 'Classification failed' },
      { status: 500 }
    )
  }
}
