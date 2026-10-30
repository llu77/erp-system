-- ==================== سندات القبض والصرف (Receipt + Payment Vouchers) ====================
-- Pending schema change for drizzle/schema.ts receiptVouchers / receiptVoucherItems.
-- Additive only: every existing row keeps working (voucherType defaults to 'receipt').
-- The lead generates the real drizzle migration; these are the exact statements it must contain,
-- followed by the data backfill.

-- 1) receiptVouchers: voucher type
ALTER TABLE `receiptVouchers` ADD `voucherType` enum('receipt','payment') NOT NULL DEFAULT 'receipt';--> statement-breakpoint

-- 2) receiptVouchers: party ("استلمنا من" / "صرفنا إلى")
ALTER TABLE `receiptVouchers` ADD `partyName` varchar(255);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `partyType` enum('branch','employee','supplier','customer','owner','other');--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `partyId` int;--> statement-breakpoint

-- 3) receiptVouchers: payment method gets 'mixed' (existing values unchanged)
ALTER TABLE `receiptVouchers` MODIFY COLUMN `paymentMethod` enum('cash','bank_transfer','check','credit_card','other','mixed') DEFAULT 'cash';--> statement-breakpoint

-- 4) receiptVouchers: payment split + bank / cheque details
ALTER TABLE `receiptVouchers` ADD `cashAmount` decimal(12,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `bankAmount` decimal(12,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `checkAmount` decimal(12,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `bankName` varchar(100);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `bankReference` varchar(100);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `checkNumber` varchar(50);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `checkDate` date;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `checkBank` varchar(100);--> statement-breakpoint

-- 5) receiptVouchers: cancellation audit
ALTER TABLE `receiptVouchers` ADD `cancelledBy` int;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `cancelledByName` varchar(255);--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `cancelledAt` timestamp;--> statement-breakpoint
ALTER TABLE `receiptVouchers` ADD `cancellationReason` text;--> statement-breakpoint

-- 6) receiptVoucherItems: quantity / unit price
ALTER TABLE `receiptVoucherItems` ADD `quantity` decimal(10,2) NOT NULL DEFAULT '1';--> statement-breakpoint
ALTER TABLE `receiptVoucherItems` ADD `unitPrice` decimal(12,2);--> statement-breakpoint

-- ==================== Data backfill (run once, after the ALTERs) ====================

-- a) Payment split from the existing single payment method.
--    credit_card / other are not split methods: their split stays 0 and the voucher
--    keeps its paymentMethod label (cash-flow grouping falls back to paymentMethod).
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

-- b) Legacy receipt vouchers: "Received From" = branch - supervisor who handed over the cash.
--    payeeName keeps meaning "Received By" (عمر المطيري / سالم الوادعي / اغراض محل).
UPDATE `receiptVouchers`
  SET `partyName` = TRIM(BOTH ' - ' FROM CONCAT(COALESCE(`branchName`, ''), ' - ', `createdByName`)),
      `partyType` = 'branch',
      `partyId` = `branchId`
  WHERE `voucherType` = 'receipt' AND (`partyName` IS NULL OR `partyName` = '');--> statement-breakpoint

-- c) Legacy items: quantity 1, unit price = amount.
UPDATE `receiptVoucherItems` SET `quantity` = 1, `unitPrice` = `amount` WHERE `unitPrice` IS NULL;--> statement-breakpoint

-- ==================== Optional (not declared in schema.ts) ====================
-- Speeds up list/report queries filtered by type and date. Non-unique, safe on existing data.
-- CREATE INDEX `receiptVouchers_type_date_idx` ON `receiptVouchers` (`voucherType`, `voucherDate`);
