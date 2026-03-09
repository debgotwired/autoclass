import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'autoclass',
  description: 'Bulk classify support tickets with AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
