import { useState } from "react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const assessDamage = async () => {
    if (!selectedImage) return;
    
    setLoading(true);
    setAssessment(null);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
        });
        
        const result = await response.json();
        setAssessment(result);
      };
      reader.readAsDataURL(selectedImage);
    } catch (error) {
      console.error('Assessment failed:', error);
      setAssessment({
        success: false,
        error: 'Network error',
        vision_analysis: '',
        industry_sources: [],
        enhanced_assessment: '',
        confidence_score: 0,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const searchKnowledgeBase = async () => {
    if (!searchQuery.trim()) return;
    
    try {
      const response = await fetch(`${searchEndpoint}?q=${encodeURIComponent(searchQuery)}`);
      const result = await response.json();
      setSearchResults(result);
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  return (
    <main className="flex items-center justify-center pt-16 pb-4">
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
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              📷 Upload Damage Photo
            </h2>
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleImageUpload}
              className="w-full p-3 border rounded-lg dark:bg-gray-800 mb-4"
            />
            {imagePreview && (
              <div className="space-y-4">
                <img 
                  src={imagePreview} 
                  alt="Preview" 
                  className="w-full h-64 object-cover rounded-lg border"
                />
                <button 
                  onClick={assessDamage} 
                  disabled={loading}
                  className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "🔍 Analyzing with AI..." : "🚀 Assess Damage"}
                </button>
              </div>
            )}
          </div>

          {/* Knowledge Base Search */}
          <div className="rounded-3xl border border-gray-200 p-6 dark:border-gray-700">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              📚 Search Knowledge Base
            </h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search IICRC standards, procedures..."
                className="flex-1 p-3 border rounded-lg dark:bg-gray-800"
                onKeyPress={(e) => e.key === 'Enter' && searchKnowledgeBase()}
              />
              <button
                onClick={searchKnowledgeBase}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                🔍
              </button>
            </div>
            
            {searchResults && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Found {searchResults.total_results} results
                </p>
                {searchResults.results.map((result, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                    <div className="font-medium">{result.metadata?.title || `Document ${idx + 1}`}</div>
                    <div className="text-gray-600 dark:text-gray-400 mt-1">
                      {result.text?.substring(0, 100)}...
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Assessment Results */}
        {assessment && (
          <div className="w-full rounded-3xl border border-gray-200 p-6 dark:border-gray-700">
            {assessment.success ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-semibold flex items-center gap-2">
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
                          assessment.industry_sources.map((source, idx) => (
                            <div key={idx} className="p-2 bg-green-50 dark:bg-green-900/20 rounded text-sm">
                              <div className="font-medium">
                                {source.metadata?.title || `Reference ${idx + 1}`}
                              </div>
                              <div className="text-gray-600 dark:text-gray-400">
                                Relevance: {Math.round((source.score || 0.8) * 100)}%
                              </div>
                            </div>
                          ))
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
                      <div className="w-32 bg-gray-200 rounded-full h-2 dark:bg-gray-700">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${assessment.confidence_score * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold">
                        {Math.round(assessment.confidence_score * 100)}%
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    {new Date(assessment.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-red-600 text-lg font-medium mb-2">
                  ❌ Assessment Failed
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  {assessment.error}: {assessment.details}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}