/**
 * Client-side Configuration Management
 * Provides safe configuration values for the frontend
 */

export interface ClientConfig {
  // API Configuration
  api: {
    endpoints: {
      damage_assessment: string;
      knowledge_search: string;
    };
    timeout: {
      damage_assessment: number;
      knowledge_search: number;
    };
  };

  // Image Processing Configuration
  image: {
    allowed_types: string[];
    max_file_size: number;
    max_dimensions: { width: number; height: number };
    min_dimensions: { width: number; height: number };
  };

  // Security Configuration
  security: {
    max_filename_length: number;
    blocked_extensions: string[];
  };

  // UI Configuration
  ui: {
    app_name: string;
    version: string;
    enable_debug: boolean;
  };
}

// Default client configuration
const DEFAULT_CLIENT_CONFIG: ClientConfig = {
  api: {
    endpoints: {
      damage_assessment: "/api/assess-damage",
      knowledge_search: "/api/knowledge-search",
    },
    timeout: {
      damage_assessment: 45000, // 45 seconds
      knowledge_search: 30000,  // 30 seconds
    },
  },

  image: {
    allowed_types: ['image/jpeg', 'image/png', 'image/webp'],
    max_file_size: 5 * 1024 * 1024, // 5MB for frontend (matches backend limit)
    max_dimensions: { width: 4096, height: 4096 },
    min_dimensions: { width: 100, height: 100 },
  },

  security: {
    max_filename_length: 255,
    blocked_extensions: ['.exe', '.bat', '.cmd', '.com', '.scr', '.vbs', '.js', '.jar'],
  },

  ui: {
    app_name: 'Aqua Inspect Vision',
    version: '1.0.0',
    enable_debug: false,
  },
};

// Environment-specific overrides for client
const CLIENT_ENV_OVERRIDES: Record<string, any> = {
  development: {
    ui: {
      enable_debug: true,
    },
  },
  
  production: {
    ui: {
      enable_debug: false,
    },
  },
};

// Load client configuration
export function loadClientConfig(environment: string = 'development'): ClientConfig {
  let config = structuredClone(DEFAULT_CLIENT_CONFIG);

  // Apply environment-specific overrides
  const envOverrides = CLIENT_ENV_OVERRIDES[environment];
  if (envOverrides) {
    config = mergeClientConfig(config, envOverrides);
  }

  return config;
}

// Deep merge utility for client configuration
function mergeClientConfig(target: any, source: any): any {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = mergeClientConfig(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

// Export configuration instance
export const clientConfig = loadClientConfig();

// Configuration validation for client
export function validateClientConfig(config: ClientConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate API timeouts
  if (config.api.timeout.damage_assessment < 1000) {
    errors.push('Damage assessment timeout must be at least 1000ms');
  }
  if (config.api.timeout.knowledge_search < 1000) {
    errors.push('Knowledge search timeout must be at least 1000ms');
  }

  // Validate image settings
  if (config.image.allowed_types.length === 0) {
    errors.push('At least one image type must be allowed');
  }
  if (config.image.max_file_size < 1024 * 1024) {
    errors.push('Max file size must be at least 1MB');
  }
  if (config.image.max_dimensions.width < config.image.min_dimensions.width) {
    errors.push('Max width must be greater than min width');
  }
  if (config.image.max_dimensions.height < config.image.min_dimensions.height) {
    errors.push('Max height must be greater than min height');
  }

  // Validate security settings
  if (config.security.max_filename_length < 1) {
    errors.push('Max filename length must be at least 1');
  }

  return { valid: errors.length === 0, errors };
}

// Export utilities
export { loadClientConfig as reloadClientConfig };