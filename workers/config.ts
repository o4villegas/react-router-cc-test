/**
 * Centralized Configuration Management
 * Provides type-safe configuration with validation and environment-specific settings
 */

export interface AppConfig {
  // Application settings
  app: {
    name: string;
    version: string;
    environment: 'development' | 'production' | 'staging';
    debugMode: boolean;
  };

  // API Configuration
  api: {
    timeout: {
      damage_assessment: number;
      knowledge_search: number;
      ai_processing: number;
    };
    limits: {
      max_file_size: number;
      max_decoded_size: number;
      max_dimensions: number;
      max_query_length: number;
    };
    retry: {
      max_attempts: number;
      backoff_ms: number;
    };
  };

  // Image Processing Configuration
  image: {
    allowed_types: string[];
    max_file_size: number;
    max_dimensions: { width: number; height: number };
    min_dimensions: { width: number; height: number };
    quality: {
      jpeg: number;
      png: number;
      webp: number;
    };
  };

  // Security Configuration
  security: {
    enable_signature_validation: boolean;
    enable_structure_validation: boolean;
    enable_sanitization: boolean;
    max_filename_length: number;
    blocked_extensions: string[];
  };

  // AI Model Configuration
  ai: {
    vision_model: string;
    language_model: string;
    autorag_dataset: string;
    enable_autorag: boolean;
    confidence_threshold: number;
  };

  // Logging Configuration
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enable_structured_logging: boolean;
    log_requests: boolean;
    log_responses: boolean;
  };

  // Performance Configuration
  performance: {
    enable_caching: boolean;
    cache_ttl: number;
    enable_compression: boolean;
    max_concurrent_requests: number;
  };
}

// Default configuration
const DEFAULT_CONFIG: AppConfig = {
  app: {
    name: 'Smart Damage Assessment',
    version: '1.0.0',
    environment: 'development',
    debugMode: false,
  },

  api: {
    timeout: {
      damage_assessment: 45000, // 45 seconds
      knowledge_search: 30000,  // 30 seconds
      ai_processing: 60000,     // 60 seconds
    },
    limits: {
      max_file_size: 50 * 1024 * 1024,    // 50MB
      max_decoded_size: 100 * 1024 * 1024, // 100MB
      max_dimensions: 8192,                 // 8192px
      max_query_length: 1000,               // 1000 characters
    },
    retry: {
      max_attempts: 3,
      backoff_ms: 1000,
    },
  },

  image: {
    allowed_types: ['image/jpeg', 'image/png', 'image/webp'],
    max_file_size: 10 * 1024 * 1024, // 10MB for frontend
    max_dimensions: { width: 4096, height: 4096 },
    min_dimensions: { width: 100, height: 100 },
    quality: {
      jpeg: 85,
      png: 95,
      webp: 80,
    },
  },

  security: {
    enable_signature_validation: true,
    enable_structure_validation: true,
    enable_sanitization: true,
    max_filename_length: 255,
    blocked_extensions: ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jar'],
  },

  ai: {
    vision_model: '@cf/llava-hf/llava-1.5-7b-hf',
    language_model: '@cf/meta/llama-3.2-3b-instruct',
    autorag_dataset: 'auto-inspect-rag',
    enable_autorag: true,
    confidence_threshold: 0.7,
  },

  logging: {
    level: 'info',
    enable_structured_logging: true,
    log_requests: true,
    log_responses: false,
  },

  performance: {
    enable_caching: false,
    cache_ttl: 300000, // 5 minutes
    enable_compression: true,
    max_concurrent_requests: 10,
  },
};

// Environment-specific overrides
const ENVIRONMENT_OVERRIDES: Record<string, any> = {
  development: {
    app: {
      debugMode: true,
    },
    logging: {
      level: 'debug',
      enable_structured_logging: true,
      log_requests: true,
      log_responses: true,
    },
    performance: {
      enable_caching: false,
    },
  },

  production: {
    app: {
      debugMode: false,
    },
    logging: {
      level: 'warn',
      enable_structured_logging: true,
      log_requests: false,
      log_responses: false,
    },
    performance: {
      enable_caching: true,
    },
  },

  staging: {
    app: {
      debugMode: true,
    },
    logging: {
      level: 'info',
      enable_structured_logging: true,
      log_requests: true,
      log_responses: false,
    },
    performance: {
      enable_caching: true,
    },
  },
};

// Configuration validation
function validateConfig(config: AppConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate timeouts
  if (config.api.timeout.damage_assessment < 1000) {
    errors.push('Damage assessment timeout must be at least 1000ms');
  }
  if (config.api.timeout.knowledge_search < 1000) {
    errors.push('Knowledge search timeout must be at least 1000ms');
  }

  // Validate limits
  if (config.api.limits.max_file_size < 1024 * 1024) {
    errors.push('Max file size must be at least 1MB');
  }
  if (config.api.limits.max_dimensions < 100) {
    errors.push('Max dimensions must be at least 100px');
  }

  // Validate image settings
  if (config.image.allowed_types.length === 0) {
    errors.push('At least one image type must be allowed');
  }
  if (config.image.max_dimensions.width < config.image.min_dimensions.width) {
    errors.push('Max width must be greater than min width');
  }
  if (config.image.max_dimensions.height < config.image.min_dimensions.height) {
    errors.push('Max height must be greater than min height');
  }

  // Validate AI settings
  if (!config.ai.vision_model || !config.ai.language_model) {
    errors.push('AI models must be specified');
  }
  if (config.ai.confidence_threshold < 0 || config.ai.confidence_threshold > 1) {
    errors.push('Confidence threshold must be between 0 and 1');
  }

  // Validate performance settings
  if (config.performance.cache_ttl < 1000) {
    errors.push('Cache TTL must be at least 1000ms');
  }
  if (config.performance.max_concurrent_requests < 1) {
    errors.push('Max concurrent requests must be at least 1');
  }

  return { valid: errors.length === 0, errors };
}

// Configuration loader with environment detection
export function loadConfig(env?: any): AppConfig {
  // Start with default configuration
  let config = structuredClone(DEFAULT_CONFIG);

  // Detect environment
  const environment = env?.NODE_ENV || env?.CLOUDFLARE_ENV || 'development';
  config.app.environment = environment as 'development' | 'production' | 'staging';

  // Apply environment-specific overrides
  const envOverrides = ENVIRONMENT_OVERRIDES[environment];
  if (envOverrides) {
    config = mergeConfig(config, envOverrides);
  }

  // Apply environment variable overrides
  if (env) {
    // Override from environment variables
    if (env.APP_DEBUG_MODE !== undefined) {
      config.app.debugMode = env.APP_DEBUG_MODE === 'true';
    }
    if (env.API_TIMEOUT_DAMAGE_ASSESSMENT) {
      config.api.timeout.damage_assessment = parseInt(env.API_TIMEOUT_DAMAGE_ASSESSMENT);
    }
    if (env.API_TIMEOUT_KNOWLEDGE_SEARCH) {
      config.api.timeout.knowledge_search = parseInt(env.API_TIMEOUT_KNOWLEDGE_SEARCH);
    }
    if (env.MAX_FILE_SIZE) {
      config.api.limits.max_file_size = parseInt(env.MAX_FILE_SIZE);
    }
    if (env.AUTORAG_DATASET) {
      config.ai.autorag_dataset = env.AUTORAG_DATASET;
    }
    if (env.ENABLE_AUTORAG !== undefined) {
      config.ai.enable_autorag = env.ENABLE_AUTORAG === 'true';
    }
    if (env.LOG_LEVEL) {
      config.logging.level = env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
    }
    if (env.ENABLE_CACHING !== undefined) {
      config.performance.enable_caching = env.ENABLE_CACHING === 'true';
    }
  }

  // Validate final configuration
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
  }

  return config;
}

// Deep merge utility for configuration
function mergeConfig(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeConfig(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Export configuration instance
export const config = loadConfig();

// Export utilities
export { validateConfig, loadConfig as reloadConfig };