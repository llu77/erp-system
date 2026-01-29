import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/lib/trpc';
import { 
  Users, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Search,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Bell,
  Eye,
  Filter,
  Download,
  RefreshCw,
  Loader2,
  LogOut,
  Sparkles,
  IdCard,
  Heart,
  FileSignature,
  ChevronLeft,
  ChevronRight,
  UserCircle,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  CalendarDays,
  ClipboardList,
  BarChart3,
  PieChart,
  Activity,
  Shield,
  Settings,
  Home
} from 'lucide-react';

// أنواع الطلبات
const REQUEST_TYPE_NAMES: Record<string, string> = {
  advance: 'سلفة',
  vacation: 'إجازة',
  arrears: 'صرف متأخرات',
  permission: 'استئذان',
  objection: 'اعتراض على مخالفة',
  resignation: 'استقالة',
};

// حالات الطلب
const STATUS_NAMES: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'موافق عليه',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
};

// ألوان الحالات
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
};

interface AdminInfo {
  id: number;
  name: string;
  username: string;
  role: string;
  branchId?: number;
  branchName?: string;
  isAdmin: boolean;
  isSupervisor: boolean;
  accessAllBranches: boolean;
}

export default function AdminEmployeePortal() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [selectedRequestType, setSelectedRequestType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('pending');
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // جلب معلومات الأدمن من localStorage
  const adminInfo: AdminInfo | null = useMemo(() => {
    const stored = localStorage.getItem('employeeInfo');
    if (stored) {
      const info = JSON.parse(stored);
      // التحقق من أن المستخدم أدمن أو مشرف
      if (info.isAdmin || info.isSupervisor) {
        return info;
      }
    }
    return null;
  }, []);

  // استخدام portalAdmin APIs بدلاً من APIs القديمة
  const adminId = adminInfo?.id || 0;

  // جلب الفروع باستخدام portalAdmin
  const { data: branches, isLoading: branchesLoading } = trpc.portalAdmin.getBranches.useQuery(
    { adminId },
    { enabled: !!adminInfo }
  );

  // جلب الموظفين باستخدام portalAdmin
  const { 
    data: employees, 
    isLoading: employeesLoading, 
    refetch: refetchEmployees 
  } = trpc.portalAdmin.getEmployees.useQuery(
    { 
      adminId,
      branchId: selectedBranch !== 'all' ? parseInt(selectedBranch) : undefined,
      search: searchQuery || undefined
    },
    { enabled: !!adminInfo }
  );

  // جلب الطلبات باستخدام portalAdmin
  const { 
    data: requests, 
    isLoading: requestsLoading, 
    refetch: refetchRequests 
  } = trpc.portalAdmin.getRequests.useQuery(
    {
      adminId,
      status: selectedStatus === 'all' ? undefined : selectedStatus,
      requestType: selectedRequestType === 'all' ? undefined : selectedRequestType,
      branchId: selectedBranch === 'all' ? undefined : parseInt(selectedBranch),
    },
    { enabled: !!adminInfo }
  );

  // جلب الوثائق المنتهية باستخدام portalAdmin
  const { data: expiringDocs } = trpc.portalAdmin.getExpiringDocuments.useQuery(
    { adminId },
    { enabled: !!adminInfo }
  );

  // جلب إحصائيات الداشبورد باستخدام portalAdmin
  const { data: dashboardStatsData } = trpc.portalAdmin.getDashboardStats.useQuery(
    { adminId },
    { enabled: !!adminInfo }
  );

  // حساب إحصائيات الطلبات من البيانات المتاحة
  const requestStats = useMemo(() => {
    if (!requests) return { total: 0, pending: 0, approved: 0, rejected: 0 };
    return {
      total: requests.length,
      pending: requests.filter((r: any) => r.status === 'pending').length,
      approved: requests.filter((r: any) => r.status === 'approved').length,
      rejected: requests.filter((r: any) => r.status === 'rejected').length,
    };
  }, [requests]);

  // Mutation للموافقة/الرفض باستخدام portalAdmin
  const updateStatusMutation = trpc.portalAdmin.updateRequestStatus.useMutation({
    onSuccess: () => {
      refetchRequests();
      setShowRequestDialog(false);
      setSelectedRequest(null);
      setReviewNotes('');
    },
  });

  // فلترة الموظفين (الفلترة تتم في الخادم الآن)
  const filteredEmployees = employees || [];

  // إحصائيات الداشبورد
  const dashboardStats = useMemo(() => {
    if (dashboardStatsData) {
      return {
        totalEmployees: dashboardStatsData.totalEmployees,
        activeEmployees: dashboardStatsData.activeEmployees,
        pendingRequests: dashboardStatsData.pendingRequests,
        expiredDocs: dashboardStatsData.expiringDocuments,
        expiringDocsCount: 0,
        totalRequests: requestStats?.total || 0,
        approvedRequests: dashboardStatsData.approvedRequests,
        rejectedRequests: dashboardStatsData.rejectedRequests,
      };
    }
    
    // Fallback to calculated stats
    const totalEmployees = employees?.length || 0;
    const activeEmployees = employees?.filter((e: any) => e.isActive).length || 0;
    const pendingRequests = requestStats?.pending || 0;
    const expiredDocs = (expiringDocs?.expired?.iqama?.length || 0) + 
                        (expiringDocs?.expired?.healthCert?.length || 0) + 
                        (expiringDocs?.expired?.contract?.length || 0);
    const expiringDocsCount = (expiringDocs?.expiring?.iqama?.length || 0) + 
                              (expiringDocs?.expiring?.healthCert?.length || 0) + 
                              (expiringDocs?.expiring?.contract?.length || 0);
    
    return {
      totalEmployees,
      activeEmployees,
      pendingRequests,
      expiredDocs,
      expiringDocsCount,
      totalRequests: requestStats?.total || 0,
      approvedRequests: requestStats?.approved || 0,
      rejectedRequests: requestStats?.rejected || 0,
    };
  }, [employees, requestStats, expiringDocs, dashboardStatsData]);

  // معالجة الطلب
  const handleProcessRequest = async (status: 'approved' | 'rejected') => {
    if (!selectedRequest || !adminInfo) return;
    
    setIsProcessing(true);
    try {
      await updateStatusMutation.mutateAsync({
        adminId: adminInfo.id,
        requestId: selectedRequest.id,
        status,
        reviewNotes,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // تسجيل الخروج
  const handleLogout = () => {
    localStorage.removeItem('employeeInfo');
    localStorage.removeItem('employeeToken');
    setLocation('/employee-login');
  };

  // التحقق من الصلاحيات
  if (!adminInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center" dir="rtl">
        <Card className="bg-slate-800/50 border-slate-700 p-8 text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">غير مصرح</h2>
          <p className="text-slate-400 mb-4">ليس لديك صلاحية الوصول لهذه الصفحة</p>
          <Button onClick={() => setLocation('/employee-login')} className="bg-amber-500 hover:bg-amber-600">
            العودة لتسجيل الدخول
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" dir="rtl">
      {/* Header */}
      <header className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setLocation('/employee-portal')}
                className="text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2 rounded-xl shadow-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">لوحة تحكم الأدمن</h1>
                <p className="text-xs text-slate-400">إدارة الموظفين والطلبات</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-white">{adminInfo.name}</p>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  {adminInfo.isAdmin ? 'مدير النظام' : 'مشرف'}
                </Badge>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-400 hover:text-white hover:bg-slate-700"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Navigation Tabs */}
          <TabsList className="bg-slate-800/50 border border-slate-700 p-1 flex-wrap h-auto gap-1">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">الرئيسية</span>
            </TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">الطلبات</span>
              {dashboardStats.pendingRequests > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">
                  {dashboardStats.pendingRequests}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="employees" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">الموظفين</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">الوثائق</span>
              {dashboardStats.expiredDocs > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">
                  {dashboardStats.expiredDocs}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="data-[state=active]:bg-amber-500 data-[state=active]:text-white gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">التقارير</span>
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 border-blue-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-blue-300">إجمالي الموظفين</p>
                      <p className="text-3xl font-bold text-white">{dashboardStats.totalEmployees}</p>
                      <p className="text-xs text-blue-400">{dashboardStats.activeEmployees} نشط</p>
                    </div>
                    <Users className="h-10 w-10 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 border-amber-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-amber-300">طلبات معلقة</p>
                      <p className="text-3xl font-bold text-white">{dashboardStats.pendingRequests}</p>
                      <p className="text-xs text-amber-400">تحتاج مراجعة</p>
                    </div>
                    <Clock className="h-10 w-10 text-amber-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-red-600/20 to-red-800/20 border-red-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-red-300">وثائق منتهية</p>
                      <p className="text-3xl font-bold text-white">{dashboardStats.expiredDocs}</p>
                      <p className="text-xs text-red-400">{dashboardStats.expiringDocsCount} قريبة الانتهاء</p>
                    </div>
                    <AlertCircle className="h-10 w-10 text-red-400" />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 border-emerald-500/30">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-emerald-300">طلبات موافق عليها</p>
                      <p className="text-3xl font-bold text-white">{dashboardStats.approvedRequests}</p>
                      <p className="text-xs text-emerald-400">من {dashboardStats.totalRequests} طلب</p>
                    </div>
                    <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* الطلبات الأخيرة */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-amber-500" />
                    أحدث الطلبات المعلقة
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {requestsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                      </div>
                    ) : requests?.filter((r: any) => r.status === 'pending').slice(0, 5).length === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                        <p>لا توجد طلبات معلقة</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {requests?.filter((r: any) => r.status === 'pending').slice(0, 5).map((request: any) => (
                          <div 
                            key={request.id}
                            className="p-3 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-amber-500/50 cursor-pointer transition-all"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowRequestDialog(true);
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-white">{request.employeeName}</span>
                              <Badge className={STATUS_COLORS[request.status]}>
                                {STATUS_NAMES[request.status]}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-slate-400">
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {REQUEST_TYPE_NAMES[request.requestType]}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(request.createdAt).toLocaleDateString('ar-SA')}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* تنبيهات الوثائق */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Bell className="h-5 w-5 text-red-500" />
                    تنبيهات الوثائق
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[300px]">
                    {!expiringDocs ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                      </div>
                    ) : dashboardStats.expiredDocs === 0 && dashboardStats.expiringDocsCount === 0 ? (
                      <div className="text-center py-8 text-slate-400">
                        <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                        <p>جميع الوثائق سارية</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {/* الإقامات المنتهية */}
                        {expiringDocs?.expired?.iqama?.map((emp: any) => (
                          <div key={`iqama-${emp.id}`} className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                            <div className="flex items-center gap-2 mb-1">
                              <IdCard className="h-4 w-4 text-red-400" />
                              <span className="font-medium text-white">{emp.name}</span>
                              <Badge className="bg-red-500/20 text-red-400 text-xs">منتهية</Badge>
                            </div>
                            <p className="text-xs text-slate-400">إقامة - {emp.branchName}</p>
                          </div>
                        ))}
                        {/* الشهادات الصحية المنتهية */}
                        {expiringDocs?.expired?.healthCert?.map((emp: any) => (
                          <div key={`health-${emp.id}`} className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                            <div className="flex items-center gap-2 mb-1">
                              <Heart className="h-4 w-4 text-red-400" />
                              <span className="font-medium text-white">{emp.name}</span>
                              <Badge className="bg-red-500/20 text-red-400 text-xs">منتهية</Badge>
                            </div>
                            <p className="text-xs text-slate-400">شهادة صحية - {emp.branchName}</p>
                          </div>
                        ))}
                        {/* العقود المنتهية */}
                        {expiringDocs?.expired?.contract?.map((emp: any) => (
                          <div key={`contract-${emp.id}`} className="p-3 bg-red-500/10 rounded-lg border border-red-500/30">
                            <div className="flex items-center gap-2 mb-1">
                              <FileSignature className="h-4 w-4 text-red-400" />
                              <span className="font-medium text-white">{emp.name}</span>
                              <Badge className="bg-red-500/20 text-red-400 text-xs">منتهية</Badge>
                            </div>
                            <p className="text-xs text-slate-400">عقد العمل - {emp.branchName}</p>
                          </div>
                        ))}
                        {/* الوثائق قريبة الانتهاء */}
                        {expiringDocs?.expiring?.iqama?.slice(0, 3).map((emp: any) => (
                          <div key={`iqama-exp-${emp.id}`} className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                            <div className="flex items-center gap-2 mb-1">
                              <IdCard className="h-4 w-4 text-amber-400" />
                              <span className="font-medium text-white">{emp.name}</span>
                              <Badge className="bg-amber-500/20 text-amber-400 text-xs">قريبة الانتهاء</Badge>
                            </div>
                            <p className="text-xs text-slate-400">إقامة - {emp.branchName}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>

              {/* قسم تفصيلي لتنبيهات الوثائق */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      ملخص حالة وثائق الموظفين
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-500/20 text-red-400">
                        {dashboardStats.expiredDocs} منتهية
                      </Badge>
                      <Badge className="bg-amber-500/20 text-amber-400">
                        {dashboardStats.expiringDocsCount} قريبة الانتهاء
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {!expiringDocs ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                    </div>
                  ) : dashboardStats.expiredDocs === 0 && dashboardStats.expiringDocsCount === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                      <p className="text-lg font-medium text-emerald-400">جميع الوثائق سارية</p>
                      <p className="text-sm text-slate-500">لا توجد وثائق منتهية أو قريبة من الانتهاء</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* الإقامات */}
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <div className="flex items-center gap-2 mb-3">
                          <IdCard className="h-5 w-5 text-blue-400" />
                          <h4 className="font-medium text-white">الإقامات</h4>
                        </div>
                        <div className="space-y-2">
                          {expiringDocs?.expired?.iqama?.length > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-red-400">منتهية</span>
                              <Badge className="bg-red-500/20 text-red-400">{expiringDocs.expired.iqama.length}</Badge>
                            </div>
                          )}
                          {expiringDocs?.expiring?.iqama?.length > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-amber-400">قريبة الانتهاء</span>
                              <Badge className="bg-amber-500/20 text-amber-400">{expiringDocs.expiring.iqama.length}</Badge>
                            </div>
                          )}
                          {(!expiringDocs?.expired?.iqama?.length && !expiringDocs?.expiring?.iqama?.length) && (
                            <p className="text-sm text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              جميعها سارية
                            </p>
                          )}
                        </div>
                        {/* قائمة الموظفين */}
                        {(expiringDocs?.expired?.iqama?.length > 0 || expiringDocs?.expiring?.iqama?.length > 0) && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <ScrollArea className="h-[150px]">
                              <div className="space-y-2">
                                {expiringDocs?.expired?.iqama?.map((emp: any) => (
                                  <div key={`iq-exp-${emp.id}`} className="flex items-center justify-between text-xs bg-red-500/10 p-2 rounded">
                                    <span className="text-white">{emp.name}</span>
                                    <span className="text-red-400">منتهية</span>
                                  </div>
                                ))}
                                {expiringDocs?.expiring?.iqama?.map((emp: any) => (
                                  <div key={`iq-soon-${emp.id}`} className="flex items-center justify-between text-xs bg-amber-500/10 p-2 rounded">
                                    <span className="text-white">{emp.name}</span>
                                    <span className="text-amber-400">
                                      {emp.iqamaExpiryDate ? `${Math.ceil((new Date(emp.iqamaExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} يوم` : 'قريباً'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>

                      {/* الشهادات الصحية */}
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <div className="flex items-center gap-2 mb-3">
                          <Heart className="h-5 w-5 text-pink-400" />
                          <h4 className="font-medium text-white">الشهادات الصحية</h4>
                        </div>
                        <div className="space-y-2">
                          {expiringDocs?.expired?.healthCert?.length > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-red-400">منتهية</span>
                              <Badge className="bg-red-500/20 text-red-400">{expiringDocs.expired.healthCert.length}</Badge>
                            </div>
                          )}
                          {expiringDocs?.expiring?.healthCert?.length > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-amber-400">قريبة الانتهاء</span>
                              <Badge className="bg-amber-500/20 text-amber-400">{expiringDocs.expiring.healthCert.length}</Badge>
                            </div>
                          )}
                          {(!expiringDocs?.expired?.healthCert?.length && !expiringDocs?.expiring?.healthCert?.length) && (
                            <p className="text-sm text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              جميعها سارية
                            </p>
                          )}
                        </div>
                        {/* قائمة الموظفين */}
                        {(expiringDocs?.expired?.healthCert?.length > 0 || expiringDocs?.expiring?.healthCert?.length > 0) && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <ScrollArea className="h-[150px]">
                              <div className="space-y-2">
                                {expiringDocs?.expired?.healthCert?.map((emp: any) => (
                                  <div key={`hc-exp-${emp.id}`} className="flex items-center justify-between text-xs bg-red-500/10 p-2 rounded">
                                    <span className="text-white">{emp.name}</span>
                                    <span className="text-red-400">منتهية</span>
                                  </div>
                                ))}
                                {expiringDocs?.expiring?.healthCert?.map((emp: any) => (
                                  <div key={`hc-soon-${emp.id}`} className="flex items-center justify-between text-xs bg-amber-500/10 p-2 rounded">
                                    <span className="text-white">{emp.name}</span>
                                    <span className="text-amber-400">
                                      {emp.healthCertExpiryDate ? `${Math.ceil((new Date(emp.healthCertExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} يوم` : 'قريباً'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>

                      {/* العقود */}
                      <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600">
                        <div className="flex items-center gap-2 mb-3">
                          <FileSignature className="h-5 w-5 text-purple-400" />
                          <h4 className="font-medium text-white">عقود العمل</h4>
                        </div>
                        <div className="space-y-2">
                          {expiringDocs?.expired?.contract?.length > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-red-400">منتهية</span>
                              <Badge className="bg-red-500/20 text-red-400">{expiringDocs.expired.contract.length}</Badge>
                            </div>
                          )}
                          {expiringDocs?.expiring?.contract?.length > 0 && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-amber-400">قريبة الانتهاء</span>
                              <Badge className="bg-amber-500/20 text-amber-400">{expiringDocs.expiring.contract.length}</Badge>
                            </div>
                          )}
                          {(!expiringDocs?.expired?.contract?.length && !expiringDocs?.expiring?.contract?.length) && (
                            <p className="text-sm text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4" />
                              جميعها سارية
                            </p>
                          )}
                        </div>
                        {/* قائمة الموظفين */}
                        {(expiringDocs?.expired?.contract?.length > 0 || expiringDocs?.expiring?.contract?.length > 0) && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <ScrollArea className="h-[150px]">
                              <div className="space-y-2">
                                {expiringDocs?.expired?.contract?.map((emp: any) => (
                                  <div key={`ct-exp-${emp.id}`} className="flex items-center justify-between text-xs bg-red-500/10 p-2 rounded">
                                    <span className="text-white">{emp.name}</span>
                                    <span className="text-red-400">منتهية</span>
                                  </div>
                                ))}
                                {expiringDocs?.expiring?.contract?.map((emp: any) => (
                                  <div key={`ct-soon-${emp.id}`} className="flex items-center justify-between text-xs bg-amber-500/10 p-2 rounded">
                                    <span className="text-white">{emp.name}</span>
                                    <span className="text-amber-400">
                                      {emp.contractExpiryDate ? `${Math.ceil((new Date(emp.contractExpiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} يوم` : 'قريباً'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </ScrollArea>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            {/* Filters */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="حالة الطلب" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الحالات</SelectItem>
                        <SelectItem value="pending">قيد المراجعة</SelectItem>
                        <SelectItem value="approved">موافق عليه</SelectItem>
                        <SelectItem value="rejected">مرفوض</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex-1 min-w-[200px]">
                    <Select value={selectedRequestType} onValueChange={setSelectedRequestType}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="نوع الطلب" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الأنواع</SelectItem>
                        <SelectItem value="advance">سلفة</SelectItem>
                        <SelectItem value="vacation">إجازة</SelectItem>
                        <SelectItem value="permission">استئذان</SelectItem>
                        <SelectItem value="arrears">صرف متأخرات</SelectItem>
                        <SelectItem value="objection">اعتراض</SelectItem>
                        <SelectItem value="resignation">استقالة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex-1 min-w-[200px]">
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفروع</SelectItem>
                        {branches?.map((branch: any) => (
                          <SelectItem key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    variant="outline" 
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={() => refetchRequests()}
                  >
                    <RefreshCw className="h-4 w-4 ml-2" />
                    تحديث
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Requests List */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">قائمة الطلبات</CardTitle>
                <CardDescription className="text-slate-400">
                  {requests?.length || 0} طلب
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  {requestsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    </div>
                  ) : requests?.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">
                      <FileText className="h-12 w-12 mx-auto mb-2" />
                      <p>لا توجد طلبات</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {requests?.map((request: any) => (
                        <div 
                          key={request.id}
                          className="p-4 bg-slate-700/50 rounded-lg border border-slate-600 hover:border-amber-500/50 cursor-pointer transition-all"
                          onClick={() => {
                            setSelectedRequest(request);
                            setShowRequestDialog(true);
                          }}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-white text-lg">{request.employeeName}</h4>
                              <p className="text-sm text-slate-400">#{request.requestNumber}</p>
                            </div>
                            <Badge className={STATUS_COLORS[request.status]}>
                              {STATUS_NAMES[request.status]}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div className="flex items-center gap-2 text-slate-300">
                              <FileText className="h-4 w-4 text-amber-500" />
                              <span>{REQUEST_TYPE_NAMES[request.requestType]}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Building2 className="h-4 w-4 text-blue-500" />
                              <span>{request.branchName || 'غير محدد'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-300">
                              <Calendar className="h-4 w-4 text-emerald-500" />
                              <span>{new Date(request.createdAt).toLocaleDateString('ar-SA')}</span>
                            </div>
                            {request.advanceAmount && (
                              <div className="flex items-center gap-2 text-slate-300">
                                <DollarSign className="h-4 w-4 text-purple-500" />
                                <span>{request.advanceAmount} ر.س</span>
                              </div>
                            )}
                          </div>
                          
                          {request.title && (
                            <p className="mt-3 text-sm text-slate-400 line-clamp-2">{request.title}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="space-y-4">
            {/* Search & Filter */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[250px]">
                    <div className="relative">
                      <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="بحث بالاسم أو الكود..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pr-10 bg-slate-700 border-slate-600 text-white"
                      />
                    </div>
                  </div>
                  
                  <div className="w-[200px]">
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                        <SelectValue placeholder="الفرع" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">جميع الفروع</SelectItem>
                        {branches?.map((branch: any) => (
                          <SelectItem key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Employees Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {employeesLoading ? (
                <div className="col-span-full flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="col-span-full text-center py-8 text-slate-400">
                  <Users className="h-12 w-12 mx-auto mb-2" />
                  <p>لا يوجد موظفين</p>
                </div>
              ) : (
                filteredEmployees.map((employee: any) => (
                  <Card 
                    key={employee.id}
                    className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 cursor-pointer transition-all"
                    onClick={() => setSelectedEmployee(employee.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        {employee.photoUrl ? (
                          <img 
                            src={employee.photoUrl} 
                            alt={employee.name}
                            className="w-14 h-14 rounded-xl object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                        ) : null}
                        <div className={`bg-gradient-to-br from-amber-500 to-orange-600 p-3 rounded-xl ${employee.photoUrl ? 'hidden' : ''}`}>
                          <UserCircle className="h-8 w-8 text-white" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-white">{employee.name}</h4>
                          <p className="text-sm text-slate-400">{employee.code}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                              {employee.branchName}
                            </Badge>
                            {employee.isActive ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                                نشط
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                غير نشط
                              </Badge>
                            )}
                            {employee.isSupervisor && (
                              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                                مشرف
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-2 text-xs">
                        <div className="flex items-center gap-1 text-slate-400">
                          <Phone className="h-3 w-3" />
                          <span>{employee.phone || 'غير محدد'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-400">
                          <Briefcase className="h-3 w-3" />
                          <span>{employee.position || 'غير محدد'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  الوثائق المنتهية والقريبة الانتهاء
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  {/* الإقامات */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-white flex items-center gap-2">
                      <IdCard className="h-4 w-4 text-blue-500" />
                      الإقامات
                    </h4>
                    {expiringDocs?.expired?.iqama?.length === 0 && expiringDocs?.expiring?.iqama?.length === 0 ? (
                      <p className="text-sm text-slate-400">لا توجد إقامات منتهية</p>
                    ) : (
                      <div className="space-y-2">
                        {expiringDocs?.expired?.iqama?.map((emp: any) => (
                          <div key={emp.id} className="p-2 bg-red-500/10 rounded border border-red-500/30">
                            <p className="font-medium text-white text-sm">{emp.name}</p>
                            <p className="text-xs text-red-400">منتهية</p>
                          </div>
                        ))}
                        {expiringDocs?.expiring?.iqama?.map((emp: any) => (
                          <div key={emp.id} className="p-2 bg-amber-500/10 rounded border border-amber-500/30">
                            <p className="font-medium text-white text-sm">{emp.name}</p>
                            <p className="text-xs text-amber-400">قريبة الانتهاء</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* الشهادات الصحية */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-white flex items-center gap-2">
                      <Heart className="h-4 w-4 text-green-500" />
                      الشهادات الصحية
                    </h4>
                    {expiringDocs?.expired?.healthCert?.length === 0 && expiringDocs?.expiring?.healthCert?.length === 0 ? (
                      <p className="text-sm text-slate-400">لا توجد شهادات منتهية</p>
                    ) : (
                      <div className="space-y-2">
                        {expiringDocs?.expired?.healthCert?.map((emp: any) => (
                          <div key={emp.id} className="p-2 bg-red-500/10 rounded border border-red-500/30">
                            <p className="font-medium text-white text-sm">{emp.name}</p>
                            <p className="text-xs text-red-400">منتهية</p>
                          </div>
                        ))}
                        {expiringDocs?.expiring?.healthCert?.map((emp: any) => (
                          <div key={emp.id} className="p-2 bg-amber-500/10 rounded border border-amber-500/30">
                            <p className="font-medium text-white text-sm">{emp.name}</p>
                            <p className="text-xs text-amber-400">قريبة الانتهاء</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* العقود */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-white flex items-center gap-2">
                      <FileSignature className="h-4 w-4 text-purple-500" />
                      العقود
                    </h4>
                    {expiringDocs?.expired?.contract?.length === 0 && expiringDocs?.expiring?.contract?.length === 0 ? (
                      <p className="text-sm text-slate-400">لا توجد عقود منتهية</p>
                    ) : (
                      <div className="space-y-2">
                        {expiringDocs?.expired?.contract?.map((emp: any) => (
                          <div key={emp.id} className="p-2 bg-red-500/10 rounded border border-red-500/30">
                            <p className="font-medium text-white text-sm">{emp.name}</p>
                            <p className="text-xs text-red-400">منتهية</p>
                          </div>
                        ))}
                        {expiringDocs?.expiring?.contract?.map((emp: any) => (
                          <div key={emp.id} className="p-2 bg-amber-500/10 rounded border border-amber-500/30">
                            <p className="font-medium text-white text-sm">{emp.name}</p>
                            <p className="text-xs text-amber-400">قريبة الانتهاء</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 cursor-pointer transition-all">
                <CardContent className="p-6 text-center">
                  <BarChart3 className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                  <h4 className="font-bold text-white mb-2">تقرير الطلبات</h4>
                  <p className="text-sm text-slate-400">إحصائيات شاملة للطلبات</p>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 cursor-pointer transition-all">
                <CardContent className="p-6 text-center">
                  <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                  <h4 className="font-bold text-white mb-2">تقرير الموظفين</h4>
                  <p className="text-sm text-slate-400">بيانات الموظفين الشاملة</p>
                </CardContent>
              </Card>
              
              <Card className="bg-slate-800/50 border-slate-700 hover:border-amber-500/50 cursor-pointer transition-all">
                <CardContent className="p-6 text-center">
                  <FileText className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                  <h4 className="font-bold text-white mb-2">تقرير الوثائق</h4>
                  <p className="text-sm text-slate-400">حالة وثائق الموظفين</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Request Details Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" />
              تفاصيل الطلب #{selectedRequest?.requestNumber}
            </DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              {/* معلومات الموظف */}
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <h4 className="font-bold text-white mb-3">معلومات الموظف</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">الاسم:</span>
                    <span className="text-white mr-2">{selectedRequest.employeeName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">الفرع:</span>
                    <span className="text-white mr-2">{selectedRequest.branchName}</span>
                  </div>
                </div>
              </div>
              
              {/* تفاصيل الطلب */}
              <div className="p-4 bg-slate-700/50 rounded-lg">
                <h4 className="font-bold text-white mb-3">تفاصيل الطلب</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-400">نوع الطلب:</span>
                    <span className="text-white mr-2">{REQUEST_TYPE_NAMES[selectedRequest.requestType]}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">الحالة:</span>
                    <Badge className={`mr-2 ${STATUS_COLORS[selectedRequest.status]}`}>
                      {STATUS_NAMES[selectedRequest.status]}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-slate-400">تاريخ الطلب:</span>
                    <span className="text-white mr-2">
                      {new Date(selectedRequest.createdAt).toLocaleDateString('ar-SA')}
                    </span>
                  </div>
                  {selectedRequest.advanceAmount && (
                    <div>
                      <span className="text-slate-400">المبلغ:</span>
                      <span className="text-white mr-2">{selectedRequest.advanceAmount} ر.س</span>
                    </div>
                  )}
                </div>
                
                {selectedRequest.title && (
                  <div className="mt-3">
                    <span className="text-slate-400">العنوان:</span>
                    <p className="text-white mt-1">{selectedRequest.title}</p>
                  </div>
                )}
                
                {selectedRequest.description && (
                  <div className="mt-3">
                    <span className="text-slate-400">التفاصيل:</span>
                    <p className="text-white mt-1">{selectedRequest.description}</p>
                  </div>
                )}
              </div>
              
              {/* ملاحظات المراجعة (للطلبات المعلقة) */}
              {selectedRequest.status === 'pending' && (
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <h4 className="font-bold text-white mb-3">ملاحظات المراجعة</h4>
                  <Textarea
                    placeholder="أضف ملاحظاتك هنا..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    className="bg-slate-600 border-slate-500 text-white"
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="flex gap-2">
            {selectedRequest?.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleProcessRequest('rejected')}
                  disabled={isProcessing}
                  className="bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <XCircle className="h-4 w-4 ml-2" />}
                  رفض
                </Button>
                <Button
                  onClick={() => handleProcessRequest('approved')}
                  disabled={isProcessing}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <CheckCircle2 className="h-4 w-4 ml-2" />}
                  موافقة
                </Button>
              </>
            )}
            <Button
              variant="outline"
              onClick={() => setShowRequestDialog(false)}
              className="border-slate-600 text-slate-300"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Employee Details Dialog */}
      <Dialog open={selectedEmployee !== null} onOpenChange={(open) => !open && setSelectedEmployee(null)}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-amber-500" />
              ملف الموظف
            </DialogTitle>
          </DialogHeader>
          
          {selectedEmployee && (() => {
            const employee = employees?.find((e: any) => e.id === selectedEmployee);
            if (!employee) return null;
            
            return (
              <div className="space-y-4">
                {/* المعلومات الأساسية */}
                <div className="p-4 bg-gradient-to-br from-amber-500/10 to-orange-600/10 rounded-lg border border-amber-500/30">
                  <div className="flex items-center gap-4">
                    {employee.photoUrl ? (
                      <img 
                        src={employee.photoUrl} 
                        alt={employee.name}
                        className="w-20 h-20 rounded-xl object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-xl ${employee.photoUrl ? 'hidden' : ''}`}>
                      <UserCircle className="h-12 w-12 text-white" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-white">{employee.name}</h3>
                      <p className="text-slate-400">{employee.code}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                          {employee.branchName}
                        </Badge>
                        {employee.isActive ? (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                            نشط
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            غير نشط
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* بيانات التواصل */}
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                    <Phone className="h-4 w-4 text-blue-500" />
                    بيانات التواصل
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">رقم الجوال:</span>
                      <span className="text-white mr-2">{employee.phone || 'غير محدد'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">البريد الإلكتروني:</span>
                      <span className="text-white mr-2">{employee.email || 'غير محدد'}</span>
                    </div>
                  </div>
                </div>
                
                {/* بيانات العمل */}
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-emerald-500" />
                    بيانات العمل
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">المسمى الوظيفي:</span>
                      <span className="text-white mr-2">{employee.position || 'غير محدد'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">الراتب الأساسي:</span>
                      <span className="text-white mr-2">{(employee as any).baseSalary?.toLocaleString() || 0} ر.س</span>
                    </div>
                    <div>
                      <span className="text-slate-400">تاريخ الالتحاق:</span>
                      <span className="text-white mr-2">
                        {(employee as any).joinDate ? new Date((employee as any).joinDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">الجنسية:</span>
                      <span className="text-white mr-2">{(employee as any).nationality || 'غير محدد'}</span>
                    </div>
                  </div>
                </div>
                
                {/* بيانات الوثائق */}
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                    <IdCard className="h-4 w-4 text-purple-500" />
                    الوثائق
                  </h4>
                  <div className="grid md:grid-cols-3 gap-4">
                    {/* الإقامة */}
                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                      <div className="flex items-center gap-2 mb-2">
                        <IdCard className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-medium text-white">الإقامة</span>
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        <div>الرقم: {employee.iqamaNumber || 'غير محدد'}</div>
                        <div className={employee.iqamaExpiryDate && new Date(employee.iqamaExpiryDate) < new Date() ? 'text-red-400' : ''}>
                          الانتهاء: {employee.iqamaExpiryDate ? new Date(employee.iqamaExpiryDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                        </div>
                      </div>
                      {(employee as any).iqamaImageUrl ? (
                        <a href={(employee as any).iqamaImageUrl} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={(employee as any).iqamaImageUrl} 
                            alt="صورة الإقامة"
                            className="w-full h-24 object-cover rounded-lg border border-slate-600 hover:border-blue-500 transition-colors cursor-pointer"
                          />
                        </a>
                      ) : (
                        <div className="w-full h-24 bg-slate-900/50 rounded-lg border border-slate-600 flex items-center justify-center text-slate-500 text-xs">
                          لا توجد صورة
                        </div>
                      )}
                    </div>
                    
                    {/* الشهادة الصحية */}
                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="h-4 w-4 text-red-400" />
                        <span className="text-sm font-medium text-white">الشهادة الصحية</span>
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        <div className={employee.healthCertExpiryDate && new Date(employee.healthCertExpiryDate) < new Date() ? 'text-red-400' : ''}>
                          الانتهاء: {employee.healthCertExpiryDate ? new Date(employee.healthCertExpiryDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                        </div>
                      </div>
                      {(employee as any).healthCertImageUrl ? (
                        <a href={(employee as any).healthCertImageUrl} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={(employee as any).healthCertImageUrl} 
                            alt="صورة الشهادة الصحية"
                            className="w-full h-24 object-cover rounded-lg border border-slate-600 hover:border-red-500 transition-colors cursor-pointer"
                          />
                        </a>
                      ) : (
                        <div className="w-full h-24 bg-slate-900/50 rounded-lg border border-slate-600 flex items-center justify-center text-slate-500 text-xs">
                          لا توجد صورة
                        </div>
                      )}
                    </div>
                    
                    {/* عقد العمل */}
                    <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                      <div className="flex items-center gap-2 mb-2">
                        <FileSignature className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm font-medium text-white">عقد العمل</span>
                      </div>
                      <div className="text-xs text-slate-400 mb-2">
                        <div className={employee.contractExpiryDate && new Date(employee.contractExpiryDate) < new Date() ? 'text-red-400' : ''}>
                          الانتهاء: {employee.contractExpiryDate ? new Date(employee.contractExpiryDate).toLocaleDateString('ar-SA') : 'غير محدد'}
                        </div>
                      </div>
                      {(employee as any).contractImageUrl ? (
                        <a href={(employee as any).contractImageUrl} target="_blank" rel="noopener noreferrer">
                          <img 
                            src={(employee as any).contractImageUrl} 
                            alt="صورة العقد"
                            className="w-full h-24 object-cover rounded-lg border border-slate-600 hover:border-emerald-500 transition-colors cursor-pointer"
                          />
                        </a>
                      ) : (
                        <div className="w-full h-24 bg-slate-900/50 rounded-lg border border-slate-600 flex items-center justify-center text-slate-500 text-xs">
                          لا توجد صورة
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* بيانات البنك */}
                <div className="p-4 bg-slate-700/50 rounded-lg">
                  <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-amber-500" />
                    بيانات البنك
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">اسم البنك:</span>
                      <span className="text-white mr-2">{(employee as any).bankName || 'غير محدد'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">رقم الحساب (IBAN):</span>
                      <span className="text-white mr-2 font-mono text-xs">{(employee as any).iban || 'غير محدد'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectedEmployee(null)}
              className="border-slate-600 text-slate-300"
            >
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Symbol AI Footer */}
      <div className="fixed bottom-4 left-4 z-40">
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/90 backdrop-blur-sm rounded-full border border-slate-700/50 shadow-lg">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="text-xs text-slate-400">Powered by</span>
          <span className="text-xs font-bold text-amber-400">Symbol AI</span>
        </div>
      </div>
    </div>
  );
}
