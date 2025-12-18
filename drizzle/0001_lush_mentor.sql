CREATE TABLE `activityLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userName` varchar(200),
	`action` varchar(50) NOT NULL,
	`entityType` varchar(50) NOT NULL,
	`entityId` int,
	`details` text,
	`ipAddress` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activityLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`parentId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`phone2` varchar(20),
	`address` text,
	`city` varchar(100),
	`country` varchar(100),
	`taxNumber` varchar(50),
	`creditLimit` decimal(12,2) DEFAULT '0',
	`balance` decimal(12,2) DEFAULT '0',
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `inventoryMovements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`type` enum('in','out','adjustment') NOT NULL,
	`quantity` int NOT NULL,
	`previousQuantity` int NOT NULL,
	`newQuantity` int NOT NULL,
	`referenceType` varchar(50),
	`referenceId` int,
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventoryMovements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoiceItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceId` int NOT NULL,
	`productId` int,
	`productName` varchar(200) NOT NULL,
	`productSku` varchar(50),
	`quantity` int NOT NULL,
	`unitPrice` decimal(12,2) NOT NULL,
	`discount` decimal(12,2) DEFAULT '0',
	`total` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `invoiceItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`invoiceNumber` varchar(50) NOT NULL,
	`customerId` int,
	`customerName` varchar(200),
	`invoiceDate` timestamp NOT NULL DEFAULT (now()),
	`dueDate` timestamp,
	`subtotal` decimal(12,2) NOT NULL,
	`taxRate` decimal(5,2) DEFAULT '0',
	`taxAmount` decimal(12,2) DEFAULT '0',
	`discountRate` decimal(5,2) DEFAULT '0',
	`discountAmount` decimal(12,2) DEFAULT '0',
	`total` decimal(12,2) NOT NULL,
	`paidAmount` decimal(12,2) DEFAULT '0',
	`status` enum('draft','pending','paid','partial','cancelled') NOT NULL DEFAULT 'draft',
	`paymentMethod` varchar(50),
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `invoices_invoiceNumber_unique` UNIQUE(`invoiceNumber`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`type` enum('low_stock','new_order','large_sale','payment_due','system') NOT NULL,
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`relatedId` int,
	`relatedType` varchar(50),
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(50) NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`categoryId` int,
	`costPrice` decimal(12,2) NOT NULL,
	`sellingPrice` decimal(12,2) NOT NULL,
	`quantity` int NOT NULL DEFAULT 0,
	`minQuantity` int NOT NULL DEFAULT 10,
	`unit` varchar(20) DEFAULT 'قطعة',
	`barcode` varchar(50),
	`imageUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `products_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`purchaseOrderId` int NOT NULL,
	`productId` int,
	`productName` varchar(200) NOT NULL,
	`productSku` varchar(50),
	`quantity` int NOT NULL,
	`receivedQuantity` int DEFAULT 0,
	`unitCost` decimal(12,2) NOT NULL,
	`total` decimal(12,2) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `purchaseOrderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `purchaseOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderNumber` varchar(50) NOT NULL,
	`supplierId` int,
	`supplierName` varchar(200),
	`orderDate` timestamp NOT NULL DEFAULT (now()),
	`expectedDate` timestamp,
	`receivedDate` timestamp,
	`subtotal` decimal(12,2) NOT NULL,
	`taxRate` decimal(5,2) DEFAULT '0',
	`taxAmount` decimal(12,2) DEFAULT '0',
	`shippingCost` decimal(12,2) DEFAULT '0',
	`total` decimal(12,2) NOT NULL,
	`paidAmount` decimal(12,2) DEFAULT '0',
	`status` enum('draft','pending','approved','received','partial','cancelled') NOT NULL DEFAULT 'draft',
	`paymentStatus` enum('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
	`notes` text,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchaseOrders_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchaseOrders_orderNumber_unique` UNIQUE(`orderNumber`)
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(20) NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(320),
	`phone` varchar(20),
	`phone2` varchar(20),
	`address` text,
	`city` varchar(100),
	`country` varchar(100),
	`taxNumber` varchar(50),
	`contactPerson` varchar(100),
	`paymentTerms` varchar(100),
	`balance` decimal(12,2) DEFAULT '0',
	`notes` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `suppliers_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','manager','employee') NOT NULL DEFAULT 'employee';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `users` ADD `department` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `position` varchar(100);--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;