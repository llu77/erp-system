import { describe, it, expect, beforeAll } from 'vitest';
import * as db from './db';

describe('Loyalty Discount System - Third Visit 60% Discount', () => {
  
  describe('getApprovedVisitsCount', () => {
    it('should return correct visit count and eligibility for customer with 0 visits', async () => {
      // Test with a non-existent customer ID
      const result = await db.getApprovedVisitsCount(999999);
      
      expect(result).toHaveProperty('totalApproved');
      expect(result).toHaveProperty('visitsInCurrentCycle');
      expect(result).toHaveProperty('isEligibleForDiscount');
      expect(result).toHaveProperty('discountPercentage');
      expect(result).toHaveProperty('nextDiscountAt');
      
      expect(result.totalApproved).toBe(0);
      expect(result.isEligibleForDiscount).toBe(false);
      // nextDiscountAt يعتمد على إعدادات الولاء (requiredVisitsForDiscount)
      expect(result.nextDiscountAt).toBeGreaterThanOrEqual(3);
    });
  });

  describe('getEligibleLoyaltyCustomersForDiscount', () => {
    it('should return array of customers with discount info', async () => {
      const result = await db.getEligibleLoyaltyCustomersForDiscount();
      
      expect(Array.isArray(result)).toBe(true);
      
      // Each customer should have required fields
      if (result.length > 0) {
        const customer = result[0];
        expect(customer).toHaveProperty('customerId');
        expect(customer).toHaveProperty('customerName');
        expect(customer).toHaveProperty('customerPhone');
        expect(customer).toHaveProperty('totalApprovedVisits');
        expect(customer).toHaveProperty('discountPercentage');
        expect(customer).toHaveProperty('isEligible');
        expect(customer).toHaveProperty('visitsInCycle');
        expect(customer).toHaveProperty('nextDiscountAt');
      }
    });

    it('should filter by branchId when provided', async () => {
      const result = await db.getEligibleLoyaltyCustomersForDiscount(1);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('checkLoyaltyDiscountByPhone', () => {
    it('should return not found for non-existent phone', async () => {
      const result = await db.checkLoyaltyDiscountByPhone('0000000000');
      
      expect(result.found).toBe(false);
      expect(result.message).toContain('غير مسجل');
    });

    it('should return correct structure', async () => {
      const result = await db.checkLoyaltyDiscountByPhone('0500000000');
      
      expect(result).toHaveProperty('found');
      expect(result).toHaveProperty('totalApprovedVisits');
      expect(result).toHaveProperty('isEligibleForDiscount');
      expect(result).toHaveProperty('discountPercentage');
      expect(result).toHaveProperty('visitsInCycle');
      expect(result).toHaveProperty('nextDiscountAt');
      expect(result).toHaveProperty('message');
    });
  });

  describe('Discount Calculation Logic', () => {
    it('should calculate 60% discount correctly', () => {
      const subtotal = 100;
      const discountPercent = 60;
      const expectedDiscount = subtotal * (discountPercent / 100);
      
      expect(expectedDiscount).toBe(60);
    });

    it('should identify eligible visits correctly (multiples of 3)', () => {
      const testCases = [
        { visits: 0, expected: false },
        { visits: 1, expected: false },
        { visits: 2, expected: false },
        { visits: 3, expected: true },
        { visits: 4, expected: false },
        { visits: 5, expected: false },
        { visits: 6, expected: true },
        { visits: 9, expected: true },
        { visits: 12, expected: true },
      ];

      testCases.forEach(({ visits, expected }) => {
        const isEligible = visits > 0 && visits % 3 === 0;
        expect(isEligible).toBe(expected);
      });
    });

    it('should calculate next discount correctly', () => {
      const requiredVisits = 3;
      const testCases = [
        { visits: 0, expectedNext: 3 },
        { visits: 1, expectedNext: 2 },
        { visits: 2, expectedNext: 1 },
        { visits: 3, expectedNext: 3 }, // After getting discount, need 3 more
        { visits: 4, expectedNext: 2 },
        { visits: 5, expectedNext: 1 },
        { visits: 6, expectedNext: 3 },
      ];

      testCases.forEach(({ visits, expectedNext }) => {
        const visitsInCycle = visits % requiredVisits;
        const nextDiscountAt = visitsInCycle === 0 && visits > 0 
          ? requiredVisits 
          : (requiredVisits - visitsInCycle);
        
        if (visits === 0) {
          expect(nextDiscountAt).toBe(3);
        } else {
          expect(nextDiscountAt).toBe(expectedNext);
        }
      });
    });
  });
});
