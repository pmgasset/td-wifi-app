// src/pages/_app.tsx
import type { AppProps } from 'next/app'
import { Analytics } from '@vercel/analytics/next'
import { UserProvider } from '@auth0/nextjs-auth0/client'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <UserProvider>
      <Component {...pageProps} />
      <Analytics />
    </UserProvider>
  )
}