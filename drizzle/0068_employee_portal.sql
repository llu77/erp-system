ALTER TABLE `employees` ADD `sessionVersion` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `employees` ADD `photoKey` varchar(500);--> statement-breakpoint
ALTER TABLE `employees` ADD `iqamaImageKey` varchar(500);--> statement-breakpoint
ALTER TABLE `employees` ADD `healthCertImageKey` varchar(500);--> statement-breakpoint
ALTER TABLE `employees` ADD `contractImageKey` varchar(500);