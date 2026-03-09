import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'autoclass - AI Ticket Classifier',
  description: 'Bulk classify support tickets with AI. Categories auto-generated from your data. BYOK.',
  openGraph: {
    title: 'autoclass - AI Ticket Classifier',
    description: 'Bulk classify support tickets with AI. Categories auto-generated from your data.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'autoclass - AI Ticket Classifier',
    description: 'Bulk classify support tickets with AI. Categories auto-generated from your data.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  )
}
