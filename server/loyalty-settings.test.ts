import { describe, it, expect, beforeAll } from 'vitest';
import { 
  getLoyaltySettings, 
  updateLoyaltySettings, 
  getLoyaltyServiceTypes, 
  addLoyaltyServiceType, 
  updateLoyaltyServiceType, 
  deleteLoyaltyServiceType 
} from './db';

describe('Loyalty Settings', () => {
  describe('getLoyaltySettings', () => {
    it('should return default settings if none exist', async () => {
      const settings = await getLoyaltySettings();
      
      expect(settings).toBeDefined();
      expect(settings.requiredVisitsForDiscount).toBeGreaterThanOrEqual(1);
      expect(settings.discountPercentage).toBeGreaterThanOrEqual(1);
      expect(settings.discountPercentage).toBeLessThanOrEqual(100);
    });

    it('should return settings with correct structure', async () => {
      const settings = await getLoyaltySettings();
      
      expect(settings).toHaveProperty('requiredVisitsForDiscount');
      expect(settings).toHaveProperty('discountPercentage');
      expect(typeof settings.requiredVisitsForDiscount).toBe('number');
      expect(typeof settings.discountPercentage).toBe('number');
    });
  });

  describe('updateLoyaltySettings', () => {
    it('should update settings successfully', async () => {
      const newSettings = {
        requiredVisitsForDiscount: 5,
        discountPercentage: 40,
      };
      
      const result = await updateLoyaltySettings(newSettings);
      
      expect(result.success).toBe(true);
      
      // Verify the update
      const settings = await getLoyaltySettings();
      expect(settings.requiredVisitsForDiscount).toBe(5);
      expect(settings.discountPercentage).toBe(40);
    });

    it('should restore original settings', async () => {
      // Restore to default
      const result = await updateLoyaltySettings({
        requiredVisitsForDiscount: 4,
        discountPercentage: 50,
      });
      
      expect(result.success).toBe(true);
    });
  });
});

describe('Loyalty Service Types', () => {
  let createdServiceId: number | undefined;

  describe('getLoyaltyServiceTypes', () => {
    it('should return array of service types', async () => {
      const types = await getLoyaltyServiceTypes();
      
      expect(Array.isArray(types)).toBe(true);
    });

    it('should return service types with correct structure', async () => {
      const types = await getLoyaltyServiceTypes();
      
      if (types.length > 0) {
        const type = types[0];
        expect(type).toHaveProperty('id');
        expect(type).toHaveProperty('name');
        expect(type).toHaveProperty('isActive');
        expect(type).toHaveProperty('sortOrder');
      }
    });
  });

  describe('addLoyaltyServiceType', () => {
    it('should add a new service type', async () => {
      const result = await addLoyaltyServiceType({
        name: 'خدمة اختبار',
      });
      
      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();
      
      createdServiceId = result.id;
    });
  });

  describe('updateLoyaltyServiceType', () => {
    it('should update an existing service type', async () => {
      if (!createdServiceId) {
        // Create one if not exists
        const addResult = await addLoyaltyServiceType({ name: 'خدمة للتحديث' });
        createdServiceId = addResult.id;
      }
      
      const result = await updateLoyaltyServiceType({
        id: createdServiceId!,
        name: 'خدمة اختبار محدثة',
        isActive: true,
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('deleteLoyaltyServiceType', () => {
    it('should delete a service type', async () => {
      if (!createdServiceId) {
        // Create one if not exists
        const addResult = await addLoyaltyServiceType({ name: 'خدمة للحذف' });
        createdServiceId = addResult.id;
      }
      
      const result = await deleteLoyaltyServiceType(createdServiceId!);
      
      expect(result.success).toBe(true);
    });
  });
});
