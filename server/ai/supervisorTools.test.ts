/**
 * اختبارات أدوات المشرف
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBranchEmployees,
  getBranchRevenue,
  getEmployeeRevenueForSupervisor,
  getBranchEmployeesRanking,
  analyzeEmployeePerformance,
  executeSupervisorTool,
  supervisorTools,
} from './supervisorTools';

// Mock database
vi.mock('../db', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
  })),
}));

describe('Supervisor Tools', () => {
  describe('supervisorTools definition', () => {
    it('should have 5 supervisor tools defined', () => {
      expect(supervisorTools).toHaveLength(5);
    });

    it('should have get_branch_employees tool', () => {
      const tool = supervisorTools.find(t => t.function.name === 'get_branch_employees');
      expect(tool).toBeDefined();
      expect(tool?.function.parameters.required).toContain('branchId');
    });

    it('should have get_branch_revenue tool', () => {
      const tool = supervisorTools.find(t => t.function.name === 'get_branch_revenue');
      expect(tool).toBeDefined();
      expect(tool?.function.parameters.required).toContain('branchId');
    });

    it('should have get_employee_revenue_supervisor tool', () => {
      const tool = supervisorTools.find(t => t.function.name === 'get_employee_revenue_supervisor');
      expect(tool).toBeDefined();
      expect(tool?.function.parameters.required).toContain('supervisorBranchId');
      expect(tool?.function.parameters.required).toContain('employeeId');
    });

    it('should have get_branch_employees_ranking tool', () => {
      const tool = supervisorTools.find(t => t.function.name === 'get_branch_employees_ranking');
      expect(tool).toBeDefined();
      expect(tool?.function.parameters.required).toContain('branchId');
    });

    it('should have analyze_employee_performance tool', () => {
      const tool = supervisorTools.find(t => t.function.name === 'analyze_employee_performance');
      expect(tool).toBeDefined();
      expect(tool?.function.parameters.required).toContain('supervisorBranchId');
      expect(tool?.function.parameters.required).toContain('employeeId');
    });
  });

  describe('executeSupervisorTool', () => {
    it('should return error for unknown tool', async () => {
      const result = await executeSupervisorTool('unknown_tool', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('أداة غير معروفة');
    });
  });

  describe('Tool result structure', () => {
    it('should have correct result structure for success', async () => {
      // Test that results have the expected structure
      const result = await executeSupervisorTool('unknown_tool', {});
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('hasData');
      expect(result).toHaveProperty('dataCount');
      expect(result).toHaveProperty('message');
    });
  });
});

describe('Supervisor Tools - Period Calculation', () => {
  it('should handle different period options in tool definitions', () => {
    const revenueTools = supervisorTools.filter(t => 
      t.function.name === 'get_branch_revenue' || 
      t.function.name === 'get_employee_revenue_supervisor' ||
      t.function.name === 'get_branch_employees_ranking'
    );

    revenueTools.forEach(tool => {
      const periodParam = tool.function.parameters.properties.period;
      expect(periodParam).toBeDefined();
      expect(periodParam.enum).toContain('today');
      expect(periodParam.enum).toContain('week');
      expect(periodParam.enum).toContain('last_week');
      expect(periodParam.enum).toContain('month');
      expect(periodParam.enum).toContain('last_month');
    });
  });
});

describe('Supervisor Access Control', () => {
  it('should have branchId as required parameter for branch-level tools', () => {
    const branchTools = ['get_branch_employees', 'get_branch_revenue', 'get_branch_employees_ranking'];
    
    branchTools.forEach(toolName => {
      const tool = supervisorTools.find(t => t.function.name === toolName);
      expect(tool?.function.parameters.required).toContain('branchId');
    });
  });

  it('should have supervisorBranchId for employee-specific tools', () => {
    const employeeTools = ['get_employee_revenue_supervisor', 'analyze_employee_performance'];
    
    employeeTools.forEach(toolName => {
      const tool = supervisorTools.find(t => t.function.name === toolName);
      expect(tool?.function.parameters.required).toContain('supervisorBranchId');
      expect(tool?.function.parameters.required).toContain('employeeId');
    });
  });
});
