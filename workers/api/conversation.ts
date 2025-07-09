import type { Context } from 'hono';

interface ConversationRequest {
  question: string;
  context?: {
    imageData?: string;
    previousAssessment?: any;
    ragContext?: any[];
    conversationHistory?: Array<{role: string; content: string}>;
  };
}

interface ConversationResponse {
  success: boolean;
  response: string;
  confidence_score?: number;
  industry_sources?: any[];
  suggested_questions?: string[];
  error?: string;
  performance?: {
    total_time: number;
    cached: boolean;
  };
}

// Predefined follow-up questions based on damage types
const DAMAGE_TYPE_QUESTIONS = {
  water: [
    "What immediate steps should I take to prevent further water damage?",
    "How long does water damage restoration typically take?",
    "Will my insurance cover this type of water damage?",
    "What are the potential health risks from water damage?"
  ],
  fire: [
    "What safety precautions should I take around fire damage?",
    "Can smoke damage be completely removed?",
    "What's the typical timeline for fire damage restoration?",
    "How do I document fire damage for insurance?"
  ],
  mold: [
    "Is this type of mold dangerous to my health?", 
    "How can I prevent mold from spreading?",
    "What professional mold remediation involves?",
    "Can I safely clean small mold areas myself?"
  ],
  structural: [
    "Is this structural damage safe to be around?",
    "What emergency measures should I take?",
    "How urgent is it to repair structural damage?",
    "What are the costs for this type of structural repair?"
  ],
  general: [
    "What's the estimated cost range for these repairs?",
    "How should I document this damage for insurance?",
    "Are there any safety concerns I should know about?",
    "What's the typical timeline for this type of repair?"
  ]
};

export async function handleConversationRequest(c: Context): Promise<Response> {
  const startTime = Date.now();
  
  try {
    const body = await c.req.json() as ConversationRequest;
    const { question, context } = body;

    if (!question?.trim()) {
      return c.json({ 
        success: false, 
        error: 'Question is required' 
      }, 400);
    }

    // Enhanced RAG search with context
    const ragQuery = await buildContextualQuery(question, context);
    
    // Search knowledge base
    const ragResponse = await (c.env as any).AI.autorag("auto-inspect-rag").aiSearch({
      query: ragQuery,
    });

    if (!ragResponse?.response) {
      throw new Error('RAG query failed - no response received');
    }

    // Generate conversational response
    const conversationalResponse = await generateConversationalResponse(
      c.env as any,
      question,
      ragResponse,
      context
    );

    // Determine damage type for suggested questions
    const damageType = identifyDamageType(context?.previousAssessment?.vision_analysis || question);
    const suggestedQuestions = DAMAGE_TYPE_QUESTIONS[damageType] || DAMAGE_TYPE_QUESTIONS.general;

    const response: ConversationResponse = {
      success: true,
      response: conversationalResponse.content,
      confidence_score: calculateConfidenceScore(ragResponse, context),
      industry_sources: ragResponse.sources || [],
      suggested_questions: suggestedQuestions.slice(0, 3), // Limit to 3 suggestions
      performance: {
        total_time: Date.now() - startTime,
        cached: false
      }
    };

    return c.json(response);

  } catch (error: any) {
    console.error('Conversation API error:', error);
    
    return c.json({
      success: false,
      error: 'Failed to process conversation request',
      details: error.message,
      performance: {
        total_time: Date.now() - startTime,
        cached: false
      }
    }, 500);
  }
}

async function buildContextualQuery(question: string, context?: any): Promise<string> {
  let contextualQuery = question;

  // Add image analysis context if available
  if (context?.previousAssessment?.vision_analysis) {
    contextualQuery = `Based on ${context.previousAssessment.vision_analysis}: ${question}`;
  }

  // Add conversation history context
  if (context?.conversationHistory?.length > 0) {
    const recentHistory = context.conversationHistory.slice(-3).map((msg: any) => 
      `${msg.role}: ${msg.content}`
    ).join('\n');
    contextualQuery = `Previous conversation:\n${recentHistory}\n\nCurrent question: ${contextualQuery}`;
  }

  return contextualQuery;
}

async function generateConversationalResponse(
  env: any,
  question: string,
  ragResponse: any,
  context?: any
): Promise<{ content: string }> {
  // Create system prompt for conversational AI
  const systemPrompt = `You are a professional damage assessment specialist having a conversation with a property owner. 

Key guidelines:
- Be conversational, helpful, and empathetic
- Reference the uploaded image when relevant
- Provide specific, actionable advice based on industry knowledge
- Always end with a follow-up question to continue the conversation
- Keep responses concise but thorough (2-3 paragraphs max)
- Use a professional but friendly tone

Industry Knowledge Available:
${ragResponse.response}

${context?.previousAssessment ? `
Previous Damage Assessment:
Vision Analysis: ${context.previousAssessment.vision_analysis}
Assessment: ${context.previousAssessment.enhanced_assessment}
` : ''}`;

  const userMessage = `Question about damage: ${question}

Please provide a helpful response that:
1. Addresses their specific question
2. References relevant industry knowledge
3. Considers the damage shown in their image
4. Ends with an engaging follow-up question`;

  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    max_tokens: 500
  });

  return { content: response.response || "I'd be happy to help with that. Could you provide more details?" };
}

function identifyDamageType(content: string): keyof typeof DAMAGE_TYPE_QUESTIONS {
  const lowerContent = content.toLowerCase();
  
  if (lowerContent.includes('water') || lowerContent.includes('flood') || lowerContent.includes('leak')) {
    return 'water';
  }
  if (lowerContent.includes('fire') || lowerContent.includes('smoke') || lowerContent.includes('burn')) {
    return 'fire';
  }
  if (lowerContent.includes('mold') || lowerContent.includes('fungus') || lowerContent.includes('moisture')) {
    return 'mold';
  }
  if (lowerContent.includes('crack') || lowerContent.includes('foundation') || lowerContent.includes('structural')) {
    return 'structural';
  }
  
  return 'general';
}

function calculateConfidenceScore(ragResponse: any, context?: any): number {
  let confidence = 0.7; // Base confidence
  
  // Increase confidence if we have good RAG sources
  if (ragResponse.sources && ragResponse.sources.length > 0) {
    confidence += 0.1;
  }
  
  // Increase confidence if we have image context
  if (context?.previousAssessment?.confidence_score) {
    confidence = Math.min(0.95, confidence + (context.previousAssessment.confidence_score * 0.2));
  }
  
  return Math.round(confidence * 100) / 100;
}