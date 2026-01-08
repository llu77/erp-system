import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// تعريف الأنواع
interface BonusEmployee {
  employeeName: string;
  employeeCode: string;
  weeklyRevenue: string | number;
  bonusTier: string;
  bonusAmount: string | number;
  isEligible: boolean;
}

interface BonusRequest {
  id: number;
  branchName: string;
  weekNumber: number;
  month: number;
  year: number;
  status: string;
  totalAmount: string | number;
  eligibleCount: number;
  totalEmployees: number;
  requestedAt?: string | Date | null;
  details: BonusEmployee[];
}

// خريطة أسماء المستويات
const getTierLabel = (tier: string): string => {
  const labels: Record<string, string> = {
    tier_7: 'Level 7',
    tier_6: 'Level 6',
    tier_5: 'Level 5',
    tier_4: 'Level 4',
    tier_3: 'Level 3',
    tier_2: 'Level 2',
    tier_1: 'Level 1',
    none: 'Not Eligible',
  };
  return labels[tier] || tier;
};

// خريطة حالات البونص
const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'Draft',
    requested: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    paid: 'Paid',
  };
  return labels[status] || status;
};

// أسماء الأشهر بالعربية
const getMonthName = (month: number): string => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || '';
};

// تنسيق العملة
const formatCurrency = (amount: number | string): string => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return `${num.toFixed(2)} SAR`;
};

/**
 * توليد PDF لتقرير البونص الأسبوعي من جهة العميل
 */
export function generateBonusPDF(request: BonusRequest): void {
  // إنشاء مستند PDF جديد
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // ألوان
  const primaryColor: [number, number, number] = [26, 26, 26];
  const greenColor: [number, number, number] = [34, 197, 94];
  const grayColor: [number, number, number] = [107, 114, 128];

  // رأس التقرير
  doc.setFillColor(...primaryColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  // شعار الشركة
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Symbol AI', pageWidth - margin, 15, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('AI Solutions Company', pageWidth - margin, 22, { align: 'right' });

  // عنوان التقرير
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Weekly Bonus Report', pageWidth / 2, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Branch: ${request.branchName}`, pageWidth / 2, 22, { align: 'center' });
  doc.text(`Week ${request.weekNumber} - ${getMonthName(request.month)} ${request.year}`, pageWidth / 2, 28, { align: 'center' });

  // شريط الحالة
  doc.setFillColor(245, 245, 245);
  doc.rect(0, 35, pageWidth, 20, 'F');

  let yPos = 48;
  doc.setTextColor(...grayColor);
  doc.setFontSize(9);
  
  // معلومات الحالة
  const infoItems = [
    { label: 'Status', value: getStatusLabel(request.status) },
    { label: 'Total Bonus', value: formatCurrency(request.totalAmount) },
    { label: 'Eligible', value: `${request.eligibleCount}/${request.totalEmployees}` },
  ];

  const itemWidth = (pageWidth - 2 * margin) / infoItems.length;
  infoItems.forEach((item, index) => {
    const x = margin + itemWidth * index + itemWidth / 2;
    doc.setTextColor(...grayColor);
    doc.text(item.label, x, 42, { align: 'center' });
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text(item.value, x, 48, { align: 'center' });
    doc.setFont('helvetica', 'normal');
  });

  yPos = 65;

  // بطاقات الإحصائيات
  doc.setFillColor(240, 253, 244);
  doc.roundedRect(margin, yPos, (pageWidth - 2 * margin - 10) / 2, 25, 3, 3, 'F');
  
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(margin + (pageWidth - 2 * margin - 10) / 2 + 10, yPos, (pageWidth - 2 * margin - 10) / 2, 25, 3, 3, 'F');

  // إحصائية 1: إجمالي البونص
  doc.setTextColor(...greenColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(request.totalAmount), margin + (pageWidth - 2 * margin - 10) / 4, yPos + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Total Bonus', margin + (pageWidth - 2 * margin - 10) / 4, yPos + 19, { align: 'center' });

  // إحصائية 2: عدد المؤهلين
  doc.setTextColor(59, 130, 246);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const stat2X = margin + (pageWidth - 2 * margin - 10) / 2 + 10 + (pageWidth - 2 * margin - 10) / 4;
  doc.text(`${request.eligibleCount} / ${request.totalEmployees}`, stat2X, yPos + 12, { align: 'center' });
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Eligible Employees', stat2X, yPos + 19, { align: 'center' });

  yPos += 35;

  // عنوان جدول الموظفين
  doc.setTextColor(...primaryColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Employee Details', margin, yPos);
  yPos += 8;

  // جدول الموظفين
  const tableData = request.details.map((emp, index) => [
    (index + 1).toString(),
    emp.employeeName || 'Unknown',
    emp.employeeCode || '-',
    formatCurrency(emp.weeklyRevenue),
    getTierLabel(emp.bonusTier),
    emp.isEligible ? formatCurrency(emp.bonusAmount) : '-',
  ]);

  // إضافة صف الإجمالي
  const totalRevenue = request.details.reduce((sum, emp) => sum + (parseFloat(String(emp.weeklyRevenue)) || 0), 0);
  tableData.push([
    '',
    'Total',
    '',
    formatCurrency(totalRevenue),
    `${request.eligibleCount} Eligible`,
    formatCurrency(request.totalAmount),
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['#', 'Employee', 'Code', 'Weekly Revenue', 'Tier', 'Bonus']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 40, halign: 'left' },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 30 },
      5: { cellWidth: 30 },
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    margin: { left: margin, right: margin },
    didParseCell: function(data: any) {
      // تنسيق صف الإجمالي
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [240, 240, 240];
        if (data.column.index === 5) {
          data.cell.styles.textColor = greenColor;
        }
      }
    },
  });

  // الحصول على موضع Y بعد الجدول
  const finalY = (doc as any).lastAutoTable?.finalY || yPos + 100;

  // ذيل التقرير
  doc.setFillColor(245, 245, 245);
  doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');

  doc.setTextColor(...grayColor);
  doc.setFontSize(8);
  doc.text(
    `Generated by Symbol AI System | Date: ${new Date().toLocaleDateString('en-US')} | Time: ${new Date().toLocaleTimeString('en-US')}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  );

  // حفظ الملف
  const filename = `bonus-report-${request.branchName}-week${request.weekNumber}-${request.month}-${request.year}.pdf`;
  doc.save(filename);
}
