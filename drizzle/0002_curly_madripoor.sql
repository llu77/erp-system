CREATE TABLE `bonusAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weeklyBonusId` int NOT NULL,
	`action` varchar(100) NOT NULL,
	`oldStatus` varchar(50),
	`newStatus` varchar(50),
	`performedBy` int NOT NULL,
	`performedAt` timestamp NOT NULL DEFAULT (now()),
	`details` text,
	CONSTRAINT `bonusAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bonusDetails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`weeklyBonusId` int NOT NULL,
	`employeeId` int NOT NULL,
	`weeklyRevenue` decimal(15,2) NOT NULL DEFAULT '0.00',
	`bonusAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
	`bonusTier` enum('tier_1','tier_2','tier_3','tier_4','tier_5','none') NOT NULL,
	`isEligible` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bonusDetails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameAr` varchar(255) NOT NULL,
	`address` text,
	`phone` varchar(50),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `branches_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `dailyRevenues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`monthlyRecordId` int NOT NULL,
	`branchId` int NOT NULL,
	`date` timestamp NOT NULL,
	`cash` decimal(15,2) NOT NULL DEFAULT '0.00',
	`network` decimal(15,2) NOT NULL DEFAULT '0.00',
	`balance` decimal(15,2) NOT NULL DEFAULT '0.00',
	`total` decimal(15,2) NOT NULL DEFAULT '0.00',
	`isMatched` boolean NOT NULL DEFAULT true,
	`unmatchReason` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailyRevenues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employeeRevenues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dailyRevenueId` int NOT NULL,
	`employeeId` int NOT NULL,
	`cash` decimal(15,2) NOT NULL DEFAULT '0.00',
	`network` decimal(15,2) NOT NULL DEFAULT '0.00',
	`total` decimal(15,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeRevenues_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(50) NOT NULL,
	`name` varchar(255) NOT NULL,
	`branchId` int NOT NULL,
	`phone` varchar(50),
	`position` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `employees_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `monthlyRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`status` enum('active','closed') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthlyRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `systemLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`level` enum('info','warning','error') NOT NULL DEFAULT 'info',
	`category` varchar(50) NOT NULL,
	`message` text NOT NULL,
	`userId` int,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `systemLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weeklyBonuses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`weekNumber` int NOT NULL,
	`weekStart` timestamp NOT NULL,
	`weekEnd` timestamp NOT NULL,
	`month` int NOT NULL,
	`year` int NOT NULL,
	`status` enum('pending','requested','approved','rejected') NOT NULL DEFAULT 'pending',
	`requestedAt` timestamp,
	`requestedBy` int,
	`approvedAt` timestamp,
	`approvedBy` int,
	`rejectedAt` timestamp,
	`rejectedBy` int,
	`rejectionReason` text,
	`totalAmount` decimal(15,2) NOT NULL DEFAULT '0.00',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `weeklyBonuses_id` PRIMARY KEY(`id`)
);
