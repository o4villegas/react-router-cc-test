/**
 * Performance-oriented caching system for Cloudflare Workers
 * Implements intelligent caching strategies for AI responses and RAG results
 */

import { type AppConfig } from "./config";

// Cache key generation utilities
export function generateCacheKey(type: 'vision' | 'rag' | 'assessment', data: any): string {
  const hash = simpleHash(JSON.stringify(data));
  return `${type}_${hash}`;
}

// Simple hash function for cache keys
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Cache interface for different storage mechanisms
export interface CacheProvider {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// In-memory cache implementation for Workers
class MemoryCache implements CacheProvider {
  private cache = new Map<string, { value: any; expires: number }>();
  private defaultTTL: number;

  constructor(defaultTTL: number = 300000) { // 5 minutes default
    this.defaultTTL = defaultTTL;
  }

  async get(key: string): Promise<any | null> {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    const expires = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { value, expires });

    // Clean up expired entries periodically
    if (this.cache.size % 50 === 0) {
      this.cleanup();
    }
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expires) {
        this.cache.delete(key);
      }
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Cache service with intelligent strategies
export class CacheService {
  private provider: CacheProvider;
  private config: AppConfig;
  private hitCount = 0;
  private missCount = 0;

  constructor(config: AppConfig, provider?: CacheProvider) {
    this.config = config;
    this.provider = provider || new MemoryCache(config.performance.cache_ttl);
  }

  // Cache vision analysis results
  async cacheVisionResult(imageHash: string, result: any): Promise<void> {
    if (!this.config.performance.enable_caching) return;

    const key = generateCacheKey('vision', { imageHash });
    const ttl = this.config.performance.cache_ttl;
    
    await this.provider.set(key, {
      result,
      timestamp: Date.now(),
      type: 'vision'
    }, ttl);
  }

  async getCachedVisionResult(imageHash: string): Promise<any | null> {
    if (!this.config.performance.enable_caching) return null;

    const key = generateCacheKey('vision', { imageHash });
    const cached = await this.provider.get(key);
    
    if (cached) {
      this.hitCount++;
      return cached.result;
    }
    
    this.missCount++;
    return null;
  }

  // Cache RAG search results
  async cacheRAGResult(query: string, result: any): Promise<void> {
    if (!this.config.performance.enable_caching) return;

    const key = generateCacheKey('rag', { query: query.toLowerCase().trim() });
    const ttl = this.config.performance.cache_ttl * 2; // RAG results can be cached longer
    
    await this.provider.set(key, {
      result,
      timestamp: Date.now(),
      type: 'rag',
      query
    }, ttl);
  }

  async getCachedRAGResult(query: string): Promise<any | null> {
    if (!this.config.performance.enable_caching) return null;

    const key = generateCacheKey('rag', { query: query.toLowerCase().trim() });
    const cached = await this.provider.get(key);
    
    if (cached) {
      this.hitCount++;
      return cached.result;
    }
    
    this.missCount++;
    return null;
  }

  // Cache complete assessment results
  async cacheAssessmentResult(imageHash: string, visionResult: any, ragResult: any, assessment: any): Promise<void> {
    if (!this.config.performance.enable_caching) return;

    const key = generateCacheKey('assessment', { imageHash });
    const ttl = this.config.performance.cache_ttl;
    
    await this.provider.set(key, {
      visionResult,
      ragResult,
      assessment,
      timestamp: Date.now(),
      type: 'assessment'
    }, ttl);
  }

  async getCachedAssessmentResult(imageHash: string): Promise<any | null> {
    if (!this.config.performance.enable_caching) return null;

    const key = generateCacheKey('assessment', { imageHash });
    const cached = await this.provider.get(key);
    
    if (cached) {
      this.hitCount++;
      return cached;
    }
    
    this.missCount++;
    return null;
  }

  // Cache statistics and management
  getCacheStats(): { hitRate: number; hits: number; misses: number; total: number } {
    const total = this.hitCount + this.missCount;
    return {
      hitRate: total > 0 ? (this.hitCount / total) * 100 : 0,
      hits: this.hitCount,
      misses: this.missCount,
      total
    };
  }

  async clearCache(): Promise<void> {
    await this.provider.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  // Image hash generation for caching
  generateImageHash(buffer: Uint8Array): string {
    // Simple hash based on file size and first/last bytes
    const size = buffer.length;
    const firstBytes = Array.from(buffer.slice(0, 16)).join(',');
    const lastBytes = Array.from(buffer.slice(-16)).join(',');
    return simpleHash(`${size}_${firstBytes}_${lastBytes}`);
  }
}

// Performance monitoring utilities
export class PerformanceMonitor {
  private metrics = new Map<string, number[]>();

  startTimer(operation: string): () => number {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
      return duration;
    };
  }

  recordMetric(operation: string, value: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    
    const values = this.metrics.get(operation)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }
  }

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

  reset(): void {
    this.metrics.clear();
  }
}

// Image optimization utilities
export class ImageOptimizer {
  private config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  // Optimize image buffer for processing
  optimizeImageBuffer(buffer: Uint8Array, mimeType: string): { buffer: Uint8Array; optimized: boolean } {
    // For now, return original buffer
    // In the future, we could implement actual image compression here
    return { buffer, optimized: false };
  }

  // Check if image needs optimization
  shouldOptimize(buffer: Uint8Array, mimeType: string): boolean {
    const sizeThreshold = 5 * 1024 * 1024; // 5MB
    return buffer.length > sizeThreshold;
  }

  // Get optimal image format recommendation
  getOptimalFormat(originalFormat: string, imageSize: number): string {
    // For large images, suggest WebP for better compression
    if (imageSize > 2 * 1024 * 1024 && originalFormat !== 'image/webp') {
      return 'image/webp';
    }
    return originalFormat;
  }
}

// Export singleton instances
export function createCacheService(config: AppConfig): CacheService {
  return new CacheService(config);
}

export function createPerformanceMonitor(): PerformanceMonitor {
  return new PerformanceMonitor();
}

export function createImageOptimizer(config: AppConfig): ImageOptimizer {
  return new ImageOptimizer(config);
}