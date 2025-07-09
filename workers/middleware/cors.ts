import type { MiddlewareHandler } from 'hono';

interface CORSOptions {
  origin?: string | string[] | ((origin: string) => boolean);
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
  optionsSuccessStatus?: number;
}

export function cors(options: CORSOptions = {}): MiddlewareHandler {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400, // 24 hours
    optionsSuccessStatus = 204
  } = options;

  return async (c, next) => {
    const requestOrigin = c.req.header('Origin');
    
    // Determine if origin is allowed
    let allowedOrigin = '*';
    if (typeof origin === 'string') {
      allowedOrigin = origin;
    } else if (Array.isArray(origin)) {
      if (requestOrigin && origin.includes(requestOrigin)) {
        allowedOrigin = requestOrigin;
      } else {
        allowedOrigin = 'null'; // Reject
      }
    } else if (typeof origin === 'function') {
      if (requestOrigin && origin(requestOrigin)) {
        allowedOrigin = requestOrigin;
      } else {
        allowedOrigin = 'null'; // Reject
      }
    }

    // Set CORS headers
    c.header('Access-Control-Allow-Origin', allowedOrigin);
    
    if (credentials) {
      c.header('Access-Control-Allow-Credentials', 'true');
    }

    if (methods.length > 0) {
      c.header('Access-Control-Allow-Methods', methods.join(', '));
    }

    if (allowedHeaders.length > 0) {
      c.header('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    }

    if (exposedHeaders.length > 0) {
      c.header('Access-Control-Expose-Headers', exposedHeaders.join(', '));
    }

    if (maxAge > 0) {
      c.header('Access-Control-Max-Age', maxAge.toString());
    }

    // Handle preflight requests
    if (c.req.method === 'OPTIONS') {
      return new Response('', { status: optionsSuccessStatus });
    }

    return next();
  };
}

// Production CORS configuration
export const productionCors = cors({
  origin: (origin) => {
    // Allow your domains in production
    const allowedDomains = [
      'https://yourdomain.com',
      'https://www.yourdomain.com',
      'https://app.yourdomain.com'
    ];
    
    // Allow localhost for development
    if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
      return true;
    }
    
    return allowedDomains.includes(origin);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  credentials: true,
  maxAge: 86400
});

// Development CORS configuration (more permissive)
export const developmentCors = cors({
  origin: '*', // Allow all origins in development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-API-Key'],
  credentials: true
});