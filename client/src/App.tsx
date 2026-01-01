import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";

// Pages
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Products from "./pages/Products";
import Categories from "./pages/Categories";
import Customers from "./pages/Customers";
import Suppliers from "./pages/Suppliers";
import Invoices from "./pages/Invoices";
import Purchases from "./pages/Purchases";
import Reports from "./pages/Reports";
import SendNotification from "./pages/SendNotification";
import Bonuses from "./pages/Bonuses";
import BonusRequests from "./pages/BonusRequests";
import Revenues from "./pages/Revenues";
import Branches from "./pages/Branches";
import Employees from "./pages/Employees";
import SubmitRequest from "./pages/SubmitRequest";
import ManageRequests from "./pages/ManageRequests";
import Payrolls from "./pages/Payrolls";
import Expenses from "./pages/Expenses";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import ProfitLoss from "./pages/ProfitLoss";
import ExecutiveDashboard from "./pages/ExecutiveDashboard";
import SecurityAlerts from "./pages/SecurityAlerts";
import PermissionsManagement from "./pages/PermissionsManagement";
import AdvancedInventory from "./pages/AdvancedInventory";
import SalesDashboard from "./pages/SalesDashboard";
import ReportSettings from "./pages/ReportSettings";
import HROnboarding from "./pages/HROnboarding";
import SchedulerSettings from "./pages/SchedulerSettings";
import NotificationRecipients from "./pages/NotificationRecipients";
import EmployeeInvoices from "./pages/EmployeeInvoices";
import InventoryCounting from "./pages/InventoryCounting";
import InventoryVarianceReport from "./pages/InventoryVarianceReport";
import TaskLookup from "./pages/TaskLookup";
import TaskManagement from "./pages/TaskManagement";
import Loyalty from "./pages/Loyalty";
import LoyaltyRegister from "./pages/LoyaltyRegister";
import LoyaltyVisit from "./pages/LoyaltyVisit";
import LoyaltySettings from "./pages/LoyaltySettings";

function Router() {
  return (
    <Switch>
      {/* صفحة تسجيل الدخول */}
      <Route path="/login" component={Login} />
      
      {/* Dashboard Routes - All protected with DashboardLayout */}
      <Route path="/">
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path="/users">
        <DashboardLayout>
          <Users />
        </DashboardLayout>
      </Route>
      <Route path="/products">
        <DashboardLayout>
          <Products />
        </DashboardLayout>
      </Route>
      <Route path="/categories">
        <DashboardLayout>
          <Categories />
        </DashboardLayout>
      </Route>
      <Route path="/customers">
        <DashboardLayout>
          <Customers />
        </DashboardLayout>
      </Route>
      <Route path="/suppliers">
        <DashboardLayout>
          <Suppliers />
        </DashboardLayout>
      </Route>
      <Route path="/employee-invoices">
        <DashboardLayout>
          <EmployeeInvoices />
        </DashboardLayout>
      </Route>
      <Route path="/invoices">
        <DashboardLayout>
          <Invoices />
        </DashboardLayout>
      </Route>
      <Route path="/purchases">
        <DashboardLayout>
          <Purchases />
        </DashboardLayout>
      </Route>
      <Route path="/reports">
        <DashboardLayout>
          <Reports />
        </DashboardLayout>
      </Route>
      <Route path="/notifications/send">
        <DashboardLayout>
          <SendNotification />
        </DashboardLayout>
      </Route>
      {/* Branches & Employees */}
      <Route path="/branches">
        <DashboardLayout>
          <Branches />
        </DashboardLayout>
      </Route>
      <Route path="/employees">
        <DashboardLayout>
          <Employees />
        </DashboardLayout>
      </Route>
      {/* Bonus System Routes */}
      <Route path="/revenues">
        <DashboardLayout>
          <Revenues />
        </DashboardLayout>
      </Route>
      <Route path="/bonuses">
        <DashboardLayout>
          <Bonuses />
        </DashboardLayout>
      </Route>
      <Route path="/bonus-requests">
        <DashboardLayout>
          <BonusRequests />
        </DashboardLayout>
      </Route>
      {/* Employee Requests Routes */}
      <Route path="/submit-request">
        <DashboardLayout>
          <SubmitRequest />
        </DashboardLayout>
      </Route>
      <Route path="/manage-requests">
        <DashboardLayout>
          <ManageRequests />
        </DashboardLayout>
      </Route>
      {/* Payroll & Expenses Routes */}
      <Route path="/payrolls">
        <DashboardLayout>
          <Payrolls />
        </DashboardLayout>
      </Route>
      <Route path="/expenses">
        <DashboardLayout>
          <Expenses />
        </DashboardLayout>
      </Route>
      {/* Settings */}
      <Route path="/settings">
        <DashboardLayout>
          <Settings />
        </DashboardLayout>
      </Route>
      {/* Profit & Loss */}
      <Route path="/profit-loss">
        <DashboardLayout>
          <ProfitLoss />
        </DashboardLayout>
      </Route>
      {/* Executive Dashboard & KPIs */}
      <Route path="/executive-dashboard">
        <DashboardLayout>
          <ExecutiveDashboard />
        </DashboardLayout>
      </Route>
      {/* Security & Audit */}
      <Route path="/security-alerts">
        <DashboardLayout>
          <SecurityAlerts />
        </DashboardLayout>
      </Route>
      {/* Permissions Management */}
      <Route path="/permissions">
        <DashboardLayout>
          <PermissionsManagement />
        </DashboardLayout>
      </Route>
      {/* Advanced Inventory */}
      <Route path="/advanced-inventory">
        <DashboardLayout>
          <AdvancedInventory />
        </DashboardLayout>
      </Route>
      {/* Inventory Counting */}
      <Route path="/inventory-counting">
        <DashboardLayout>
          <InventoryCounting />
        </DashboardLayout>
      </Route>
      {/* Inventory Variance Report */}
      <Route path="/inventory-variance-report">
        <DashboardLayout>
          <InventoryVarianceReport />
        </DashboardLayout>
      </Route>
      <Route path="/sales-dashboard">
        <DashboardLayout>
          <SalesDashboard />
        </DashboardLayout>
      </Route>
      <Route path="/report-settings">
        <DashboardLayout>
          <ReportSettings />
        </DashboardLayout>
      </Route>
      {/* Scheduler & System Monitor */}
      <Route path="/scheduler">
        <DashboardLayout>
          <SchedulerSettings />
        </DashboardLayout>
      </Route>
      {/* Notification Recipients */}
      <Route path="/notification-recipients">
        <DashboardLayout>
          <NotificationRecipients />
        </DashboardLayout>
      </Route>
      {/* HR Onboarding Portal - Public Page */}
      <Route path="/hr-onboarding" component={HROnboarding} />
      {/* Task Lookup - Public Page */}
      <Route path="/task-lookup" component={TaskLookup} />
      {/* Task Management - Admin Only */}
      <Route path="/task-management">
        <DashboardLayout>
          <TaskManagement />
        </DashboardLayout>
      </Route>
      {/* Loyalty Program */}
      <Route path="/loyalty">
        <DashboardLayout>
          <Loyalty />
        </DashboardLayout>
      </Route>
      {/* Loyalty Settings - Admin Only */}
      <Route path="/loyalty/settings">
        <DashboardLayout>
          <LoyaltySettings />
        </DashboardLayout>
      </Route>
      {/* Loyalty Register - Public Page */}
      <Route path="/loyalty/register" component={LoyaltyRegister} />
      {/* Loyalty Visit - Public Page */}
      <Route path="/loyalty/visit" component={LoyaltyVisit} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
