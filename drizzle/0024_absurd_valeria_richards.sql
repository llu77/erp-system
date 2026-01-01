ALTER TABLE `loyaltyVisits` ADD `invoiceImageUrl` text;--> statement-breakpoint
ALTER TABLE `loyaltyVisits` ADD `invoiceImageKey` varchar(255);--> statement-breakpoint
ALTER TABLE `loyaltyVisits` ADD `status` enum('pending','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `loyaltyVisits` ADD `approvedBy` int;--> statement-breakpoint
ALTER TABLE `loyaltyVisits` ADD `approvedAt` timestamp;--> statement-breakpoint
ALTER TABLE `loyaltyVisits` ADD `rejectionReason` text;