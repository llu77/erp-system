import { lazy, Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { Loader2 } from "lucide-react";

// Loading component for lazy loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// Critical pages - loaded immediately
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import POS from "./pages/POS";
import POSLogin from "./pages/POSLogin";

// Lazy loaded pages - grouped by feature
// User Management
const Users = lazy(() => import("./pages/Users"));
const EmployeeAccounts = lazy(() => import("./pages/EmployeeAccounts"));
const PermissionsManagement = lazy(() => import("./pages/PermissionsManagement"));

// Inventory & Products
const Products = lazy(() => import("./pages/Products"));
const Categories = lazy(() => import("./pages/Categories"));
const AdvancedInventory = lazy(() => import("./pages/AdvancedInventory"));
const InventoryCounting = lazy(() => import("./pages/InventoryCounting"));
const InventoryVarianceReport = lazy(() => import("./pages/InventoryVarianceReport"));

// CRM
const Customers = lazy(() => import("./pages/Customers"));
const Suppliers = lazy(() => import("./pages/Suppliers"));

// Sales & Invoices
const Invoices = lazy(() => import("./pages/Invoices"));
const Purchases = lazy(() => import("./pages/Purchases"));
const EmployeeInvoices = lazy(() => import("./pages/EmployeeInvoices"));
const PaidInvoicesReport = lazy(() => import("./pages/PaidInvoicesReport"));
const SalesDashboard = lazy(() => import("./pages/SalesDashboard"));

// Financial
const Revenues = lazy(() => import("./pages/Revenues"));
const Expenses = lazy(() => import("./pages/Expenses"));
const ProfitLoss = lazy(() => import("./pages/ProfitLoss"));
const CashFlowReport = lazy(() => import("./pages/CashFlowReport"));
const ReceiptVoucher = lazy(() => import("./pages/ReceiptVoucher"));
const ReceiptVoucherReports = lazy(() => import("./pages/ReceiptVoucherReports"));
const VouchersReport = lazy(() => import("./pages/VouchersReport"));

// HR & Payroll
const Employees = lazy(() => import("./pages/Employees"));
const Payrolls = lazy(() => import("./pages/Payrolls"));
const Bonuses = lazy(() => import("./pages/Bonuses"));
const BonusRequests = lazy(() => import("./pages/BonusRequests"));
const SubmitRequest = lazy(() => import("./pages/SubmitRequest"));
const ManageRequests = lazy(() => import("./pages/ManageRequests"));
const HROnboarding = lazy(() => import("./pages/HROnboarding"));
const DocumentsDashboard = lazy(() => import("./pages/DocumentsDashboard"));
const EmployeeDocumentsReport = lazy(() => import("./pages/EmployeeDocumentsReport"));

// Employee Portal
const EmployeeLogin = lazy(() => import("./pages/EmployeeLogin"));
const EmployeePortal = lazy(() => import("./pages/EmployeePortal"));
const AdminEmployeePortal = lazy(() => import("./pages/AdminEmployeePortal"));
const EmployeeAssistant = lazy(() => import("./pages/EmployeeAssistant"));

// Reports & Analytics
const Reports = lazy(() => import("./pages/Reports"));
const MonthlyReports = lazy(() => import("./pages/MonthlyReports"));
const ReportSettings = lazy(() => import("./pages/ReportSettings"));
const ReportScheduleSettings = lazy(() => import("./pages/ReportScheduleSettings"));
const ReportBuilder = lazy(() => import("./pages/ReportBuilder"));
const BIDashboard = lazy(() => import("./pages/BIDashboard"));
const ExecutiveDashboard = lazy(() => import("./pages/ExecutiveDashboard"));
const ServicePerformanceReport = lazy(() => import("./pages/ServicePerformanceReport"));
const EmployeePerformanceReport = lazy(() => import("./pages/EmployeePerformanceReport"));

// AI Features
const AIAnalytics = lazy(() => import("./pages/AIAnalytics"));
const AIDecisionCenter = lazy(() => import("./pages/AIDecisionCenter"));
const AICommandCenter = lazy(() => import("./pages/AICommandCenter"));
const AIMonitorSettings = lazy(() => import("./pages/AIMonitorSettings"));
const ReportAssistant = lazy(() => import("./components/ReportAssistant"));

// Loyalty System
const Loyalty = lazy(() => import("./pages/Loyalty"));
const LoyaltyRegister = lazy(() => import("./pages/LoyaltyRegister"));
const LoyaltyVisit = lazy(() => import("./pages/LoyaltyVisit"));
const LoyaltySettings = lazy(() => import("./pages/LoyaltySettings"));
const LoyaltyReport = lazy(() => import("./pages/LoyaltyReport"));
const LoyaltyDeletionRequests = lazy(() => import("./pages/LoyaltyDeletionRequests"));

// POS System
const POSDailyReport = lazy(() => import("./pages/POSDailyReport"));
const POSEmployeeRanking = lazy(() => import("./pages/POSEmployeeRanking"));
const POSSettings = lazy(() => import("./pages/POSSettings"));
const POSServicesManagement = lazy(() => import("./pages/POSServicesManagement"));
const POSCategoriesManagement = lazy(() => import("./pages/POSCategoriesManagement"));
const POSServicesOnly = lazy(() => import("./pages/POSServicesOnly"));
const POSEmployeeStats = lazy(() => import("./pages/POSEmployeeStats"));

// System & Settings
const Branches = lazy(() => import("./pages/Branches"));
const Settings = lazy(() => import("./pages/Settings"));
const SendNotification = lazy(() => import("./pages/SendNotification"));
const NotificationRecipients = lazy(() => import("./pages/NotificationRecipients"));
const SchedulerSettings = lazy(() => import("./pages/SchedulerSettings"));
const SchedulerDashboard = lazy(() => import("./pages/SchedulerDashboard"));

// Monitoring & Security
const MonitoringDashboard = lazy(() => import("./pages/MonitoringDashboard"));
const SecurityAlerts = lazy(() => import("./pages/SecurityAlerts"));
const SmartAlerts = lazy(() => import("./pages/SmartAlerts"));
const AuditCompliance = lazy(() => import("./pages/AuditCompliance"));

// Tasks
const TaskLookup = lazy(() => import("./pages/TaskLookup"));
const TaskManagement = lazy(() => import("./pages/TaskManagement"));

// Wrapper component for lazy loaded pages
const LazyPage = ({ component: Component }: { component: React.LazyExoticComponent<React.ComponentType<any>> }) => (
  <Suspense fallback={<PageLoader />}>
    <Component />
  </Suspense>
);

function Router() {
  return (
    <Switch>
      {/* صفحة تسجيل الدخول */}
      <Route path="/login" component={Login} />
      
      {/* بوابة الموظفين */}
      <Route path="/employee-login">
        <LazyPage component={EmployeeLogin} />
      </Route>
      <Route path="/employee-portal">
        <LazyPage component={EmployeePortal} />
      </Route>
      <Route path="/admin-employee-portal">
        <LazyPage component={AdminEmployeePortal} />
      </Route>
      
      {/* إدارة حسابات الموظفين */}
      <Route path="/employee-accounts">
        <DashboardLayout>
          <LazyPage component={EmployeeAccounts} />
        </DashboardLayout>
      </Route>
      
      {/* نظام الكاشير POS */}
      <Route path="/pos-login" component={POSLogin} />
      <Route path="/pos" component={POS} />
      <Route path="/pos-daily-report">
        <LazyPage component={POSDailyReport} />
      </Route>
      <Route path="/pos-settings">
        <DashboardLayout>
          <LazyPage component={POSSettings} />
        </DashboardLayout>
      </Route>
      <Route path="/pos-services">
        <DashboardLayout>
          <LazyPage component={POSServicesManagement} />
        </DashboardLayout>
      </Route>
      <Route path="/pos-categories">
        <DashboardLayout>
          <LazyPage component={POSCategoriesManagement} />
        </DashboardLayout>
      </Route>
      <Route path="/pos-services-only">
        <LazyPage component={POSServicesOnly} />
      </Route>
      <Route path="/pos-employee-stats">
        <LazyPage component={POSEmployeeStats} />
      </Route>
      <Route path="/pos-employee-ranking">
        <LazyPage component={POSEmployeeRanking} />
      </Route>
      <Route path="/service-performance-report">
        <DashboardLayout>
          <LazyPage component={ServicePerformanceReport} />
        </DashboardLayout>
      </Route>
      <Route path="/employee-performance-report">
        <DashboardLayout>
          <LazyPage component={EmployeePerformanceReport} />
        </DashboardLayout>
      </Route>
      
      {/* نظام الولاء */}
      <Route path="/loyalty">
        <DashboardLayout>
          <LazyPage component={Loyalty} />
        </DashboardLayout>
      </Route>
      <Route path="/loyalty-register">
        <LazyPage component={LoyaltyRegister} />
      </Route>
      <Route path="/loyalty-visit">
        <LazyPage component={LoyaltyVisit} />
      </Route>
      {/* مسارات بديلة للباركود المطبوع */}
      <Route path="/loyalty/register">
        <LazyPage component={LoyaltyRegister} />
      </Route>
      <Route path="/loyalty/visit">
        <LazyPage component={LoyaltyVisit} />
      </Route>
      <Route path="/loyalty-settings">
        <DashboardLayout>
          <LazyPage component={LoyaltySettings} />
        </DashboardLayout>
      </Route>
      <Route path="/loyalty-report">
        <DashboardLayout>
          <LazyPage component={LoyaltyReport} />
        </DashboardLayout>
      </Route>
      <Route path="/loyalty-deletion-requests">
        <DashboardLayout>
          <LazyPage component={LoyaltyDeletionRequests} />
        </DashboardLayout>
      </Route>
      
      {/* لوحة التحكم الرئيسية */}
      <Route path="/">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      
      {/* إدارة المستخدمين */}
      <Route path="/users">
        <DashboardLayout>
          <LazyPage component={Users} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة الصلاحيات */}
      <Route path="/permissions">
        <DashboardLayout>
          <LazyPage component={PermissionsManagement} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة المنتجات */}
      <Route path="/products">
        <DashboardLayout>
          <LazyPage component={Products} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة الفئات */}
      <Route path="/categories">
        <DashboardLayout>
          <LazyPage component={Categories} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة العملاء */}
      <Route path="/customers">
        <DashboardLayout>
          <LazyPage component={Customers} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة الموردين */}
      <Route path="/suppliers">
        <DashboardLayout>
          <LazyPage component={Suppliers} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة الفواتير */}
      <Route path="/invoices">
        <DashboardLayout>
          <LazyPage component={Invoices} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة المشتريات */}
      <Route path="/purchases">
        <DashboardLayout>
          <LazyPage component={Purchases} />
        </DashboardLayout>
      </Route>
      
      {/* التقارير */}
      <Route path="/reports">
        <DashboardLayout>
          <LazyPage component={Reports} />
        </DashboardLayout>
      </Route>
      
      {/* إرسال الإشعارات */}
      <Route path="/send-notification">
        <DashboardLayout>
          <LazyPage component={SendNotification} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة المكافآت */}
      <Route path="/bonuses">
        <DashboardLayout>
          <LazyPage component={Bonuses} />
        </DashboardLayout>
      </Route>
      
      {/* طلبات المكافآت */}
      <Route path="/bonus-requests">
        <DashboardLayout>
          <LazyPage component={BonusRequests} />
        </DashboardLayout>
      </Route>
      
      {/* سجل الإيرادات */}
      <Route path="/revenues">
        <DashboardLayout>
          <LazyPage component={Revenues} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة الفروع */}
      <Route path="/branches">
        <DashboardLayout>
          <LazyPage component={Branches} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة الموظفين */}
      <Route path="/employees">
        <DashboardLayout>
          <LazyPage component={Employees} />
        </DashboardLayout>
      </Route>
      
      {/* لوحة الوثائق */}
      <Route path="/documents">
        <DashboardLayout>
          <LazyPage component={DocumentsDashboard} />
        </DashboardLayout>
      </Route>
      
      {/* تقديم طلب */}
      <Route path="/submit-request">
        <DashboardLayout>
          <LazyPage component={SubmitRequest} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة الطلبات */}
      <Route path="/manage-requests">
        <DashboardLayout>
          <LazyPage component={ManageRequests} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة الرواتب */}
      <Route path="/payrolls">
        <DashboardLayout>
          <LazyPage component={Payrolls} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة المصاريف */}
      <Route path="/expenses">
        <DashboardLayout>
          <LazyPage component={Expenses} />
        </DashboardLayout>
      </Route>
      
      {/* الإعدادات */}
      <Route path="/settings">
        <DashboardLayout>
          <LazyPage component={Settings} />
        </DashboardLayout>
      </Route>
      
      {/* تقرير الأرباح والخسائر */}
      <Route path="/profit-loss">
        <DashboardLayout>
          <LazyPage component={ProfitLoss} />
        </DashboardLayout>
      </Route>
      
      {/* لوحة التحكم التنفيذية */}
      <Route path="/executive-dashboard">
        <DashboardLayout>
          <LazyPage component={ExecutiveDashboard} />
        </DashboardLayout>
      </Route>
      
      {/* تنبيهات الأمان */}
      <Route path="/security-alerts">
        <DashboardLayout>
          <LazyPage component={SecurityAlerts} />
        </DashboardLayout>
      </Route>
      
      {/* المخزون المتقدم */}
      <Route path="/advanced-inventory">
        <DashboardLayout>
          <LazyPage component={AdvancedInventory} />
        </DashboardLayout>
      </Route>
      
      {/* لوحة المبيعات */}
      <Route path="/sales-dashboard">
        <DashboardLayout>
          <LazyPage component={SalesDashboard} />
        </DashboardLayout>
      </Route>
      
      {/* إعدادات التقارير */}
      <Route path="/report-settings">
        <DashboardLayout>
          <LazyPage component={ReportSettings} />
        </DashboardLayout>
      </Route>
      
      {/* تأهيل الموظفين */}
      <Route path="/hr-onboarding">
        <DashboardLayout>
          <LazyPage component={HROnboarding} />
        </DashboardLayout>
      </Route>
      
      {/* إعدادات الجدولة */}
      <Route path="/scheduler-settings">
        <DashboardLayout>
          <LazyPage component={SchedulerSettings} />
        </DashboardLayout>
      </Route>
      
      {/* مستلمي الإشعارات */}
      <Route path="/notification-recipients">
        <DashboardLayout>
          <LazyPage component={NotificationRecipients} />
        </DashboardLayout>
      </Route>
      
      {/* فواتير الموظفين */}
      <Route path="/employee-invoices">
        <DashboardLayout>
          <LazyPage component={EmployeeInvoices} />
        </DashboardLayout>
      </Route>
      
      {/* جرد المخزون */}
      <Route path="/inventory-counting">
        <DashboardLayout>
          <LazyPage component={InventoryCounting} />
        </DashboardLayout>
      </Route>
      
      {/* تقرير فروقات المخزون */}
      <Route path="/inventory-variance-report">
        <DashboardLayout>
          <LazyPage component={InventoryVarianceReport} />
        </DashboardLayout>
      </Route>
      
      {/* البحث عن المهام */}
      <Route path="/task-lookup">
        <DashboardLayout>
          <LazyPage component={TaskLookup} />
        </DashboardLayout>
      </Route>
      
      {/* إدارة المهام */}
      <Route path="/task-management">
        <DashboardLayout>
          <LazyPage component={TaskManagement} />
        </DashboardLayout>
      </Route>
      
      {/* تقرير وثائق الموظفين */}
      <Route path="/employee-documents-report">
        <DashboardLayout>
          <LazyPage component={EmployeeDocumentsReport} />
        </DashboardLayout>
      </Route>
      
      {/* لوحة المراقبة */}
      <Route path="/monitoring-dashboard">
        <DashboardLayout>
          <LazyPage component={MonitoringDashboard} />
        </DashboardLayout>
      </Route>
      
      {/* لوحة الجدولة */}
      <Route path="/scheduler-dashboard">
        <DashboardLayout>
          <LazyPage component={SchedulerDashboard} />
        </DashboardLayout>
      </Route>
      
      {/* التنبيهات الذكية */}
      <Route path="/smart-alerts">
        <DashboardLayout>
          <LazyPage component={SmartAlerts} />
        </DashboardLayout>
      </Route>
      
      {/* سند القبض */}
      <Route path="/receipt-voucher">
        <DashboardLayout>
          <LazyPage component={ReceiptVoucher} />
        </DashboardLayout>
      </Route>
      
      {/* تقارير سندات القبض */}
      <Route path="/receipt-voucher-reports">
        <DashboardLayout>
          <LazyPage component={ReceiptVoucherReports} />
        </DashboardLayout>
      </Route>
      
      {/* تقرير السندات */}
      <Route path="/vouchers-report">
        <DashboardLayout>
          <LazyPage component={VouchersReport} />
        </DashboardLayout>
      </Route>
      
      {/* لوحة ذكاء الأعمال */}
      <Route path="/bi-dashboard">
        <DashboardLayout>
          <LazyPage component={BIDashboard} />
        </DashboardLayout>
      </Route>
      
      {/* منشئ التقارير */}
      <Route path="/report-builder">
        <DashboardLayout>
          <LazyPage component={ReportBuilder} />
        </DashboardLayout>
      </Route>
      
      {/* تحليلات الذكاء الاصطناعي */}
      <Route path="/ai-analytics">
        <DashboardLayout>
          <LazyPage component={AIAnalytics} />
        </DashboardLayout>
      </Route>
      
      {/* مساعد الموظفين */}
      <Route path="/employee-assistant">
        <DashboardLayout>
          <LazyPage component={EmployeeAssistant} />
        </DashboardLayout>
      </Route>
      
      {/* تقرير الفواتير المدفوعة */}
      <Route path="/paid-invoices-report">
        <DashboardLayout>
          <LazyPage component={PaidInvoicesReport} />
        </DashboardLayout>
      </Route>
      
      {/* التقارير الشهرية */}
      <Route path="/monthly-reports">
        <DashboardLayout>
          <LazyPage component={MonthlyReports} />
        </DashboardLayout>
      </Route>
      
      {/* مركز قرارات الذكاء الاصطناعي */}
      <Route path="/ai-decision-center">
        <DashboardLayout>
          <LazyPage component={AIDecisionCenter} />
        </DashboardLayout>
      </Route>
      
      {/* التدقيق والامتثال */}
      <Route path="/audit-compliance">
        <DashboardLayout>
          <LazyPage component={AuditCompliance} />
        </DashboardLayout>
      </Route>
      
      {/* إعدادات جدولة التقارير */}
      <Route path="/report-schedule-settings">
        <DashboardLayout>
          <LazyPage component={ReportScheduleSettings} />
        </DashboardLayout>
      </Route>
      
      {/* تقرير التدفق النقدي */}
      <Route path="/cash-flow-report">
        <DashboardLayout>
          <LazyPage component={CashFlowReport} />
        </DashboardLayout>
      </Route>
      
      {/* مساعد التقارير */}
      <Route path="/report-assistant">
        <DashboardLayout>
          <LazyPage component={ReportAssistant} />
        </DashboardLayout>
      </Route>
      
      {/* مركز قيادة الذكاء الاصطناعي */}
      <Route path="/ai-command-center">
        <DashboardLayout>
          <LazyPage component={AICommandCenter} />
        </DashboardLayout>
      </Route>
      
      {/* إعدادات مراقبة الذكاء الاصطناعي */}
      <Route path="/ai-monitor-settings">
        <DashboardLayout>
          <LazyPage component={AIMonitorSettings} />
        </DashboardLayout>
      </Route>
      
      {/* صفحة غير موجودة */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
