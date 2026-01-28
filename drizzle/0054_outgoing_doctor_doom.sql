CREATE TABLE `scheduledAIReportLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`reportType` varchar(50) NOT NULL,
	`status` enum('success','failed') NOT NULL,
	`executionTimeMs` int,
	`reportContent` json,
	`emailsSent` int NOT NULL DEFAULT 0,
	`recipientList` json,
	`errorMessage` text,
	`errorStack` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `scheduledAIReportLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledAIReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportType` enum('weekly_ai_summary','risk_alerts','performance_analysis','compliance_report','financial_forecast') NOT NULL,
	`scheduleType` enum('daily','weekly','monthly') NOT NULL DEFAULT 'weekly',
	`scheduleDay` int NOT NULL DEFAULT 0,
	`scheduleTime` varchar(10) NOT NULL DEFAULT '08:00',
	`recipientEmails` json NOT NULL,
	`sendToOwner` boolean NOT NULL DEFAULT true,
	`branchId` int,
	`branchName` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`lastRunStatus` enum('success','failed','pending') DEFAULT 'pending',
	`lastRunError` text,
	`totalRuns` int NOT NULL DEFAULT 0,
	`successfulRuns` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdByName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduledAIReports_id` PRIMARY KEY(`id`)
);
