ALTER TABLE `weeklyBonuses` MODIFY COLUMN `status` enum('pending','requested','approved','rejected','paid') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `weeklyBonuses` ADD `paidAt` timestamp;--> statement-breakpoint
ALTER TABLE `weeklyBonuses` ADD `paidBy` int;--> statement-breakpoint
ALTER TABLE `weeklyBonuses` ADD `paymentMethod` enum('cash','bank_transfer','check');--> statement-breakpoint
ALTER TABLE `weeklyBonuses` ADD `paymentReference` varchar(255);--> statement-breakpoint
ALTER TABLE `weeklyBonuses` ADD `paymentNotes` text;