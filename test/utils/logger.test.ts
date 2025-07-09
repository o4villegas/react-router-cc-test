import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../../app/utils/logger';

describe('Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Logging Methods', () => {
    it('logs debug messages', () => {
      const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
      logger.debug('Debug message', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('DEBUG'),
        { data: 'test' }
      );
      
      consoleSpy.mockRestore();
    });

    it('logs info messages', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      logger.info('Info message', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('INFO'),
        { data: 'test' }
      );
      
      consoleSpy.mockRestore();
    });

    it('logs warn messages', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      logger.warn('Warning message', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('WARN'),
        { data: 'test' }
      );
      
      consoleSpy.mockRestore();
    });

    it('logs error messages', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      logger.error('Error message', { data: 'test' });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('ERROR'),
        { data: 'test' }
      );
      
      consoleSpy.mockRestore();
    });

    it('includes component name in log message', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
      
      logger.info('Test message', { data: 'test' }, 'TestComponent');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[TestComponent]'),
        { data: 'test' }
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Specialized Logging Methods', () => {
    it('logs AI errors with proper context', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      logger.aiError('image processing', new Error('AI failed'), 'DamageAssessment');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI Operation Failed: image processing'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('logs validation errors with proper context', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      logger.validationError('file size', new Error('Too large'), 'FileUpload');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Validation Error: file size'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });

    it('logs API errors with proper context', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      logger.apiError('/api/assess-damage', new Error('Network error'), 'DamageAssessment');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('API Error: /api/assess-damage'),
        expect.any(Error)
      );
      
      consoleSpy.mockRestore();
    });
  });
});