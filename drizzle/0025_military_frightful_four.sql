CREATE TABLE `loyaltySettingsAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255) NOT NULL,
	`changeType` enum('settings','service_add','service_update','service_delete') NOT NULL,
	`oldValues` text,
	`newValues` text,
	`description` text,
	`serviceId` int,
	`serviceName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loyaltySettingsAuditLog_id` PRIMARY KEY(`id`)
);
