CREATE TABLE `conversation_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`toolCalls` text,
	`toolResults` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `conversation_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `conversation_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`employeeId` int NOT NULL,
	`employeeName` varchar(100),
	`branchId` int,
	`branchName` varchar(100),
	`status` enum('active','closed') NOT NULL DEFAULT 'active',
	`messageCount` int NOT NULL DEFAULT 0,
	`lastMessageAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `conversation_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `conversation_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `pending_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` varchar(64) NOT NULL,
	`employeeId` int NOT NULL,
	`requestType` varchar(50) NOT NULL,
	`requestData` text NOT NULL,
	`summary` text NOT NULL,
	`status` enum('pending','confirmed','cancelled','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp NOT NULL,
	`confirmedAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pending_requests_id` PRIMARY KEY(`id`)
);
