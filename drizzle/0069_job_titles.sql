-- المسمى الوظيفي ثابت: مشرف لحساب المشرف، وحلاق لغيره (لا يُدخل يدوياً)
UPDATE `employees`
SET `position` = CASE WHEN `isSupervisor` = 1 THEN 'مشرف' ELSE 'حلاق' END
WHERE `position` IS NULL
   OR `position` <> CASE WHEN `isSupervisor` = 1 THEN 'مشرف' ELSE 'حلاق' END;--> statement-breakpoint
-- أسطر المسيرات: نفس علامة المشرف التي حددت حافز المشرف في السطر
UPDATE `payrollDetails`
SET `position` = CASE WHEN `isSupervisor` = 1 THEN 'مشرف' ELSE 'حلاق' END
WHERE `position` IS NULL
   OR `position` <> CASE WHEN `isSupervisor` = 1 THEN 'مشرف' ELSE 'حلاق' END;--> statement-breakpoint
-- مخالصات إنهاء الخدمة: من حساب الموظف
UPDATE `endOfServiceSettlements` s
JOIN `employees` e ON e.`id` = s.`employeeId`
SET s.`position` = CASE WHEN e.`isSupervisor` = 1 THEN 'مشرف' ELSE 'حلاق' END
WHERE s.`position` IS NULL
   OR s.`position` <> CASE WHEN e.`isSupervisor` = 1 THEN 'مشرف' ELSE 'حلاق' END;
