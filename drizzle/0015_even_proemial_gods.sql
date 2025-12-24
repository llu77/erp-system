CREATE TABLE `deletedRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deletedByUserId` int NOT NULL,
	`deletedByUserName` varchar(200) NOT NULL,
	`entityType` enum('purchase_order','expense','revenue','employee','product','supplier','customer','invoice','employee_request','bonus_request') NOT NULL,
	`originalId` int NOT NULL,
	`originalData` text NOT NULL,
	`reason` text,
	`branchId` int,
	`branchName` varchar(100),
	`deletedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deletedRecords_id` PRIMARY KEY(`id`)
);
