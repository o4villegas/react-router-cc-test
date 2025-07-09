/**
 * Frontend Performance Optimization Utilities
 * Provides client-side performance enhancements and monitoring
 */

import { type ClientConfig } from "./client-config";

// Image compression utilities for frontend
export class ImageCompressor {
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  // Compress image before upload
  async compressImage(file: File, quality: number = 0.8): Promise<{ file: Blob; compressed: boolean; originalSize: number; compressedSize: number }> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate optimal dimensions
        const { width, height } = this.calculateOptimalDimensions(img.width, img.height);
        
        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const compressed = blob.size < file.size;
            resolve({
              file: blob,
              compressed,
              originalSize: file.size,
              compressedSize: blob.size
            });
          } else {
            // Fallback to original file
            resolve({
              file: file,
              compressed: false,
              originalSize: file.size,
              compressedSize: file.size
            });
          }
        }, this.getOptimalMimeType(file.type), quality);
      };

      img.onerror = () => {
        // Fallback to original file
        resolve({
          file: file,
          compressed: false,
          originalSize: file.size,
          compressedSize: file.size
        });
      };

      img.src = URL.createObjectURL(file);
    });
  }

  // Calculate optimal dimensions while maintaining aspect ratio
  private calculateOptimalDimensions(originalWidth: number, originalHeight: number): { width: number; height: number } {
    const maxWidth = this.config.image.max_dimensions.width;
    const maxHeight = this.config.image.max_dimensions.height;

    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;

    if (originalWidth > originalHeight) {
      return {
        width: Math.min(maxWidth, originalWidth),
        height: Math.min(maxWidth / aspectRatio, originalHeight)
      };
    } else {
      return {
        width: Math.min(maxHeight * aspectRatio, originalWidth),
        height: Math.min(maxHeight, originalHeight)
      };
    }
  }

  // Get optimal MIME type for compression
  private getOptimalMimeType(originalType: string): string {
    // For better compression, prefer WebP when available
    if (this.supportsWebP() && originalType !== 'image/webp') {
      return 'image/webp';
    }
    return originalType;
  }

  // Check WebP support
  private supportsWebP(): boolean {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
  }

  // Determine if compression is beneficial
  shouldCompress(file: File): boolean {
    const compressionThreshold = this.config.image.max_file_size * 0.5; // Compress if > 50% of max size
    return file.size > compressionThreshold;
  }
}

// Request batching utility
export class RequestBatcher {
  private pendingRequests = new Map<string, Promise<any>>();
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  // Deduplicate identical requests
  async batchRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key) as Promise<T>;
    }

    const request = requestFn().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, request);
    return request;
  }

  // Clear all pending requests
  clearPending(): void {
    this.pendingRequests.clear();
  }

  // Get pending request count
  getPendingCount(): number {
    return this.pendingRequests.size;
  }
}

// Performance monitoring for frontend
export class FrontendPerformanceMonitor {
  private metrics = new Map<string, number[]>();
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = config;
  }

  // Start timing an operation
  startTimer(operation: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
      return duration;
    };
  }

  // Record a performance metric
  recordMetric(operation: string, value: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const values = this.metrics.get(operation)!;
    values.push(value);
    
    // Keep only last 50 measurements for memory efficiency
    if (values.length > 50) {
      values.shift();
    }

    // Log slow operations in debug mode
    if (this.config.ui.enable_debug && value > 5000) { // > 5 seconds
      console.warn(`Slow operation detected: ${operation} took ${value.toFixed(2)}ms`);
    }
  }

  // Get metrics for an operation
  getMetrics(operation: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(operation);
    if (!values || values.length === 0) return null;

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  // Get all recorded metrics
  getAllMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
    const result: Record<string, { avg: number; min: number; max: number; count: number }> = {};
    
    for (const [operation, values] of this.metrics.entries()) {
      if (values.length > 0) {
        result[operation] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          count: values.length
        };
      }
    }
    
    return result;
  }

  // Export metrics for analysis
  exportMetrics(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: this.getAllMetrics(),
      config: {
        app_name: this.config.ui.app_name,
        version: this.config.ui.version
      }
    }, null, 2);
  }

  // Reset all metrics
  reset(): void {
    this.metrics.clear();
  }
}

// Progressive loading utility
export class ProgressiveLoader {
  private loadingStates = new Map<string, boolean>();

  // Track loading state
  setLoading(key: string, loading: boolean): void {
    this.loadingStates.set(key, loading);
  }

  // Check if any operations are loading
  isAnyLoading(): boolean {
    return Array.from(this.loadingStates.values()).some(loading => loading);
  }

  // Get loading state for specific operation
  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }

  // Clear all loading states
  clearAll(): void {
    this.loadingStates.clear();
  }

  // Get count of active loading operations
  getLoadingCount(): number {
    return Array.from(this.loadingStates.values()).filter(loading => loading).length;
  }
}

// Memory optimization utilities
export class MemoryOptimizer {
  private objectURLs = new Set<string>();
  private timers = new Set<number>();

  // Track object URLs for cleanup
  createObjectURL(blob: Blob): string {
    const url = URL.createObjectURL(blob);
    this.objectURLs.add(url);
    return url;
  }

  // Track timers for cleanup
  setTimeout(callback: () => void, delay: number): number {
    const id = window.setTimeout(() => {
      callback();
      this.timers.delete(id);
    }, delay);
    this.timers.add(id);
    return id;
  }

  // Clean up all tracked resources
  cleanup(): void {
    // Revoke object URLs
    for (const url of this.objectURLs) {
      URL.revokeObjectURL(url);
    }
    this.objectURLs.clear();

    // Clear timers
    for (const id of this.timers) {
      clearTimeout(id);
    }
    this.timers.clear();
  }

  // Get resource counts
  getResourceCounts(): { objectURLs: number; timers: number } {
    return {
      objectURLs: this.objectURLs.size,
      timers: this.timers.size
    };
  }
}

// Export utility functions
export function createImageCompressor(config: ClientConfig): ImageCompressor {
  return new ImageCompressor(config);
}

export function createRequestBatcher(config: ClientConfig): RequestBatcher {
  return new RequestBatcher(config);
}

export function createFrontendPerformanceMonitor(config: ClientConfig): FrontendPerformanceMonitor {
  return new FrontendPerformanceMonitor(config);
}

export function createProgressiveLoader(): ProgressiveLoader {
  return new ProgressiveLoader();
}

export function createMemoryOptimizer(): MemoryOptimizer {
  return new MemoryOptimizer();
}

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: number;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => func(...args), delay);
  };
}

// Throttle utility for performance
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      func(...args);
    }
  };
}