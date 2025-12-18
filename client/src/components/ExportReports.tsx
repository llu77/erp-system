import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ExportData {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string | number }[];
}

interface ExportReportsProps {
  data: ExportData;
  filename: string;
}

export function ExportReports({ data, filename }: ExportReportsProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportToCSV = () => {
    try {
      setIsExporting(true);
      
      // إضافة BOM للدعم العربي
      let csvContent = "\uFEFF";
      
      // العنوان
      csvContent += data.title + "\n\n";
      
      // الرؤوس
      csvContent += data.headers.join(",") + "\n";
      
      // الصفوف
      data.rows.forEach((row) => {
        csvContent += row.map(cell => {
          // إذا كانت الخلية تحتوي على فاصلة أو علامة اقتباس، نضعها بين علامات اقتباس
          const cellStr = String(cell);
          if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(",") + "\n";
      });
      
      // الملخص
      if (data.summary && data.summary.length > 0) {
        csvContent += "\n";
        data.summary.forEach((item) => {
          csvContent += `${item.label},${item.value}\n`;
        });
      }
      
      // إنشاء الملف وتحميله
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);
      
      toast.success("تم تصدير التقرير بنجاح");
    } catch (error) {
      toast.error("حدث خطأ أثناء التصدير");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToExcel = () => {
    try {
      setIsExporting(true);
      
      // إنشاء محتوى HTML للجدول
      let htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="UTF-8">
          <!--[if gte mso 9]>
          <xml>
            <x:ExcelWorkbook>
              <x:ExcelWorksheets>
                <x:ExcelWorksheet>
                  <x:Name>التقرير</x:Name>
                  <x:WorksheetOptions>
                    <x:DisplayRightToLeft/>
                  </x:WorksheetOptions>
                </x:ExcelWorksheet>
              </x:ExcelWorksheets>
            </x:ExcelWorkbook>
          </xml>
          <![endif]-->
          <style>
            table { border-collapse: collapse; direction: rtl; }
            th, td { border: 1px solid #000; padding: 8px; text-align: right; }
            th { background-color: #1e40af; color: white; font-weight: bold; }
            .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
            .summary { background-color: #f3f4f6; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="title">${data.title}</div>
          <table>
            <thead>
              <tr>
                ${data.headers.map(h => `<th>${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${data.rows.map(row => `
                <tr>
                  ${row.map(cell => `<td>${cell}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
      `;
      
      // إضافة الملخص
      if (data.summary && data.summary.length > 0) {
        htmlContent += `
          <br/>
          <table>
            ${data.summary.map(item => `
              <tr class="summary">
                <td>${item.label}</td>
                <td>${item.value}</td>
              </tr>
            `).join("")}
          </table>
        `;
      }
      
      htmlContent += "</body></html>";
      
      // إنشاء الملف وتحميله
      const blob = new Blob([htmlContent], { type: "application/vnd.ms-excel;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.xls`;
      link.click();
      URL.revokeObjectURL(link.href);
      
      toast.success("تم تصدير التقرير بنجاح");
    } catch (error) {
      toast.error("حدث خطأ أثناء التصدير");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const exportToPDF = () => {
    try {
      setIsExporting(true);
      
      // إنشاء محتوى HTML للطباعة
      const htmlContent = `
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>${data.title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Cairo', sans-serif; 
              padding: 20mm;
              direction: rtl;
            }
            .title {
              font-size: 24px;
              font-weight: bold;
              color: #1e40af;
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 10px;
              border-bottom: 3px solid #1e40af;
            }
            .date {
              text-align: center;
              color: #6b7280;
              margin-bottom: 20px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            th {
              background-color: #1e40af;
              color: white;
              padding: 12px;
              text-align: right;
              font-weight: 600;
            }
            td {
              padding: 10px 12px;
              border-bottom: 1px solid #e5e7eb;
              text-align: right;
            }
            tr:nth-child(even) {
              background-color: #f9fafb;
            }
            .summary {
              margin-top: 20px;
              padding: 15px;
              background-color: #f3f4f6;
              border-radius: 8px;
            }
            .summary-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .summary-row:last-child {
              border-bottom: none;
              font-weight: bold;
              font-size: 18px;
              color: #1e40af;
            }
            .footer {
              margin-top: 30px;
              text-align: center;
              color: #9ca3af;
              font-size: 12px;
            }
            @media print {
              body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="title">${data.title}</div>
          <div class="date">تاريخ التقرير: ${new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}</div>
          
          <table>
            <thead>
              <tr>
                ${data.headers.map(h => `<th>${h}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${data.rows.map(row => `
                <tr>
                  ${row.map(cell => `<td>${cell}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
          
          ${data.summary && data.summary.length > 0 ? `
            <div class="summary">
              ${data.summary.map(item => `
                <div class="summary-row">
                  <span>${item.label}</span>
                  <span>${item.value}</span>
                </div>
              `).join("")}
            </div>
          ` : ""}
          
          <div class="footer">
            تم إنشاء هذا التقرير بواسطة نظام ERP
          </div>
        </body>
        </html>
      `;
      
      // فتح نافذة جديدة للطباعة
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      
      toast.success("تم فتح نافذة الطباعة - احفظ كـ PDF");
    } catch (error) {
      toast.error("حدث خطأ أثناء التصدير");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 ml-2" />
          )}
          تصدير
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 ml-2" />
          تصدير PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel}>
          <FileSpreadsheet className="h-4 w-4 ml-2" />
          تصدير Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 ml-2" />
          تصدير CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
