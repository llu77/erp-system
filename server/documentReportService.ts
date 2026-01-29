/**
 * خدمة توليد تقرير حالة الوثائق HTML
 * Symbol AI - نظام إدارة الموارد البشرية
 * قالب احترافي يدعم اللغة العربية بالكامل
 */

interface DocumentReportData {
  generatedAt: Date;
  generatedBy: string;
  branchFilter: string | null;
  
  // الملخص
  summary: {
    totalExpired: number;
    totalExpiring: number;
    expiredIqamaCount: number;
    expiringIqamaCount: number;
    expiredHealthCertCount: number;
    expiringHealthCertCount: number;
    expiredContractCount: number;
    expiringContractCount: number;
  };
  
  // الوثائق المنتهية
  expired: {
    iqama: Array<{
      id: number;
      name: string;
      code: string;
      branchName: string;
      iqamaExpiryDate: Date | null;
    }>;
    healthCert: Array<{
      id: number;
      name: string;
      code: string;
      branchName: string;
      healthCertExpiryDate: Date | null;
    }>;
    contract: Array<{
      id: number;
      name: string;
      code: string;
      branchName: string;
      contractExpiryDate: Date | null;
    }>;
  };
  
  // الوثائق قريبة الانتهاء
  expiring: {
    iqama: Array<{
      id: number;
      name: string;
      code: string;
      branchName: string;
      iqamaExpiryDate: Date | null;
    }>;
    healthCert: Array<{
      id: number;
      name: string;
      code: string;
      branchName: string;
      healthCertExpiryDate: Date | null;
    }>;
    contract: Array<{
      id: number;
      name: string;
      code: string;
      branchName: string;
      contractExpiryDate: Date | null;
    }>;
  };
}

const formatDate = (date: Date | string | null): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
};

const formatDateShort = (date: Date | string | null): string => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const getDaysRemaining = (date: Date | string | null): number | null => {
  if (!date) return null;
  const expiryDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);
  const diffTime = expiryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const getStatusBadge = (days: number | null): { text: string; textEn: string; color: string; bgColor: string } => {
  if (days === null) return { text: 'غير محدد', textEn: 'N/A', color: '#64748b', bgColor: '#f1f5f9' };
  if (days < 0) return { text: 'منتهية', textEn: 'EXPIRED', color: '#dc2626', bgColor: '#fef2f2' };
  if (days <= 7) return { text: 'عاجل', textEn: 'URGENT', color: '#dc2626', bgColor: '#fef2f2' };
  if (days <= 30) return { text: 'قريباً', textEn: 'SOON', color: '#d97706', bgColor: '#fffbeb' };
  return { text: 'سارية', textEn: 'VALID', color: '#16a34a', bgColor: '#f0fdf4' };
};

/**
 * توليد HTML لتقرير الوثائق - يدعم العربية بالكامل
 */
export function generateDocumentReportHTML(data: DocumentReportData): string {
  const reportNumber = `DOC-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(Date.now()).slice(-4)}`;
  const branchLabel = data.branchFilter || 'جميع الفروع';
  
  // تجميع جميع الوثائق المنتهية
  const expiredDocs: Array<{
    name: string;
    code: string;
    branch: string;
    docType: string;
    docTypeEn: string;
    expiryDate: Date | null;
    days: number | null;
  }> = [];
  
  data.expired.iqama.forEach(emp => {
    const days = getDaysRemaining(emp.iqamaExpiryDate);
    expiredDocs.push({
      name: emp.name,
      code: emp.code,
      branch: emp.branchName,
      docType: 'الإقامة',
      docTypeEn: 'Iqama',
      expiryDate: emp.iqamaExpiryDate,
      days
    });
  });
  
  data.expired.healthCert.forEach(emp => {
    const days = getDaysRemaining(emp.healthCertExpiryDate);
    expiredDocs.push({
      name: emp.name,
      code: emp.code,
      branch: emp.branchName,
      docType: 'الشهادة الصحية',
      docTypeEn: 'Health Cert',
      expiryDate: emp.healthCertExpiryDate,
      days
    });
  });
  
  data.expired.contract.forEach(emp => {
    const days = getDaysRemaining(emp.contractExpiryDate);
    expiredDocs.push({
      name: emp.name,
      code: emp.code,
      branch: emp.branchName,
      docType: 'العقد',
      docTypeEn: 'Contract',
      expiryDate: emp.contractExpiryDate,
      days
    });
  });
  
  // تجميع الوثائق قريبة الانتهاء
  const expiringDocs: Array<{
    name: string;
    code: string;
    branch: string;
    docType: string;
    docTypeEn: string;
    expiryDate: Date | null;
    days: number | null;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
  }> = [];
  
  data.expiring.iqama.forEach(emp => {
    const days = getDaysRemaining(emp.iqamaExpiryDate);
    const priority = days !== null && days <= 7 ? 'HIGH' : days !== null && days <= 30 ? 'MEDIUM' : 'LOW';
    expiringDocs.push({
      name: emp.name,
      code: emp.code,
      branch: emp.branchName,
      docType: 'الإقامة',
      docTypeEn: 'Iqama',
      expiryDate: emp.iqamaExpiryDate,
      days,
      priority
    });
  });
  
  data.expiring.healthCert.forEach(emp => {
    const days = getDaysRemaining(emp.healthCertExpiryDate);
    const priority = days !== null && days <= 7 ? 'HIGH' : days !== null && days <= 30 ? 'MEDIUM' : 'LOW';
    expiringDocs.push({
      name: emp.name,
      code: emp.code,
      branch: emp.branchName,
      docType: 'الشهادة الصحية',
      docTypeEn: 'Health Cert',
      expiryDate: emp.healthCertExpiryDate,
      days,
      priority
    });
  });
  
  data.expiring.contract.forEach(emp => {
    const days = getDaysRemaining(emp.contractExpiryDate);
    const priority = days !== null && days <= 7 ? 'HIGH' : days !== null && days <= 30 ? 'MEDIUM' : 'LOW';
    expiringDocs.push({
      name: emp.name,
      code: emp.code,
      branch: emp.branchName,
      docType: 'العقد',
      docTypeEn: 'Contract',
      expiryDate: emp.contractExpiryDate,
      days,
      priority
    });
  });
  
  // ترتيب حسب الأولوية
  expiringDocs.sort((a, b) => {
    const priorityOrder = { 'HIGH': 0, 'MEDIUM': 1, 'LOW': 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>تقرير حالة الوثائق - ${reportNumber}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Tajawal', 'Segoe UI', sans-serif;
      direction: rtl;
      background: #ffffff;
      color: #000000;
      line-height: 1.6;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    .page {
      width: 297mm;
      min-height: 210mm;
      padding: 12mm;
      margin: 0 auto;
      background: white;
    }
    
    /* الهيدر */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 15px;
      border-bottom: 3px solid #0f172a;
      margin-bottom: 20px;
    }
    
    .logo-section {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .logo {
      width: 55px;
      height: 55px;
      background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 24px;
      font-weight: 800;
    }
    
    .company-info h1 {
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 3px;
    }
    
    .company-info p {
      font-size: 11px;
      color: #64748b;
    }
    
    .report-meta {
      text-align: left;
      font-size: 10px;
      color: #64748b;
    }
    
    .report-meta .date {
      font-weight: 600;
      color: #0f172a;
    }
    
    /* عنوان التقرير */
    .report-title {
      text-align: center;
      margin-bottom: 20px;
    }
    
    .report-title h2 {
      font-size: 22px;
      font-weight: 700;
      color: #0f172a;
      margin-bottom: 5px;
    }
    
    .report-title .subtitle {
      font-size: 12px;
      color: #64748b;
    }
    
    .report-title .branch-badge {
      display: inline-block;
      background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
      color: white;
      padding: 5px 18px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      margin-top: 8px;
    }
    
    /* بطاقات الملخص */
    .summary-cards {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .summary-card {
      border-radius: 8px;
      padding: 12px;
      text-align: center;
      border: 2px solid;
    }
    
    .summary-card.expired {
      background: #fef2f2;
      border-color: #dc2626;
    }
    
    .summary-card.expiring {
      background: #fffbeb;
      border-color: #d97706;
    }
    
    .summary-card.iqama {
      background: #eff6ff;
      border-color: #2563eb;
    }
    
    .summary-card.contract {
      background: #faf5ff;
      border-color: #9333ea;
    }
    
    .summary-card .icon {
      font-size: 20px;
      margin-bottom: 5px;
    }
    
    .summary-card .label {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 4px;
      font-weight: 600;
    }
    
    .summary-card .value {
      font-size: 24px;
      font-weight: 800;
    }
    
    .summary-card.expired .value { color: #dc2626; }
    .summary-card.expiring .value { color: #d97706; }
    .summary-card.iqama .value { color: #2563eb; }
    .summary-card.contract .value { color: #9333ea; }
    
    /* الجداول */
    .section {
      margin-bottom: 20px;
    }
    
    .section-title {
      font-size: 14px;
      font-weight: 700;
      padding: 8px 12px;
      border-radius: 6px 6px 0 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-title.critical {
      background: #dc2626;
      color: white;
    }
    
    .section-title.warning {
      background: #d97706;
      color: white;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    
    th {
      background: #0f172a;
      color: white;
      padding: 8px 10px;
      text-align: right;
      font-weight: 600;
    }
    
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
      color: #0f172a;
    }
    
    tr:nth-child(even) {
      background: #f8fafc;
    }
    
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 9px;
      font-weight: 700;
    }
    
    .badge-critical {
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #dc2626;
    }
    
    .badge-warning {
      background: #fffbeb;
      color: #d97706;
      border: 1px solid #d97706;
    }
    
    .badge-high {
      background: #fef2f2;
      color: #dc2626;
    }
    
    .badge-medium {
      background: #fffbeb;
      color: #d97706;
    }
    
    .badge-low {
      background: #f0fdf4;
      color: #16a34a;
    }
    
    .text-danger { color: #dc2626 !important; font-weight: 700; }
    .text-warning { color: #d97706 !important; font-weight: 700; }
    .text-success { color: #16a34a !important; font-weight: 700; }
    
    /* التوقيعات */
    .signatures-section {
      margin-top: 25px;
      padding-top: 20px;
      border-top: 2px solid #e2e8f0;
    }
    
    .signatures-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
      text-align: center;
    }
    
    .signature-box {
      padding: 12px;
    }
    
    .signature-box .title {
      font-size: 10px;
      color: #64748b;
      margin-bottom: 30px;
    }
    
    .signature-box .line {
      border-top: 1px solid #0f172a;
      padding-top: 6px;
    }
    
    .signature-box .name {
      font-size: 12px;
      font-weight: 600;
      color: #0f172a;
    }
    
    .signature-box .role {
      font-size: 9px;
      color: #64748b;
    }
    
    .stamp-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    
    .stamp {
      width: 70px;
      height: 70px;
      border: 3px solid #a855f7;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      color: #a855f7;
      font-weight: 700;
      margin-bottom: 5px;
    }
    
    .stamp .company {
      font-size: 8px;
    }
    
    .stamp .symbol {
      font-size: 14px;
    }
    
    /* الفوتر */
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 8px;
      color: #64748b;
    }
    
    .no-data {
      text-align: center;
      padding: 20px;
      color: #16a34a;
      font-size: 12px;
    }
    
    .no-data .icon {
      font-size: 30px;
      margin-bottom: 8px;
    }
    
    @media print {
      body { 
        background: white; 
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .page { 
        box-shadow: none; 
        padding: 8mm;
      }
      .section-title.critical,
      .section-title.warning,
      th {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
    }
    
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
  </style>
</head>
<body>
  <div class="page">
    <!-- الهيدر -->
    <div class="header">
      <div class="logo-section">
        <div class="logo">S</div>
        <div class="company-info">
          <h1>Symbol AI</h1>
          <p>نظام إدارة الموارد البشرية</p>
        </div>
      </div>
      <div class="report-meta">
        <p>تاريخ الإصدار: <span class="date">${formatDate(data.generatedAt)}</span></p>
        <p>أعده: ${data.generatedBy}</p>
        <p>رقم التقرير: ${reportNumber}</p>
      </div>
    </div>
    
    <!-- عنوان التقرير -->
    <div class="report-title">
      <h2>تقرير حالة وثائق الموظفين</h2>
      <p class="subtitle">Employee Documents Status Report</p>
      <span class="branch-badge">${branchLabel}</span>
    </div>
    
    <!-- بطاقات الملخص -->
    <div class="summary-cards">
      <div class="summary-card expired">
        <div class="icon">⚠️</div>
        <div class="label">وثائق منتهية</div>
        <div class="value">${data.summary.totalExpired}</div>
      </div>
      <div class="summary-card expiring">
        <div class="icon">⏰</div>
        <div class="label">قريبة الانتهاء</div>
        <div class="value">${data.summary.totalExpiring}</div>
      </div>
      <div class="summary-card iqama">
        <div class="icon">🪪</div>
        <div class="label">مشاكل الإقامة</div>
        <div class="value">${data.summary.expiredIqamaCount + data.summary.expiringIqamaCount}</div>
      </div>
      <div class="summary-card contract">
        <div class="icon">📄</div>
        <div class="label">مشاكل العقود</div>
        <div class="value">${data.summary.expiredContractCount + data.summary.expiringContractCount}</div>
      </div>
    </div>
    
    ${expiredDocs.length > 0 ? `
    <!-- الوثائق المنتهية -->
    <div class="section">
      <div class="section-title critical">
        ⚠️ وثائق منتهية تتطلب إجراء فوري - Expired Documents Requiring Immediate Action
      </div>
      <table>
        <thead>
          <tr>
            <th>اسم الموظف</th>
            <th>الكود</th>
            <th>الفرع</th>
            <th>نوع الوثيقة</th>
            <th>تاريخ الانتهاء</th>
            <th>الحالة</th>
            <th>الأولوية</th>
          </tr>
        </thead>
        <tbody>
          ${expiredDocs.map(doc => `
            <tr>
              <td><strong>${doc.name}</strong></td>
              <td>${doc.code}</td>
              <td>${doc.branch}</td>
              <td>${doc.docType} (${doc.docTypeEn})</td>
              <td>${formatDateShort(doc.expiryDate)}</td>
              <td class="text-danger">${doc.days !== null ? `منتهية منذ ${Math.abs(doc.days)} يوم` : '-'}</td>
              <td><span class="badge badge-critical">حرج - CRITICAL</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : `
    <div class="section">
      <div class="section-title" style="background: #16a34a; color: white;">
        ✅ لا توجد وثائق منتهية - No Expired Documents
      </div>
      <div class="no-data">
        <div class="icon">✅</div>
        <p>جميع الوثائق سارية المفعول</p>
      </div>
    </div>
    `}
    
    ${expiringDocs.length > 0 ? `
    <!-- الوثائق قريبة الانتهاء -->
    <div class="section">
      <div class="section-title warning">
        ⏰ وثائق قريبة الانتهاء - Documents Expiring Soon
      </div>
      <table>
        <thead>
          <tr>
            <th>اسم الموظف</th>
            <th>الكود</th>
            <th>الفرع</th>
            <th>نوع الوثيقة</th>
            <th>تاريخ الانتهاء</th>
            <th>المتبقي</th>
            <th>الأولوية</th>
          </tr>
        </thead>
        <tbody>
          ${expiringDocs.map(doc => `
            <tr>
              <td><strong>${doc.name}</strong></td>
              <td>${doc.code}</td>
              <td>${doc.branch}</td>
              <td>${doc.docType} (${doc.docTypeEn})</td>
              <td>${formatDateShort(doc.expiryDate)}</td>
              <td class="${doc.priority === 'HIGH' ? 'text-danger' : doc.priority === 'MEDIUM' ? 'text-warning' : 'text-success'}">${doc.days} يوم</td>
              <td><span class="badge badge-${doc.priority.toLowerCase()}">${doc.priority === 'HIGH' ? 'عالي' : doc.priority === 'MEDIUM' ? 'متوسط' : 'منخفض'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ` : ''}
    
    <!-- التوقيعات والختم -->
    <div class="signatures-section">
      <div class="signatures-grid">
        <div class="signature-box">
          <div class="title">المشرف العام - General Supervisor</div>
          <div class="line">
            <div class="name">سالم الوادعي</div>
            <div class="role">Salem Al-Wadei</div>
          </div>
        </div>
        
        <div class="signature-box stamp-box">
          <div class="stamp">
            <span class="company">Symbol AI</span>
            <span class="symbol">✓</span>
            <span class="company">معتمد</span>
          </div>
          <div class="role">ختم الشركة</div>
        </div>
        
        <div class="signature-box">
          <div class="title">المدير - Manager</div>
          <div class="line">
            <div class="name">عمر المطيري</div>
            <div class="role">Omar Al-Mutairi</div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- الفوتر -->
    <div class="footer">
      <p>هذا التقرير تم إنشاؤه آلياً بواسطة نظام Symbol AI لإدارة الموارد البشرية</p>
      <p>All rights reserved to Symbol AI © ${new Date().getFullYear()}</p>
    </div>
  </div>
  
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>
`;
}

export default { generateDocumentReportHTML };
