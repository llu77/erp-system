/**
 * Cached Procedures - إجراءات مع تخزين مؤقت
 * 
 * يوفر دوال مساعدة لتفعيل الـ Caching في الـ tRPC procedures
 */

import { cacheService, cacheKeys, cacheTTL } from './cacheService';
import * as db from '../db';

// ===== Dashboard Stats (Cached) =====
export async function getCachedDashboardStats(branchId?: number) {
  const cacheKey = cacheKeys.dashboardStats(branchId);
  
  return cacheService.getOrSet(
    cacheKey,
    async () => {
      // Gather all dashboard stats
      const [
        products,
        customers,
        suppliers,
        lowStockProducts,
      ] = await Promise.all([
        db.getAllProducts(),
        db.getAllCustomers(),
        db.getAllSuppliers(),
        db.getLowStockProducts(),
      ]);
      
      return {
        totalProducts: products.length,
        totalCustomers: customers.length,
        totalSuppliers: suppliers.length,
        lowStockCount: lowStockProducts.length,
      };
    },
    cacheTTL.MEDIUM // 5 minutes
  );
}

// ===== Products List (Cached) =====
export async function getCachedProducts(branchId?: number) {
  const cacheKey = cacheKeys.productList(branchId);
  
  return cacheService.getOrSet(
    cacheKey,
    async () => {
      return db.getAllProducts();
    },
    cacheTTL.MEDIUM
  );
}

// ===== Customers List (Cached) =====
export async function getCachedCustomers() {
  const cacheKey = cacheKeys.customerList();
  
  return cacheService.getOrSet(
    cacheKey,
    () => db.getAllCustomers(),
    cacheTTL.MEDIUM
  );
}

// ===== Suppliers List (Cached) =====
export async function getCachedSuppliers() {
  const cacheKey = cacheKeys.supplierList();
  
  return cacheService.getOrSet(
    cacheKey,
    () => db.getAllSuppliers(),
    cacheTTL.MEDIUM
  );
}

// ===== Branches List (Cached) =====
export async function getCachedBranches() {
  const cacheKey = cacheKeys.branchList();
  
  return cacheService.getOrSet(
    cacheKey,
    () => db.getBranches(),
    cacheTTL.LONG // 15 minutes - branches rarely change
  );
}

// ===== POS Services (Cached) =====
export async function getCachedPosServices(branchId?: number) {
  const cacheKey = cacheKeys.posServices(branchId);
  
  return cacheService.getOrSet(
    cacheKey,
    async () => {
      return db.getPosServices();
    },
    cacheTTL.MEDIUM
  );
}

// ===== POS Categories (Cached) =====
export async function getCachedPosCategories() {
  const cacheKey = cacheKeys.posCategories();
  
  return cacheService.getOrSet(
    cacheKey,
    () => db.getPosCategories(),
    cacheTTL.LONG // 15 minutes
  );
}

// ===== POS Employees (Cached) =====
export async function getCachedPosEmployees(branchId: number) {
  const cacheKey = cacheKeys.posEmployees(branchId);
  
  return cacheService.getOrSet(
    cacheKey,
    () => db.getEmployeesByBranch(branchId),
    cacheTTL.MEDIUM
  );
}

// ===== Loyalty Customer (Cached) =====
export async function getCachedLoyaltyCustomer(phone: string) {
  const cacheKey = cacheKeys.loyaltyCustomer(phone);
  
  return cacheService.getOrSet(
    cacheKey,
    () => db.getLoyaltyCustomerByPhone(phone),
    cacheTTL.SHORT // 1 minute - loyalty data changes frequently
  );
}

// ===== Cache Invalidation Helpers =====
export function invalidateProductCache(branchId?: number) {
  if (branchId) {
    cacheService.invalidatePattern(`products:list:${branchId}`);
  }
  cacheService.invalidatePattern('products:');
  cacheService.invalidatePattern('dashboard:stats:');
}

export function invalidateCustomerCache() {
  cacheService.invalidatePattern('customers:');
  cacheService.invalidatePattern('dashboard:stats:');
}

export function invalidateSupplierCache() {
  cacheService.invalidatePattern('suppliers:');
  cacheService.invalidatePattern('dashboard:stats:');
}

export function invalidateBranchCache() {
  cacheService.invalidatePattern('branches:');
}

export function invalidatePosCache(branchId?: number) {
  if (branchId) {
    cacheService.invalidatePattern(`pos:services:${branchId}`);
    cacheService.invalidatePattern(`pos:employees:${branchId}`);
    cacheService.invalidatePattern(`pos:daily:${branchId}`);
  }
  cacheService.invalidatePattern('pos:');
}

export function invalidateLoyaltyCache(phone?: string) {
  if (phone) {
    cacheService.invalidatePattern(`loyalty:customer:${phone}`);
  }
  cacheService.invalidatePattern('loyalty:');
}

// ===== Export Cache Stats =====
export function getCacheStats() {
  return cacheService.getStats();
}
