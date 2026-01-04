CREATE TABLE `bonusTierAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255) NOT NULL,
	`tierId` int,
	`tierKey` varchar(20),
	`changeType` enum('create','update','delete') NOT NULL,
	`oldValues` text,
	`newValues` text,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bonusTierAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bonusTierSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tierKey` varchar(20) NOT NULL,
	`tierName` varchar(100) NOT NULL,
	`minRevenue` decimal(10,2) NOT NULL,
	`maxRevenue` decimal(10,2),
	`bonusAmount` decimal(10,2) NOT NULL,
	`color` varchar(20) NOT NULL DEFAULT 'gray',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bonusTierSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `bonusTierSettings_tierKey_unique` UNIQUE(`tierKey`)
);
