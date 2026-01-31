ALTER TABLE `dailyRevenues` ADD `loyalty` decimal(15,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `dailyRevenues` ADD `loyaltyInvoiceImage` json;