import * as db from '../db';
import { sendEmail, getEmailTemplate, formatCurrency, formatNumber, formatPercentage } from './emailService';

interface TopCustomer {
  name: string;
  invoiceCount: number;
  totalPurchases: number;
}

interface ProductBatch {
  batchNumber: string;
  remainingQuantity: number;
  expiryDate: Date | null;
}

// تقرير المبيعات الأسبوعي
export async function generateWeeklySalesReport(): Promise<string> {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // جلب بيانات المبيعات
  const currentWeekSales = await db.getInvoicesByDateRange(weekAgo, now);
  const previousWeekSales = await db.getInvoicesByDateRange(twoWeeksAgo, weekAgo);

  const currentTotal = currentWeekSales.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
  const previousTotal = previousWeekSales.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
  const changePercent = previousTotal > 0 ? ((currentTotal - previousTotal) / previousTotal) * 100 : 0;

  // أفضل المنتجات
  const topProducts = await db.getTopSellingProducts(5, weekAgo, now);

  // أفضل العملاء
  const topCustomers: TopCustomer[] = await db.getTopCustomers(5, weekAgo, now);

  let content = `
    <div class="section">
      <div class="section-title">ملخص المبيعات الأسبوعي</div>
      <div style="text-align: center;">
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(currentTotal)}</div>
          <div class="stat-label">إجمالي المبيعات</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${currentWeekSales.length}</div>
          <div class="stat-label">عدد الفواتير</div>
        </div>
      </div>
      <p style="text-align: center; margin-top: 15px;">
        <span class="${changePercent >= 0 ? 'positive' : 'negative'}">
          ${formatPercentage(changePercent)} مقارنة بالأسبوع السابق
        </span>
      </p>
    </div>
  `;

  if (topProducts.length > 0) {
    content += `
      <div class="section">
        <div class="section-title">أفضل المنتجات مبيعاً</div>
        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكمية المباعة</th>
              <th>الإيرادات</th>
            </tr>
          </thead>
          <tbody>
            ${topProducts.map(p => `
              <tr>
                <td>${p.name}</td>
                <td>${formatNumber(p.totalQuantity)}</td>
                <td>${formatCurrency(p.totalRevenue)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  if (topCustomers.length > 0) {
    content += `
      <div class="section">
        <div class="section-title">أفضل العملاء</div>
        <table>
          <thead>
            <tr>
              <th>العميل</th>
              <th>عدد الفواتير</th>
              <th>إجمالي المشتريات</th>
            </tr>
          </thead>
          <tbody>
            ${topCustomers.map((c: TopCustomer) => `
              <tr>
                <td>${c.name}</td>
                <td>${c.invoiceCount}</td>
                <td>${formatCurrency(c.totalPurchases)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return content;
}

// تقرير المخزون المنخفض
export async function generateLowStockReport(): Promise<string> {
  const lowStockProducts = await db.getLowStockProducts();
  const expiringProducts: ProductBatch[] = await db.getExpiringProductBatches(30);

  let content = '';

  if (lowStockProducts.length > 0) {
    content += `
      <div class="section">
        <div class="section-title">⚠️ منتجات تحت الحد الأدنى (${lowStockProducts.length})</div>
        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th>الكمية الحالية</th>
              <th>الحد الأدنى</th>
              <th>النقص</th>
            </tr>
          </thead>
          <tbody>
            ${lowStockProducts.map(p => `
              <tr>
                <td>${p.name}</td>
                <td class="negative">${p.quantity}</td>
                <td>${p.minQuantity}</td>
                <td class="negative">${p.minQuantity - p.quantity}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else {
    content += `
      <div class="section">
        <div class="section-title">✅ حالة المخزون</div>
        <p style="text-align: center; color: #28a745;">جميع المنتجات فوق الحد الأدنى</p>
      </div>
    `;
  }

  if (expiringProducts.length > 0) {
    content += `
      <div class="section">
        <div class="section-title">⏰ منتجات قريبة الانتهاء (${expiringProducts.length})</div>
        <table>
          <thead>
            <tr>
              <th>رقم الدفعة</th>
              <th>الكمية</th>
              <th>تاريخ الانتهاء</th>
            </tr>
          </thead>
          <tbody>
            ${expiringProducts.map((b: ProductBatch) => `
              <tr>
                <td>${b.batchNumber}</td>
                <td>${b.remainingQuantity}</td>
                <td>${b.expiryDate ? new Date(b.expiryDate).toLocaleDateString('ar-SA') : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  return content;
}

// تقرير الأرباح والخسائر
export async function generateProfitLossReport(): Promise<string> {
  const now = new Date();
  const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  
  const kpis = await db.calculateFinancialKPIs(monthAgo, now);
  
  if (!kpis) {
    return `<div class="section"><p>لا توجد بيانات مالية متاحة</p></div>`;
  }

  const content = `
    <div class="section">
      <div class="section-title">مؤشرات الأداء المالي</div>
      <div style="text-align: center;">
        <div class="stat-card">
          <div class="stat-value ${(kpis.grossProfitMargin * 100) >= 0 ? 'positive' : 'negative'}">${(kpis.grossProfitMargin * 100).toFixed(1)}%</div>
          <div class="stat-label">هامش الربح الإجمالي</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${(kpis.netProfitMargin * 100) >= 0 ? 'positive' : 'negative'}">${(kpis.netProfitMargin * 100).toFixed(1)}%</div>
          <div class="stat-label">هامش الربح الصافي</div>
        </div>
        <div class="stat-card">
          <div class="stat-value ${(kpis.roi * 100) >= 0 ? 'positive' : 'negative'}">${(kpis.roi * 100).toFixed(1)}%</div>
          <div class="stat-label">العائد على الاستثمار</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${kpis.currentRatio.toFixed(2)}</div>
          <div class="stat-label">نسبة السيولة</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">ملخص الأرباح والخسائر (آخر شهر)</div>
      <table>
        <tr>
          <td><strong>إجمالي الإيرادات</strong></td>
          <td class="positive">${formatCurrency(kpis.totalRevenue)}</td>
        </tr>
        <tr>
          <td><strong>تكلفة البضاعة المباعة</strong></td>
          <td class="negative">${formatCurrency(kpis.totalCost)}</td>
        </tr>
        <tr>
          <td><strong>إجمالي الربح</strong></td>
          <td class="${kpis.grossProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(kpis.grossProfit)}</td>
        </tr>
        <tr>
          <td><strong>إجمالي المصاريف</strong></td>
          <td class="negative">${formatCurrency(kpis.totalExpenses)}</td>
        </tr>
        <tr style="background-color: #e9ecef;">
          <td><strong>صافي الربح</strong></td>
          <td class="${kpis.netProfit >= 0 ? 'positive' : 'negative'}"><strong>${formatCurrency(kpis.netProfit)}</strong></td>
        </tr>
      </table>
    </div>
  `;

  return content;
}

// إرسال التقرير الأسبوعي الشامل
export async function sendWeeklyReport(recipientEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const salesReport = await generateWeeklySalesReport();
    const stockReport = await generateLowStockReport();
    const profitReport = await generateProfitLossReport();

    const fullContent = `
      <h2 style="color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px;">
        📊 التقرير الأسبوعي - ${new Date().toLocaleDateString('ar-SA')}
      </h2>
      ${salesReport}
      ${stockReport}
      ${profitReport}
    `;

    const html = getEmailTemplate(fullContent, 'التقرير الأسبوعي');

    const result = await sendEmail({
      to: recipientEmail,
      subject: `📊 التقرير الأسبوعي - Symbol AI - ${new Date().toLocaleDateString('ar-SA')}`,
      html,
    });

    return result;
  } catch (error) {
    console.error('Error sending weekly report:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// إرسال تقرير المخزون المنخفض
export async function sendLowStockAlert(recipientEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const stockReport = await generateLowStockReport();

    const html = getEmailTemplate(stockReport, 'تنبيه المخزون');

    const result = await sendEmail({
      to: recipientEmail,
      subject: `⚠️ تنبيه المخزون - Symbol AI - ${new Date().toLocaleDateString('ar-SA')}`,
      html,
    });

    return result;
  } catch (error) {
    console.error('Error sending low stock alert:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// إرسال تقرير الأرباح والخسائر الشهري
export async function sendMonthlyProfitReport(recipientEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profitReport = await generateProfitLossReport();

    const html = getEmailTemplate(profitReport, 'تقرير الأرباح والخسائر الشهري');

    const result = await sendEmail({
      to: recipientEmail,
      subject: `💰 تقرير الأرباح والخسائر - Symbol AI - ${new Date().toLocaleDateString('ar-SA')}`,
      html,
    });

    return result;
  } catch (error) {
    console.error('Error sending profit report:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
