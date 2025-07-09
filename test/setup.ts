import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Cloudflare Workers environment
Object.defineProperty(globalThis, 'import', {
  value: {
    meta: {
      env: {
        DEV: true,
        PROD: false,
        MODE: 'test',
      },
    },
  },
  writable: true,
});

// Mock FileReader for testing
global.FileReader = class {
  result: string | ArrayBuffer | null = null;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  
  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = `data:image/jpeg;base64,mock-base64-data`;
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
};

// Mock Image for testing
global.Image = class {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  width: number = 800;
  height: number = 600;
  
  constructor() {
    setTimeout(() => {
      if (this.onload) {
        this.onload();
      }
    }, 0);
  }
} as any;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn(() => 'mock-url');
global.URL.revokeObjectURL = vi.fn();

// Mock fetch for API testing
global.fetch = vi.fn();

// Mock console methods to avoid noise in tests
global.console.error = vi.fn();
global.console.warn = vi.fn();
global.console.log = vi.fn();