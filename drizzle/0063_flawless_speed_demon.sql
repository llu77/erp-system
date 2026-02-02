ALTER TABLE `dailyRevenues` ADD `posConfirmed` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `dailyRevenues` ADD `posConfirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `dailyRevenues` ADD `posConfirmedBy` varchar(100);