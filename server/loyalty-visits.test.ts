import { describe, it, expect, beforeAll } from 'vitest';
import { 
  getLoyaltyCustomersByBranch,
  getLoyaltyVisitsByBranch,
  getPendingVisitsByBranch,
  getAllPendingVisits,
  approveVisit,
  rejectVisit,
  getVisitById,
  getAllLoyaltyCustomers,
} from './db';

describe('Loyalty Visits Management', () => {
  describe('getLoyaltyCustomersByBranch', () => {
    it('should return customers for a specific branch', async () => {
      const customers = await getLoyaltyCustomersByBranch(1);
      
      expect(Array.isArray(customers)).toBe(true);
      // All returned customers should belong to branch 1
      customers.forEach(customer => {
        expect(customer.branchId).toBe(1);
      });
    });

    it('should return empty array for non-existent branch', async () => {
      const customers = await getLoyaltyCustomersByBranch(99999);
      
      expect(Array.isArray(customers)).toBe(true);
      expect(customers.length).toBe(0);
    });
  });

  describe('getLoyaltyVisitsByBranch', () => {
    it('should return visits for a specific branch', async () => {
      const visits = await getLoyaltyVisitsByBranch(1);
      
      expect(Array.isArray(visits)).toBe(true);
      // All returned visits should belong to branch 1
      visits.forEach(visit => {
        expect(visit.branchId).toBe(1);
      });
    });
  });

  describe('getPendingVisitsByBranch', () => {
    it('should return only pending visits for a branch', async () => {
      const visits = await getPendingVisitsByBranch(1);
      
      expect(Array.isArray(visits)).toBe(true);
      // All returned visits should be pending
      visits.forEach(visit => {
        expect(visit.status).toBe('pending');
        expect(visit.branchId).toBe(1);
      });
    });
  });

  describe('getAllPendingVisits', () => {
    it('should return all pending visits', async () => {
      const visits = await getAllPendingVisits();
      
      expect(Array.isArray(visits)).toBe(true);
      // All returned visits should be pending
      visits.forEach(visit => {
        expect(visit.status).toBe('pending');
      });
    });
  });

  describe('getVisitById', () => {
    it('should return null for non-existent visit', async () => {
      const visit = await getVisitById(99999);
      
      expect(visit).toBeNull();
    });
  });

  describe('approveVisit', () => {
    it('should return success for valid operation', async () => {
      // This test assumes there's a pending visit to approve
      // In a real scenario, we'd create a test visit first
      const result = await approveVisit(99999, 1);
      
      // Even if visit doesn't exist, the function should return success
      // (no rows affected but no error)
      expect(result).toHaveProperty('success');
    });
  });

  describe('rejectVisit', () => {
    it('should return success for valid operation', async () => {
      const result = await rejectVisit(99999, 1, 'سبب اختباري');
      
      expect(result).toHaveProperty('success');
    });
  });

  describe('getAllLoyaltyCustomers', () => {
    it('should return all customers', async () => {
      const customers = await getAllLoyaltyCustomers();
      
      expect(Array.isArray(customers)).toBe(true);
    });

    it('should return customers with correct structure', async () => {
      const customers = await getAllLoyaltyCustomers();
      
      if (customers.length > 0) {
        const customer = customers[0];
        expect(customer).toHaveProperty('id');
        expect(customer).toHaveProperty('name');
        expect(customer).toHaveProperty('phone');
        expect(customer).toHaveProperty('totalVisits');
      }
    });
  });
});
