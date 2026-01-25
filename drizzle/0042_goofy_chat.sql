ALTER TABLE `payrollDetails` ADD `negativeInvoicesDeduction` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `negativeInvoicesDetails` text;