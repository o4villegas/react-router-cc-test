# AGENTS.md - Development Guide & Session Continuity

This document provides comprehensive information for AI agents and developers working on the Smart Water Damage Assessment Tool. It ensures continuity between CLI sessions and provides essential context for development work.

## 🎯 Application Overview

### Purpose
AI-powered water damage assessment application that combines computer vision, RAG (Retrieval-Augmented Generation), and industry expertise to provide professional-grade damage analysis for water damage restoration professionals and insurance adjusters.

### Current Status
- **Deployment**: ✅ Working and deployed
- **Core Features**: ✅ Functional AI assessment pipeline
- **Configuration**: ⚠️ Requires environment setup (see Configuration section)

## 📁 Project Structure

```
react-router-cc-test/
├── app/
│   ├── components/
│   │   └── damage-assessment.tsx    # Main UI component
│   ├── routes/
│   │   └── home.tsx                 # Home route with metadata
│   ├── root.tsx                     # Root layout component
│   ├── routes.ts                    # Route configuration
│   └── app.css                      # Global styles
├── workers/
│   └── app.ts                       # Hono server with AI endpoints
├── package.json                     # Dependencies and scripts
├── wrangler.jsonc                   # Cloudflare Workers configuration
├── vite.config.ts                   # Vite build configuration
├── tsconfig.json                    # TypeScript configuration
└── README.md                        # Updated project documentation
```

## 🚀 Key Features Implemented

### 1. AI Assessment Pipeline
- **Image Upload**: File input with comprehensive validation (`damage-assessment.tsx`)
- **Vision Analysis**: LLaVA 1.5 7B model for damage detection (`app.ts:16-19`)
- **RAG Integration**: AutoRAG for industry knowledge retrieval (`app.ts:22-26`)
- **Enhanced Assessment**: Llama 3.2 3B for professional reports (`app.ts:29-40`)
- **Results Display**: Comprehensive UI with confidence scoring

### 2. API Endpoints
- `POST /api/assess-damage` - Main assessment endpoint
- `GET /api/knowledge-search` - RAG knowledge base search

### 3. Frontend Features
- Responsive design with Tailwind CSS
- Real-time image preview with validation
- Professional assessment display
- Knowledge base search functionality
- Comprehensive error handling and loading states
- Image validation (size, type, dimensions)
- Error boundaries for AI operations
- Production-safe logging system

## 🛠 Tech Stack Details

### Frontend
- **React 19** with React Router 7
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Vite** for build system

### Backend
- **Hono** framework on Cloudflare Workers
- **TypeScript** throughout
- **Cloudflare Workers AI** integration

### AI/ML Services
- **LLaVA 1.5 7B** - Vision analysis
- **AutoRAG** - Industry knowledge retrieval
- **Llama 3.2 3B** - Enhanced assessment generation

## ⚙️ Configuration Requirements

### Critical Configuration Items
1. **AutoRAG Dataset ID** - Replace `REPLACE_WITH_YOUR_DATASET_ID` in `wrangler.jsonc:54`
2. **R2 Bucket Name** - Replace `REPLACE_WITH_YOUR_BUCKET_NAME` in `wrangler.jsonc:60`
3. **Cloudflare Workers AI Access** - Account must have Workers AI enabled

### Environment Variables
Current variables in `wrangler.jsonc`:
- `VALUE_FROM_CLOUDFLARE`: "Hello from Hono/CF"

### Bindings
- `AI` - Cloudflare Workers AI binding
- `AUTORAG` - AutoRAG dataset binding
- `R2_BUCKET` - R2 storage binding

## 📝 Development Commands

```bash
# Install dependencies
npm install

# Generate Cloudflare types
npm run cf-typegen

# Type checking
npm run typecheck

# Development server
npm run dev

# Build for production
npm run build

# Deploy to Cloudflare Workers
npm run deploy

# Preview build
npm run preview
```

## 🔧 Code Quality Standards

### Current State
- **TypeScript**: Comprehensive type coverage
- **Error Handling**: Implemented in API endpoints
- **Code Style**: Consistent throughout
- **Security**: No vulnerabilities found (npm audit clean)

### Areas for Improvement
1. ✅ **Input Validation**: Comprehensive image validation implemented
2. ✅ **Error Boundaries**: React error boundaries for AI operations
3. ✅ **Production Logging**: Environment-aware logging system
4. **Accessibility**: Add ARIA labels and keyboard navigation
5. **Testing**: No tests currently implemented

## 🧪 Testing Strategy

### Current Status
- **Unit Tests**: None implemented
- **Integration Tests**: None implemented
- **E2E Tests**: None implemented

### Recommended Testing Approach
1. **Vitest** for unit testing
2. **React Testing Library** for component tests
3. **Playwright** for E2E tests
4. **Cloudflare Workers testing** for API endpoints

## 🔒 Security Considerations

### Current Security Measures
- Input sanitization for API endpoints
- Base64 image handling
- Environment variable usage
- TypeScript type safety

### Security Recommendations
1. Add file size limits for image uploads
2. Implement rate limiting for API endpoints
3. Add CORS configuration if needed
4. Validate image file types on upload

## 📊 Performance Considerations

### Current Performance Features
- Edge deployment via Cloudflare Workers
- Efficient image handling with FileReader
- Optimized AI model usage
- Proper error handling to prevent crashes

### Performance Optimization Opportunities
1. Image compression before upload
2. Caching strategies for RAG results
3. Progressive loading for large assessments
4. WebP image format support

## 🐛 Known Issues & Limitations

### Configuration Issues
- Placeholder values in `wrangler.jsonc` need replacement
- Missing production environment variables

### Code Issues
- ✅ **Console.log statements**: Replaced with structured logging system
- ✅ **Error messaging**: Comprehensive error boundaries implemented
- **Retry mechanisms**: Basic retry implemented, could be enhanced

### Feature Limitations
- No batch processing for multiple images
- No export functionality for assessments
- No user authentication/authorization

## 🚀 Deployment Information

### Current Deployment
- **Platform**: Cloudflare Workers
- **Status**: Working and deployed
- **Domain**: TBD (depends on user's Cloudflare setup)

### Deployment Requirements
1. Cloudflare account with Workers AI access
2. AutoRAG dataset configured
3. R2 bucket created
4. Wrangler CLI configured

### Deployment Process
```bash
# Build and deploy
npm run deploy

# Or step by step
npm run build
wrangler deploy
```

## 📚 Knowledge Base Setup

### AutoRAG Configuration
The application requires an AutoRAG dataset containing:
- IICRC standards and guidelines
- Water damage restoration best practices
- Industry-specific documentation
- Remediation procedures

### Dataset Structure
Recommended document types:
- IICRC S500 Standard
- Water damage classification guides
- Mold remediation procedures
- Equipment specifications
- Insurance documentation requirements

## 🤝 Development Guidelines

### When Adding New Features
1. **Follow TypeScript**: Maintain type safety
2. **Error Handling**: Implement proper error boundaries
3. **Testing**: Add tests for new functionality
4. **Documentation**: Update this file and README.md
5. **Security**: Consider security implications

### Code Review Checklist
- [ ] TypeScript types are comprehensive
- [ ] Error handling is implemented
- [ ] Performance implications considered
- [ ] Security best practices followed
- [ ] Tests added for new functionality
- [ ] Documentation updated

### Session Continuity
When working on this project across multiple sessions:
1. Review this AGENTS.md file first
2. Check the latest commit for recent changes
3. Verify configuration status
4. Run `npm run typecheck` to ensure code quality
5. Test core functionality before making changes

## 📈 Metrics & Monitoring

### Current Monitoring
- Cloudflare Workers observability enabled
- Error logging in API endpoints
- Client-side error handling

### Recommended Monitoring
1. AI model performance metrics
2. API response times
3. Error rates and types
4. User engagement metrics
5. Cost tracking for AI operations

## 🎯 Future Roadmap

### Short-term Improvements
1. Complete configuration setup
2. Add comprehensive testing
3. Implement accessibility features
4. Add input validation

### Medium-term Features
1. Batch processing capabilities
2. Export functionality
3. User authentication
4. Advanced search filters

### Long-term Vision
1. Mobile app development
2. Integration with insurance systems
3. Advanced AI model fine-tuning
4. Real-time collaboration features

## 🆘 Troubleshooting

### Common Issues
1. **"Assessment failed"** - Check Cloudflare Workers AI bindings
2. **"Search failed"** - Verify AutoRAG dataset configuration
3. **Build errors** - Run `npm run cf-typegen` to update types
4. **Type errors** - Check TypeScript configuration

### Debug Steps
1. Check browser console for client-side errors
2. Review Cloudflare Workers logs
3. Verify wrangler.jsonc configuration
4. Test API endpoints directly

## 📞 Support & Resources

### Documentation
- [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
- [AutoRAG Documentation](https://developers.cloudflare.com/workers-ai/autorag/)
- [React Router 7 Docs](https://reactrouter.com/)
- [Hono Documentation](https://hono.dev/)

### Community
- Cloudflare Workers Discord
- React Router GitHub Issues
- Hono GitHub Discussions

---

*This document should be updated with each significant change to the project. Last updated: Initial creation*