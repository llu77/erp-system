import mysql from 'mysql2/promise';

const DATABASE_URL = process.env.DATABASE_URL;

async function seedNotificationRecipients() {
  const connection = await mysql.createConnection(DATABASE_URL);
  
  try {
    // حذف المستلمين الموجودين
    await connection.execute('DELETE FROM notificationRecipients');
    
    // إضافة المستلمين الجدد
    const recipients = [
      {
        name: 'الأدمن',
        email: 'Nntn127@gmail.com',
        role: 'admin',
        branchId: null,
        branchName: null,
        receiveRevenueAlerts: true,
        receiveExpenseAlerts: true,
        receiveMismatchAlerts: true,
        receiveInventoryAlerts: true,
        receiveMonthlyReminders: true,
        receiveRequestNotifications: true,
        receiveReportNotifications: true,
        receiveBonusNotifications: true,
        isActive: true
      },
      {
        name: 'المشرف العام',
        email: 'Salemalwadai1997@gmail.com',
        role: 'general_supervisor',
        branchId: null,
        branchName: null,
        receiveRevenueAlerts: true,
        receiveExpenseAlerts: true,
        receiveMismatchAlerts: true,
        receiveInventoryAlerts: true,
        receiveMonthlyReminders: true,
        receiveRequestNotifications: true,
        receiveReportNotifications: true,
        receiveBonusNotifications: true,
        isActive: true
      },
      {
        name: 'مشرف فرع طويق',
        email: 'mohamedismaelebrhem@gmail.com',
        role: 'branch_supervisor',
        branchId: 1, // فرع طويق
        branchName: 'فرع طويق',
        receiveRevenueAlerts: true,
        receiveExpenseAlerts: true,
        receiveMismatchAlerts: true,
        receiveInventoryAlerts: true,
        receiveMonthlyReminders: true,
        receiveRequestNotifications: true,
        receiveReportNotifications: true,
        receiveBonusNotifications: true,
        isActive: true
      },
      {
        name: 'مشرف فرع لبن',
        email: 'Galalbdo766@gmail.com',
        role: 'branch_supervisor',
        branchId: 2, // فرع لبن
        branchName: 'فرع لبن',
        receiveRevenueAlerts: true,
        receiveExpenseAlerts: true,
        receiveMismatchAlerts: true,
        receiveInventoryAlerts: true,
        receiveMonthlyReminders: true,
        receiveRequestNotifications: true,
        receiveReportNotifications: true,
        receiveBonusNotifications: true,
        isActive: true
      }
    ];
    
    for (const recipient of recipients) {
      await connection.execute(
        `INSERT INTO notificationRecipients 
         (name, email, role, branchId, branchName, 
          receiveRevenueAlerts, receiveExpenseAlerts, receiveMismatchAlerts,
          receiveInventoryAlerts, receiveMonthlyReminders, receiveRequestNotifications,
          receiveReportNotifications, receiveBonusNotifications, isActive)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recipient.name,
          recipient.email,
          recipient.role,
          recipient.branchId,
          recipient.branchName,
          recipient.receiveRevenueAlerts,
          recipient.receiveExpenseAlerts,
          recipient.receiveMismatchAlerts,
          recipient.receiveInventoryAlerts,
          recipient.receiveMonthlyReminders,
          recipient.receiveRequestNotifications,
          recipient.receiveReportNotifications,
          recipient.receiveBonusNotifications,
          recipient.isActive
        ]
      );
      console.log(`✓ تم إضافة: ${recipient.name} (${recipient.email})`);
    }
    
    // التحقق من الفروع وإنشائها إذا لم تكن موجودة
    const [branches] = await connection.execute('SELECT * FROM branches WHERE id IN (1, 2)');
    if (branches.length === 0) {
      await connection.execute(
        `INSERT INTO branches (id, name, code, address, phone, isActive) VALUES 
         (1, 'فرع طويق', 'TUWAIQ', 'الرياض - حي طويق', '0500000001', true),
         (2, 'فرع لبن', 'LABAN', 'الرياض - حي لبن', '0500000002', true)
         ON DUPLICATE KEY UPDATE name = VALUES(name)`
      );
      console.log('✓ تم إنشاء الفروع');
    }
    
    console.log('\n✅ تم إضافة جميع المستلمين بنجاح!');
    
  } catch (error) {
    console.error('خطأ:', error);
  } finally {
    await connection.end();
  }
}

seedNotificationRecipients();
