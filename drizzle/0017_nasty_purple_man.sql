ALTER TABLE `payrollDetails` MODIFY COLUMN `overtimeAmount` decimal(12,2) NOT NULL DEFAULT '1000.00';--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `workDays` int DEFAULT 30 NOT NULL;--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `absentDays` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `absentDeduction` decimal(12,2) DEFAULT '0.00' NOT NULL;