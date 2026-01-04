ALTER TABLE `employeeRequests` ADD `isDeductedFromSalary` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `employeeRequests` ADD `deductedInPayrollId` int;--> statement-breakpoint
ALTER TABLE `employeeRequests` ADD `deductedAt` timestamp;