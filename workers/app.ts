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
    const { image } = await c.req.json();
    
    // Convert base64 to Uint8Array for vision model
    const base64Data = image.split(',')[1];
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Step 1: Vision AI Analysis using LLaVA
    const visionResponse = await (c.env as any).AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: Array.from(imageBuffer),
      prompt: "Analyze this water damage image. Describe the type of damage, affected materials, severity level, and any visible issues like staining, warping, or mold."
    });

    // Step 2: RAG Query for Industry Knowledge
    let ragResponse = { response: '', data: [] };
    try {
      // Check if AI binding and autorag method exist
      if (c.env.AI && typeof c.env.AI.autorag === 'function') {
        ragResponse = await c.env.AI.autorag("auto-inspect-rag").aiSearch({
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
    return c.json({ 
      success: false, 
      error: "Assessment failed", 
      details: (error as Error).message 
    }, 500);
  }
});

// Helper route for testing RAG knowledge base
app.get("/api/knowledge-search", async (c) => {
  const query = c.req.query('q');
  if (!query) return c.json({ error: "Query parameter 'q' required" }, 400);
  
  try {
    // Check if AI binding exists
    if (!c.env.AI) {
      return c.json({ 
        success: false, 
        error: "AI binding not available", 
        details: "AutoRAG requires AI binding to be configured" 
      }, 500);
    }
    
    // Check if autorag method exists
    if (typeof c.env.AI.autorag !== 'function') {
      return c.json({
        success: false,
        error: "AutoRAG not available",
        details: "AutoRAG method not found on AI binding"
      }, 500);
    }
    
    // Use the new AutoRAG dataset with aiSearch method
    const results = await c.env.AI.autorag("auto-inspect-rag").aiSearch({
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
    return c.json({ 
      success: false, 
      error: "Search failed", 
      details: (error as Error).message 
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
