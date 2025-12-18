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

function Router() {
  return (
    <Switch>
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
