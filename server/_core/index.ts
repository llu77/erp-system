import "dotenv/config";
import express from "express";
import compression from "compression";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { ensureAdminExists } from "../auth/localAuth";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Enable gzip compression for all responses
  app.use(compression({
    level: 6, // Compression level (1-9, 6 is a good balance)
    threshold: 1024, // Only compress responses larger than 1KB
    filter: (req, res) => {
      // Don't compress if client doesn't accept gzip
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Use default filter function
      return compression.filter(req, res);
    }
  }));
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // إنشاء حساب Admin الافتراضي إذا لم يكن موجوداً
  try {
    await ensureAdminExists();
  } catch (error) {
    console.error('[Server] Failed to ensure admin exists:', error);
  }
  
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  
  // Audio upload endpoint for voice transcription
  const multerModule = await import('multer');
  const multer = multerModule.default;
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 } // 16MB limit
  });
  
  app.post('/api/upload-audio', upload.single('file'), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'لم يتم رفع ملف صوتي' });
      }
      
      const { storagePut } = await import('../storage');
      const fileName = `audio/${Date.now()}-${Math.random().toString(36).substring(7)}.webm`;
      const { url } = await storagePut(fileName, req.file.buffer, req.file.mimetype || 'audio/webm');
      
      res.json({ url, key: fileName });
    } catch (error) {
      console.error('Audio upload error:', error);
      res.status(500).json({ error: 'فشل رفع الملف الصوتي' });
    }
  });
  // Excel Export API for Revenues
  app.post('/api/revenues/export-excel', async (req: any, res: any) => {
    try {
      const ExcelJS = await import('exceljs');
      const { title, dateRange, totals, revenues } = req.body;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Symbol AI - نظام إدارة متكامل';
      workbook.created = new Date();

      const worksheet = workbook.addWorksheet('سجل الإيرادات', {
        views: [{ rightToLeft: true }]
      });

      // إعداد الأعمدة
      worksheet.columns = [
        { header: 'التاريخ', key: 'date', width: 15 },
        { header: 'اليوم', key: 'dayName', width: 12 },
        { header: 'نقدي', key: 'cash', width: 12 },
        { header: 'شبكة', key: 'network', width: 12 },
        { header: 'رصيد', key: 'balance', width: 12 },
        { header: 'فواتير مدفوع', key: 'paidInvoices', width: 14 },
        { header: 'ولاء', key: 'loyalty', width: 12 },
        { header: 'الإجمالي', key: 'total', width: 14 },
        { header: 'الحالة', key: 'status', width: 14 },
        { header: 'الكاشير', key: 'posStatus', width: 12 },
      ];

      // عنوان التقرير
      worksheet.insertRow(1, [title]);
      worksheet.mergeCells('A1:J1');
      const titleRow = worksheet.getRow(1);
      titleRow.font = { bold: true, size: 16, color: { argb: 'FF1A1A1A' } };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
      titleRow.height = 30;

      // نطاق التاريخ
      worksheet.insertRow(2, [dateRange]);
      worksheet.mergeCells('A2:J2');
      const dateRow = worksheet.getRow(2);
      dateRow.font = { size: 12, color: { argb: 'FF666666' } };
      dateRow.alignment = { horizontal: 'center', vertical: 'middle' };
      dateRow.height = 20;

      // صف فارغ
      worksheet.insertRow(3, []);

      // رؤوس الأعمدة (الصف 4)
      const headerRow = worksheet.getRow(4);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A1A1A' }
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 25;

      // إضافة البيانات
      revenues.forEach((rev: any, index: number) => {
        const row = worksheet.addRow({
          date: rev.date,
          dayName: rev.dayName,
          cash: rev.cash,
          network: rev.network,
          balance: rev.balance,
          paidInvoices: rev.paidInvoices,
          loyalty: rev.loyalty,
          total: rev.total,
          status: rev.isMatched ? '✓ متطابق' : '✗ غير متطابق',
          posStatus: rev.posConfirmed ? '✓ مؤكد' : '○ بانتظار',
        });

        // تنسيق الصفوف
        row.alignment = { horizontal: 'center', vertical: 'middle' };
        row.height = 22;

        // تلوين الصفوف بالتناوب
        if (index % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF5F5F5' }
          };
        }

        // تلوين خلية الحالة
        const statusCell = row.getCell('status');
        statusCell.font = {
          bold: true,
          color: { argb: rev.isMatched ? 'FF22C55E' : 'FFEF4444' }
        };

        // تلوين خلية الكاشير
        const posCell = row.getCell('posStatus');
        posCell.font = {
          bold: true,
          color: { argb: rev.posConfirmed ? 'FF22C55E' : 'FFFBBF24' }
        };
      });

      // صف الإجمالي
      const totalRow = worksheet.addRow({
        date: 'الإجمالي',
        dayName: '',
        cash: totals.cash,
        network: totals.network,
        balance: totals.balance,
        paidInvoices: totals.paidInvoices,
        loyalty: totals.loyalty,
        total: totals.total,
        status: `${totals.matched} متطابق`,
        posStatus: '',
      });
      totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      totalRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1A1A1A' }
      };
      totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
      totalRow.height = 28;

      // تنسيق الأرقام
      ['cash', 'network', 'balance', 'paidInvoices', 'loyalty', 'total'].forEach(col => {
        worksheet.getColumn(col).numFmt = '#,##0.00';
      });

      // إضافة حدود للجدول
      const lastRow = worksheet.rowCount;
      for (let i = 4; i <= lastRow; i++) {
        const row = worksheet.getRow(i);
        row.eachCell({ includeEmpty: true }, (cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E5E5' } },
            left: { style: 'thin', color: { argb: 'FFE5E5E5' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E5E5' } },
            right: { style: 'thin', color: { argb: 'FFE5E5E5' } }
          };
        });
      }

      // إرسال الملف
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=revenues-report.xlsx');

      await workbook.xlsx.write(res);
      res.end();
    } catch (error) {
      console.error('Excel export error:', error);
      res.status(500).json({ error: 'فشل تصدير التقرير' });
    }
  });

  // Service Performance PDF Report API
  app.get('/api/reports/service-performance', async (req: any, res: any) => {
    try {
      const { startDate, endDate, branchId, branchName, month, year } = req.query;
      
      // Import database functions
      const db = await import('../db');
      const { generateServicePerformancePDF } = await import('../pdfService');
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const branchIdNum = branchId ? parseInt(branchId as string) : undefined;
      
      // Fetch data
      const [topServices, categoryPerformance, summary, dailyData] = await Promise.all([
        db.getServicePerformanceReport(start, end, branchIdNum, 20),
        db.getServicePerformanceByCategory(start, end, branchIdNum),
        db.getServicePerformanceSummary(start, end, branchIdNum),
        db.getServicePerformanceDaily(start, end, branchIdNum),
      ]);
      
      const pdfBuffer = await generateServicePerformancePDF({
        month: month as string || 'غير محدد',
        year: parseInt(year as string) || new Date().getFullYear(),
        branchName: branchName as string || 'جميع الفروع',
        summary: summary || {
          totalRevenue: 0,
          totalServices: 0,
          totalInvoices: 0,
          uniqueServices: 0,
          averageInvoiceValue: 0,
          revenueChange: 0,
          servicesChange: 0,
        },
        topServices: topServices || [],
        categoryPerformance: categoryPerformance || [],
        dailyData: dailyData || [],
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=service-performance-${month}-${year}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Service Performance PDF export error:', error);
      res.status(500).json({ error: 'فشل تصدير التقرير' });
    }
  });

  // Employee Performance PDF export endpoint
  app.get('/api/reports/employee-performance', async (req: any, res: any) => {
    try {
      const { startDate, endDate, branchId, branchName, month, year } = req.query;
      
      // Import database functions
      const db = await import('../db');
      const { generateEmployeePerformancePDF } = await import('../pdfService');
      
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      const branchIdNum = branchId ? parseInt(branchId as string) : undefined;
      
      // Fetch data
      const [employees, summary, dailyData] = await Promise.all([
        db.getEmployeePerformanceReport(start, end, branchIdNum, 20),
        db.getEmployeePerformanceSummary(start, end, branchIdNum),
        db.getEmployeePerformanceDaily(start, end, branchIdNum),
      ]);
      
      const pdfBuffer = await generateEmployeePerformancePDF({
        month: month as string || 'غير محدد',
        year: year as string || new Date().getFullYear().toString(),
        branchName: branchName as string || 'جميع الفروع',
        summary: summary,
        employees: employees || [],
        dailyData: dailyData || [],
      });
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=employee-performance-${month}-${year}.pdf`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Employee Performance PDF export error:', error);
      res.status(500).json({ error: 'فشل تصدير التقرير' });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
    
    // تشغيل نظام الجدولة في بيئة الإنتاج
    if (process.env.NODE_ENV === 'production') {
      import('../scheduler/cronScheduler').then(({ startScheduler }) => {
        startScheduler();
      }).catch(err => {
        console.error('Failed to start scheduler:', err);
      });
    }
    
    // تشغيل Queue الإشعارات
    import('../notifications/notificationQueue').then(({ startNotificationQueue }) => {
      startNotificationQueue();
      console.log('[Notification Queue] Started');
    }).catch(err => {
      console.error('Failed to start notification queue:', err);
    });
  });
}

startServer().catch(console.error);
