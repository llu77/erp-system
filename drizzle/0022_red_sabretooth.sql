CREATE TABLE `loyaltyCustomers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`email` varchar(255),
	`totalVisits` int NOT NULL DEFAULT 0,
	`totalDiscountsUsed` int NOT NULL DEFAULT 0,
	`branchId` int,
	`branchName` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loyaltyCustomers_id` PRIMARY KEY(`id`),
	CONSTRAINT `loyaltyCustomers_customerId_unique` UNIQUE(`customerId`),
	CONSTRAINT `loyaltyCustomers_phone_unique` UNIQUE(`phone`)
);
--> statement-breakpoint
CREATE TABLE `loyaltyVisits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitId` varchar(50) NOT NULL,
	`customerId` int NOT NULL,
	`customerName` varchar(255) NOT NULL,
	`customerPhone` varchar(20) NOT NULL,
	`serviceType` varchar(255) NOT NULL,
	`visitDate` timestamp NOT NULL DEFAULT (now()),
	`branchId` int,
	`branchName` varchar(255),
	`isDiscountVisit` boolean NOT NULL DEFAULT false,
	`discountPercentage` int NOT NULL DEFAULT 0,
	`visitNumberInMonth` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loyaltyVisits_id` PRIMARY KEY(`id`),
	CONSTRAINT `loyaltyVisits_visitId_unique` UNIQUE(`visitId`)
);
