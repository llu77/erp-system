CREATE TABLE `aiAnalytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisType` enum('sales_forecast','customer_segmentation','anomaly_detection','inventory_optimization','pricing_recommendation','marketing_recommendation') NOT NULL,
	`branchId` int,
	`dateRange` json,
	`results` json NOT NULL,
	`confidence` decimal(5,2),
	`isActive` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiAnalytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiRecommendations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`type` enum('inventory_reorder','pricing_change','customer_retention','marketing_campaign','staffing','general') NOT NULL,
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`title` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`actionRequired` text,
	`relatedEntityType` varchar(50),
	`relatedEntityId` int,
	`metadata` json,
	`status` enum('pending','viewed','actioned','dismissed') NOT NULL DEFAULT 'pending',
	`viewedBy` int,
	`viewedAt` timestamp,
	`actionedBy` int,
	`actionedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiRecommendations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customDashboards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`layout` json NOT NULL,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customDashboards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customerSegments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`recencyScore` int NOT NULL,
	`frequencyScore` int NOT NULL,
	`monetaryScore` int NOT NULL,
	`rfmScore` varchar(10) NOT NULL,
	`segment` enum('champions','loyal_customers','potential_loyalists','new_customers','promising','need_attention','about_to_sleep','at_risk','cant_lose','hibernating','lost') NOT NULL,
	`lastPurchaseDate` timestamp,
	`totalPurchases` int NOT NULL DEFAULT 0,
	`totalSpent` decimal(12,2) NOT NULL DEFAULT '0',
	`avgOrderValue` decimal(12,2) NOT NULL DEFAULT '0',
	`predictedClv` decimal(12,2),
	`churnRisk` decimal(5,2),
	`calculatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `customerSegments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reportExecutionLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`executedBy` int,
	`executionType` enum('manual','scheduled') NOT NULL,
	`status` enum('success','failed') NOT NULL,
	`durationMs` int,
	`rowsReturned` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reportExecutionLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reportSchedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`scheduleType` enum('daily','weekly','monthly') NOT NULL,
	`scheduleTime` varchar(10) NOT NULL,
	`scheduleDay` int,
	`recipients` json NOT NULL,
	`format` enum('pdf','excel','csv') NOT NULL DEFAULT 'pdf',
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reportSchedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savedReports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`createdBy` int NOT NULL,
	`config` json NOT NULL,
	`isPublic` boolean NOT NULL DEFAULT false,
	`category` varchar(50),
	`lastRunAt` timestamp,
	`runCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savedReports_id` PRIMARY KEY(`id`)
);
