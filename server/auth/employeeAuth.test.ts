import { describe, it, expect } from 'vitest';
import { generateUsername, generatePassword } from './employeeAuth';

describe('Employee Authentication Utilities', () => {
  describe('generateUsername', () => {
    it('should generate username from employee name', () => {
      const username = generateUsername('محمد أحمد', 'EMP001');
      expect(username).toBeDefined();
      expect(typeof username).toBe('string');
      expect(username.length).toBeGreaterThan(0);
    });

    it('should generate username from English name', () => {
      const username = generateUsername('John Doe', 'EMP002');
      expect(username).toBeDefined();
      expect(username.toLowerCase()).toContain('john');
    });

    it('should handle names without code', () => {
      const username = generateUsername('Test User');
      expect(username).toBeDefined();
      expect(username).toBe('testuser');
    });

    it('should truncate long names to 8 characters', () => {
      const username = generateUsername('VeryLongEmployeeName', 'EMP003');
      expect(username).toBe('verylong' + 'emp003');
    });
  });

  describe('generatePassword', () => {
    it('should generate password of correct length', () => {
      const password = generatePassword();
      expect(password).toBeDefined();
      expect(password.length).toBe(8);
    });

    it('should generate different passwords each time', () => {
      const password1 = generatePassword();
      const password2 = generatePassword();
      
      // While there's a tiny chance they could be the same, it's extremely unlikely
      expect(password1).not.toBe(password2);
    });

    it('should only contain alphanumeric characters', () => {
      const password = generatePassword();
      expect(password).toMatch(/^[a-zA-Z0-9]+$/);
    });
  });
});
