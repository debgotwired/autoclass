# autoclass

Bulk classify support tickets with AI. Bring your own OpenAI key.

## What it does

1. You paste your OpenAI API key (stored in browser only)
2. Upload a CSV with a `text` column
3. Click "Classify All"
4. Download CSV with categories added

No data stored. No accounts. Just classification.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/autoclass)

Or manually:

```bash
npm i -g vercel
vercel
```

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000

## CSV Format

Your CSV needs a text column. These column names work:
- `text`
- `ticket_text`
- `message`
- `content`
- `description`
- `body`

Example:
```csv
text
"I want to cancel my order"
"Where is my package?"
"I was charged twice"
```

## Output

Downloads a CSV with:
```csv
text,category
"I want to cancel my order","cancellation"
"Where is my package?","shipping_inquiry"
"I was charged twice","billing_issue"
```

## Default Categories

- billing_issue
- account_access
- order_issue
- shipping_inquiry
- cancellation
- return_refund
- product_question
- technical_support
- feedback
- other

## Privacy

- API key stored in browser localStorage only
- Key sent directly to OpenAI, not stored on our servers
- No analytics, no tracking
- Open source

## License

MIT
