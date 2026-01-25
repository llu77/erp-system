CREATE TABLE `employeeLeaveBalance` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`year` int NOT NULL,
	`leaveType` enum('annual','sick','emergency','unpaid') NOT NULL,
	`totalDays` int NOT NULL DEFAULT 0,
	`usedDays` int NOT NULL DEFAULT 0,
	`pendingDays` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employeeLeaveBalance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `requestAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`fileType` varchar(100),
	`fileSize` int,
	`uploadedBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `requestAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `requestTimeline` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestId` int NOT NULL,
	`status` enum('submitted','under_review','pending_approval','approved','rejected','cancelled','completed') NOT NULL,
	`notes` text,
	`actionBy` int,
	`actionByName` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `requestTimeline_id` PRIMARY KEY(`id`)
);
