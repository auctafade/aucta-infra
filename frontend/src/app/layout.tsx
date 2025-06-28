// frontend/src/app/layout.tsx
import './globals.css'
import type { Metadata } from 'next'
import { Providers } from '@/components/Providers'

export const metadata: Metadata = {
  title: 'AUCTA - Luxury Product Authentication',
  description: 'Digital passports and blockchain authentication for luxury goods',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}