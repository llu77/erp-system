# تصميم نظام خصم الزيارة الثالثة

## المتطلبات

### القاعدة الأساسية
- كل 3 زيارات **موافق عليها (approved)**، الزيارة الثالثة تحصل على خصم **60%**
- الخصم نسبة مئوية من إجمالي الفاتورة
- يجب التحقق من أن الزيارات تمت الموافقة عليها

### تدفق البيانات
```
عميل الولاء → زيارات موافق عليها → كل 3 زيارات = خصم 3 ريال
                                    ↓
                            يظهر في الكاشير
                                    ↓
                            قائمة منسدلة + حاسبة
                                    ↓
                            يُطبق على الفاتورة
```

## التصميم المعماري

### 1. منطق حساب الخصم

```typescript
// المنطق الأساسي
function calculateLoyaltyDiscount(approvedVisits: number, invoiceTotal: number): { 
  discountPercentage: number;
  discountAmount: number; 
  isEligible: boolean;
  discountVisitNumber: number;
} {
  // كل 3 زيارات موافق عليها = خصم 60%
  const VISITS_FOR_DISCOUNT = 3;
  const DISCOUNT_PERCENTAGE = 60; // نسبة مئوية
  
  // التحقق من أن الزيارة الحالية هي الثالثة (أو مضاعفاتها)
  const visitInCycle = approvedVisits % VISITS_FOR_DISCOUNT;
  const isEligible = visitInCycle === 0 && approvedVisits > 0;
  
  const discountAmount = isEligible ? (invoiceTotal * DISCOUNT_PERCENTAGE / 100) : 0;
  
  return {
    discountPercentage: isEligible ? DISCOUNT_PERCENTAGE : 0,
    discountAmount,
    isEligible,
    discountVisitNumber: approvedVisits,
  };
}
```

### 2. تعديلات قاعدة البيانات

لا حاجة لتعديل الجداول الحالية. سنستخدم:
- `loyaltyVisits.status = 'approved'` للتحقق من الموافقة
- `loyaltySettings` لتخزين إعدادات الخصم (اختياري)

### 3. API Endpoints

#### 3.1 جلب عملاء الولاء المؤهلين للخصم
```typescript
// pos.loyaltyCustomers.getEligibleForDiscount
// يجلب العملاء الذين لديهم زيارات موافق عليها ومؤهلين للخصم
```

#### 3.2 التحقق من خصم عميل محدد
```typescript
// pos.loyaltyCustomers.checkDiscountByPhone
// يتحقق من عدد الزيارات الموافق عليها ويحسب الخصم
```

### 4. واجهة الكاشير

#### 4.1 القائمة المنسدلة
- تظهر عملاء الولاء المؤهلين للخصم
- تعرض: الاسم، رقم الجوال، عدد الزيارات، مبلغ الخصم

#### 4.2 حاسبة الخصم
- تعرض: عدد الزيارات الموافق عليها
- تعرض: هل الزيارة الحالية مؤهلة للخصم
- تعرض: مبلغ الخصم (3 ريال)

#### 4.3 تطبيق الخصم
- عند اختيار عميل من القائمة
- يُطبق الخصم تلقائياً على الفاتورة
- يُسجل في الفاتورة كـ "خصم ولاء"

## الحالات الحدية (Edge Cases)

1. **عميل بدون زيارات موافق عليها**: لا يظهر في القائمة
2. **عميل بزيارة واحدة أو اثنتين**: يظهر مع "غير مؤهل"
3. **عميل بـ 3 زيارات**: مؤهل لخصم 3 ريال
4. **عميل بـ 6 زيارات**: مؤهل لخصم 3 ريال (الدورة الثانية)
5. **استخدام الخصم مرتين في نفس اليوم**: ممنوع

## خطة التنفيذ

### Phase 3: Backend
1. إضافة دالة `getApprovedVisitsCount` في db.ts
2. إضافة دالة `getEligibleLoyaltyCustomers` في db.ts
3. إضافة endpoint `pos.loyaltyCustomers.getEligible`
4. إضافة endpoint `pos.loyaltyCustomers.checkDiscountByPhone`

### Phase 4: Frontend
1. إضافة قائمة منسدلة في POS.tsx
2. إضافة حاسبة الخصم
3. تعديل منطق الفاتورة لتطبيق الخصم
