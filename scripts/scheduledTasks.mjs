#!/usr/bin/env node

/**
 * سكريبت المهام المجدولة
 * يمكن تشغيله عبر cron job أو يدوياً
 * 
 * الاستخدام:
 *   node scripts/scheduledTasks.mjs daily-reminder    # تذكير الإيرادات غير المسجلة (يومياً الساعة 10 صباحاً)
 *   node scripts/scheduledTasks.mjs weekly-report     # التقرير الأسبوعي للمشرفين (أسبوعياً يوم الأحد)
 *   node scripts/scheduledTasks.mjs all               # تشغيل جميع المهام
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'info@symbolai.net';

// إنشاء اتصال بقاعدة البيانات
async function getConnection() {
  const url = new URL(DATABASE_URL);
  return mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
    ssl: { rejectUnauthorized: false }
  });
}

// إرسال بريد إلكتروني
async function sendEmail(to, subject, html) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to,
      subject,
      html
    })
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`فشل إرسال البريد: ${error}`);
  }
  
  return response.json();
}

// تنسيق المبلغ
function formatCurrency(amount) {
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2
  }).format(amount);
}

// ==================== تذكير الإيرادات غير المسجلة ====================

async function sendDailyReminders() {
  console.log('🔔 بدء فحص الإيرادات غير المسجلة...');
  
  const conn = await getConnection();
  
  try {
    // الحصول على الفروع
    const [branches] = await conn.execute('SELECT id, nameAr as name_ar FROM branches WHERE isActive = 1');
    
    // تحديد تاريخ أمس
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    // الحصول على مستلمي الإشعارات
    const [recipients] = await conn.execute('SELECT * FROM notificationRecipients WHERE isActive = 1');
    
    const missingBranches = [];
    
    // فحص كل فرع
    for (const branch of branches) {
      const [revenues] = await conn.execute(
        'SELECT id FROM dailyRevenues WHERE branchId = ? AND date = ?',
        [branch.id, yesterdayStr]
      );
      
      if (revenues.length === 0) {
        missingBranches.push({ id: branch.id, name: branch.name_ar });
      }
    }
    
    if (missingBranches.length === 0) {
      console.log('✅ جميع الفروع سجلت إيراداتها');
      return { checked: branches.length, missing: 0, sent: 0 };
    }
    
    console.log(`⚠️ ${missingBranches.length} فرع لم يسجل إيراد أمس`);
    
    let sent = 0;
    
    // إرسال تذكيرات
    for (const branch of missingBranches) {
      const branchRecipients = recipients.filter(
        r => r.branchId === branch.id || r.role === 'admin' || r.role === 'general_supervisor'
      );
      
      for (const recipient of branchRecipients) {
        const html = `
          <!DOCTYPE html>
          <html dir="rtl">
          <head><meta charset="UTF-8"></head>
          <body style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <div style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">⚠️ تذكير: إيراد غير مسجل</h1>
              </div>
              <div style="padding: 30px;">
                <p style="font-size: 18px;">مرحباً ${recipient.name}،</p>
                <p>لم يتم تسجيل إيراد <strong>${branch.name}</strong> ليوم <strong>${yesterdayStr}</strong>.</p>
                <p>يرجى تسجيل الإيراد في أقرب وقت ممكن.</p>
                <div style="background: #fff3cd; border-radius: 8px; padding: 15px; margin: 20px 0;">
                  <p style="margin: 0; color: #856404;"><strong>ملاحظة:</strong> يجب تسجيل الإيرادات يومياً لضمان دقة التقارير المالية.</p>
                </div>
              </div>
              <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                <p>© ${new Date().getFullYear()} Symbol AI - جميع الحقوق محفوظة</p>
              </div>
            </div>
          </body>
          </html>
        `;
        
        try {
          await sendEmail(
            recipient.email,
            `⚠️ تذكير: إيراد غير مسجل - ${branch.name} - ${yesterdayStr}`,
            html
          );
          sent++;
          console.log(`✓ تم إرسال تذكير إلى: ${recipient.name} (${recipient.email})`);
        } catch (error) {
          console.error(`✗ فشل إرسال تذكير إلى ${recipient.email}:`, error.message);
        }
      }
    }
    
    return { checked: branches.length, missing: missingBranches.length, sent };
    
  } finally {
    await conn.end();
  }
}

// ==================== التقرير الأسبوعي للمشرفين ====================

async function sendWeeklyReports() {
  console.log('📊 بدء إرسال التقارير الأسبوعية...');
  
  const conn = await getConnection();
  
  try {
    // الحصول على مستلمي الإشعارات
    const [recipients] = await conn.execute('SELECT * FROM notificationRecipients WHERE isActive = 1');
    
    // الحصول على الفروع
    const [branches] = await conn.execute('SELECT id, nameAr as name_ar FROM branches WHERE isActive = 1');
    const branchMap = new Map(branches.map(b => [b.id, b.name_ar]));
    
    // تحديد فترة الأسبوع
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const nowStr = now.toISOString().split('T')[0];
    
    let sent = 0;
    
    for (const recipient of recipients) {
      let reportContent = '';
      let branchName = 'جميع الفروع';
      
      if (recipient.branch_id) {
        // مشرف فرع محدد
        reportContent = await generateBranchReport(conn, recipient.branch_id, weekAgoStr, nowStr);
        branchName = branchMap.get(recipient.branch_id) || 'غير محدد';
      } else {
        // المشرف العام أو الأدمن - تقرير لجميع الفروع
        for (const branch of branches) {
          reportContent += await generateBranchReport(conn, branch.id, weekAgoStr, nowStr);
          reportContent += '<hr style="margin: 30px 0; border: none; border-top: 2px dashed #ccc;">';
        }
      }
      
      const html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head><meta charset="UTF-8"></head>
        <body style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px;">
          <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">📊 التقرير الأسبوعي</h1>
              <p style="color: #00d4ff; margin: 10px 0 0 0;">${branchName}</p>
            </div>
            <div style="padding: 30px;">
              <p style="font-size: 18px;">مرحباً ${recipient.name}،</p>
              <p>إليك ملخص الأسبوع من ${weekAgoStr} إلى ${nowStr}:</p>
              ${reportContent}
            </div>
            <div style="background: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #666;">
              <p>© ${new Date().getFullYear()} Symbol AI - جميع الحقوق محفوظة</p>
            </div>
          </div>
        </body>
        </html>
      `;
      
      try {
        await sendEmail(
          recipient.email,
          `📊 التقرير الأسبوعي - ${branchName} - ${nowStr}`,
          html
        );
        sent++;
        console.log(`✓ تم إرسال التقرير الأسبوعي إلى: ${recipient.name} (${recipient.email})`);
      } catch (error) {
        console.error(`✗ فشل إرسال التقرير إلى ${recipient.email}:`, error.message);
      }
    }
    
    return { total: recipients.length, sent };
    
  } finally {
    await conn.end();
  }
}

async function generateBranchReport(conn, branchId, startDate, endDate) {
  // الحصول على اسم الفرع
  const [branchResult] = await conn.execute('SELECT nameAr as name_ar FROM branches WHERE id = ?', [branchId]);
  const branchName = branchResult[0]?.name_ar || 'غير محدد';
  
  // الحصول على الإيرادات
  const [revenues] = await conn.execute(
    'SELECT * FROM dailyRevenues WHERE branchId = ? AND date BETWEEN ? AND ?',
    [branchId, startDate, endDate]
  );
  
  let totalCash = 0, totalNetwork = 0, totalBalance = 0;
  let matchedDays = 0, unmatchedDays = 0;
  
  for (const rev of revenues) {
    totalCash += parseFloat(rev.cash || 0);
    totalNetwork += parseFloat(rev.network || 0);
    totalBalance += parseFloat(rev.balance || 0);
    if (rev.isMatched) matchedDays++;
    else unmatchedDays++;
  }
  
  const totalRevenue = totalCash + totalNetwork;
  
  // الحصول على المصاريف
  const [expenses] = await conn.execute(
    'SELECT * FROM expenses WHERE branchId = ? AND expenseDate BETWEEN ? AND ?',
    [branchId, startDate, endDate]
  );
  
  let totalExpenses = 0;
  const expensesByCategory = {};
  
  for (const exp of expenses) {
    const amount = parseFloat(exp.amount || 0);
    totalExpenses += amount;
    const category = exp.category || 'أخرى';
    expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
  }
  
  const netProfit = totalRevenue - totalExpenses;
  
  return `
    <div style="background: #f8f9fa; border-radius: 10px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #1a1a2e; margin-top: 0; border-bottom: 2px solid #00d4ff; padding-bottom: 10px;">
        🏢 ${branchName}
      </h3>
      
      <h4 style="color: #27ae60;">💰 الإيرادات</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">النقدي</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #27ae60;">${formatCurrency(totalCash)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #ddd;">الشبكة</td>
          <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #27ae60;">${formatCurrency(totalNetwork)}</td>
        </tr>
        <tr style="background: #e9ecef;">
          <td style="padding: 8px;"><strong>الإجمالي</strong></td>
          <td style="padding: 8px; color: #27ae60; font-size: 16px;"><strong>${formatCurrency(totalRevenue)}</strong></td>
        </tr>
      </table>
      <p style="font-size: 12px; color: #666;">
        ✅ ${matchedDays} يوم متطابق | 
        ${unmatchedDays > 0 ? '⚠️' : '✅'} ${unmatchedDays} يوم غير متطابق
      </p>
      
      <h4 style="color: #e74c3c;">📤 المصاريف</h4>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px;">
        ${Object.entries(expensesByCategory).map(([cat, amt]) => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${cat}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; color: #e74c3c;">${formatCurrency(amt)}</td>
          </tr>
        `).join('')}
        <tr style="background: #ffeeba;">
          <td style="padding: 8px;"><strong>إجمالي المصاريف</strong></td>
          <td style="padding: 8px; color: #e74c3c; font-size: 16px;"><strong>${formatCurrency(totalExpenses)}</strong></td>
        </tr>
      </table>
      
      <div style="background: ${netProfit >= 0 ? '#d4edda' : '#f8d7da'}; border-radius: 8px; padding: 15px; text-align: center;">
        <h4 style="margin: 0 0 10px 0; color: ${netProfit >= 0 ? '#155724' : '#721c24'};">📈 صافي الأسبوع</h4>
        <p style="font-size: 24px; margin: 0; color: ${netProfit >= 0 ? '#27ae60' : '#e74c3c'};">
          <strong>${formatCurrency(netProfit)}</strong>
        </p>
      </div>
    </div>
  `;
}

// ==================== التشغيل الرئيسي ====================

const task = process.argv[2];

console.log('━'.repeat(50));
console.log(`📅 ${new Date().toLocaleString('ar-SA')}`);
console.log('━'.repeat(50));

switch (task) {
  case 'daily-reminder':
    sendDailyReminders()
      .then(result => {
        console.log('━'.repeat(50));
        console.log(`✅ اكتمل فحص ${result.checked} فرع`);
        console.log(`⚠️ ${result.missing} فرع بدون إيراد`);
        console.log(`📧 تم إرسال ${result.sent} تذكير`);
      })
      .catch(console.error);
    break;
    
  case 'weekly-report':
    sendWeeklyReports()
      .then(result => {
        console.log('━'.repeat(50));
        console.log(`✅ تم إرسال ${result.sent}/${result.total} تقرير أسبوعي`);
      })
      .catch(console.error);
    break;
    
  case 'all':
    Promise.all([sendDailyReminders(), sendWeeklyReports()])
      .then(([daily, weekly]) => {
        console.log('━'.repeat(50));
        console.log('📊 ملخص المهام:');
        console.log(`  - تذكيرات يومية: ${daily.sent} رسالة`);
        console.log(`  - تقارير أسبوعية: ${weekly.sent} رسالة`);
      })
      .catch(console.error);
    break;
    
  default:
    console.log(`
الاستخدام:
  node scripts/scheduledTasks.mjs daily-reminder    # تذكير الإيرادات غير المسجلة
  node scripts/scheduledTasks.mjs weekly-report     # التقرير الأسبوعي للمشرفين
  node scripts/scheduledTasks.mjs all               # تشغيل جميع المهام

جدولة Cron المقترحة:
  # تذكير يومي الساعة 10 صباحاً
  0 10 * * * cd /path/to/erp-system && node scripts/scheduledTasks.mjs daily-reminder
  
  # تقرير أسبوعي كل يوم أحد الساعة 8 صباحاً
  0 8 * * 0 cd /path/to/erp-system && node scripts/scheduledTasks.mjs weekly-report
    `);
}
