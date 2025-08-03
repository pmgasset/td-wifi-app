# ===== README.md =====
# Travel Data WiFi - Jamstack E-commerce

A modern, high-performance e-commerce site built with Next.js, Cloudflare Pages, and Zoho Commerce APIs.

## Features

- 🚀 **Static Site Generation** for optimal performance
- 🛒 **E-commerce functionality** powered by Zoho APIs
- 📱 **Mobile-first responsive design**
- 🔍 **SEO optimized** with structured data
- 🛡️ **Secure and fast** with Cloudflare Pages
- 🎨 **Modern UI** with Tailwind CSS

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables (see below)
4. Run development server: `npm run dev`
5. Build for production: `npm run build`

## Environment Variables

Create a `.env.local` file with:

```
ZOHO_CLIENT_ID=your_zoho_client_id
ZOHO_CLIENT_SECRET=your_zoho_client_secret  
ZOHO_REFRESH_TOKEN=your_zoho_refresh_token
ZOHO_STORE_ID=your_zoho_store_id
```

## Deployment

This project is optimized for deployment on Vercel and uses Upstash Redis for
product caching. A daily cron job fetches products from Zoho Inventory and
stores them in Redis for fast access.

### Deployment on Vercel

1. Connect your GitHub repository to Vercel
2. Set build command: `npm run build`
3. Add the required environment variables in the Vercel dashboard:

```
UPSTASH_REDIS_REST_URL=your_redis_url
UPSTASH_REDIS_REST_TOKEN=your_redis_token
CRON_SECRET=your_secure_random_string
```

4. Vercel will automatically run the cron job defined in `vercel.json` to sync
   products daily.

## Project Structure

```
src/
├── components/     # Reusable UI components
├── lib/           # API clients and utilities
├── pages/         # Next.js pages
├── store/         # Zustand state management
└── styles/        # Global styles
```

## Performance Features

- Static generation with ISR for product updates
- Image optimization and lazy loading
- Code splitting and tree shaking
- CDN-first architecture with Cloudflare

## SEO Features

- Structured data for products and organization
- Meta tags and Open Graph optimization
- XML sitemap generation
- Clean URL structure

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details
