import { useState, useCallback } from "react";
import { AIErrorBoundary } from "./error-boundary";
import { logger } from "../utils/logger";

// Image validation constants
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_DIMENSIONS = { width: 4096, height: 4096 };
const MIN_DIMENSIONS = { width: 100, height: 100 };

interface ValidationError {
  type: 'size' | 'type' | 'dimensions' | 'corrupt';
  message: string;
}

interface AssessmentResult {
  success: boolean;
  vision_analysis: string;
  industry_sources: any[];
  enhanced_assessment: string;
  confidence_score: number;
  timestamp: string;
  error?: string;
  details?: string;
}

interface SearchResult {
  success: boolean;
  query: string;
  results: any[];
  total_results: number;
  error?: string;
  details?: string;
}

export function DamageAssessment({ 
  apiEndpoint, 
  searchEndpoint 
}: { 
  apiEndpoint: string;
  searchEndpoint: string;
}) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const validateImage = (file: File): Promise<ValidationError | null> => {
    return new Promise((resolve) => {
      // Check file size
      if (file.size > MAX_FILE_SIZE) {
        resolve({
          type: 'size',
          message: `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB. Current size: ${(file.size / (1024 * 1024)).toFixed(1)}MB`
        });
        return;
      }

      // Check file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        resolve({
          type: 'type',
          message: `Only JPEG, PNG, and WebP images are allowed. Current type: ${file.type}`
        });
        return;
      }

      // Check image dimensions
      const img = new Image();
      const url = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(url);
        
        if (img.width > MAX_DIMENSIONS.width || img.height > MAX_DIMENSIONS.height) {
          resolve({
            type: 'dimensions',
            message: `Image dimensions must be less than ${MAX_DIMENSIONS.width}x${MAX_DIMENSIONS.height}px. Current: ${img.width}x${img.height}px`
          });
          return;
        }
        
        if (img.width < MIN_DIMENSIONS.width || img.height < MIN_DIMENSIONS.height) {
          resolve({
            type: 'dimensions',
            message: `Image dimensions must be at least ${MIN_DIMENSIONS.width}x${MIN_DIMENSIONS.height}px. Current: ${img.width}x${img.height}px`
          });
          return;
        }
        
        resolve(null); // Valid image
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({
          type: 'corrupt',
          message: 'Unable to load image. File may be corrupted or invalid.'
        });
      };
      
      img.src = url;
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setValidationError(null);
    setSelectedImage(null);
    setImagePreview("");
    
    if (!file) return;
    
    const validationError = await validateImage(file);
    if (validationError) {
      setValidationError(validationError);
      return;
    }
    
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const assessDamage = useCallback(async () => {
    if (!selectedImage) return;
    
    setLoading(true);
    setAssessment(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          
          // Create abort controller for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout
          
          const response = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: base64 }),
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json() as AssessmentResult;
          
          if (!result.success && result.error) {
            throw new Error(`AI Assessment Error: ${result.error} - ${result.details || ''}`);
          }
          
          setAssessment(result);
          setRetryCount(0); // Reset retry count on success
        } catch (error) {
          logger.aiError('image assessment', error, 'DamageAssessment');
          
          // Enhanced error handling with specific error types
          let errorMessage = 'Assessment failed';
          let errorDetails = '';
          
          if (error instanceof Error) {
            if (error.name === 'AbortError') {
              errorMessage = 'Request timeout';
              errorDetails = 'The AI analysis is taking longer than expected. Please try again or use a smaller image.';
            } else if (error.message.includes('HTTP 429')) {
              errorMessage = 'Rate limit exceeded';
              errorDetails = 'Too many requests. Please wait a moment and try again.';
            } else if (error.message.includes('HTTP 500')) {
              errorMessage = 'AI service error';
              errorDetails = 'The AI service is temporarily unavailable. Please try again.';
            } else if (error.message.includes('Failed to fetch')) {
              errorMessage = 'Network error';
              errorDetails = 'Unable to connect to the assessment service. Check your internet connection.';
            } else if (error.message.includes('AI Assessment Error')) {
              errorMessage = 'AI processing error';
              errorDetails = error.message;
            } else {
              errorMessage = 'Unexpected error';
              errorDetails = error.message;
            }
          }
          
          setAssessment({
            success: false,
            error: errorMessage,
            details: errorDetails,
            vision_analysis: '',
            industry_sources: [],
            enhanced_assessment: '',
            confidence_score: 0,
            timestamp: new Date().toISOString()
          });
        }
      };
      
      reader.onerror = () => {
        throw new Error('Failed to read image file. The file may be corrupted.');
      };
      
      reader.readAsDataURL(selectedImage);
    } catch (error) {
      logger.error('Failed to read image file', error, 'DamageAssessment');
      setAssessment({
        success: false,
        error: 'File reading error',
        details: error instanceof Error ? error.message : 'Unknown error',
        vision_analysis: '',
        industry_sources: [],
        enhanced_assessment: '',
        confidence_score: 0,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  }, [selectedImage, apiEndpoint]);

  const searchKnowledgeBase = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for search
      
      const response = await fetch(`${searchEndpoint}?q=${encodeURIComponent(searchQuery)}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json() as SearchResult;
      
      if (!result.success && result.error) {
        throw new Error(`Search Error: ${result.error}${result.details ? ` - ${result.details}` : ''}`);
      }
      
      setSearchResults(result);
    } catch (error) {
      logger.apiError('knowledge search', error, 'DamageAssessment');
      
      // Handle timeout errors specifically
      let errorMessage = 'Search failed';
      if (error instanceof Error && error.name === 'AbortError') {
        errorMessage = 'Search timeout - please try again';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Set error state for search results
      setSearchResults({
        success: false,
        query: searchQuery,
        results: [],
        total_results: 0,
        error: errorMessage
      });
    }
  }, [searchQuery, searchEndpoint]);

  const handleRetry = useCallback(() => {
    setRetryCount(prev => prev + 1);
    assessDamage();
  }, [assessDamage]);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <main id="main-content" className="flex items-center justify-center pt-16 pb-4">
        <div className="flex-1 flex flex-col items-center gap-8 min-h-0 max-w-6xl">
        <header className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Smart Damage Assessment
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-center max-w-2xl">
            AI-powered water damage analysis enhanced with proprietary industry knowledge and IICRC standards
          </p>
        </header>

        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-6 px-4">
          {/* Image Upload Section */}
          <div className="rounded-3xl border border-gray-200 p-6 dark:border-gray-700">
            <h2 id="upload-section" className="text-xl font-semibold mb-4 flex items-center gap-2">
              📷 Upload Damage Photo
            </h2>
            <input 
              id="image-upload"
              type="file" 
              accept="image/jpeg,image/png,image/webp" 
              onChange={handleImageUpload}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 mb-4"
              aria-describedby="upload-help upload-error"
              aria-label="Upload damage photo for AI analysis"
            />
            <div id="upload-help" className="sr-only">
              Upload a photo of water damage. Accepted formats: JPEG, PNG, WebP. Maximum size: 10MB.
            </div>
            {validationError && (
              <div 
                id="upload-error" 
                className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800"
                role="alert"
                aria-live="polite"
              >
                <p className="text-red-700 dark:text-red-400 text-sm font-medium">
                  ❌ {validationError.message}
                </p>
              </div>
            )}
            {imagePreview && (
              <div className="space-y-4">
                <img 
                  src={imagePreview} 
                  alt="Preview of uploaded damage photo" 
                  className="w-full h-64 object-cover rounded-lg border"
                />
                <button 
                  onClick={assessDamage} 
                  disabled={loading || validationError !== null}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  aria-describedby="assess-help"
                  aria-label={loading ? "Analyzing image with AI" : "Start damage assessment"}
                >
                  {loading ? "🔍 Analyzing with AI..." : "🚀 Assess Damage"}
                </button>
                <div id="assess-help" className="sr-only">
                  {loading ? "Assessment in progress. Please wait." : "Click to analyze the uploaded image for water damage using AI."}
                </div>
              </div>
            )}
          </div>

          {/* Knowledge Base Search */}
          <div className="rounded-3xl border border-gray-200 p-6 dark:border-gray-700">
            <h2 id="search-section" className="text-xl font-semibold mb-4 flex items-center gap-2">
              📚 Search Knowledge Base
            </h2>
            <div className="flex gap-2 mb-4">
              <label htmlFor="search-input" className="sr-only">
                Search knowledge base
              </label>
              <input
                id="search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search IICRC standards, procedures..."
                className="flex-1 p-3 border rounded-lg dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    searchKnowledgeBase();
                  }
                }}
                aria-describedby="search-help"
                aria-label="Search industry standards and procedures"
              />
              <button
                onClick={searchKnowledgeBase}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label="Search knowledge base"
                disabled={!searchQuery.trim()}
              >
                🔍
              </button>
            </div>
            <div id="search-help" className="sr-only">
              Search for IICRC standards, water damage procedures, and industry best practices. Press Enter or click search button to search.
            </div>
            
            {searchResults && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.success ? (
                  <>
                    <p className="text-sm text-gray-600 dark:text-gray-400" aria-live="polite">
                      Found {searchResults.total_results} results for "{searchResults.query}"
                    </p>
                    <div role="list" aria-label="Search results">
                      {searchResults.results.map((result, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm" role="listitem">
                          <div className="font-medium">{result.metadata?.title || `Document ${idx + 1}`}</div>
                          <div className="text-gray-600 dark:text-gray-400 mt-1">
                            {result.text?.substring(0, 100)}...
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div 
                    className="p-3 bg-red-50 border border-red-200 rounded-lg dark:bg-red-900/20 dark:border-red-800"
                    role="alert"
                    aria-live="polite"
                  >
                    <p className="text-red-700 dark:text-red-400 text-sm font-medium">
                      ❌ Search Error: {searchResults.error}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Assessment Results */}
        <AIErrorBoundary onRetry={handleRetry}>
        {assessment && (
          <div 
            className="w-full rounded-3xl border border-gray-200 p-6 dark:border-gray-700"
            role="region"
            aria-labelledby="results-heading"
          >
            {assessment.success ? (
              <div className="space-y-6">
                <h2 id="results-heading" className="text-2xl font-semibold flex items-center gap-2">
                  📋 Assessment Results
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2 mb-2">
                        🤖 AI Vision Analysis
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        {assessment.vision_analysis}
                      </p>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-green-700 dark:text-green-400 flex items-center gap-2 mb-2">
                        📖 Industry Sources Applied
                      </h3>
                      <div className="space-y-2">
                        {assessment.industry_sources.length > 0 ? (
                          <div role="list" aria-label="Industry sources used">
                            {assessment.industry_sources.map((source, idx) => (
                              <div key={idx} className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm" role="listitem">
                                <div className="font-medium">
                                  {source.metadata?.title || `Reference ${idx + 1}`}
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">
                                  Relevance: {Math.round((source.score || 0.8) * 100)}%
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 italic">No specific industry sources matched</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-purple-700 dark:text-purple-400 flex items-center gap-2 mb-2">
                      🎯 Professional Assessment
                    </h3>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {assessment.enhanced_assessment}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">Confidence Score:</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-32 bg-gray-200 rounded-full h-2 dark:bg-gray-700"
                        role="progressbar"
                        aria-valuenow={Math.round(assessment.confidence_score * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`Assessment confidence: ${Math.round(assessment.confidence_score * 100)} percent`}
                      >
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${assessment.confidence_score * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold" aria-hidden="true">
                        {Math.round(assessment.confidence_score * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    <time dateTime={assessment.timestamp}>
                      {new Date(assessment.timestamp).toLocaleString()}
                    </time>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8" role="alert" aria-live="polite">
                <div className="text-red-600 text-lg font-medium mb-2">
                  ❌ Assessment Failed
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {assessment.error}: {assessment.details}
                </p>
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  aria-label="Retry damage assessment"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}
        </AIErrorBoundary>
        </div>
      </main>
    </>
  );
}