CREATE TABLE `employeeNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`employeeId` int NOT NULL,
	`type` enum('request_status','salary_ready','task_assigned','leave_balance','bonus_ready','general') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`relatedType` varchar(50),
	`relatedId` int,
	`isRead` boolean NOT NULL DEFAULT false,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employeeNotifications_id` PRIMARY KEY(`id`)
);
