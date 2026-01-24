ALTER TABLE `employees` ADD `username` varchar(50);--> statement-breakpoint
ALTER TABLE `employees` ADD `password` varchar(255);--> statement-breakpoint
ALTER TABLE `employees` ADD `hasPortalAccess` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `lastLogin` timestamp;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_username_unique` UNIQUE(`username`);