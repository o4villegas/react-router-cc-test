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
- Cloudflare account with Workers AI access (for production)
- AutoRAG dataset configured (see AGENTS.md for production setup)

### Installation
```bash
npm install
npm run cf-typegen
npm run typecheck
```

### Development

#### Local Development (with AI Mocks)
For local development, the application automatically uses realistic AI mocks to simulate Cloudflare Workers AI responses:

```bash
npm run dev
```

The application will:
- ✅ Use mock AI responses for vision analysis, AutoRAG, and language generation
- ✅ Provide realistic water damage assessment scenarios
- ✅ Allow full UI testing without Cloudflare AI dependencies
- ✅ Include proper error handling and timeout simulation

#### Production Development (with Real AI)
To test with actual Cloudflare AI services, deploy to Cloudflare Workers:

```bash
npm run deploy
```

#### Environment Variables
You can control the behavior with environment variables:

- `ENABLE_DEV_MOCKS=true` - Force use of AI mocks (default in development)
- `AI_TIMEOUT_MS=5000` - Set AI operation timeout (default: 5s dev, 30s prod)
- `ENABLE_AUTORAG=false` - Disable AutoRAG functionality
- `NODE_ENV=development` - Set environment mode

### Deployment
```bash
npm run deploy
```

## Configuration

### Development Configuration
No configuration needed for local development - AI mocks are enabled automatically.

### Production Configuration
For production deployment, update `wrangler.jsonc`:

1. **AutoRAG Dataset**: Create and configure your AutoRAG dataset with industry documents:
   ```bash
   # Create AutoRAG dataset (replace with your dataset name)
   wrangler vectorize create auto-inspect-rag
   ```

2. **R2 Bucket**: The bucket `damagescan` is already configured in `wrangler.jsonc`

3. **AI Models**: The following models are pre-configured:
   - Vision: `@cf/llava-hf/llava-1.5-7b-hf`
   - Language: `@cf/meta/llama-3.2-3b-instruct`
   - AutoRAG: Uses your configured dataset

### Troubleshooting

**Issue: AI requests hanging in development**
- ✅ **Solution**: This is expected! Use `ENABLE_DEV_MOCKS=true` (default) for local development

**Issue: "AutoRAG dataset not found" in production**
- ✅ **Solution**: Create and populate your AutoRAG dataset with IICRC documents (see AGENTS.md)

**Issue: AI models not available**
- ✅ **Solution**: Ensure your Cloudflare account has Workers AI access and the models are available in your region

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