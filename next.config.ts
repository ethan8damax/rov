import type { NextConfig } from 'next'
import withPWA from '@ducanh2912/next-pwa'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

const csp = [
  "default-src 'self'",
  `connect-src 'self' ${supabaseUrl} wss://*.supabase.co https://development.plaid.com https://production.plaid.com`,
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.plaid.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "frame-src 'self' https://cdn.plaid.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy',   value: csp },
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

const withPWAConfig = withPWA({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  cacheOnFrontEndNav: true,
})

export default withPWAConfig(nextConfig)
