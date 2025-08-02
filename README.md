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
CACHE_DIR=/tmp # optional cache directory (use /tmp on serverless)
```

## Deployment

This project is optimized for Cloudflare Pages:

1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set output directory: `out`
4. Add environment variables in Cloudflare Pages dashboard
   - Set `CACHE_DIR` to `/tmp` or another writable path on serverless platforms

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
