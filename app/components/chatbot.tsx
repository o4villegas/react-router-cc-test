import { useState, useRef, useEffect } from "react";
import { AIErrorBoundary } from "./error-boundary";
import { logger } from "../utils/logger";
import { type ClientConfig } from "../utils/client-config";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  imageUrl?: string;
  metadata?: {
    confidence_score?: number;
    industry_sources?: any[];
    performance?: {
      total_time: number;
      cached: boolean;
    };
  };
}

interface ConversationState {
  hasImage: boolean;
  imageData?: string;
  imageHash?: string;
  lastAssessment?: any;
  ragContext?: any[];
}

interface ChatbotProps {
  apiEndpoint: string;
  config: ClientConfig;
}

export function Chatbot({ apiEndpoint, config }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m here to help you assess property damage. Please upload an image to get started.',
      timestamp: new Date()
    }
  ]);
  
  const [isLoading, setIsLoading] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>({
    hasImage: false
  });
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const validateImage = async (file: File): Promise<{ valid: boolean; error?: string }> => {
    // Check file size
    if (file.size > config.image.max_file_size) {
      return {
        valid: false,
        error: `File size must be less than ${config.image.max_file_size / (1024 * 1024)}MB`
      };
    }

    // Check file type
    if (!config.image.allowed_types.includes(file.type)) {
      return {
        valid: false,
        error: `Only ${config.image.allowed_types.join(', ')} images are allowed`
      };
    }

    return { valid: true };
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (file: File) => {
    const validation = await validateImage(file);
    if (!validation.valid) {
      addMessage('assistant', validation.error || 'Invalid image file');
      return;
    }

    try {
      const base64Image = await convertToBase64(file);
      const imageUrl = URL.createObjectURL(file);
      
      // Add user message with image
      addMessage('user', 'I\'ve uploaded an image for damage assessment.', imageUrl);
      
      // Update conversation state
      setConversationState(prev => ({
        ...prev,
        hasImage: true,
        imageData: base64Image
      }));

      // Trigger initial analysis
      await performDamageAnalysis(base64Image);
      
    } catch (error) {
      logger.error('Image upload failed', error, 'Chatbot');
      addMessage('assistant', 'Sorry, there was an error processing your image. Please try again.');
    }
  };

  const performDamageAnalysis = async (imageData: string) => {
    setIsLoading(true);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.api.timeout.damage_assessment);

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageData }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json() as any;
      
      if (result.success) {
        // Store RAG context for future questions and create image hash for caching
        const imageHash = btoa(imageData).slice(0, 16);
        setConversationState(prev => ({
          ...prev,
          lastAssessment: result,
          ragContext: result.industry_sources,
          imageHash
        }));

        // Create comprehensive damage description with follow-up question
        const damageDescription = createConversationalResponse(result);
        
        addMessage('assistant', damageDescription, undefined, {
          confidence_score: result.confidence_score,
          industry_sources: result.industry_sources,
          performance: result.performance
        });
      } else {
        addMessage('assistant', result.error || 'I encountered an error analyzing your image. Could you try uploading a clearer photo?');
      }
      
    } catch (error) {
      logger.apiError(apiEndpoint, error, 'Chatbot');
      addMessage('assistant', 'I\'m having trouble analyzing your image right now. Please try again in a moment.');
    } finally {
      setIsLoading(false);
    }
  };

  const createConversationalResponse = (result: any): string => {
    const { vision_analysis, enhanced_assessment, confidence_score, autorag_response } = result;
    
    // Create engaging conversational response
    let response = "I've analyzed your image and here's what I found:\n\n";
    
    // Add main assessment
    response += `**Damage Assessment:**\n${enhanced_assessment}\n\n`;
    
    // Add confidence indicator
    const confidenceText = confidence_score > 0.8 ? "high confidence" : 
                          confidence_score > 0.6 ? "moderate confidence" : "preliminary assessment";
    response += `*This assessment is made with ${confidenceText} based on industry standards.*\n\n`;
    
    // Add engaging follow-up question based on damage type
    const followUpQuestions = [
      "What specific concerns do you have about this damage?",
      "Would you like me to explain the repair process for this type of damage?", 
      "Are there any other areas of damage you'd like me to examine?",
      "Do you need information about emergency mitigation steps?",
      "Would you like to know about the potential costs involved?",
      "Are you dealing with any insurance claims for this damage?"
    ];
    
    const randomQuestion = followUpQuestions[Math.floor(Math.random() * followUpQuestions.length)];
    response += `**${randomQuestion}**`;
    
    return response;
  };

  const handleFollowUpQuestion = async (question: string) => {
    if (!conversationState.hasImage || !conversationState.lastAssessment) {
      addMessage('assistant', 'Please upload an image first so I can provide specific advice about your damage.');
      return;
    }

    setIsLoading(true);
    
    try {
      const conversationEndpoint = "/api/conversation";
      
      const response = await fetch(conversationEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          context: {
            imageData: conversationState.imageData,
            previousAssessment: conversationState.lastAssessment,
            ragContext: conversationState.ragContext,
            conversationHistory: messages.slice(-6).map(msg => ({
              role: msg.role,
              content: msg.content
            }))
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Conversation API error: ${response.status}`);
      }

      const result = await response.json() as any;
      
      if (result.success) {
        addMessage('assistant', result.response, undefined, {
          confidence_score: result.confidence_score,
          industry_sources: result.industry_sources
        });
      } else {
        addMessage('assistant', result.error || 'I\'m having trouble with that question. Could you try rephrasing it?');
      }
      
    } catch (error) {
      logger.error('Follow-up question failed', error, 'Chatbot');
      addMessage('assistant', 'I\'m having trouble answering that question right now. Could you rephrase it?');
    } finally {
      setIsLoading(false);
    }
  };


  const addMessage = (role: 'user' | 'assistant', content: string, imageUrl?: string, metadata?: any) => {
    const newMessage: Message = {
      id: Date.now().toString(),
      role,
      content,
      timestamp: new Date(),
      imageUrl,
      metadata
    };
    
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const question = formData.get('question') as string;
    
    if (question.trim()) {
      addMessage('user', question);
      handleFollowUpQuestion(question);
      e.currentTarget.reset();
    }
  };

  return (
    <AIErrorBoundary>
      <div className="flex flex-col h-full max-w-4xl mx-auto aqua-card rounded-lg shadow-lg">
        {/* Chat Header */}
        <div className="aqua-card rounded-t-lg border-b aqua-border-primary">
          <h2 className="text-xl font-semibold aqua-inspect-title">Damage Assessment Assistant</h2>
          <p className="aqua-text-secondary text-sm">Upload an image to begin damage analysis</p>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-96">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                message.role === 'user' 
                  ? 'aqua-button aqua-text-primary' 
                  : 'aqua-bg-secondary aqua-text-primary border aqua-border-primary'
              }`}>
                {message.imageUrl && (
                  <img 
                    src={message.imageUrl} 
                    alt="Uploaded damage" 
                    className="w-full rounded mb-2 max-h-48 object-cover"
                  />
                )}
                <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                {message.metadata?.confidence_score && (
                  <div className="text-xs mt-1 opacity-75">
                    Confidence: {Math.round(message.metadata.confidence_score * 100)}%
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="aqua-bg-secondary border aqua-border-primary rounded-lg px-4 py-2">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin h-4 w-4 spinner"></div>
                  <span className="text-sm aqua-text-secondary">Analyzing...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t aqua-border-primary p-4">
          {!conversationState.hasImage ? (
            /* Image Upload */
            <div className="text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept={config.image.allowed_types.join(',')}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="aqua-button px-6 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                📷 Upload Damage Photo
              </button>
              <p className="text-xs aqua-text-muted mt-2">
                Supported: {config.image.allowed_types.join(', ')} • Max {config.image.max_file_size / (1024 * 1024)}MB
              </p>
            </div>
          ) : (
            /* Question Input */
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                name="question"
                type="text"
                placeholder="Ask me about the damage, repairs, costs, or insurance..."
                disabled={isLoading}
                className="flex-1 px-4 py-2 border aqua-border-primary rounded-lg focus:ring-2 focus:ring-accent-orange focus:border-accent-orange aqua-bg-secondary aqua-text-primary"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="aqua-button px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                Send
              </button>
            </form>
          )}
        </div>
      </div>
    </AIErrorBoundary>
  );
}