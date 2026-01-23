ALTER TABLE `payrollDetails` ADD `leaveDays` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `leaveDeduction` decimal(12,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `leaveType` varchar(50);--> statement-breakpoint
ALTER TABLE `payrollDetails` ADD `leaveDetails` text;