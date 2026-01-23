ALTER TABLE `loyaltyCustomers` ADD `cycleStartDate` timestamp;--> statement-breakpoint
ALTER TABLE `loyaltyCustomers` ADD `cycleVisitsCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `loyaltyCustomers` ADD `cycleDiscountUsed` boolean DEFAULT false NOT NULL;