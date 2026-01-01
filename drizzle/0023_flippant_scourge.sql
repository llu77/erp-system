CREATE TABLE `loyaltyServiceTypes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyaltyServiceTypes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loyaltySettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requiredVisitsForDiscount` int NOT NULL DEFAULT 4,
	`discountPercentage` int NOT NULL DEFAULT 50,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyaltySettings_id` PRIMARY KEY(`id`)
);
