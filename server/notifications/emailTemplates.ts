// قوالب البريد الإلكتروني الرسمية والمتقدمة
// Symbol AI - نظام إدارة الأعمال

// ==================== القالب الأساسي ====================
export function getBaseTemplate(content: string, title: string): string {
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
          font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
          direction: rtl;
          text-align: right;
          background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%);
          padding: 40px 20px;
          min-height: 100vh;
        }
        
        .email-container {
          max-width: 650px;
          margin: 0 auto;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }
        
        .header {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          padding: 35px 30px;
          text-align: center;
          position: relative;
        }
        
        .header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #a855f7, #3b82f6, #22c55e, #eab308);
        }
        
        .logo {
          width: 60px;
          height: 60px;
          background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
          border-radius: 12px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
        }
        
        .logo-text {
          color: white;
          font-size: 24px;
          font-weight: bold;
        }
        
        .header h1 {
          color: #ffffff;
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 8px;
        }
        
        .header .subtitle {
          color: rgba(255, 255, 255, 0.8);
          font-size: 14px;
        }
        
        .content {
          padding: 35px 30px;
          background: #ffffff;
        }
        
        .greeting {
          font-size: 16px;
          color: #1a1a2e;
          margin-bottom: 20px;
          line-height: 1.8;
        }
        
        .greeting strong {
          color: #a855f7;
        }
        
        .alert-box {
          padding: 20px;
          border-radius: 12px;
          margin: 20px 0;
        }
        
        .alert-box.info {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-right: 4px solid #3b82f6;
        }
        
        .alert-box.warning {
          background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
          border-right: 4px solid #eab308;
        }
        
        .alert-box.success {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border-right: 4px solid #22c55e;
        }
        
        .alert-box.danger {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          border-right: 4px solid #ef4444;
        }
        
        .alert-box.purple {
          background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
          border-right: 4px solid #a855f7;
        }
        
        .details-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          margin: 20px 0;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .details-table th {
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: white;
          padding: 14px 16px;
          text-align: right;
          font-weight: 600;
          font-size: 13px;
        }
        
        .details-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
          color: #374151;
        }
        
        .details-table tr:last-child td {
          border-bottom: none;
        }
        
        .details-table tr:nth-child(even) {
          background: #f8fafc;
        }
        
        .info-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
          margin: 20px 0;
        }
        
        .info-item {
          background: #f8fafc;
          padding: 15px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }
        
        .info-item .label {
          font-size: 12px;
          color: #64748b;
          margin-bottom: 5px;
        }
        
        .info-item .value {
          font-size: 16px;
          font-weight: 600;
          color: #1a1a2e;
        }
        
        .cta-button {
          display: inline-block;
          background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%);
          color: white;
          padding: 14px 30px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 600;
          margin: 20px 0;
          box-shadow: 0 4px 14px 0 rgba(168, 85, 247, 0.39);
        }
        
        .divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, #e2e8f0, transparent);
          margin: 25px 0;
        }
        
        .footer {
          background: #f8fafc;
          padding: 25px 30px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        
        .footer-logo {
          font-size: 18px;
          font-weight: 700;
          color: #1a1a2e;
          margin-bottom: 10px;
        }
        
        .footer-text {
          font-size: 12px;
          color: #64748b;
          line-height: 1.6;
        }
        
        .footer-links {
          margin-top: 15px;
        }
        
        .footer-links a {
          color: #a855f7;
          text-decoration: none;
          margin: 0 10px;
          font-size: 12px;
        }
        
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        
        .badge.pending { background: #fef3c7; color: #92400e; }
        .badge.approved { background: #dcfce7; color: #166534; }
        .badge.rejected { background: #fee2e2; color: #991b1b; }
        .badge.urgent { background: #fee2e2; color: #991b1b; }
        .badge.high { background: #ffedd5; color: #9a3412; }
        .badge.normal { background: #dbeafe; color: #1e40af; }
        .badge.low { background: #f3f4f6; color: #374151; }
        
        .highlight {
          background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%);
          padding: 3px 8px;
          border-radius: 4px;
          color: #7c3aed;
          font-weight: 600;
        }
        
        .amount {
          font-size: 24px;
          font-weight: 700;
          color: #a855f7;
        }
        
        .timestamp {
          font-size: 11px;
          color: #94a3b8;
          margin-top: 5px;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        ${content}
        
        <div class="footer">
          <div class="footer-logo">Symbol AI</div>
          <div class="footer-text">
            نظام إدارة الأعمال المتكامل<br>
            هذا البريد تم إرساله تلقائياً - الرجاء عدم الرد عليه
          </div>
          <div class="timestamp">
            ${new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            ${new Date().toLocaleTimeString('ar-SA')}
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// ==================== أنواع الطلبات ====================
export const REQUEST_TYPE_NAMES: Record<string, string> = {
  advance: 'سلفة',
  vacation: 'إجازة',
  arrears: 'صرف متأخرات',
  permission: 'استئذان',
  objection: 'اعتراض',
  resignation: 'استقالة',
};

export const REQUEST_TYPE_ICONS: Record<string, string> = {
  advance: '💰',
  vacation: '🏖️',
  arrears: '📋',
  permission: '🕐',
  objection: '⚠️',
  resignation: '📝',
};

export const PRIORITY_NAMES: Record<string, string> = {
  low: 'منخفضة',
  normal: 'عادية',
  high: 'عالية',
  urgent: 'عاجلة',
};

// ==================== قالب طلب موظف جديد ====================
export function getEmployeeRequestTemplate(data: {
  employeeName: string;
  employeeCode?: string;
  requestType: string;
  title: string;
  description?: string;
  priority?: string;
  branchName?: string;
  requestNumber?: string;
  details?: Record<string, any>;
  recipientName: string;
  recipientRole: string;
}): { subject: string; html: string } {
  const typeIcon = REQUEST_TYPE_ICONS[data.requestType] || '📋';
  const typeName = REQUEST_TYPE_NAMES[data.requestType] || data.requestType;
  const priorityName = PRIORITY_NAMES[data.priority || 'normal'] || 'عادية';
  const priorityClass = data.priority || 'normal';
  
  let detailsHtml = '';
  if (data.details) {
    const detailsRows = Object.entries(data.details)
      .filter(([_, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => `
        <tr>
          <td style="font-weight: 600; color: #64748b; width: 40%;">${key}</td>
          <td style="color: #1a1a2e;">${value}</td>
        </tr>
      `).join('');
    
    if (detailsRows) {
      detailsHtml = `
        <h3 style="color: #1a1a2e; margin: 25px 0 15px; font-size: 16px;">📋 تفاصيل الطلب</h3>
        <table class="details-table">
          <tbody>
            ${detailsRows}
          </tbody>
        </table>
      `;
    }
  }
  
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">${typeIcon}</span>
      </div>
      <h1>طلب ${typeName} جديد</h1>
      <div class="subtitle">يتطلب مراجعتك واتخاذ الإجراء المناسب</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        السلام عليكم ورحمة الله وبركاته،<br><br>
        <strong>${data.recipientName}</strong> - ${data.recipientRole}<br><br>
        نود إعلامكم بأنه تم تقديم طلب جديد يتطلب مراجعتكم:
      </div>
      
      <div class="alert-box purple">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <div style="font-size: 18px; font-weight: 700; color: #7c3aed; margin-bottom: 5px;">
              ${data.title}
            </div>
            <div style="font-size: 14px; color: #64748b;">
              رقم الطلب: <span class="highlight">${data.requestNumber || 'جديد'}</span>
            </div>
          </div>
          <span class="badge ${priorityClass}">${priorityName}</span>
        </div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="label">👤 اسم الموظف</div>
          <div class="value">${data.employeeName}</div>
        </div>
        <div class="info-item">
          <div class="label">🏢 الفرع</div>
          <div class="value">${data.branchName || 'غير محدد'}</div>
        </div>
        <div class="info-item">
          <div class="label">📋 نوع الطلب</div>
          <div class="value">${typeIcon} ${typeName}</div>
        </div>
        <div class="info-item">
          <div class="label">📅 تاريخ التقديم</div>
          <div class="value">${new Date().toLocaleDateString('ar-SA')}</div>
        </div>
      </div>
      
      ${data.description ? `
        <div class="alert-box info">
          <div style="font-weight: 600; margin-bottom: 8px;">📝 وصف الطلب:</div>
          <div style="color: #374151; line-height: 1.8;">${data.description}</div>
        </div>
      ` : ''}
      
      ${detailsHtml}
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <p style="color: #64748b; margin-bottom: 15px;">للمراجعة واتخاذ الإجراء المناسب:</p>
        <a href="#" class="cta-button">مراجعة الطلب في النظام</a>
      </div>
    </div>
  `;
  
  return {
    subject: `${typeIcon} طلب ${typeName} جديد - ${data.employeeName} | ${data.branchName || 'Symbol AI'}`,
    html: getBaseTemplate(content, `طلب ${typeName} جديد`),
  };
}

// ==================== قالب تحديث حالة الطلب ====================
export function getRequestStatusUpdateTemplate(data: {
  employeeName: string;
  requestType: string;
  title: string;
  requestNumber?: string;
  oldStatus: string;
  newStatus: string;
  reviewNotes?: string;
  rejectionReason?: string;
  reviewerName: string;
  branchName?: string;
  recipientName: string;
}): { subject: string; html: string } {
  const typeIcon = REQUEST_TYPE_ICONS[data.requestType] || '📋';
  const typeName = REQUEST_TYPE_NAMES[data.requestType] || data.requestType;
  
  const statusNames: Record<string, string> = {
    pending: 'قيد الانتظار',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
    cancelled: 'ملغي',
  };
  
  const statusIcons: Record<string, string> = {
    pending: '⏳',
    approved: '✅',
    rejected: '❌',
    cancelled: '🚫',
  };
  
  const statusColors: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    cancelled: 'danger',
  };
  
  const newStatusName = statusNames[data.newStatus] || data.newStatus;
  const statusIcon = statusIcons[data.newStatus] || '📋';
  const alertClass = statusColors[data.newStatus] || 'info';
  
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">${statusIcon}</span>
      </div>
      <h1>تحديث حالة الطلب</h1>
      <div class="subtitle">${newStatusName}</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        السلام عليكم ورحمة الله وبركاته،<br><br>
        <strong>${data.recipientName}</strong><br><br>
        نود إعلامكم بتحديث حالة الطلب التالي:
      </div>
      
      <div class="alert-box ${alertClass}">
        <div style="font-size: 20px; font-weight: 700; margin-bottom: 10px;">
          ${statusIcon} ${newStatusName}
        </div>
        <div style="font-size: 14px; color: #64748b;">
          ${data.title} - رقم الطلب: <span class="highlight">${data.requestNumber || 'غير محدد'}</span>
        </div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="label">👤 مقدم الطلب</div>
          <div class="value">${data.employeeName}</div>
        </div>
        <div class="info-item">
          <div class="label">📋 نوع الطلب</div>
          <div class="value">${typeIcon} ${typeName}</div>
        </div>
        <div class="info-item">
          <div class="label">👨‍💼 المراجع</div>
          <div class="value">${data.reviewerName}</div>
        </div>
        <div class="info-item">
          <div class="label">📅 تاريخ التحديث</div>
          <div class="value">${new Date().toLocaleDateString('ar-SA')}</div>
        </div>
      </div>
      
      ${data.reviewNotes ? `
        <div class="alert-box info">
          <div style="font-weight: 600; margin-bottom: 8px;">📝 ملاحظات المراجعة:</div>
          <div style="color: #374151; line-height: 1.8;">${data.reviewNotes}</div>
        </div>
      ` : ''}
      
      ${data.rejectionReason ? `
        <div class="alert-box danger">
          <div style="font-weight: 600; margin-bottom: 8px;">❌ سبب الرفض:</div>
          <div style="color: #374151; line-height: 1.8;">${data.rejectionReason}</div>
        </div>
      ` : ''}
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <a href="#" class="cta-button">عرض تفاصيل الطلب</a>
      </div>
    </div>
  `;
  
  return {
    subject: `${statusIcon} تحديث طلب ${typeName} - ${newStatusName} | ${data.employeeName}`,
    html: getBaseTemplate(content, 'تحديث حالة الطلب'),
  };
}

// ==================== قالب طلب البونص ====================
export function getBonusRequestTemplate(data: {
  employeeName: string;
  employeeCode?: string;
  amount: number;
  weekNumber: number;
  month: number;
  year: number;
  branchName?: string;
  recipientName: string;
  recipientRole: string;
  weeklyRevenue?: number;
  tier?: string;
}): { subject: string; html: string } {
  const tierNames: Record<string, string> = {
    tier_5: 'المستوى 5 (180 ر.س)',
    tier_4: 'المستوى 4 (135 ر.س)',
    tier_3: 'المستوى 3 (95 ر.س)',
    tier_2: 'المستوى 2 (60 ر.س)',
    tier_1: 'المستوى 1 (35 ر.س)',
    none: 'غير مؤهل',
  };
  
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">🎁</span>
      </div>
      <h1>طلب صرف بونص</h1>
      <div class="subtitle">الأسبوع ${data.weekNumber} - ${data.month}/${data.year}</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        السلام عليكم ورحمة الله وبركاته،<br><br>
        <strong>${data.recipientName}</strong> - ${data.recipientRole}<br><br>
        تم تقديم طلب صرف بونص يتطلب موافقتكم:
      </div>
      
      <div class="alert-box purple" style="text-align: center;">
        <div class="amount">${data.amount.toFixed(2)} ر.س</div>
        <div style="color: #64748b; margin-top: 5px;">قيمة البونص المطلوب</div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="label">👤 اسم الموظف</div>
          <div class="value">${data.employeeName}</div>
        </div>
        <div class="info-item">
          <div class="label">🏢 الفرع</div>
          <div class="value">${data.branchName || 'غير محدد'}</div>
        </div>
        <div class="info-item">
          <div class="label">📊 الإيراد الأسبوعي</div>
          <div class="value">${data.weeklyRevenue?.toFixed(2) || '0.00'} ر.س</div>
        </div>
        <div class="info-item">
          <div class="label">🏆 المستوى</div>
          <div class="value">${tierNames[data.tier || 'none'] || 'غير محدد'}</div>
        </div>
      </div>
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <p style="color: #64748b; margin-bottom: 15px;">للموافقة على طلب البونص:</p>
        <a href="#" class="cta-button">مراجعة طلب البونص</a>
      </div>
    </div>
  `;
  
  return {
    subject: `🎁 طلب صرف بونص - ${data.employeeName} | ${data.amount.toFixed(2)} ر.س`,
    html: getBaseTemplate(content, 'طلب صرف بونص'),
  };
}

// ==================== قالب تقرير البونص الأسبوعي ====================
export function getWeeklyBonusReportTemplate(data: {
  branchName: string;
  weekNumber: number;
  month: number;
  year: number;
  totalAmount: number;
  eligibleCount: number;
  totalEmployees: number;
  details: Array<{
    employeeName: string;
    weeklyRevenue: number;
    tier: string;
    bonusAmount: number;
    isEligible: boolean;
  }>;
  recipientName: string;
}): { subject: string; html: string } {
  const tierNames: Record<string, string> = {
    tier_5: 'المستوى 5',
    tier_4: 'المستوى 4',
    tier_3: 'المستوى 3',
    tier_2: 'المستوى 2',
    tier_1: 'المستوى 1',
    none: 'غير مؤهل',
  };
  
  const tierColors: Record<string, string> = {
    tier_5: '#a855f7',
    tier_4: '#3b82f6',
    tier_3: '#22c55e',
    tier_2: '#eab308',
    tier_1: '#f97316',
    none: '#9ca3af',
  };
  
  const eligibilityPercentage = data.totalEmployees > 0 
    ? Math.round((data.eligibleCount / data.totalEmployees) * 100) 
    : 0;
  
  const detailsRows = data.details.map((d, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${d.employeeName}</td>
      <td>${d.weeklyRevenue.toFixed(2)} ر.س</td>
      <td><span style="color: ${tierColors[d.tier] || '#9ca3af'}; font-weight: 600;">${tierNames[d.tier] || 'غير محدد'}</span></td>
      <td style="font-weight: 600; color: ${d.isEligible ? '#22c55e' : '#9ca3af'};">${d.bonusAmount.toFixed(2)} ر.س</td>
    </tr>
  `).join('');
  
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">📊</span>
      </div>
      <h1>تقرير البونص الأسبوعي</h1>
      <div class="subtitle">${data.branchName} - الأسبوع ${data.weekNumber} من ${data.month}/${data.year}</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        السلام عليكم ورحمة الله وبركاته،<br><br>
        <strong>${data.recipientName}</strong><br><br>
        نرفق لكم تقرير البونص الأسبوعي:
      </div>
      
      <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 15px; margin: 25px 0;">
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%); border-radius: 12px; min-width: 120px;">
          <div style="font-size: 28px; font-weight: 700; color: #a855f7;">${data.totalAmount.toFixed(2)}</div>
          <div style="font-size: 12px; color: #64748b;">ر.س إجمالي البونص</div>
        </div>
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 12px; min-width: 120px;">
          <div style="font-size: 28px; font-weight: 700; color: #22c55e;">${data.eligibleCount}</div>
          <div style="font-size: 12px; color: #64748b;">موظفين مؤهلين</div>
        </div>
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 12px; min-width: 120px;">
          <div style="font-size: 28px; font-weight: 700; color: #3b82f6;">${data.totalEmployees}</div>
          <div style="font-size: 12px; color: #64748b;">إجمالي الموظفين</div>
        </div>
        <div style="text-align: center; padding: 20px; background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%); border-radius: 12px; min-width: 120px;">
          <div style="font-size: 28px; font-weight: 700; color: #eab308;">${eligibilityPercentage}%</div>
          <div style="font-size: 12px; color: #64748b;">نسبة الأهلية</div>
        </div>
      </div>
      
      <h3 style="color: #1a1a2e; margin: 25px 0 15px; font-size: 16px;">📋 تفاصيل البونص</h3>
      
      <table class="details-table">
        <thead>
          <tr>
            <th>#</th>
            <th>اسم الموظف</th>
            <th>الإيراد الأسبوعي</th>
            <th>المستوى</th>
            <th>البونص</th>
          </tr>
        </thead>
        <tbody>
          ${detailsRows}
          <tr style="background: linear-gradient(135deg, #a855f7 0%, #9333ea 100%); color: white;">
            <td colspan="4" style="font-weight: 700; border: none;">الإجمالي</td>
            <td style="font-weight: 700; border: none;">${data.totalAmount.toFixed(2)} ر.س</td>
          </tr>
        </tbody>
      </table>
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <a href="#" class="cta-button">عرض التقرير في النظام</a>
      </div>
    </div>
  `;
  
  return {
    subject: `📊 تقرير البونص الأسبوعي - ${data.branchName} | الأسبوع ${data.weekNumber}`,
    html: getBaseTemplate(content, 'تقرير البونص الأسبوعي'),
  };
}

// ==================== قالب تنبيه مصروف مرتفع ====================
export function getHighExpenseAlertTemplate(data: {
  amount: number;
  category: string;
  description?: string;
  branchName?: string;
  date: string;
  recipientName: string;
  threshold?: number;
}): { subject: string; html: string } {
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">⚠️</span>
      </div>
      <h1>تنبيه مصروف مرتفع</h1>
      <div class="subtitle">يتطلب انتباهكم</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        السلام عليكم ورحمة الله وبركاته،<br><br>
        <strong>${data.recipientName}</strong><br><br>
        تم تسجيل مصروف يتجاوز الحد المسموح:
      </div>
      
      <div class="alert-box danger" style="text-align: center;">
        <div class="amount" style="color: #ef4444;">${data.amount.toFixed(2)} ر.س</div>
        <div style="color: #64748b; margin-top: 5px;">قيمة المصروف</div>
        ${data.threshold ? `<div style="font-size: 12px; color: #991b1b; margin-top: 10px;">الحد المسموح: ${data.threshold.toFixed(2)} ر.س</div>` : ''}
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="label">📁 البند</div>
          <div class="value">${data.category}</div>
        </div>
        <div class="info-item">
          <div class="label">🏢 الفرع</div>
          <div class="value">${data.branchName || 'غير محدد'}</div>
        </div>
        <div class="info-item">
          <div class="label">📅 التاريخ</div>
          <div class="value">${data.date}</div>
        </div>
        <div class="info-item">
          <div class="label">📊 النسبة</div>
          <div class="value" style="color: #ef4444;">${data.threshold ? Math.round((data.amount / data.threshold) * 100) : 0}%</div>
        </div>
      </div>
      
      ${data.description ? `
        <div class="alert-box info">
          <div style="font-weight: 600; margin-bottom: 8px;">📝 الوصف:</div>
          <div style="color: #374151; line-height: 1.8;">${data.description}</div>
        </div>
      ` : ''}
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <a href="#" class="cta-button">مراجعة المصاريف</a>
      </div>
    </div>
  `;
  
  return {
    subject: `⚠️ تنبيه مصروف مرتفع - ${data.amount.toFixed(2)} ر.س | ${data.branchName || 'Symbol AI'}`,
    html: getBaseTemplate(content, 'تنبيه مصروف مرتفع'),
  };
}

// ==================== قالب أمر شراء جديد ====================
export function getNewPurchaseOrderTemplate(data: {
  orderNumber: string;
  supplierName?: string;
  totalAmount: number;
  itemsCount: number;
  branchName?: string;
  createdBy: string;
  recipientName: string;
  items?: Array<{ name: string; quantity: number; price: number }>;
}): { subject: string; html: string } {
  let itemsHtml = '';
  if (data.items && data.items.length > 0) {
    const itemsRows = data.items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.name}</td>
        <td>${item.quantity}</td>
        <td>${item.price.toFixed(2)} ر.س</td>
        <td>${(item.quantity * item.price).toFixed(2)} ر.س</td>
      </tr>
    `).join('');
    
    itemsHtml = `
      <h3 style="color: #1a1a2e; margin: 25px 0 15px; font-size: 16px;">📦 المنتجات المطلوبة</h3>
      <table class="details-table">
        <thead>
          <tr>
            <th>#</th>
            <th>المنتج</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
    `;
  }
  
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">🛒</span>
      </div>
      <h1>أمر شراء جديد</h1>
      <div class="subtitle">رقم الأمر: ${data.orderNumber}</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        السلام عليكم ورحمة الله وبركاته،<br><br>
        <strong>${data.recipientName}</strong><br><br>
        تم إنشاء أمر شراء جديد يتطلب مراجعتكم:
      </div>
      
      <div class="alert-box info" style="text-align: center;">
        <div class="amount" style="color: #3b82f6;">${data.totalAmount.toFixed(2)} ر.س</div>
        <div style="color: #64748b; margin-top: 5px;">إجمالي أمر الشراء</div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="label">🏪 المورد</div>
          <div class="value">${data.supplierName || 'غير محدد'}</div>
        </div>
        <div class="info-item">
          <div class="label">🏢 الفرع</div>
          <div class="value">${data.branchName || 'غير محدد'}</div>
        </div>
        <div class="info-item">
          <div class="label">📦 عدد الأصناف</div>
          <div class="value">${data.itemsCount}</div>
        </div>
        <div class="info-item">
          <div class="label">👤 أنشأه</div>
          <div class="value">${data.createdBy}</div>
        </div>
      </div>
      
      ${itemsHtml}
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <a href="#" class="cta-button">مراجعة أمر الشراء</a>
      </div>
    </div>
  `;
  
  return {
    subject: `🛒 أمر شراء جديد - ${data.orderNumber} | ${data.totalAmount.toFixed(2)} ر.س`,
    html: getBaseTemplate(content, 'أمر شراء جديد'),
  };
}

// ==================== قالب إيراد غير متطابق ====================
export function getRevenueMismatchTemplate(data: {
  branchName: string;
  date: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  reason?: string;
  recipientName: string;
}): { subject: string; html: string } {
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">🔴</span>
      </div>
      <h1>تنبيه إيراد غير متطابق</h1>
      <div class="subtitle">يتطلب مراجعة فورية</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        السلام عليكم ورحمة الله وبركاته،<br><br>
        <strong>${data.recipientName}</strong><br><br>
        تم رصد عدم تطابق في الإيرادات يتطلب مراجعتكم الفورية:
      </div>
      
      <div class="alert-box danger">
        <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 20px; text-align: center;">
          <div>
            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">المتوقع</div>
            <div style="font-size: 20px; font-weight: 700; color: #22c55e;">${data.expectedAmount.toFixed(2)} ر.س</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">الفعلي</div>
            <div style="font-size: 20px; font-weight: 700; color: #3b82f6;">${data.actualAmount.toFixed(2)} ر.س</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #64748b; margin-bottom: 5px;">الفرق</div>
            <div style="font-size: 20px; font-weight: 700; color: #ef4444;">${data.difference.toFixed(2)} ر.س</div>
          </div>
        </div>
      </div>
      
      <div class="info-grid">
        <div class="info-item">
          <div class="label">🏢 الفرع</div>
          <div class="value">${data.branchName}</div>
        </div>
        <div class="info-item">
          <div class="label">📅 التاريخ</div>
          <div class="value">${data.date}</div>
        </div>
      </div>
      
      ${data.reason ? `
        <div class="alert-box warning">
          <div style="font-weight: 600; margin-bottom: 8px;">📝 السبب المسجل:</div>
          <div style="color: #374151; line-height: 1.8;">${data.reason}</div>
        </div>
      ` : ''}
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <a href="#" class="cta-button">مراجعة الإيرادات</a>
      </div>
    </div>
  `;
  
  return {
    subject: `🔴 تنبيه إيراد غير متطابق - ${data.branchName} | فرق ${data.difference.toFixed(2)} ر.س`,
    html: getBaseTemplate(content, 'تنبيه إيراد غير متطابق'),
  };
}


// ==================== قالب تذكير الجرد ====================
export function getInventoryReminderTemplate(data: {
  recipientName: string;
  dayOfMonth: number;
  branches?: { name: string; productCount: number }[];
}): { subject: string; html: string } {
  const branchesHtml = data.branches?.map(b => `
    <div class="info-item">
      <div class="label">🏢 ${b.name}</div>
      <div class="value">${b.productCount} منتج</div>
    </div>
  `).join('') || '';
  
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">📦</span>
      </div>
      <h1>تذكير بموعد الجرد</h1>
      <div class="subtitle">يوم ${data.dayOfMonth} من الشهر</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        السلام عليكم ورحمة الله وبركاته،<br><br>
        <strong>${data.recipientName}</strong><br><br>
        نذكركم بأن اليوم هو موعد إجراء الجرد الدوري للمخزون.
      </div>
      
      <div class="alert-box warning">
        <div style="font-size: 18px; font-weight: 700; color: #d97706; margin-bottom: 10px;">
          ⚠️ يرجى إجراء الجرد اليوم
        </div>
        <div style="font-size: 14px; color: #64748b;">
          الجرد الدوري يساعد في الحفاظ على دقة المخزون واكتشاف الفروقات مبكراً
        </div>
      </div>
      
      ${branchesHtml ? `
        <h3 style="color: #1a1a2e; margin: 25px 0 15px; font-size: 16px;">📊 الفروع والمنتجات</h3>
        <div class="info-grid">
          ${branchesHtml}
        </div>
      ` : ''}
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <p style="color: #64748b; margin-bottom: 15px;">لبدء عملية الجرد:</p>
        <a href="#" class="cta-button">الذهاب إلى صفحة الجرد</a>
      </div>
      
      <div class="alert-box info" style="margin-top: 20px;">
        <div style="font-weight: 600; margin-bottom: 8px;">📋 خطوات الجرد:</div>
        <ol style="color: #374151; line-height: 2; padding-right: 20px;">
          <li>اذهب إلى صفحة "الجرد الفعلي" في النظام</li>
          <li>اختر الفرع المراد جرده</li>
          <li>أدخل الكميات الفعلية لكل منتج</li>
          <li>راجع الفروقات واحفظ الجرد</li>
          <li>اعتمد الجرد بعد التأكد من صحة البيانات</li>
        </ol>
      </div>
    </div>
  `;
  
  return {
    subject: `📦 تذكير: موعد الجرد الدوري - يوم ${data.dayOfMonth} | Symbol AI`,
    html: getBaseTemplate(content, 'تذكير بموعد الجرد'),
  };
}

// ==================== قالب تذكير مسيرات الرواتب ====================
export function getPayrollReminderTemplate(data: {
  recipientName: string;
  month: string;
  year: number;
  branches?: { name: string; employeeCount: number }[];
}): { subject: string; html: string } {
  const branchesHtml = data.branches?.map(b => `
    <div class="info-item">
      <div class="label">🏢 ${b.name}</div>
      <div class="value">${b.employeeCount} موظف</div>
    </div>
  `).join('') || '';
  
  const content = `
    <div class="header">
      <div class="logo">
        <span class="logo-text">💰</span>
      </div>
      <h1>تذكير بإنشاء مسيرات الرواتب</h1>
      <div class="subtitle">${data.month} ${data.year}</div>
    </div>
    
    <div class="content">
      <div class="greeting">
        السلام عليكم ورحمة الله وبركاته،<br><br>
        <strong>${data.recipientName}</strong><br><br>
        نذكركم بأن اليوم هو موعد إنشاء مسيرات الرواتب الشهرية.
      </div>
      
      <div class="alert-box purple">
        <div style="font-size: 18px; font-weight: 700; color: #7c3aed; margin-bottom: 10px;">
          💼 حان وقت إعداد الرواتب
        </div>
        <div style="font-size: 14px; color: #64748b;">
          يرجى إنشاء مسيرات الرواتب لجميع الفروع قبل نهاية الشهر
        </div>
      </div>
      
      ${branchesHtml ? `
        <h3 style="color: #1a1a2e; margin: 25px 0 15px; font-size: 16px;">👥 الفروع والموظفين</h3>
        <div class="info-grid">
          ${branchesHtml}
        </div>
      ` : ''}
      
      <div class="divider"></div>
      
      <div style="text-align: center;">
        <p style="color: #64748b; margin-bottom: 15px;">لإنشاء مسيرات الرواتب:</p>
        <a href="#" class="cta-button">الذهاب إلى مسيرات الرواتب</a>
      </div>
      
      <div class="alert-box info" style="margin-top: 20px;">
        <div style="font-weight: 600; margin-bottom: 8px;">📋 خطوات إنشاء المسيرة:</div>
        <ol style="color: #374151; line-height: 2; padding-right: 20px;">
          <li>اذهب إلى صفحة "مسيرات الرواتب" في النظام</li>
          <li>اضغط على "إنشاء مسيرة جديدة"</li>
          <li>اختر الفرع والشهر</li>
          <li>أدخل بيانات الموظفين (أيام العمل، الساعات الإضافية، الحوافز، الخصومات)</li>
          <li>راجع المسيرة وأرسلها للاعتماد</li>
        </ol>
      </div>
    </div>
  `;
  
  return {
    subject: `💰 تذكير: إنشاء مسيرات رواتب ${data.month} ${data.year} | Symbol AI`,
    html: getBaseTemplate(content, 'تذكير بإنشاء مسيرات الرواتب'),
  };
}


// ==================== قالب إشعار المهام ====================
export function getTaskNotificationTemplate(data: {
  employeeName: string;
  subject: string;
  details?: string;
  requirement: string;
  referenceNumber: string;
  priority: string;
  dueDate?: string;
  branchName?: string;
  createdByName: string;
}): string {
  const priorityColors: Record<string, string> = {
    urgent: '#ef4444',
    high: '#f97316',
    medium: '#3b82f6',
    low: '#6b7280',
  };

  const priorityNames: Record<string, string> = {
    urgent: 'عاجل',
    high: 'مرتفع',
    medium: 'متوسط',
    low: 'منخفض',
  };

  const content = `
    <div style="padding: 30px;">
      <h2 style="color: #1f2937; margin-bottom: 20px; font-size: 22px;">
        مهمة جديدة مطلوبة منك
      </h2>
      
      <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <span style="font-size: 14px; color: #64748b;">الرقم المرجعي</span>
          <span style="font-size: 24px; font-weight: bold; color: #3b82f6; font-family: monospace; letter-spacing: 3px;">${data.referenceNumber}</span>
        </div>
        <div style="border-top: 1px solid #e2e8f0; padding-top: 15px;">
          <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; color: white; background: ${priorityColors[data.priority] || '#6b7280'};">
            الأولوية: ${priorityNames[data.priority] || data.priority}
          </span>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b; width: 120px;">الموظف</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1f2937; font-weight: 600;">${data.employeeName}</td>
        </tr>
        ${data.branchName ? `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">الفرع</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1f2937;">${data.branchName}</td>
        </tr>
        ` : ''}
        ${data.dueDate ? `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">تاريخ الاستحقاق</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1f2937;">${data.dueDate}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #64748b;">المرسل</td>
          <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1f2937;">${data.createdByName}</td>
        </tr>
      </table>

      <div style="background: #f0f9ff; border-right: 4px solid #3b82f6; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #1e40af; margin-bottom: 10px; font-size: 16px;">موضوع المهمة</h3>
        <p style="color: #1f2937; font-size: 18px; font-weight: 600; margin: 0;">${data.subject}</p>
      </div>

      ${data.details ? `
      <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
        <h3 style="color: #64748b; margin-bottom: 10px; font-size: 14px;">التفاصيل</h3>
        <p style="color: #374151; margin: 0; white-space: pre-wrap;">${data.details}</p>
      </div>
      ` : ''}

      <div style="background: linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%); padding: 25px; border-radius: 12px; margin-bottom: 25px;">
        <h3 style="color: #1e40af; margin-bottom: 15px; font-size: 16px; display: flex; align-items: center;">
          <span style="margin-left: 8px;">📋</span>
          المطلوب منك
        </h3>
        <p style="color: #1f2937; font-size: 16px; margin: 0; line-height: 1.8; white-space: pre-wrap;">${data.requirement}</p>
      </div>

      <div style="text-align: center; padding: 20px; background: #f8fafc; border-radius: 12px;">
        <p style="color: #64748b; margin-bottom: 15px; font-size: 14px;">
          للاستجابة للمهمة، قم بالدخول على صفحة المهام وأدخل الرقم المرجعي
        </p>
        <a href="https://sym.manus.space/task-lookup" 
           style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: white; padding: 14px 35px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          الذهاب لصفحة المهام
        </a>
      </div>
    </div>
  `;

  return getBaseTemplate(content, 'مهمة جديدة - Symbol AI');
}
