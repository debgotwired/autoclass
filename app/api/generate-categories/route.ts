import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const GENERATE_CATEGORIES_PROMPT = `You are an expert at analyzing customer support tickets and creating classification taxonomies.

Given a sample of customer support tickets, create a set of categories that would work well for classifying ALL tickets in a dataset like this.

Guidelines:
- Create 5-15 categories (aim for the sweet spot - enough to be useful, not so many that they overlap)
- Categories should be mutually exclusive and collectively exhaustive
- Use lowercase_with_underscores format
- Include an "other" category for edge cases
- Consider the specific domain and vocabulary in these tickets

Respond with a JSON array of category objects, each with:
- "name": the category name (lowercase_with_underscores)
- "description": a brief description of what tickets belong here (1 sentence)

Example response:
[
  {"name": "billing_issue", "description": "Charges, refunds, payment problems, invoice questions"},
  {"name": "shipping_delay", "description": "Late deliveries, tracking updates, lost packages"},
  {"name": "other", "description": "Tickets that don't fit other categories"}
]

Respond with ONLY the JSON array, no other text.`

export async function POST(request: NextRequest) {
  try {
    const { tickets, apiKey, totalCount } = await request.json()

    if (!apiKey) {
      return NextResponse.json({ error: 'API key required' }, { status: 400 })
    }

    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json({ error: 'No tickets provided' }, { status: 400 })
    }

    const client = new OpenAI({ apiKey })

    // Tickets are already sampled on the frontend
    const ticketList = tickets
      .slice(0, 50) // Extra safety limit
      .map((t: { text: string }, i: number) => `${i + 1}. ${t.text.slice(0, 500)}`) // Limit text length
      .join('\n')

    const total = totalCount || tickets.length

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: GENERATE_CATEGORIES_PROMPT },
        { role: 'user', content: `Here are ${tickets.length} sample tickets from a dataset of ${total} total:\n\n${ticketList}` }
      ],
      temperature: 0.3,
      max_tokens: 1500,
    })

    const content = response.choices[0]?.message?.content?.trim() || '[]'

    // Parse the JSON response
    let categories
    try {
      categories = JSON.parse(content)
    } catch {
      // Try to extract JSON from the response if it has extra text
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        categories = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse categories from AI response')
      }
    }

    // Validate categories structure
    if (!Array.isArray(categories)) {
      throw new Error('Invalid categories format')
    }

    // Ensure each category has name and description
    categories = categories
      .filter((c: any) => c && typeof c.name === 'string')
      .map((c: any) => ({
        name: c.name.toLowerCase().trim().replace(/\s+/g, '_'),
        description: typeof c.description === 'string' ? c.description : 'No description'
      }))

    // Ensure "other" category exists
    if (!categories.some((c: any) => c.name === 'other')) {
      categories.push({ name: 'other', description: 'Tickets that don\'t fit other categories' })
    }

    return NextResponse.json({ categories })

  } catch (error: any) {
    console.error('Category generation error:', error)

    // User-friendly error messages
    let message = 'Category generation failed'
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
