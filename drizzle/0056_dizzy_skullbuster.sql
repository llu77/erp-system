CREATE TABLE `portalNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`type` enum('request_approved','request_rejected','request_pending','document_expiring','document_expired','salary_ready','bonus_approved','announcement','task_assigned','reminder','system') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`actionUrl` varchar(500),
	`actionLabel` varchar(100),
	`metadata` json,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `portalNotifications_id` PRIMARY KEY(`id`)
);
