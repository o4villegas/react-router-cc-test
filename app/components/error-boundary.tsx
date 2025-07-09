import { Component, ReactNode } from "react";
import { logger } from "../utils/logger";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: string) => ReactNode;
  onError?: (error: Error, errorInfo: string) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const errorDetails = errorInfo.componentStack || error.stack || 'Unknown error';
    
    this.setState({
      error,
      errorInfo: errorDetails,
    });

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorDetails);
    }

    // Log error using logger utility
    logger.error('ErrorBoundary caught an error', { error, errorInfo }, 'ErrorBoundary');
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo || '');
      }

      // Default error UI
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-red-600 dark:text-red-400 text-xl">⚠️</span>
            <h3 className="text-red-800 dark:text-red-200 font-semibold">
              Something went wrong
            </h3>
          </div>
          
          <p className="text-red-700 dark:text-red-300 mb-4">
            An unexpected error occurred while processing your request. Please try again.
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
            
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200">
                  Show Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs bg-red-100 dark:bg-red-900/40 p-3 rounded overflow-x-auto text-red-800 dark:text-red-200">
                  {this.state.error.message}
                  {this.state.errorInfo && `\n\n${this.state.errorInfo}`}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to trigger error boundary
export function useErrorHandler() {
  return (error: Error, errorInfo?: string) => {
    // This will be caught by the nearest error boundary
    throw error;
  };
}

// Specific error boundary for AI operations
interface AIErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
}

export function AIErrorBoundary({ children, onRetry }: AIErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={(error, errorInfo) => (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-6 dark:border-orange-800 dark:bg-orange-900/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-orange-600 dark:text-orange-400 text-xl">🤖</span>
            <h3 className="text-orange-800 dark:text-orange-200 font-semibold">
              AI Service Error
            </h3>
          </div>
          
          <p className="text-orange-700 dark:text-orange-300 mb-4">
            The AI analysis service is temporarily unavailable. This could be due to:
          </p>
          
          <ul className="text-orange-700 dark:text-orange-300 mb-4 list-disc list-inside space-y-1">
            <li>High demand on AI services</li>
            <li>Temporary service maintenance</li>
            <li>Network connectivity issues</li>
            <li>Invalid image format or content</li>
          </ul>
          
          <div className="space-y-3">
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors mr-3"
              >
                Retry Analysis
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
          
          {import.meta.env.DEV && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-200">
                Show Technical Details (Development Only)
              </summary>
              <pre className="mt-2 text-xs bg-orange-100 dark:bg-orange-900/40 p-3 rounded overflow-x-auto text-orange-800 dark:text-orange-200">
                {error.message}
                {errorInfo && `\n\n${errorInfo}`}
              </pre>
            </details>
          )}
        </div>
      )}
      onError={(error, errorInfo) => {
        // Log AI-specific errors
        logger.aiError('AI service operation', { error, errorInfo }, 'AIErrorBoundary');
        
        // Could send to monitoring service in production
        // analytics.track('ai_error', { error: error.message, component: 'DamageAssessment' });
      }}
    >
      {children}
    </ErrorBoundary>
  );
}