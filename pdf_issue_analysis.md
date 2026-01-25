# تحليل مشكلة PDF لكشف الراتب

## المرحلة 1: الفهم العميق (Understand)

### 1.1 وصف المشكلة
- **الأعراض**: عند النقر على زر "تحميل PDF" في صفحة كشف الراتب، يظهر خطأ في console: `Error generating PDF: undefined`
- **رسائل الخطأ الإضافية**: `[API Query Error] undefined` و `404 errors`
- **السلوك المتوقع**: يجب أن يتم تنزيل ملف PDF يحتوي على كشف الراتب

### 1.2 تتبع تدفق البيانات
```
User clicks "تحميل PDF" 
    → generatePDF() function called
    → Checks if salarySlip data exists
    → Creates jsPDF document
    → Generates PDF content
    → Downloads file
```

### 1.3 نقاط الفحص
- [ ] التحقق من وجود بيانات salarySlip
- [ ] التحقق من استيراد مكتبة jsPDF بشكل صحيح
- [ ] التحقق من API endpoint getSalarySlip
- [ ] التحقق من الأخطاء في console

### 1.4 الملفات المعنية
1. `client/src/components/portal/SalarySlip.tsx` - مكون كشف الراتب
2. `server/routers.ts` - نقطة النهاية API
3. `server/db.ts` - دالة جلب البيانات

---

## المرحلة 2: التحليل الهيكلي

### 2.1 هيكل المكون SalarySlip.tsx
- استيراد jsPDF و jspdf-autotable
- استخدام trpc.employeePortal.getSalarySlip.useQuery
- دالة generatePDF() لتوليد PDF

### 2.2 تدفق البيانات
```
Frontend (SalarySlip.tsx)
    → trpc.employeePortal.getSalarySlip.useQuery({ employeeId, year, month })
    → Server (routers.ts) employeePortal.getSalarySlip
    → Database (db.ts) getEmployeeSalarySlip()
    → Return data to frontend
    → generatePDF() uses salarySlip data
```

---

## نتائج التحليل

### 3.1 المشكلة المكتشفة
- **jsPDF غير متاح في المتصفح**: `jsPDF available: false`
- **خطأ API**: `[API Query Error] undefined`
- **أخطاء 404**: موارد غير موجودة

### 3.2 السبب الجذري
1. **مشكلة استيراد jsPDF**: المكتبة لا يتم تحميلها بشكل صحيح في المتصفح
2. **مشكلة في catch block**: الخطأ يُطبع كـ `undefined` مما يعني أن الخطأ الفعلي غير معروف

### 3.3 الحل المقترح
1. تحسين معالجة الأخطاء في دالة generatePDF
2. التحقق من صحة استيراد jsPDF
3. إضافة تسجيل أفضل للأخطاء
