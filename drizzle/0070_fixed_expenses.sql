CREATE TABLE `recurringExpenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`category` enum('shop_supplies','printing','carpet_cleaning','small_needs','residency','medical_exam','transportation','electricity','internet','license_renewal','visa','residency_renewal','health_cert_renewal','maintenance','health_cert','violation','emergency','shop_rent','housing_rent','improvements','bonus','other') NOT NULL,
	`title` varchar(255) NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`paymentMethod` enum('cash','bank_transfer','check','credit_card','other') NOT NULL DEFAULT 'cash',
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`startsOn` varchar(7) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurringExpenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `expenses` MODIFY COLUMN `category` enum('shop_supplies','printing','carpet_cleaning','small_needs','residency','medical_exam','transportation','electricity','internet','license_renewal','visa','residency_renewal','health_cert_renewal','maintenance','health_cert','violation','emergency','shop_rent','housing_rent','improvements','bonus','other','salaries') NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `source` enum('manual','fixed','payroll') DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `sourceKey` varchar(100);--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_sourceKey_unique` UNIQUE(`sourceKey`);