// src/pages/_app.tsx
import type { AppProps } from 'next/app'
import { Analytics } from '@vercel/analytics/next'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Component {...pageProps} />
      <Analytics />
    </>
  )
}