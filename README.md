# Smart Water Damage Assessment Tool

![AI-powered water damage assessment with industry expertise](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/24c5a7dd-e1e3-43a9-b912-d78d9a4293bc/public)

An AI-powered water damage assessment application that combines computer vision, RAG (Retrieval-Augmented Generation), and industry expertise to provide professional-grade damage analysis. Built with modern web technologies and deployed on Cloudflare Workers for global edge performance.

## Overview

This application helps water damage restoration professionals and insurance adjusters quickly assess property damage using AI-powered image analysis combined with industry-standard guidelines from IICRC and other authoritative sources.

## Key Features

- 🔍 **AI Vision Analysis**: Advanced computer vision using LLaVA for damage detection
- 📚 **RAG Integration**: Industry knowledge retrieval from IICRC standards and best practices  
- 🎯 **Professional Assessment**: Comprehensive damage reports with remediation recommendations
- ⚡ **Edge Deployment**: Global performance via Cloudflare Workers
- 🧭 **Modern Architecture**: React Router 7 + Hono + TypeScript
- 🎨 **Professional UI**: Tailwind CSS with responsive design
- 📊 **Confidence Scoring**: AI-generated confidence levels for assessments

## Tech Stack

- **Frontend**: React 19 + React Router 7 + TypeScript
  - Modern SPA architecture with SSR capabilities
  - Tailwind CSS for styling
  - File-based routing system
  - Built and optimized with Vite

- **Backend**: Hono on Cloudflare Workers
  - `/api/assess-damage` - Main AI assessment endpoint
  - `/api/knowledge-search` - RAG knowledge base search
  - TypeScript throughout for type safety

- **AI/ML**: Cloudflare Workers AI
  - **Vision**: LLaVA 1.5 7B for image analysis
  - **RAG**: AutoRAG for industry knowledge retrieval
  - **Enhancement**: Llama 3.2 3B for professional assessment generation

- **Deployment**: Cloudflare Workers
  - Global edge deployment
  - R2 storage for assets
  - Workers AI bindings

## Getting Started

### Prerequisites
- Node.js 18+
- Cloudflare account with Workers AI access
- AutoRAG dataset configured (see AGENTS.md)

### Installation
```bash
npm install
npm run cf-typegen
npm run typecheck
```

### Development
```bash
npm run dev
```

### Deployment
```bash
npm run deploy
```

## Configuration

Update `wrangler.jsonc` with your Cloudflare resources:
- Replace `REPLACE_WITH_YOUR_DATASET_ID` with your AutoRAG dataset ID
- Replace `REPLACE_WITH_YOUR_BUCKET_NAME` with your R2 bucket name

## API Endpoints

### POST /api/assess-damage
Analyzes uploaded images for water damage assessment.

**Request**:
```json
{
  "image": "data:image/jpeg;base64,..."
}
```

**Response**:
```json
{
  "success": true,
  "vision_analysis": "Detailed damage description...",
  "industry_sources": [...],
  "enhanced_assessment": "Professional assessment...",
  "confidence_score": 0.85,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET /api/knowledge-search?q=query
Searches the RAG knowledge base for industry information.

## Architecture

The application follows a multi-step AI processing pipeline:

1. **Image Upload**: User uploads damage photo
2. **Vision Analysis**: LLaVA analyzes image for damage characteristics
3. **RAG Query**: AutoRAG searches for relevant industry guidelines
4. **Enhanced Assessment**: Llama 3.2 combines vision + RAG for professional report
5. **Results Display**: Comprehensive assessment with confidence scoring

## Contributing

See `AGENTS.md` for detailed development guidelines and session continuity information.

## Resources

- 🧩 [Hono on Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
- 🤖 [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- 📚 [AutoRAG Documentation](https://developers.cloudflare.com/workers-ai/autorag/)
- 🛠 [Wrangler CLI reference](https://developers.cloudflare.com/workers/wrangler/)
- 🎨 [Tailwind CSS Documentation](https://tailwindcss.com/)
- 🔀 [React Router Docs](https://reactrouter.com/)