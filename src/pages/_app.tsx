// src/pages/_app.tsx
import type { AppProps } from 'next/app';
import { Analytics } from '@vercel/analytics/next';
import { UserProvider } from '@auth0/nextjs-auth0/client';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  const { user } = pageProps;
  return (
    <UserProvider user={user}>
      <Component {...pageProps} />
      <Analytics />
    </UserProvider>
  );
}