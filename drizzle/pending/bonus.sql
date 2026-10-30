-- ============================================================================
-- Bonus subsystem rebuild (branch wip/bonus)
-- Pending MySQL statements for the lead to fold into the real drizzle migration.
-- Matches drizzle/schema.ts: weeklyBonuses.approvedAmount / paidAmount, bonusDetails.tierName
-- ============================================================================

-- 1) Snapshot columns ---------------------------------------------------------

-- المبلغ المعتمد وقت الموافقة والمبلغ المصروف فعلياً
ALTER TABLE `weeklyBonuses` ADD COLUMN `approvedAmount` decimal(15,2) NULL AFTER `totalAmount`;
ALTER TABLE `weeklyBonuses` ADD COLUMN `paidAmount` decimal(15,2) NULL AFTER `approvedAmount`;

-- اسم المستوى وقت الاحتساب
ALTER TABLE `bonusDetails` ADD COLUMN `tierName` varchar(100) NULL AFTER `bonusTier`;

-- 2) Seed the 7 default tiers ONLY when the table is empty ---------------------
-- (replaces the old write-on-read initializeDefaultBonusTiers)
INSERT INTO `bonusTierSettings` (`tierKey`, `tierName`, `minRevenue`, `maxRevenue`, `bonusAmount`, `color`, `sortOrder`, `isActive`)
SELECT d.`tierKey`, d.`tierName`, d.`minRevenue`, d.`maxRevenue`, d.`bonusAmount`, d.`color`, d.`sortOrder`, 1
FROM (
  SELECT 'tier_1' AS `tierKey`, 'المستوى 1' AS `tierName`, 1450.00 AS `minRevenue`, 1749.99 AS `maxRevenue`, 35.00 AS `bonusAmount`, 'orange' AS `color`, 1 AS `sortOrder`
  UNION ALL SELECT 'tier_2', 'المستوى 2', 1750.00, 1949.99, 55.00, 'yellow', 2
  UNION ALL SELECT 'tier_3', 'المستوى 3', 1950.00, 2199.99, 65.00, 'green', 3
  UNION ALL SELECT 'tier_4', 'المستوى 4', 2200.00, 2499.99, 90.00, 'cyan', 4
  UNION ALL SELECT 'tier_5', 'المستوى 5', 2500.00, 2799.99, 120.00, 'blue', 5
  UNION ALL SELECT 'tier_6', 'المستوى 6', 2800.00, 3199.99, 155.00, 'indigo', 6
  UNION ALL SELECT 'tier_7', 'المستوى 7', 3200.00, NULL, 190.00, 'purple', 7
) AS d
WHERE NOT EXISTS (SELECT 1 FROM (SELECT `id` FROM `bonusTierSettings` LIMIT 1) AS existing_tiers);

-- 3) Backfill -----------------------------------------------------------------

-- اسم المستوى للتفاصيل القديمة: من إعدادات المستويات الحالية، وإلا "المستوى N"
UPDATE `bonusDetails` bd
LEFT JOIN `bonusTierSettings` ts ON ts.`tierKey` = bd.`bonusTier`
SET bd.`tierName` = CASE
  WHEN bd.`bonusTier` = 'none' THEN 'غير مؤهل'
  WHEN ts.`tierName` IS NOT NULL THEN ts.`tierName`
  ELSE CONCAT('المستوى ', SUBSTRING(bd.`bonusTier`, 6))
END
WHERE bd.`tierName` IS NULL;

-- المبالغ المعتمدة/المصروفة للسجلات القديمة = الإجمالي المسجل
UPDATE `weeklyBonuses`
SET `approvedAmount` = `totalAmount`
WHERE `approvedAmount` IS NULL AND `status` IN ('approved', 'paid');

UPDATE `weeklyBonuses`
SET `paidAmount` = COALESCE(`approvedAmount`, `totalAmount`)
WHERE `paidAmount` IS NULL AND `status` = 'paid';

-- أيام الكاشير القديمة لم تكن تُعلم كمؤكدة (posConfirmed لم يكن يُكتب)
-- تُعلم الأيام التي لها فواتير كاشير مكتملة في نفس اليوم وأنشأها مسار الكاشير (صورة موازنة "verified" ومطابقة)
-- ملاحظة: إعادة بناء إيرادات الموظفين لهذه الأيام تتم من زر "إعادة احتساب من الكاشير" (bonuses.rebuildFromPos)
UPDATE `dailyRevenues` dr
SET dr.`posConfirmed` = 1,
    dr.`posConfirmedAt` = COALESCE(dr.`posConfirmedAt`, dr.`createdAt`),
    dr.`posConfirmedBy` = COALESCE(dr.`posConfirmedBy`, 'الكاشير')
WHERE (dr.`posConfirmed` IS NULL OR dr.`posConfirmed` = 0)
  AND dr.`imageVerificationStatus` = 'verified'
  AND dr.`isMatched` = 1
  AND NOT EXISTS (SELECT 1 FROM `employeeRevenues` er WHERE er.`dailyRevenueId` = dr.`id`)
  AND EXISTS (
    SELECT 1 FROM `posInvoices` pi
    WHERE pi.`branchId` = dr.`branchId`
      AND pi.`status` = 'completed'
      AND DATE(pi.`invoiceDate`) = DATE(dr.`date`)
  );

-- 4) Optional diagnostics (read-only) -----------------------------------------
-- No unique indexes are added: concurrent writers are serialized by locking the branch row
-- (SELECT id FROM branches WHERE id = ? FOR UPDATE). Existing duplicates can be inspected with:
-- SELECT branchId, year, month, weekNumber, COUNT(*) c FROM weeklyBonuses GROUP BY 1,2,3,4 HAVING c > 1;
-- SELECT weeklyBonusId, employeeId, COUNT(*) c FROM bonusDetails GROUP BY 1,2 HAVING c > 1;
