import { Hono } from "hono";
import { createRequestHandler } from "react-router";
import { loadConfig } from "./config";
import { createCacheService, createPerformanceMonitor, createImageOptimizer } from "./cache";
import { apiRateLimit, aiRateLimit } from "./middleware/rate-limit";
import { productionCors, developmentCors } from "./middleware/cors";
import { handleConversationRequest } from "./api/conversation";
import { AIMocks } from "./ai-mocks";

// Load configuration with environment detection
let appConfig;
let cacheService;
let performanceMonitor;
let imageOptimizer;

try {
  appConfig = loadConfig();
  cacheService = createCacheService(appConfig);
  performanceMonitor = createPerformanceMonitor();
  imageOptimizer = createImageOptimizer(appConfig);
} catch (error) {
  console.error('Failed to load configuration:', error);
  throw error;
}

// Enhanced logger with configuration-driven behavior
const logger = {
  error: (message: string, data?: any) => {
    if (appConfig.logging.level === 'error' || appConfig.logging.level === 'warn' || 
        appConfig.logging.level === 'info' || appConfig.logging.level === 'debug') {
      const logData = appConfig.logging.enable_structured_logging ? 
        { level: 'ERROR', message, data, timestamp: new Date().toISOString() } : 
        `[${new Date().toISOString()}] ERROR: ${message}`;
      console.error(logData, appConfig.logging.enable_structured_logging ? undefined : data);
    }
  },
  info: (message: string, data?: any) => {
    if (appConfig.logging.level === 'info' || appConfig.logging.level === 'debug') {
      const logData = appConfig.logging.enable_structured_logging ? 
        { level: 'INFO', message, data, timestamp: new Date().toISOString() } : 
        `[${new Date().toISOString()}] INFO: ${message}`;
      console.log(logData, appConfig.logging.enable_structured_logging ? undefined : data);
    }
  },
  warn: (message: string, data?: any) => {
    if (appConfig.logging.level === 'warn' || appConfig.logging.level === 'info' || 
        appConfig.logging.level === 'debug') {
      const logData = appConfig.logging.enable_structured_logging ? 
        { level: 'WARN', message, data, timestamp: new Date().toISOString() } : 
        `[${new Date().toISOString()}] WARN: ${message}`;
      console.warn(logData, appConfig.logging.enable_structured_logging ? undefined : data);
    }
  },
  debug: (message: string, data?: any) => {
    if (appConfig.logging.level === 'debug') {
      const logData = appConfig.logging.enable_structured_logging ? 
        { level: 'DEBUG', message, data, timestamp: new Date().toISOString() } : 
        `[${new Date().toISOString()}] DEBUG: ${message}`;
      console.debug(logData, appConfig.logging.enable_structured_logging ? undefined : data);
    }
  }
};

const app = new Hono();

// Apply CORS middleware
app.use('*', appConfig.app.environment === 'production' ? productionCors : developmentCors);

// Apply rate limiting to API routes
app.use('/api/*', apiRateLimit);

// Apply AI-specific rate limiting to AI endpoints
app.use('/api/assess-damage', aiRateLimit);
app.use('/api/knowledge-search', aiRateLimit);
app.use('/api/conversation', aiRateLimit);

// Image security validation utilities (using configuration)
const IMAGE_MAGIC_BYTES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF header for WebP
  gif: [0x47, 0x49, 0x46, 0x38], // GIF8 header
};

// Configuration-driven constants
const ALLOWED_MIME_TYPES = appConfig.image.allowed_types;
const MAX_IMAGE_DIMENSIONS = appConfig.api.limits.max_dimensions;

function validateImageSignature(buffer: Uint8Array): { valid: boolean; detectedType: string | null; error?: string } {
  if (buffer.length < 8) {
    return { valid: false, detectedType: null, error: 'Image data too small to validate' };
  }

  // Check JPEG signature
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { valid: true, detectedType: 'image/jpeg' };
  }

  // Check PNG signature
  if (buffer.length >= 8 && 
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return { valid: true, detectedType: 'image/png' };
  }

  // Check WebP signature (RIFF + WebP)
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { valid: true, detectedType: 'image/webp' };
  }

  return { valid: false, detectedType: null, error: 'Unsupported or invalid image format' };
}

function validateImageStructure(buffer: Uint8Array, mimeType: string): { valid: boolean; error?: string } {
  try {
    if (mimeType === 'image/jpeg') {
      return validateJPEGStructure(buffer);
    } else if (mimeType === 'image/png') {
      return validatePNGStructure(buffer);
    } else if (mimeType === 'image/webp') {
      return validateWebPStructure(buffer);
    }
    return { valid: false, error: 'Unsupported image type for structure validation' };
  } catch (error) {
    return { valid: false, error: 'Image structure validation failed' };
  }
}

function validateJPEGStructure(buffer: Uint8Array): { valid: boolean; error?: string } {
  // Basic JPEG validation - check for proper SOI and EOI markers
  if (buffer.length < 4) return { valid: false, error: 'JPEG too small' };
  
  // Start of Image marker (SOI)
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return { valid: false, error: 'Invalid JPEG start marker' };
  }
  
  // Look for End of Image marker (EOI) in last few bytes
  const endIndex = buffer.length - 2;
  if (endIndex >= 0 && (buffer[endIndex] !== 0xFF || buffer[endIndex + 1] !== 0xD9)) {
    // EOI might not be at the very end due to metadata, so check last 100 bytes
    let foundEOI = false;
    for (let i = Math.max(0, buffer.length - 100); i < buffer.length - 1; i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
        foundEOI = true;
        break;
      }
    }
    if (!foundEOI) {
      return { valid: false, error: 'JPEG missing end marker' };
    }
  }
  
  return { valid: true };
}

function validatePNGStructure(buffer: Uint8Array): { valid: boolean; error?: string } {
  if (buffer.length < 33) return { valid: false, error: 'PNG too small' };
  
  // PNG signature already validated, check for IHDR chunk
  if (buffer[12] !== 0x49 || buffer[13] !== 0x48 || buffer[14] !== 0x44 || buffer[15] !== 0x52) {
    return { valid: false, error: 'PNG missing IHDR chunk' };
  }
  
  // Basic dimension validation from IHDR
  const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
  const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
  
  if (width === 0 || height === 0 || width > MAX_IMAGE_DIMENSIONS || height > MAX_IMAGE_DIMENSIONS) {
    return { valid: false, error: `PNG dimensions invalid or too large: ${width}x${height}` };
  }
  
  return { valid: true };
}

function validateWebPStructure(buffer: Uint8Array): { valid: boolean; error?: string } {
  if (buffer.length < 20) return { valid: false, error: 'WebP too small' };
  
  // WebP signature already validated, check file size consistency
  const fileSize = (buffer[4]) | (buffer[5] << 8) | (buffer[6] << 16) | (buffer[7] << 24);
  if (fileSize + 8 !== buffer.length) {
    return { valid: false, error: 'WebP file size mismatch' };
  }
  
  return { valid: true };
}

function sanitizeImageBuffer(buffer: Uint8Array): Uint8Array {
  // Create a copy to avoid modifying original
  const sanitized = new Uint8Array(buffer);
  
  // Remove any potential null bytes at the end (common in malformed files)
  let actualLength = sanitized.length;
  while (actualLength > 0 && sanitized[actualLength - 1] === 0) {
    actualLength--;
  }
  
  return sanitized.slice(0, actualLength);
}

// Enhanced API routes for damage assessment with RAG
app.post("/api/assess-damage", async (c) => {
  const endTimer = performanceMonitor.startTimer('damage_assessment_total');
  
  try {
    // Validate request body structure
    const body = await c.req.json();
    if (!body || typeof body !== 'object') {
      return c.json({ 
        success: false, 
        error: "Invalid request body",
        details: "Request body must be a JSON object" 
      }, 400);
    }

    const { image } = body;
    if (!image || typeof image !== 'string') {
      return c.json({ 
        success: false, 
        error: "Missing or invalid image field",
        details: "Image field is required and must be a string" 
      }, 400);
    }

    // Validate data URI format and extract MIME type
    if (!image.startsWith('data:image/')) {
      return c.json({ 
        success: false, 
        error: "Invalid image format",
        details: "Image must be a valid data URI starting with 'data:image/'" 
      }, 400);
    }

    // Extract and validate MIME type from data URI
    const mimeTypeMatch = image.match(/^data:(image\/[^;]+);base64,/);
    if (!mimeTypeMatch) {
      return c.json({ 
        success: false, 
        error: "Invalid data URI format",
        details: "Data URI must specify MIME type and base64 encoding" 
      }, 400);
    }

    const declaredMimeType = mimeTypeMatch[1];
    if (!ALLOWED_MIME_TYPES.includes(declaredMimeType)) {
      return c.json({ 
        success: false, 
        error: "Unsupported image type",
        details: `Only JPEG, PNG, and WebP images are supported. Received: ${declaredMimeType}` 
      }, 400);
    }

    // Validate size (using configured limit)
    if (image.length > appConfig.api.limits.max_file_size) {
      return c.json({ 
        success: false, 
        error: "Image too large",
        details: `Image size ${image.length} bytes exceeds limit of ${Math.round(appConfig.api.limits.max_file_size / (1024 * 1024))}MB` 
      }, 413);
    }

    // Validate and extract base64 data
    const base64Data = image.split(',')[1];
    if (!base64Data) {
      return c.json({ 
        success: false, 
        error: "Invalid data URI format",
        details: "Data URI must contain base64 data after comma" 
      }, 400);
    }

    // Safe base64 decoding
    let imageBuffer;
    try {
      imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    } catch (error) {
      return c.json({ 
        success: false, 
        error: "Invalid base64 data",
        details: "Unable to decode base64 image data" 
      }, 400);
    }

    // Validate decoded image size (prevent memory issues)
    if (imageBuffer.length > appConfig.api.limits.max_decoded_size) {
      return c.json({ 
        success: false, 
        error: "Decoded image too large",
        details: `Decoded image size ${imageBuffer.length} bytes exceeds limit of ${Math.round(appConfig.api.limits.max_decoded_size / (1024 * 1024))}MB` 
      }, 413);
    }

    // Security validation: Verify image file signature matches declared MIME type
    const signatureValidation = validateImageSignature(imageBuffer);
    if (!signatureValidation.valid) {
      return c.json({ 
        success: false, 
        error: "Invalid image file",
        details: signatureValidation.error || "Image file signature validation failed" 
      }, 400);
    }

    // Verify declared MIME type matches actual image type
    if (signatureValidation.detectedType !== declaredMimeType) {
      return c.json({ 
        success: false, 
        error: "Image type mismatch",
        details: `Declared type ${declaredMimeType} does not match actual type ${signatureValidation.detectedType}` 
      }, 400);
    }

    // Validate internal image structure
    const structureValidation = validateImageStructure(imageBuffer, declaredMimeType);
    if (!structureValidation.valid) {
      return c.json({ 
        success: false, 
        error: "Corrupted image file",
        details: structureValidation.error || "Image structure validation failed" 
      }, 400);
    }

    // Sanitize image buffer to remove potential malicious data
    const sanitizedBuffer = sanitizeImageBuffer(imageBuffer);
    
    // Generate image hash for caching
    const imageHash = cacheService.generateImageHash(sanitizedBuffer);
    
    // Check cache first
    const cachedResult = await cacheService.getCachedAssessmentResult(imageHash);
    if (cachedResult) {
      logger.info('Cache hit for assessment', { imageHash });
      endTimer();
      return c.json({
        ...cachedResult.assessment,
        cached: true,
        cache_timestamp: cachedResult.timestamp
      });
    }
    
    // Log security validation success
    logger.info(`Image security validation passed`, {
      declaredType: declaredMimeType,
      detectedType: signatureValidation.detectedType,
      originalSize: imageBuffer.length,
      sanitizedSize: sanitizedBuffer.length,
      imageHash
    });
    
    // Step 1: Vision AI Analysis using LLaVA (use sanitized buffer)
    const visionTimer = performanceMonitor.startTimer('vision_analysis');
    
    // Check vision cache first
    let visionResponse = await cacheService.getCachedVisionResult(imageHash);
    if (!visionResponse) {
      // Check if we should use development mocks
      if (AIMocks.shouldUseMocks(appConfig, c.env)) {
        logger.info('Using AI mocks for development');
        const mockResponse = await AIMocks.mockVisionAnalysis(
          sanitizedBuffer,
          "Analyze this water damage image. Describe the type of damage, affected materials, severity level, and any visible issues like staining, warping, or mold."
        );
        visionResponse = {
          description: mockResponse.description,
          confidence: mockResponse.confidence
        };
      } else {
        // Production AI call with timeout
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI vision analysis timeout')), appConfig.ai.timeout_ms)
        );
        
        const aiPromise = (c.env as any).AI.run(appConfig.ai.vision_model, {
          image: Array.from(sanitizedBuffer),
          prompt: "Analyze this water damage image focusing on remediation planning. Identify: 1) Specific materials damaged (drywall, flooring, insulation, etc.), 2) Water damage class (Class 1-4 based on affected area), 3) Water category (1-3 based on contamination level), 4) Which materials require removal vs. can be dried in place, 5) Room-specific concerns (ventilation, structural elements, hidden damage areas), 6) Immediate safety issues. Provide specific details needed for IICRC-compliant remediation planning."
        });
        
        visionResponse = await Promise.race([aiPromise, timeoutPromise]);
      }
      
      // Cache vision result
      await cacheService.cacheVisionResult(imageHash, visionResponse);
    }
    
    visionTimer();

    // Step 2: RAG Query for Industry Knowledge
    const ragTimer = performanceMonitor.startTimer('rag_search');
    let ragResponse: any = { response: '', data: [] };
    
    try {
      // Check if AI binding and autorag method exist
      if (appConfig.ai.enable_autorag) {
        const ragQuery = `water damage classification materials assessment removal vs drying ${visionResponse.description} IICRC S500 standards remediation protocol equipment requirements`;
        
        // Check RAG cache first
        let cachedRAGResult = await cacheService.getCachedRAGResult(ragQuery);
        if (cachedRAGResult) {
          ragResponse = cachedRAGResult;
        } else {
          // Use mocks or real AutoRAG
          if (AIMocks.shouldUseMocks(appConfig, c.env)) {
            logger.info('Using AutoRAG mocks for development');
            ragResponse = await AIMocks.mockAutoRAGSearch(ragQuery);
          } else if ((c.env as any).AI && typeof (c.env as any).AI.autorag === 'function') {
            // Production AutoRAG call with timeout
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('AutoRAG timeout')), appConfig.ai.timeout_ms)
            );
            
            const ragPromise = (c.env as any).AI.autorag(appConfig.ai.autorag_dataset).aiSearch({
              query: ragQuery
            });
            
            ragResponse = await Promise.race([ragPromise, timeoutPromise]);
          } else {
            logger.warn('AutoRAG not available, continuing with vision-only analysis');
          }
          
          // Cache RAG result
          await cacheService.cacheRAGResult(ragQuery, ragResponse);
        }
      } else {
        logger.info('AutoRAG disabled, continuing with vision-only analysis');
      }
    } catch (error) {
      logger.error('AutoRAG search failed', { error: (error as Error).message, stack: (error as Error).stack });
      // Continue with vision-only analysis
    }
    
    ragTimer();

    // Step 3: Combine Vision + RAG for Enhanced Assessment
    const assessmentTimer = performanceMonitor.startTimer('enhanced_assessment');
    
    let enhancedAssessment;
    if (AIMocks.shouldUseMocks(appConfig, c.env)) {
      logger.info('Using language model mocks for development');
      const mockResponse = await AIMocks.mockLanguageGeneration([
        {
          role: "system", 
          content: "You are a friendly and experienced water damage restoration expert who communicates in a conversational, approachable tone. Your goal is to help property owners understand their situation and feel confident about the next steps. Always end your response with an engaging follow-up question to encourage further conversation and gather more details that could help with the assessment."
        },
        {
          role: "user",
          content: `Vision Analysis: ${visionResponse.description}\n\nIndustry Guidelines: ${ragResponse.response || JSON.stringify(ragResponse.data || [])}\n\n${ragResponse.response || ragResponse.data?.length ? 'Using industry guidelines above, provide a professional remediation assessment' : 'Based on IICRC S500 standards, provide a professional remediation assessment'} for this water damage situation. Structure your response to cover: 1) **Damage Classification** (Class 1-4 and Category 1-3), 2) **Materials Assessment** (what can be dried vs. must be removed), 3) **Remediation Strategy** (equipment needed, drying protocol), 4) **Timeline and Phases** (emergency services, drying, reconstruction), 5) **Safety Considerations** (PPE requirements, containment needs), 6) **Documentation Requirements** (moisture readings, photo documentation). Keep the tone professional but approachable, and end with a specific question about the property's conditions or timeline.`
        }
      ]);
      enhancedAssessment = mockResponse;
    } else {
      // Production language model call with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Language model timeout')), appConfig.ai.timeout_ms)
      );
      
      const aiPromise = (c.env as any).AI.run(appConfig.ai.language_model, {
        messages: [
          {
            role: "system", 
            content: "You are a friendly and experienced water damage restoration expert who communicates in a conversational, approachable tone. Your goal is to help property owners understand their situation and feel confident about the next steps. Always end your response with an engaging follow-up question to encourage further conversation and gather more details that could help with the assessment."
          },
          {
            role: "user",
            content: `Vision Analysis: ${visionResponse.description}\n\nIndustry Guidelines: ${ragResponse.response || JSON.stringify(ragResponse.data || [])}\n\n${ragResponse.response || ragResponse.data?.length ? 'Using industry guidelines above, help me understand' : 'Based on standard water damage restoration practices, help me understand'} this water damage situation. Please provide a conversational assessment that covers: 1) What type of damage we're dealing with 2) The steps we'll need to take 3) How long this might take 4) What equipment will be needed 5) What to document for insurance. Keep the tone friendly and reassuring, and end with a specific question to learn more about the situation.`
          }
        ]
      });
      
      enhancedAssessment = await Promise.race([aiPromise, timeoutPromise]);
    }
    
    assessmentTimer();

    // Prepare final response
    const finalResult = {
      success: true,
      vision_analysis: visionResponse.description,
      industry_sources: ragResponse.data || [],
      autorag_response: ragResponse.response || null,
      enhanced_assessment: enhancedAssessment.response,
      confidence_score: visionResponse.confidence || appConfig.ai.confidence_threshold,
      timestamp: new Date().toISOString(),
      performance: {
        total_time: endTimer(),
        cached: false
      }
    };

    // Cache the complete assessment
    await cacheService.cacheAssessmentResult(imageHash, visionResponse, ragResponse, finalResult);

    return c.json(finalResult);

  } catch (error) {
    logger.error('AI assessment failed', { error: (error as Error).message, stack: (error as Error).stack });
    
    // Enhanced error handling with specific error types
    let statusCode = 500;
    let errorMessage = "Assessment failed";
    let errorDetails = "An unexpected error occurred";
    
    if (error instanceof Error) {
      // Handle different types of errors
      if (error.message.includes('AI model not found')) {
        statusCode = 503;
        errorMessage = "AI service unavailable";
        errorDetails = "The AI vision model is temporarily unavailable";
      } else if (error.message.includes('timeout')) {
        statusCode = 504;
        errorMessage = "Request timeout";
        errorDetails = "The AI processing took too long to complete";
      } else if (error.message.includes('rate limit')) {
        statusCode = 429;
        errorMessage = "Rate limit exceeded";
        errorDetails = "Too many requests. Please try again later";
      } else if (error.message.includes('memory')) {
        statusCode = 507;
        errorMessage = "Insufficient resources";
        errorDetails = "The image is too large to process";
      } else if (error.message.includes('Invalid image') || error.message.includes('Corrupted image')) {
        statusCode = 400;
        errorMessage = "Invalid image file";
        errorDetails = "The uploaded image file is corrupted or malformed";
      } else if (error.message.includes('Image type mismatch')) {
        statusCode = 400;
        errorMessage = "Image validation failed";
        errorDetails = "The image file does not match its declared format";
      } else {
        errorDetails = error.message;
      }
    }
    
    return c.json({ 
      success: false, 
      error: errorMessage, 
      details: errorDetails,
      timestamp: new Date().toISOString()
    }, statusCode as any);
  }
});

// Helper route for testing RAG knowledge base
app.get("/api/knowledge-search", async (c) => {
  const endTimer = performanceMonitor.startTimer('knowledge_search');
  
  const query = c.req.query('q');
  if (!query) {
    return c.json({ 
      success: false, 
      error: "Missing query parameter", 
      details: "Query parameter 'q' is required" 
    }, 400);
  }

  // Validate query length and content
  if (typeof query !== 'string' || query.trim().length === 0) {
    return c.json({ 
      success: false, 
      error: "Invalid query parameter", 
      details: "Query must be a non-empty string" 
    }, 400);
  }

  if (query.length > appConfig.api.limits.max_query_length) {
    return c.json({ 
      success: false, 
      error: "Query too long", 
      details: `Query must be less than ${appConfig.api.limits.max_query_length} characters` 
    }, 400);
  }
  
  try {
    // Check if AI binding exists
    if (!(c.env as any).AI) {
      return c.json({ 
        success: false, 
        error: "AI binding not available", 
        details: "AutoRAG requires AI binding to be configured" 
      }, 500);
    }
    
    // Check if autorag method exists
    if (typeof (c.env as any).AI.autorag !== 'function') {
      return c.json({
        success: false,
        error: "AutoRAG not available",
        details: "AutoRAG method not found on AI binding"
      }, 500);
    }
    
    // Check cache first
    let results = await cacheService.getCachedRAGResult(query);
    let cached = false;
    
    if (!results) {
      // Use the new AutoRAG dataset with aiSearch method
      results = await (c.env as any).AI.autorag(appConfig.ai.autorag_dataset).aiSearch({
        query: query
      });
      
      // Cache the results
      await cacheService.cacheRAGResult(query, results);
    } else {
      cached = true;
    }
    
    const totalTime = endTimer();
    
    return c.json({
      success: true,
      query: query,
      response: results.response || null,
      results: results.data || [],
      total_results: results.data?.length || 0,
      performance: {
        total_time: totalTime,
        cached: cached
      }
    });
    
  } catch (error) {
    endTimer(); // End the timer even on error
    logger.error('Knowledge search failed', { error: (error as Error).message, stack: (error as Error).stack });
    
    // Enhanced error handling with specific error types
    let statusCode = 500;
    let errorMessage = "Search failed";
    let errorDetails = "An unexpected error occurred";
    
    if (error instanceof Error) {
      // Handle different types of errors
      if (error.message.includes('dataset not found')) {
        statusCode = 503;
        errorMessage = "Search service unavailable";
        errorDetails = "The knowledge base is temporarily unavailable";
      } else if (error.message.includes('timeout')) {
        statusCode = 504;
        errorMessage = "Search timeout";
        errorDetails = "The search took too long to complete";
      } else if (error.message.includes('rate limit')) {
        statusCode = 429;
        errorMessage = "Rate limit exceeded";
        errorDetails = "Too many search requests. Please try again later";
      } else if (error.message.includes('AutoRAG not available')) {
        statusCode = 503;
        errorMessage = "Search service unavailable";
        errorDetails = "The AutoRAG service is not available";
      } else {
        errorDetails = error.message;
      }
    }
    
    return c.json({ 
      success: false, 
      error: errorMessage, 
      details: errorDetails,
      timestamp: new Date().toISOString()
    }, statusCode as any);
  }
});

// Conversation endpoint for chatbot follow-up questions
app.post("/api/conversation", handleConversationRequest);

// Performance and cache statistics endpoint
app.get("/api/stats", async (c) => {
  try {
    const cacheStats = cacheService.getCacheStats();
    const performanceMetrics = performanceMonitor.getAllMetrics();
    
    return c.json({
      success: true,
      cache: cacheStats,
      performance: performanceMetrics,
      timestamp: new Date().toISOString(),
      config: {
        caching_enabled: appConfig.performance.enable_caching,
        cache_ttl: appConfig.performance.cache_ttl,
        max_concurrent_requests: appConfig.performance.max_concurrent_requests
      }
    });
  } catch (error) {
    logger.error('Stats endpoint failed', { error: (error as Error).message });
    return c.json({
      success: false,
      error: "Failed to retrieve statistics",
      timestamp: new Date().toISOString()
    }, 500);
  }
});

app.get("*", (c) => {
  const requestHandler = createRequestHandler(
    () => import("virtual:react-router/server-build"),
    import.meta.env.MODE,
  );

  return requestHandler(c.req.raw, {
    cloudflare: { env: c.env, ctx: c.executionCtx },
  });
});

export default app;
