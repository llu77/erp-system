-- ==================== مسيرات الرواتب: الربط بالسلف والمخالفات ====================
-- (تُولّد أعمدة الجداول تلقائياً عبر drizzle-kit من schema.ts، وهذا الملف يحتوي ترحيل البيانات فقط)

-- ربط السلف المعتمدة القديمة التي خُصمت فعلياً في مسيرات سابقة لكنها لم تُعلَّم كمخصومة
-- (كان النظام القديم لا يعلّم السلف كمخصومة، فتظهر مجدداً في كل مسيرة)
-- القاعدة: تُعتبر السلفة مخصومة في أول مسيرة غير ملغاة للموظف أُنشئت بعد اعتماد السلفة وفيها خصم سلف
UPDATE `employeeRequests` er
JOIN (
  SELECT er2.`id` AS requestId, MIN(p.`id`) AS payrollId
  FROM `employeeRequests` er2
  JOIN `payrollDetails` pd ON pd.`employeeId` = er2.`employeeId` AND pd.`advanceDeduction` > 0
  JOIN `payrolls` p ON p.`id` = pd.`payrollId`
    AND p.`status` <> 'cancelled'
    AND p.`createdAt` >= COALESCE(er2.`reviewedAt`, er2.`updatedAt`)
  WHERE er2.`requestType` = 'advance'
    AND er2.`status` = 'approved'
    AND er2.`isDeductedFromSalary` = 0
  GROUP BY er2.`id`
) matched ON matched.requestId = er.`id`
SET er.`isDeductedFromSalary` = 1,
    er.`deductedInPayrollId` = matched.payrollId,
    er.`deductedAt` = NOW();
