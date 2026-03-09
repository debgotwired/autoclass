# autoclass

Bulk classify support tickets with AI. Categories are **automatically generated** from your data - no manual taxonomy setup required.

## How it works

1. **Upload CSV** - Drop your file with ticket text
2. **Auto-generate categories** - AI analyzes a sample and suggests categories specific to your tickets
3. **Review & edit** - Add, remove, or rename categories before classifying
4. **Classify all** - Process your entire dataset with consistent categorization
5. **Download results** - Get your classified CSV

## Key features

- **Dynamic categories** - Categories are generated from YOUR data, not hardcoded templates
- **BYOK** - Bring your own OpenAI API key. Key stays in your browser
- **No file size limits** - Process thousands of tickets
- **Editable taxonomy** - Review and customize categories before classification
- **Privacy first** - No data stored. No accounts. No tracking

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/debgotwired/autoclass)

Or run locally:

```bash
git clone https://github.com/debgotwired/autoclass.git
cd autoclass
npm install
npm run dev
```

## CSV format

Your CSV needs a text column. Accepts: `text`, `ticket_text`, `message`, `content`, `description`, `body`

```csv
text
"I want to cancel my order"
"Where is my package?"
"I was charged twice"
```

## Output

```csv
text,category
"I want to cancel my order","order_cancellation"
"Where is my package?","shipping_tracking"
"I was charged twice","billing_dispute"
```

Categories are generated based on your specific tickets, not predetermined templates.

## How category generation works

1. Samples up to 50 tickets from your dataset (evenly distributed)
2. Asks GPT-4o-mini to analyze patterns and create 5-15 categories
3. Returns categories with descriptions
4. You can edit before classifying

## Cost

Uses `gpt-4o-mini`:
- Category generation: ~1 API call
- Classification: 1 call per ticket (batched for speed)

Typical cost: ~$0.01 per 100 tickets

## Privacy

- API key stored in browser localStorage
- Requests proxied through our API route (never logged) then sent to OpenAI
- No database, no analytics, no cookies, no tracking
- Open source - audit the code

## Sample data

`sample_tickets_hard.csv` contains 1000 challenging test tickets with typos, ambiguous cases, and multi-issue tickets.

## Tech stack

- Next.js 14
- OpenAI API (gpt-4o-mini)
- TypeScript
- No database

## License

MIT
