import { Hono } from "hono";
import { createRequestHandler } from "react-router";

// Simple server-side logger for Cloudflare Workers
const logger = {
  error: (message: string, data?: any) => {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`, data);
  },
  info: (message: string, data?: any) => {
    console.log(`[${new Date().toISOString()}] INFO: ${message}`, data);
  },
  warn: (message: string, data?: any) => {
    console.warn(`[${new Date().toISOString()}] WARN: ${message}`, data);
  }
};

const app = new Hono();

// Enhanced API routes for damage assessment with RAG
app.post("/api/assess-damage", async (c) => {
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

    // Validate data URI format
    if (!image.startsWith('data:image/')) {
      return c.json({ 
        success: false, 
        error: "Invalid image format",
        details: "Image must be a valid data URI starting with 'data:image/'" 
      }, 400);
    }

    // Validate size (50MB limit for request)
    if (image.length > 50 * 1024 * 1024) {
      return c.json({ 
        success: false, 
        error: "Image too large",
        details: `Image size ${image.length} bytes exceeds limit of 50MB` 
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
    if (imageBuffer.length > 100 * 1024 * 1024) {
      return c.json({ 
        success: false, 
        error: "Decoded image too large",
        details: `Decoded image size ${imageBuffer.length} bytes exceeds limit of 100MB` 
      }, 413);
    }
    
    // Step 1: Vision AI Analysis using LLaVA
    const visionResponse = await (c.env as any).AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: Array.from(imageBuffer),
      prompt: "Analyze this water damage image. Describe the type of damage, affected materials, severity level, and any visible issues like staining, warping, or mold."
    });

    // Step 2: RAG Query for Industry Knowledge
    let ragResponse = { response: '', data: [] };
    try {
      // Check if AI binding and autorag method exist
      if ((c.env as any).AI && typeof (c.env as any).AI.autorag === 'function') {
        ragResponse = await (c.env as any).AI.autorag("auto-inspect-rag").aiSearch({
          query: `water damage ${visionResponse.description} remediation guidelines IICRC standards`
        });
      } else {
        logger.warn('AutoRAG not available, continuing with vision-only analysis');
      }
    } catch (error) {
      logger.error('AutoRAG search failed', { error: (error as Error).message, stack: (error as Error).stack });
      // Continue with vision-only analysis
    }

    // Step 3: Combine Vision + RAG for Enhanced Assessment
    const enhancedAssessment = await (c.env as any).AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        {
          role: "system", 
          content: "You are a certified water damage restoration expert. Combine the vision analysis with industry guidelines to provide comprehensive assessment with specific remediation steps, timeline, and compliance requirements."
        },
        {
          role: "user",
          content: `Vision Analysis: ${visionResponse.description}\n\nIndustry Guidelines: ${ragResponse.response || JSON.stringify(ragResponse.data || [])}\n\n${ragResponse.response || ragResponse.data?.length ? 'Using industry guidelines above, provide' : 'Based on standard water damage restoration practices, provide'} detailed professional assessment with: 1) Damage classification 2) Required actions 3) Estimated timeline 4) Equipment needed 5) Insurance documentation requirements.`
        }
      ]
    });

    return c.json({
      success: true,
      vision_analysis: visionResponse.description,
      industry_sources: ragResponse.data || [],
      autorag_response: ragResponse.response || null,
      enhanced_assessment: enhancedAssessment.response,
      confidence_score: visionResponse.confidence || 0.85,
      timestamp: new Date().toISOString()
    });

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

  if (query.length > 1000) {
    return c.json({ 
      success: false, 
      error: "Query too long", 
      details: "Query must be less than 1000 characters" 
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
    
    // Use the new AutoRAG dataset with aiSearch method
    const results = await (c.env as any).AI.autorag("auto-inspect-rag").aiSearch({
      query: query
    });
    
    return c.json({
      success: true,
      query: query,
      response: results.response || null,
      results: results.data || [],
      total_results: results.data?.length || 0
    });
    
  } catch (error) {
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
