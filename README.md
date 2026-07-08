# Edward Clipper

Standalone web clipper app for capturing and archiving web content, extracted from XCAP HQ monorepo.

## Features

- 🖼️ **Single & Multi-page Capture**: Screenshots, HTML, PDF generation
- 📄 **DocSend Support**: Conservative multi-page capture with anti-detection
- ☁️ **Cloud Storage**: Cloudflare R2 for scalable, global file storage  
- 🔍 **Searchable Archive**: Postgres-backed clip indexing and metadata
- 🔐 **Secure Access**: Cloudflare Access authentication
- 🌐 **Browser Extension**: Chrome extension for easy one-click capture

## Architecture

- **Backend**: Next.js 15 on Railway
- **Storage**: Cloudflare R2 + Railway Postgres
- **Frontend**: React clip browsing UI
- **Extension**: Manifest V3 Chrome extension
- **Domain**: edsnip.com (pending acquisition)

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Deployment

Auto-deployed to Railway on push to main branch.

---

Extracted from XCAP HQ on 2026-07-08. Original clipper by Chris Telles.