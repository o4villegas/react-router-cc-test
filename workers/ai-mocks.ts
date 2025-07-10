/**
 * AI Mock Responses for Development Environment
 * Provides realistic mock data when Cloudflare AI services are unavailable
 */

export interface MockVisionResponse {
  description: string;
  confidence: number;
}

export interface MockRAGResponse {
  response: string;
  data: Array<{
    source: string;
    content: string;
    relevance: number;
  }>;
}

export interface MockLanguageResponse {
  response: string;
}

// Remediation-focused mock vision analysis responses
const MOCK_VISION_RESPONSES: MockVisionResponse[] = [
  {
    description: "**Materials Damaged:** Painted drywall with bubbling/peeling paint, potential insulation behind wall. **Damage Class:** Class 2 (part of room affected). **Water Category:** Category 1 (clean water source). **Removal vs Drying:** Drywall can likely be dried in place if moisture content <25%, paint requires removal and reapplication. **Room Concerns:** Check for hidden damage behind baseboards, ensure adequate ventilation for drying. **Safety Issues:** No immediate structural concerns, standard PPE recommended.",
    confidence: 0.85
  },
  {
    description: "**Materials Damaged:** Acoustic ceiling tiles (removal required), drywall substrate, potential ceiling insulation. **Damage Class:** Class 3 (ceiling overhead, gravity-fed). **Water Category:** Category 2 (gray water - potential contamination). **Removal vs Drying:** All ceiling tiles must be removed, drywall assessment needed with moisture meter. **Room Concerns:** Structural integrity of ceiling joists requires inspection, containment recommended. **Safety Issues:** Potential overhead hazard, hard hat required during inspection.",
    confidence: 0.78
  },
  {
    description: "**Materials Damaged:** Laminate/hardwood flooring, subflooring, potential floor joists. **Damage Class:** Class 4 (specialty drying situations). **Water Category:** Category 1-2 (depends on source). **Removal vs Drying:** Flooring requires removal, subfloor assessment with moisture readings. **Room Concerns:** Check crawl space/basement below for additional damage, HVAC duct inspection if present. **Safety Issues:** Floor stability concerns, avoid heavy equipment until structural assessment.",
    confidence: 0.82
  }
];

// Mock industry knowledge responses
const MOCK_RAG_RESPONSES: MockRAGResponse[] = [
  {
    response: "According to IICRC S500 standards, water damage restoration should begin within 24-48 hours to prevent secondary damage including microbial growth. Class 2 water damage (affecting part of a room) requires controlled drying with proper ventilation and monitoring.",
    data: [
      {
        source: "IICRC S500 Standard",
        content: "Water damage restoration timeline and classification guidelines",
        relevance: 0.92
      },
      {
        source: "EPA Mold Remediation Guidelines", 
        content: "Prevention of microbial growth in water-damaged materials",
        relevance: 0.88
      }
    ]
  },
  {
    response: "Professional water extraction and structural drying are essential for Category 1 clean water damage. Affected materials should be evaluated within 24 hours, with porous materials like drywall potentially requiring replacement if saturation exceeds industry standards.",
    data: [
      {
        source: "IICRC S500 Water Damage Restoration",
        content: "Material evaluation and replacement criteria",
        relevance: 0.95
      },
      {
        source: "Building Performance Institute Guidelines",
        content: "Structural drying protocols and equipment specifications",
        relevance: 0.87
      }
    ]
  }
];

// Mock enhanced assessment responses
const MOCK_LANGUAGE_RESPONSES: string[] = [
  "Based on the water damage analysis, this appears to be a moderate water intrusion affecting drywall materials. **Immediate Action Required:** The affected area should be assessed by a certified water damage restoration professional within 24 hours to prevent secondary damage.\n\n**Recommended Steps:** 1) Document damage with photographs for insurance, 2) Remove any wet materials like carpeting or padding, 3) Establish proper ventilation and dehumidification, 4) Monitor moisture levels daily.\n\n**What specific concerns do you have about this damage?**",
  
  "I can see significant water damage that requires prompt professional attention. The staining patterns suggest this has been developing over time, which increases the risk of microbial growth. **Emergency Steps:** Contact a certified restoration company immediately and document everything for insurance purposes.\n\n**Important:** Avoid disturbing the affected area unnecessarily, as this can spread potential contaminants. Professional water extraction and controlled drying are essential for preventing further structural damage.\n\n**Would you like me to explain the repair process for this type of damage?**",
  
  "This water damage shows characteristics requiring immediate intervention. The affected materials appear to include both surface and potentially structural elements. **Critical Timeline:** Professional assessment needed within 24-48 hours to prevent irreversible damage and potential health hazards.\n\n**Insurance Documentation:** Take detailed photos from multiple angles, note the date/time of discovery, and keep records of any immediate actions taken. Professional restoration typically takes 3-5 days depending on extent.\n\n**Are you dealing with any insurance claims for this damage?**"
];

export class AIMocks {
  /**
   * Generate mock vision analysis response
   */
  static async mockVisionAnalysis(imageBuffer: Uint8Array, prompt: string): Promise<MockVisionResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // Return random but realistic response
    const response = MOCK_VISION_RESPONSES[Math.floor(Math.random() * MOCK_VISION_RESPONSES.length)];
    
    // Add slight randomization to confidence
    return {
      ...response,
      confidence: Math.max(0.6, response.confidence + (Math.random() - 0.5) * 0.1)
    };
  }

  /**
   * Generate mock AutoRAG search response
   */
  static async mockAutoRAGSearch(query: string): Promise<MockRAGResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 300 + Math.random() * 700));
    
    return MOCK_RAG_RESPONSES[Math.floor(Math.random() * MOCK_RAG_RESPONSES.length)];
  }

  /**
   * Generate mock language model response
   */
  static async mockLanguageGeneration(messages: Array<{role: string; content: string}>): Promise<MockLanguageResponse> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    
    return {
      response: MOCK_LANGUAGE_RESPONSES[Math.floor(Math.random() * MOCK_LANGUAGE_RESPONSES.length)]
    };
  }

  /**
   * Check if development mocks should be used
   */
  static shouldUseMocks(config: any, env: any): boolean {
    // Use mocks if explicitly enabled or if in development mode
    return config.ai.enable_dev_mocks || 
           (config.app.environment === 'development' && !env.AI);
  }
}