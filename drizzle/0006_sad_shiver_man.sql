CREATE TABLE `company_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`type` enum('text','number','boolean','json','image') NOT NULL DEFAULT 'text',
	`category` varchar(50) NOT NULL DEFAULT 'general',
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`updatedBy` int,
	CONSTRAINT `company_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `company_settings_key_unique` UNIQUE(`key`)
);
