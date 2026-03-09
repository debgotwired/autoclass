# autoclass

Bulk classify support tickets with AI. BYOK (Bring Your Own Key).

![autoclass demo](https://via.placeholder.com/800x400?text=autoclass+demo)

## What it does

1. Paste your OpenAI API key (stored in browser only)
2. Upload a CSV with a `text` column
3. Click "Classify All"
4. Download CSV with categories added

No accounts. No data stored. No vendor lock-in.

## One-click deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/debgotwired/autoclass)

## Run locally

```bash
git clone https://github.com/debgotwired/autoclass.git
cd autoclass
npm install
npm run dev
```

Open http://localhost:3000

## CSV format

Your CSV needs a text column:

```csv
text
"I want to cancel my order"
"Where is my package?"
"I was charged twice"
```

Accepted column names: `text`, `ticket_text`, `message`, `content`, `description`, `body`

## Output

```csv
text,category
"I want to cancel my order","cancellation"
"Where is my package?","shipping_inquiry"
"I was charged twice","billing_issue"
```

## Default categories

| Category | Examples |
|----------|----------|
| billing_issue | charges, refunds, invoices |
| account_access | login, password, settings |
| order_issue | wrong item, damaged, missing |
| shipping_inquiry | tracking, delivery, shipping |
| cancellation | cancel order, cancel subscription |
| return_refund | returns, refund status |
| product_question | specs, availability, compatibility |
| technical_support | bugs, errors, app issues |
| feedback | complaints, suggestions |
| other | everything else |

## Custom categories

Coming soon: define your own categories.

## Privacy

- API key stored in browser `localStorage` only
- Key sent to OpenAI directly from your browser via our API route
- No analytics, no tracking, no cookies
- Fully open source — audit the code yourself

## Tech stack

- Next.js 14
- OpenAI API (gpt-4o-mini)
- Deployed on Vercel

## Sample data

`sample_tickets_hard.csv` — 1000 challenging test tickets with typos, ambiguous cases, angry customers, multi-issue tickets.

## Contributing

PRs welcome. Keep it simple.

## License

MIT
