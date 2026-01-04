export const generateAdvancesReportHTML = (data: {
  filteredAdvances: any[];
  totalAmount: number;
  deductedAmount: number;
  pendingAmount: number;
  advancesDateFrom?: string;
  advancesDateTo?: string;
}) => {
  const { filteredAdvances, totalAmount, deductedAmount, pendingAmount, advancesDateFrom, advancesDateTo } = data;
  
  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>تقرير السلف المأخوذة</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;600;700;800&display=swap');
        body { 
          font-family: 'Tajawal', Arial, sans-serif; 
          padding: 40px; 
          background: #f8f9fa;
          color: #1a1a1a;
          line-height: 1.6;
        }
        .container { 
          max-width: 900px; 
          margin: 0 auto; 
          background: #fff; 
          padding: 40px; 
          border-radius: 12px; 
          box-shadow: 0 2px 8px rgba(0,0,0,0.1); 
        }
        .header { 
          text-align: center; 
          margin-bottom: 40px; 
          border-bottom: 3px solid #2563eb; 
          padding-bottom: 25px; 
        }
        .logo { 
          font-size: 28px; 
          font-weight: 800; 
          color: #2563eb; 
          margin-bottom: 10px; 
          letter-spacing: 1px; 
        }
        .header h1 { 
          font-size: 26px; 
          margin-bottom: 8px; 
          color: #1a1a1a; 
          font-weight: 700; 
        }
        .header p { 
          color: #666; 
          font-size: 14px; 
          margin: 5px 0; 
        }
        .date-info { 
          color: #888; 
          font-size: 13px; 
          margin-top: 10px; 
        }
        .stats { 
          display: grid; 
          grid-template-columns: repeat(4, 1fr); 
          gap: 15px; 
          margin-bottom: 35px; 
        }
        .stat-box { 
          padding: 20px; 
          border-radius: 10px; 
          text-align: center; 
          border-left: 4px solid #2563eb;
          background: linear-gradient(135deg, #f0f7ff 0%, #e0f2fe 100%);
        }
        .stat-box.deducted { 
          border-left-color: #16a34a; 
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); 
        }
        .stat-box.pending { 
          border-left-color: #ca8a04; 
          background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); 
        }
        .stat-box .value { 
          font-size: 24px; 
          font-weight: 800; 
          color: #2563eb; 
          margin-bottom: 5px;
        }
        .stat-box.deducted .value { color: #16a34a; }
        .stat-box.pending .value { color: #ca8a04; }
        .stat-box .label { 
          font-size: 13px; 
          color: #666; 
          font-weight: 500;
        }
        .table-section { margin-top: 30px; }
        .table-title { 
          font-size: 16px; 
          font-weight: 700; 
          color: #1a1a1a; 
          margin-bottom: 15px; 
          padding-bottom: 10px; 
          border-bottom: 2px solid #e5e7eb; 
        }
        table { 
          width: 100%; 
          border-collapse: collapse; 
          margin-top: 15px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        th, td { 
          border: 1px solid #e5e7eb; 
          padding: 14px; 
          text-align: right; 
          font-size: 13px;
        }
        th { 
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #fff;
          font-weight: 700;
        }
        tr:nth-child(even) { background: #f9fafb; }
        tr:hover { background: #f3f4f6; }
        td { color: #374151; }
        .deducted-status { 
          color: #16a34a; 
          font-weight: 600; 
          background: #f0fdf4; 
          padding: 4px 8px; 
          border-radius: 4px; 
          display: inline-block; 
        }
        .pending-status { 
          color: #ca8a04; 
          font-weight: 600; 
          background: #fffbeb; 
          padding: 4px 8px; 
          border-radius: 4px; 
          display: inline-block; 
        }
        .amount { color: #2563eb; font-weight: 600; }
        .footer { 
          margin-top: 40px; 
          padding-top: 20px; 
          border-top: 2px solid #e5e7eb;
          text-align: center; 
          color: #888; 
          font-size: 12px;
        }
        .footer-text { margin: 5px 0; }
        @media print { 
          body { padding: 10px; background: #fff; }
          .container { box-shadow: none; padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">💼 نظام ERP</div>
          <h1>تقرير السلف المأخوذة</h1>
          <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-SA')}</p>
          ${advancesDateFrom || advancesDateTo ? `<p class="date-info">الفترة: ${advancesDateFrom || 'البداية'} - ${advancesDateTo || 'النهاية'}</p>` : ''}
        </div>
        
        <div class="stats">
          <div class="stat-box">
            <div class="value">${filteredAdvances.length}</div>
            <div class="label">إجمالي السلف</div>
          </div>
          <div class="stat-box">
            <div class="value">${totalAmount.toLocaleString()} ر.س</div>
            <div class="label">إجمالي المبالغ</div>
          </div>
          <div class="stat-box deducted">
            <div class="value">${deductedAmount.toLocaleString()} ر.س</div>
            <div class="label">المخصومة</div>
          </div>
          <div class="stat-box pending">
            <div class="value">${pendingAmount.toLocaleString()} ر.س</div>
            <div class="label">غير مخصومة</div>
          </div>
        </div>

        <div class="table-section">
          <div class="table-title">📋 تفاصيل السلف</div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>الموظف</th>
                <th>المبلغ</th>
                <th>السبب</th>
                <th>تاريخ الموافقة</th>
                <th>الموافق</th>
                <th>الحالة</th>
                <th>تاريخ الخصم</th>
              </tr>
            </thead>
            <tbody>
              ${filteredAdvances.map((advance: any, index: number) => `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${advance.employeeName}</strong></td>
                  <td class="amount">${advance.amount.toLocaleString()} ر.س</td>
                  <td>${advance.reason || advance.title || '-'}</td>
                  <td>${advance.approvedAt ? new Date(advance.approvedAt).toLocaleDateString('ar-SA') : '-'}</td>
                  <td>${advance.approvedBy || '-'}</td>
                  <td>
                    <span class="${advance.isDeducted ? 'deducted-status' : 'pending-status'}">
                      ${advance.isDeducted ? '✓ تم الخصم' : '⏳ لم يخصم بعد'}
                    </span>
                  </td>
                  <td>${advance.deductedAt ? new Date(advance.deductedAt).toLocaleDateString('ar-SA') : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="footer">
          <div class="footer-text">✓ تم إنشاء هذا التقرير بواسطة نظام ERP</div>
          <div class="footer-text">📅 ${new Date().toLocaleString('ar-SA')}</div>
          <div class="footer-text">جميع المبالغ بالريال السعودي (ر.س)</div>
        </div>
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `;
};
