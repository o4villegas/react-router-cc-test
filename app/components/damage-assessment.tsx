import { useState, useCallback, useEffect, useRef } from "react";
import { AIErrorBoundary } from "./error-boundary";
import { logger } from "../utils/logger";
import { type ClientConfig } from "../utils/client-config";
import { 
  createImageCompressor, 
  createRequestBatcher, 
  createFrontendPerformanceMonitor, 
  createProgressiveLoader,
  createMemoryOptimizer,
  debounce
} from "../utils/performance";

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
  performance?: {
    total_time: number;
    cached: boolean;
  };
  cached?: boolean;
  cache_timestamp?: string;
}

interface SearchResult {
  success: boolean;
  query: string;
  results: any[];
  total_results: number;
  error?: string;
  details?: string;
  performance?: {
    total_time: number;
    cached: boolean;
  };
}

export function DamageAssessment({ 
  apiEndpoint, 
  searchEndpoint,
  config
}: { 
  apiEndpoint: string;
  searchEndpoint: string;
  config: ClientConfig;
}) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");
  const [validationError, setValidationError] = useState<ValidationError | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Performance utilities
  const imageCompressor = useRef(createImageCompressor(config));
  const requestBatcher = useRef(createRequestBatcher(config));
  const performanceMonitor = useRef(createFrontendPerformanceMonitor(config));
  const progressiveLoader = useRef(createProgressiveLoader());
  const memoryOptimizer = useRef(createMemoryOptimizer());

  // Performance state
  const [performanceStats, setPerformanceStats] = useState<any>(null);
  const [compressionStats, setCompressionStats] = useState<{ originalSize: number; compressedSize: number; compressed: boolean } | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      memoryOptimizer.current.cleanup();
    };
  }, []);

  const validateImage = (file: File): Promise<ValidationError | null> => {
    return new Promise((resolve) => {
      // Check file size
      if (file.size > config.image.max_file_size) {
        resolve({
          type: 'size',
          message: `File size must be less than ${config.image.max_file_size / (1024 * 1024)}MB. Current size: ${(file.size / (1024 * 1024)).toFixed(1)}MB`
        });
        return;
      }

      // Check file type
      if (!config.image.allowed_types.includes(file.type)) {
        resolve({
          type: 'type',
          message: `Only ${config.image.allowed_types.join(', ')} images are allowed. Current type: ${file.type}`
        });
        return;
      }

      // Additional file extension validation
      const fileName = file.name.toLowerCase();
      const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
      const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
      
      if (!hasValidExtension) {
        resolve({
          type: 'type',
          message: `File must have a valid image extension (.jpg, .jpeg, .png, .webp). Current file: ${file.name}`
        });
        return;
      }

      // Validate file name doesn't contain suspicious characters
      const suspiciousChars = /[<>:"/\\|?*\x00-\x1f]/;
      if (suspiciousChars.test(file.name)) {
        resolve({
          type: 'type',
          message: 'File name contains invalid characters'
        });
        return;
      }

      // Validate filename length
      if (file.name.length > config.security.max_filename_length) {
        resolve({
          type: 'type',
          message: `Filename too long. Maximum length: ${config.security.max_filename_length} characters`
        });
        return;
      }

      // Check for blocked extensions
      const hasBlockedExtension = config.security.blocked_extensions.some(ext => 
        fileName.endsWith(ext.toLowerCase())
      );
      if (hasBlockedExtension) {
        resolve({
          type: 'type',
          message: 'File extension is not allowed for security reasons'
        });
        return;
      }

      // Validate image file header (magic bytes) before processing
      const reader = new FileReader();
      reader.onload = (e) => {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          resolve({
            type: 'corrupt',
            message: 'Unable to read image file data'
          });
          return;
        }

        const bytes = new Uint8Array(arrayBuffer, 0, Math.min(12, arrayBuffer.byteLength));
        
        // Validate image signature
        let isValidSignature = false;
        if (file.type === 'image/jpeg' && bytes.length >= 3) {
          isValidSignature = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
        } else if (file.type === 'image/png' && bytes.length >= 8) {
          isValidSignature = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
                            bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A;
        } else if (file.type === 'image/webp' && bytes.length >= 12) {
          isValidSignature = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
                            bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
        }

        if (!isValidSignature) {
          resolve({
            type: 'corrupt',
            message: `File signature does not match declared type ${file.type}`
          });
          return;
        }

        // Check image dimensions
        const img = new Image();
        const url = URL.createObjectURL(file);
        
        img.onload = () => {
          URL.revokeObjectURL(url);
          
          if (img.width > config.image.max_dimensions.width || img.height > config.image.max_dimensions.height) {
            resolve({
              type: 'dimensions',
              message: `Image dimensions must be less than ${config.image.max_dimensions.width}x${config.image.max_dimensions.height}px. Current: ${img.width}x${img.height}px`
            });
            return;
          }
          
          if (img.width < config.image.min_dimensions.width || img.height < config.image.min_dimensions.height) {
            resolve({
              type: 'dimensions',
              message: `Image dimensions must be at least ${config.image.min_dimensions.width}x${config.image.min_dimensions.height}px. Current: ${img.width}x${img.height}px`
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
      };

      reader.onerror = () => {
        resolve({
          type: 'corrupt',
          message: 'Unable to read image file'
        });
      };

      // Read first 12 bytes for signature validation
      reader.readAsArrayBuffer(file.slice(0, 12));
    });
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const endTimer = performanceMonitor.current.startTimer('image_upload_processing');
    
    const file = event.target.files?.[0];
    setValidationError(null);
    setSelectedImage(null);
    setImagePreview("");
    setCompressionStats(null);
    
    if (!file) return;
    
    try {
      const validationError = await validateImage(file);
      if (validationError) {
        setValidationError(validationError);
        return;
      }
      
      // Check if compression would be beneficial
      let finalFile: File | Blob = file;
      if (imageCompressor.current.shouldCompress(file)) {
        const compressionResult = await imageCompressor.current.compressImage(file);
        finalFile = new File([compressionResult.file], file.name, { type: compressionResult.file.type });
        
        setCompressionStats({
          originalSize: compressionResult.originalSize,
          compressedSize: compressionResult.compressedSize,
          compressed: compressionResult.compressed
        });
        
        logger.info('Image compression completed', {
          original_size: compressionResult.originalSize,
          compressed_size: compressionResult.compressedSize,
          compression_ratio: compressionResult.compressedSize / compressionResult.originalSize,
          compressed: compressionResult.compressed
        });
      }
      
      setSelectedImage(finalFile as File);
      
      // Use memory optimizer for object URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setImagePreview(dataUrl);
      };
      reader.readAsDataURL(finalFile);
      
      endTimer();
    } catch (error) {
      endTimer();
      logger.error('Image upload processing failed', error);
      setValidationError({
        type: 'corrupt',
        message: 'Failed to process image. Please try again.'
      });
    }
  };

  const assessDamage = useCallback(async () => {
    if (!selectedImage) return;
    
    const endTimer = performanceMonitor.current.startTimer('damage_assessment_request');
    progressiveLoader.current.setLoading('assessment', true);
    setLoading(true);
    setAssessment(null);
    setLoadingProgress(0);
    setLoadingStage("Preparing image...");
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64 = e.target?.result as string;
          setLoadingProgress(15);
          setLoadingStage("Uploading image...");
          
          // Use request batching to prevent duplicate requests
          const requestKey = `assess_${selectedImage.name}_${selectedImage.size}`;
          
          const result = await requestBatcher.current.batchRequest(requestKey, async () => {
            // Create abort controller for timeout
            const controller = new AbortController();
            const timeoutId = memoryOptimizer.current.setTimeout(() => controller.abort(), config.api.timeout.damage_assessment);
            
            // Start progress simulation for long-running process
            setLoadingProgress(25);
            setLoadingStage("Analyzing image with AI...");
            
            // Simulate progress during AI processing
            const progressInterval = setInterval(() => {
              setLoadingProgress(prev => {
                if (prev < 85) {
                  const increment = Math.random() * 5 + 2; // Random 2-7% increments
                  return Math.min(prev + increment, 85);
                }
                return prev;
              });
            }, 2000); // Update every 2 seconds
            
            // Update stages during processing
            setTimeout(() => setLoadingStage("Processing vision analysis..."), 5000);
            setTimeout(() => setLoadingStage("Searching knowledge base..."), 12000);
            setTimeout(() => setLoadingStage("Generating assessment..."), 18000);
            
            const response = await fetch(apiEndpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: base64 }),
              signal: controller.signal
            });
            
            clearInterval(progressInterval);
            setLoadingProgress(95);
            setLoadingStage("Finalizing results...");
            
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            return await response.json() as AssessmentResult;
          });
          
          if (!result.success && result.error) {
            throw new Error(`AI Assessment Error: ${result.error} - ${result.details || ''}`);
          }
          
          // Store performance stats if available
          if (result.performance) {
            setPerformanceStats(result.performance);
          }
          
          setLoadingProgress(100);
          setLoadingStage("Complete!");
          setAssessment(result);
          setRetryCount(0); // Reset retry count on success
          endTimer();
        } catch (error) {
          endTimer();
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
            } else if (error.message.includes('Invalid image file')) {
              errorMessage = 'Invalid image';
              errorDetails = 'The uploaded image file is corrupted or not a valid image format.';
            } else if (error.message.includes('Image validation failed')) {
              errorMessage = 'Image validation error';
              errorDetails = 'The image file does not match its declared format or contains invalid data.';
            } else if (error.message.includes('Image type mismatch')) {
              errorMessage = 'Image format error';
              errorDetails = 'The actual image format does not match the file extension.';
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
        endTimer();
        throw new Error('Failed to read image file. The file may be corrupted.');
      };
      
      reader.readAsDataURL(selectedImage);
    } catch (error) {
      endTimer();
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
      progressiveLoader.current.setLoading('assessment', false);
      setLoading(false);
      // Reset progress after a brief delay to show completion
      setTimeout(() => {
        setLoadingProgress(0);
        setLoadingStage("");
      }, 1000);
    }
  }, [selectedImage, apiEndpoint, config.api.timeout.damage_assessment]);

  const searchKnowledgeBase = useCallback(async () => {
    if (!searchQuery.trim()) return;
    
    const endTimer = performanceMonitor.current.startTimer('knowledge_search_request');
    progressiveLoader.current.setLoading('search', true);
    
    try {
      // Use request batching for duplicate queries
      const requestKey = `search_${searchQuery.trim().toLowerCase()}`;
      
      const result = await requestBatcher.current.batchRequest(requestKey, async () => {
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = memoryOptimizer.current.setTimeout(() => controller.abort(), config.api.timeout.knowledge_search);
        
        const response = await fetch(`${searchEndpoint}?q=${encodeURIComponent(searchQuery)}`, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json() as SearchResult;
      });
      
      if (!result.success && result.error) {
        throw new Error(`Search Error: ${result.error}${result.details ? ` - ${result.details}` : ''}`);
      }
      
      setSearchResults(result);
      endTimer();
    } catch (error) {
      endTimer();
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
    } finally {
      progressiveLoader.current.setLoading('search', false);
    }
  }, [searchQuery, searchEndpoint, config.api.timeout.knowledge_search]);

  // Debounced search function for better performance
  const debouncedSearch = useCallback(
    debounce(() => {
      searchKnowledgeBase();
    }, 500),
    [searchKnowledgeBase]
  );

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
        <header className="flex flex-col items-center gap-6">
          <h1 className="text-6xl font-bold text-center aqua-inspect-title">
            <span>Aqua</span>
            <span className="aqua-inspect-accent"> Inspect</span>
            <span> Vision</span>
          </h1>
          <p className="text-center max-w-2xl text-lg" style={{ color: '#a0a0a0' }}>
            Professional AI-powered water damage assessment with computer vision and industry expertise
          </p>
        </header>

        {/* Step Indicators */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-semibold">1</div>
              <span className="ml-2 text-white font-medium">Upload</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-600"></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${assessment ? 'bg-orange-500 text-white' : 'bg-gray-600 text-gray-400'}`}>2</div>
              <span className={`ml-2 font-medium ${assessment ? 'text-white' : 'text-gray-400'}`}>Analysis</span>
            </div>
            <div className="w-8 h-0.5 bg-gray-600"></div>
            <div className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${assessment ? 'bg-orange-500 text-white' : 'bg-gray-600 text-gray-400'}`}>3</div>
              <span className={`ml-2 font-medium ${assessment ? 'text-white' : 'text-gray-400'}`}>Chat</span>
            </div>
          </div>
        </div>

        {/* Step-by-Step Flow */}
        <div className="w-full max-w-4xl mx-auto space-y-8 px-4">
          
          {/* Step 1: Image Upload - Always Visible */}
          <div className="aqua-card rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-semibold">1</div>
              <h2 className="text-2xl font-semibold text-white">Upload Damage Photo</h2>
            </div>
            <input 
              id="image-upload"
              type="file" 
              accept={config.image.allowed_types.join(',')} 
              onChange={handleImageUpload}
              className="w-full mb-4 p-3 rounded-lg border transition-all duration-300"
              style={{ 
                backgroundColor: '#1a1a1a', 
                borderColor: '#333333', 
                color: '#ffffff' 
              }}
              aria-describedby="upload-help upload-error"
              aria-label="Upload damage photo for AI analysis"
            />
            <div id="upload-help" className="sr-only">
              Upload a photo of water damage. Accepted formats: {config.image.allowed_types.join(', ')}. Maximum size: {Math.round(config.image.max_file_size / (1024 * 1024))}MB.
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
                
                {compressionStats && compressionStats.compressed && (
                  <div className="p-2 bg-green-50 border border-green-200 rounded dark:bg-green-900/20 dark:border-green-800">
                    <p className="text-green-700 dark:text-green-400 text-xs">
                      ✅ Image optimized: {(compressionStats.originalSize / 1024 / 1024).toFixed(1)}MB → {(compressionStats.compressedSize / 1024 / 1024).toFixed(1)}MB 
                      ({Math.round((1 - compressionStats.compressedSize / compressionStats.originalSize) * 100)}% reduction)
                    </p>
                  </div>
                )}
                
                <button 
                  onClick={assessDamage} 
                  disabled={loading || validationError !== null}
                  className="aqua-button w-full px-6 py-3 rounded-xl font-semibold transition-all duration-300 disabled:opacity-50"
                  aria-describedby="assess-help"
                  aria-label={loading ? "Analyzing image with AI" : "Start damage assessment"}
                >
                  {loading ? "🔍 Analyzing with AI..." : "🚀 Assess Damage"}
                </button>
                
                {/* Progress Bar */}
                {loading && (
                  <div className="w-full space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="aqua-inspect-accent font-medium">{loadingStage}</span>
                      <span className="text-white font-semibold">{Math.round(loadingProgress)}%</span>
                    </div>
                    <div className="aqua-progress-bg rounded-xl overflow-hidden h-3">
                      <div 
                        className="aqua-progress-fill h-full rounded-xl transition-all duration-500"
                        style={{ width: `${loadingProgress}%` }}
                        role="progressbar"
                        aria-valuenow={loadingProgress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Assessment progress"
                      ></div>
                    </div>
                    <div className="text-xs text-center" style={{ color: '#666666' }}>
                      AI processing typically takes 20-30 seconds
                    </div>
                  </div>
                )}
                
                <div id="assess-help" className="sr-only">
                  {loading ? "Assessment in progress. Please wait." : "Click to analyze the uploaded image for water damage using AI."}
                </div>
              </div>
            )}
          </div>

          {/* Step 2: Assessment Results - Only visible after assessment */}
          {assessment && (
            <div className="aqua-card rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-semibold">2</div>
                <h2 className="text-2xl font-semibold text-white">Assessment Results</h2>
              </div>
              {assessment.success ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium text-white flex items-center gap-2 mb-3">
                      🤖 AI Vision Analysis
                    </h3>
                    <p className="text-gray-300 p-4 bg-gray-800 rounded-lg">
                      {assessment.vision_analysis}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-white flex items-center gap-2 mb-3">
                      📖 Enhanced Assessment
                    </h3>
                    <div className="text-gray-300 p-4 bg-gray-800 rounded-lg">
                      {assessment.enhanced_assessment}
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-sm text-gray-400">
                    <span>Confidence: {Math.round(assessment.confidence_score * 100)}%</span>
                    {assessment.performance && (
                      <span>Processing time: {(assessment.performance.total_time / 1000).toFixed(1)}s</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
                  <p className="text-red-400 font-medium">❌ Assessment Error: {assessment.error}</p>
                  {assessment.details && (
                    <p className="text-red-300 text-sm mt-2">{assessment.details}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Chat Interface - Only visible after assessment */}
          {assessment && assessment.success && (
            <div className="aqua-card rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center text-sm font-semibold">3</div>
                <h2 className="text-2xl font-semibold text-white">Ask Questions</h2>
              </div>
              
              <div className="space-y-4">
                <p className="text-gray-300">
                  Have questions about your assessment? Ask me anything about water damage restoration, IICRC standards, or next steps.
                </p>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Ask about remediation steps, equipment needed, timeline..."
                    className="flex-1 p-3 rounded-lg border transition-all duration-300"
                    style={{ 
                      backgroundColor: '#1a1a1a', 
                      borderColor: '#333333', 
                      color: '#ffffff' 
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        searchKnowledgeBase();
                      }
                    }}
                  />
                  <button
                    onClick={searchKnowledgeBase}
                    className="aqua-button px-6 py-3 rounded-lg transition-all duration-300"
                    disabled={!searchQuery.trim() || progressiveLoader.current.isLoading('search')}
                  >
                    {progressiveLoader.current.isLoading('search') ? '⏳' : '💬'}
                  </button>
                </div>
                
                {searchResults && (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {searchResults.success ? (
                      <div className="space-y-3">
                        <p className="text-gray-400 text-sm">
                          Found {searchResults.total_results} relevant resources:
                        </p>
                        {searchResults.results.map((result, idx) => (
                          <div key={idx} className="p-4 bg-gray-800 rounded-lg">
                            <div className="font-medium text-white">{result.metadata?.title || `Resource ${idx + 1}`}</div>
                            <div className="text-gray-300 mt-2 text-sm">
                              {result.text?.substring(0, 200)}...
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 bg-red-900/20 border border-red-800 rounded-lg">
                        <p className="text-red-400 font-medium">❌ Search Error: {searchResults.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        </div>
      </main>
    </>
  );
}