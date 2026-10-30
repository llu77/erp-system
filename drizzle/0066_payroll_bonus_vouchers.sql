CREATE TABLE `employeeViolations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`employeeName` varchar(255) NOT NULL,
	`branchId` int NOT NULL,
	`branchName` varchar(255),
	`violationDate` timestamp NOT NULL,
	`violationType` varchar(100) NOT NULL,
	`description` text,
	`amount` decimal(12,2) NOT NULL,
	`status` enum('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
	`createdBy` int NOT NULL,
	`createdByName` varchar(255),
	`reviewedBy` int,
	`reviewedByName` varchar(255),
	`reviewedAt` timestamp,
	`reviewNotes` text,
	`isDeductedFromSalary` boolean NOT NULL DEFAULT false,
	`deductedInPayrollId` int,
	`deductedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeViolations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `receiptVouchers` MODIFY COLUMN `paymentMethod` enum('cash','bank_transfer','check','credit_card','other','mixed') DEFAULT 'cash';--> statement-breakpoint
ALTER TABLE `bonusDetails` ADD `tierName` varchar(100);--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `advanceDetails` text;--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `violationsDeduction` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `violationsDetails` text;--> statement-breakpoint
ALTER TABLE `receiptVoucherItems` ADD `quantity` decimal(10,2) DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE `receiptVoucherItems` ADD `unitPrice` decimal(12,2);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `voucherType` enum('receipt','payment') DEFAULT 'receipt' NOT NULL;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `partyName` varchar(255);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `partyType` enum('branch','employee','supplier','customer','owner','other');--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `partyId` int;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `cashAmount` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `bankAmount` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `checkAmount` decimal(12,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `bankName` varchar(100);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `bankReference` varchar(100);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `checkNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `checkDate` date;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `checkBank` varchar(100);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `cancelledBy` int;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `cancelledByName` varchar(255);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `cancellationReason` text;--> statement-breakpoint
ALTER TABLE `weeklyBonuses` ADD `approvedAmount` decimal(15,2);--> statement-breakpoint
ALTER TABLE `weeklyBonuses` ADD `paidAmount` decimal(15,2);--> statement-breakpoint
-- ترحيل البيانات - بونص: المستويات الافتراضية (إن كان الجدول فارغاً) وتعبئة أسماء المستويات والمبالغ المعتمدة/المصروفة وأيام الكاشير
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
WHERE NOT EXISTS (SELECT 1 FROM (SELECT `id` FROM `bonusTierSettings` LIMIT 1) AS existing_tiers);--> statement-breakpoint
UPDATE `bonusDetails` bd
LEFT JOIN `bonusTierSettings` ts ON ts.`tierKey` = bd.`bonusTier`
SET bd.`tierName` = CASE
  WHEN bd.`bonusTier` = 'none' THEN 'غير مؤهل'
  WHEN ts.`tierName` IS NOT NULL THEN ts.`tierName`
  ELSE CONCAT('المستوى ', SUBSTRING(bd.`bonusTier`, 6))
END
WHERE bd.`tierName` IS NULL;--> statement-breakpoint
UPDATE `weeklyBonuses`
SET `approvedAmount` = `totalAmount`
WHERE `approvedAmount` IS NULL AND `status` IN ('approved', 'paid');--> statement-breakpoint
UPDATE `weeklyBonuses`
SET `paidAmount` = COALESCE(`approvedAmount`, `totalAmount`)
WHERE `paidAmount` IS NULL AND `status` = 'paid';--> statement-breakpoint
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
  );--> statement-breakpoint
-- ترحيل البيانات - سندات: توزيع طرق الدفع والطرف للسندات القديمة
UPDATE `receiptVouchers` SET `cashAmount` = `totalAmount`
  WHERE (`paymentMethod` = 'cash' OR `paymentMethod` IS NULL)
    AND `cashAmount` = 0 AND `bankAmount` = 0 AND `checkAmount` = 0;--> statement-breakpoint
UPDATE `receiptVouchers` SET `bankAmount` = `totalAmount`
  WHERE `paymentMethod` = 'bank_transfer'
    AND `cashAmount` = 0 AND `bankAmount` = 0 AND `checkAmount` = 0;--> statement-breakpoint
UPDATE `receiptVouchers` SET `checkAmount` = `totalAmount`
  WHERE `paymentMethod` = 'check'
    AND `cashAmount` = 0 AND `bankAmount` = 0 AND `checkAmount` = 0;--> statement-breakpoint
UPDATE `receiptVouchers` SET `paymentMethod` = 'cash' WHERE `paymentMethod` IS NULL;--> statement-breakpoint
UPDATE `receiptVouchers`
  SET `partyName` = TRIM(BOTH ' - ' FROM CONCAT(COALESCE(`branchName`, ''), ' - ', `createdByName`)),
      `partyType` = 'branch',
      `partyId` = `branchId`
  WHERE `voucherType` = 'receipt' AND (`partyName` IS NULL OR `partyName` = '');--> statement-breakpoint
UPDATE `receiptVoucherItems` SET `quantity` = 1, `unitPrice` = `amount` WHERE `unitPrice` IS NULL;--> statement-breakpoint
-- ترحيل البيانات - رواتب: ربط السلف القديمة المخصومة فعلياً في مسيرات سابقة
UPDATE `employeeRequests` er
JOIN (
  SELECT er2.`id` AS requestId, MIN(p.`id`) AS payrollId
  FROM `employeeRequests` er2
  JOIN `payrollDetails` pd
    ON pd.`employeeId` = er2.`employeeId`
   AND pd.`advanceDetails` IS NULL
   AND pd.`advanceDeduction` >= er2.`advanceAmount` - 0.01
  JOIN `payrolls` p ON p.`id` = pd.`payrollId`
    AND p.`status` <> 'cancelled'
    AND p.`createdAt` >= COALESCE(er2.`reviewedAt`, er2.`updatedAt`)
  WHERE er2.`requestType` = 'advance'
    AND er2.`status` = 'approved'
    AND er2.`isDeductedFromSalary` = 0
    AND er2.`advanceAmount` > 0
  GROUP BY er2.`id`
) matched ON matched.requestId = er.`id`
SET er.`isDeductedFromSalary` = 1,
    er.`deductedInPayrollId` = matched.payrollId,
    er.`deductedAt` = NOW();
