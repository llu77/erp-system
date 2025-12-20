ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','employee','supervisor','viewer') NOT NULL DEFAULT 'employee';--> statement-breakpoint
ALTER TABLE `users` ADD `branchId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `permissions` text;