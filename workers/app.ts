import { Hono } from "hono";
import { createRequestHandler } from "react-router";

const app = new Hono();

// Enhanced API routes for damage assessment with RAG
app.post("/api/assess-damage", async (c) => {
  try {
    const { image } = await c.req.json();
    
    // Convert base64 to Uint8Array for vision model
    const base64Data = image.split(',')[1];
    const imageBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Step 1: Vision AI Analysis using LLaVA
    const visionResponse = await c.env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
      image: Array.from(imageBuffer),
      prompt: "Analyze this water damage image. Describe the type of damage, affected materials, severity level, and any visible issues like staining, warping, or mold."
    });

    // Step 2: RAG Query for Industry Knowledge
    const ragResponse = await c.env.AUTORAG.search({
      query: `water damage ${visionResponse.description} remediation guidelines IICRC standards`,
      limit: 3,
      score_threshold: 0.7
    });

    // Step 3: Combine Vision + RAG for Enhanced Assessment
    const enhancedAssessment = await c.env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
      messages: [
        {
          role: "system", 
          content: "You are a certified water damage restoration expert. Combine the vision analysis with industry guidelines to provide comprehensive assessment with specific remediation steps, timeline, and compliance requirements."
        },
        {
          role: "user",
          content: `Vision Analysis: ${visionResponse.description}\n\nIndustry Guidelines: ${JSON.stringify(ragResponse.data || [])}\n\nProvide detailed professional assessment with: 1) Damage classification 2) Required actions 3) Estimated timeline 4) Equipment needed 5) Insurance documentation requirements.`
        }
      ]
    });

    return c.json({
      success: true,
      vision_analysis: visionResponse.description,
      industry_sources: ragResponse.data || [],
      enhanced_assessment: enhancedAssessment.response,
      confidence_score: visionResponse.confidence || 0.85,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Assessment failed:', error);
    return c.json({ 
      success: false, 
      error: "Assessment failed", 
      details: error.message 
    }, 500);
  }
});

// Helper route for testing RAG knowledge base
app.get("/api/knowledge-search", async (c) => {
  const query = c.req.query('q');
  if (!query) return c.json({ error: "Query parameter 'q' required" }, 400);
  
  try {
    const results = await c.env.AUTORAG.search({
      query: query,
      limit: 5,
      score_threshold: 0.5
    });
    
    return c.json({
      success: true,
      query: query,
      results: results.data || [],
      total_results: results.data?.length || 0
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: "Search failed", 
      details: error.message 
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
