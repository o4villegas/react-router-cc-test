import type { MiddlewareHandler } from 'hono';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (c: any) => string;
  skipIf?: (c: any) => boolean;
  onLimitReached?: (c: any) => Response;
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

// In-memory store for rate limiting (use KV/Durable Objects in production)
const rateLimitStore: RateLimitStore = {};

export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const {
    windowMs,
    maxRequests,
    keyGenerator = (c) => c.req.header('cf-connecting-ip') || 'unknown',
    skipIf = () => false,
    onLimitReached
  } = options;

  return async (c, next) => {
    // Skip rate limiting if condition is met
    if (skipIf(c)) {
      return next();
    }

    const key = keyGenerator(c);
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    Object.keys(rateLimitStore).forEach(storeKey => {
      if (rateLimitStore[storeKey].resetTime < windowStart) {
        delete rateLimitStore[storeKey];
      }
    });

    // Get or create rate limit entry
    let entry = rateLimitStore[key];
    if (!entry || entry.resetTime < windowStart) {
      entry = rateLimitStore[key] = {
        count: 0,
        resetTime: now + windowMs
      };
    }

    // Increment request count
    entry.count++;

    // Check if limit exceeded
    if (entry.count > maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      
      if (onLimitReached) {
        return onLimitReached(c);
      }

      return c.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${retryAfter} seconds.`,
          retryAfter
        },
        429,
        {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': entry.resetTime.toString()
        }
      );
    }

    // Add rate limit headers
    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', (maxRequests - entry.count).toString());
    c.header('X-RateLimit-Reset', entry.resetTime.toString());

    return next();
  };
}

// Predefined rate limiters for different endpoints
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // 100 requests per 15 minutes
});

export const aiRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 20, // 20 AI requests per 5 minutes
  onLimitReached: (c) => c.json({
    error: 'AI service rate limit exceeded',
    message: 'Too many AI requests. Please wait before trying again.',
    code: 'AI_RATE_LIMIT_EXCEEDED'
  }, 429)
});

export const uploadRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  maxRequests: 50, // 50 uploads per 10 minutes
});