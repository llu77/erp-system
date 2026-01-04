import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle,
  Bell,
  Brain,
  TrendingUp,
  TrendingDown,
  Shield,
  Activity,
  Zap,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronRight,
  Lightbulb,
  Target,
  BarChart3,
  AlertCircle,
} from "lucide-react";

export default function SmartAlerts() {
  const { user } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<number | null>(user?.branchId || null);
  const [activeTab, setActiveTab] = useState("alerts");

  const { data: branches } = trpc.branches.list.useQuery();
  
  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = 
    trpc.intelligence.getProactiveAlerts.useQuery(
      { branchId: selectedBranch || 0 },
      { enabled: !!selectedBranch }
    );

  const { data: anomalies, isLoading: anomaliesLoading, refetch: refetchAnomalies } = 
    trpc.intelligence.detectAnomalies.useQuery(
      { branchId: selectedBranch || 0, includeEmployeeLevel: true },
      { enabled: !!selectedBranch }
    );

  const { data: recommendations, isLoading: recsLoading, refetch: refetchRecs } = 
    trpc.intelligence.getSmartRecommendations.useQuery(
      { branchId: selectedBranch || 0 },
      { enabled: !!selectedBranch }
    );

  const { data: integrity, isLoading: integrityLoading, refetch: refetchIntegrity } = 
    trpc.intelligence.checkDataIntegrity.useQuery(
      { branchId: selectedBranch || undefined },
      { enabled: !!selectedBranch }
    );

  const handleRefreshAll = () => {
    refetchAlerts();
    refetchAnomalies();
    refetchRecs();
    refetchIntegrity();
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
      case "urgent": return "bg-red-500";
      case "warning": return "bg-orange-500";
      case "info": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
      case "urgent": return <Badge variant="destructive">عاجل</Badge>;
      case "warning": return <Badge className="bg-orange-500">تحذير</Badge>;
      case "info": return <Badge variant="secondary">معلومات</Badge>;
      default: return <Badge variant="outline">{priority}</Badge>;
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case "performance_drop": return <TrendingDown className="h-5 w-5 text-red-500" />;
      case "opportunity": return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "data_delay": return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "bonus_at_risk": return <Clock className="h-5 w-5 text-blue-500" />;
      default: return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical": return <Badge variant="destructive">حرج</Badge>;
      case "warning": return <Badge className="bg-orange-500">تحذير</Badge>;
      case "info": return <Badge variant="secondary">معلومات</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  if (!selectedBranch && user?.role === 'admin') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Brain className="h-7 w-7 text-primary" />
              التنبيهات الذكية
            </h1>
            <p className="text-muted-foreground mt-1">
              مراقبة وتحليل ذكي للبيانات والأداء
            </p>
          </div>
        </div>

        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>اختر الفرع</CardTitle>
            <CardDescription>
              يرجى اختيار الفرع لعرض التنبيهات الذكية
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={(v) => setSelectedBranch(Number(v))}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.nameAr || branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  const criticalAlerts = alerts?.alerts?.filter(a => a.priority === 'critical' || a.priority === 'urgent') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            التنبيهات الذكية
          </h1>
          <p className="text-muted-foreground mt-1">
            مراقبة وتحليل ذكي للبيانات والأداء
          </p>
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'admin' && (
            <Select 
              value={selectedBranch?.toString()} 
              onValueChange={(v) => setSelectedBranch(Number(v))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                {branches?.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id.toString()}>
                    {branch.nameAr || branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button variant="outline" size="sm" onClick={handleRefreshAll}>
            <RefreshCw className="h-4 w-4 ml-2" />
            تحديث
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={criticalAlerts.length > 0 ? "border-red-300 bg-red-50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <Badge variant="destructive">
                {criticalAlerts.length}
              </Badge>
            </div>
            <p className="text-2xl font-bold mt-3">
              {criticalAlerts.length}
            </p>
            <p className="text-sm text-muted-foreground">تنبيهات عاجلة</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Activity className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-3">
              {anomalies?.anomalies?.length || 0}
            </p>
            <p className="text-sm text-muted-foreground">شذوذ مكتشف</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-lg bg-blue-100">
                <Lightbulb className="h-5 w-5 text-blue-600" />
              </div>
            </div>
            <p className="text-2xl font-bold mt-3">
              {recommendations?.recommendations?.length || 0}
            </p>
            <p className="text-sm text-muted-foreground">توصيات ذكية</p>
          </CardContent>
        </Card>

        <Card className={integrity?.isHealthy ? "border-green-300 bg-green-50" : "border-yellow-300 bg-yellow-50"}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className={`p-2 rounded-lg ${integrity?.isHealthy ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <Shield className={`h-5 w-5 ${integrity?.isHealthy ? 'text-green-600' : 'text-yellow-600'}`} />
              </div>
            </div>
            <p className="text-2xl font-bold mt-3">
              {integrity?.isHealthy ? 'سليم' : 'تحذير'}
            </p>
            <p className="text-sm text-muted-foreground">سلامة البيانات</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            التنبيهات
            {alerts?.alerts?.length ? (
              <Badge variant="secondary" className="mr-1">{alerts.alerts.length}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            الشذوذ
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            التوصيات
          </TabsTrigger>
          <TabsTrigger value="integrity" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            السلامة
          </TabsTrigger>
        </TabsList>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="mt-4">
          {alertsLoading ? (
            <AlertsSkeleton />
          ) : alerts?.alerts?.length ? (
            <div className="space-y-3">
              {alerts.alerts.map((alert, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-2 rounded-lg ${getPriorityColor(alert.priority)} bg-opacity-10`}>
                        {getAlertIcon(alert.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold">{alert.title}</h3>
                          {getPriorityBadge(alert.priority)}
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                        {alert.actionRequired && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-700 flex items-center gap-1">
                              <Zap className="h-4 w-4" />
                              <span className="font-medium">الإجراء المطلوب:</span> {alert.actionRequired}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">لا توجد تنبيهات</h3>
                <p className="text-muted-foreground">كل شيء يعمل بشكل طبيعي</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Anomalies Tab */}
        <TabsContent value="anomalies" className="mt-4">
          {anomaliesLoading ? (
            <AlertsSkeleton />
          ) : anomalies?.anomalies?.length ? (
            <div className="space-y-3">
              {anomalies.anomalies.map((anomaly, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-yellow-100">
                        <BarChart3 className="h-5 w-5 text-yellow-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold">
                            {anomaly.type === 'spike' ? 'ارتفاع غير طبيعي' : 'انخفاض غير طبيعي'}
                          </h3>
                          {getSeverityBadge(anomaly.severity)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {anomaly.entityName} - {anomaly.date}
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">القيمة الفعلية:</span>
                            <span className="font-semibold mr-1">{anomaly.actualValue?.toLocaleString()} ر.س</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">القيمة المتوقعة:</span>
                            <span className="font-semibold mr-1">{anomaly.expectedValue?.toLocaleString()} ر.س</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">الانحراف:</span>
                            <span className={`font-semibold mr-1 ${anomaly.deviation > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {anomaly.deviation?.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                        {anomaly.possibleCauses && anomaly.possibleCauses.length > 0 && (
                          <div className="mt-2 text-sm">
                            <span className="text-muted-foreground">الأسباب المحتملة:</span>
                            <span className="mr-1">{anomaly.possibleCauses.join('، ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">لا يوجد شذوذ</h3>
                <p className="text-muted-foreground">البيانات ضمن النطاق الطبيعي</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="mt-4">
          {recsLoading ? (
            <AlertsSkeleton />
          ) : recommendations?.recommendations?.length ? (
            <div className="space-y-3">
              {recommendations.recommendations.map((rec, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-2 rounded-lg bg-blue-100">
                        <Target className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className="font-semibold">{rec.title}</h3>
                          {getPriorityBadge(rec.priority)}
                        </div>
                        <p className="text-sm text-muted-foreground">{rec.description}</p>
                        {rec.impact && (
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">التحسن المتوقع:</span>
                            <Progress value={rec.impact.improvementPercent} className="w-24 h-2" />
                            <span className="text-sm font-medium">{rec.impact.improvementPercent?.toFixed(0)}%</span>
                          </div>
                        )}
                        {rec.actionItems && rec.actionItems.length > 0 && (
                          <div className="mt-3 space-y-1">
                            <p className="text-sm font-medium">الخطوات المقترحة:</p>
                            {rec.actionItems.map((item, i) => (
                              <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <ChevronRight className="h-4 w-4" />
                                {item.action}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Lightbulb className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">لا توجد توصيات حالياً</h3>
                <p className="text-muted-foreground">سيتم عرض التوصيات عند توفر بيانات كافية</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Integrity Tab */}
        <TabsContent value="integrity" className="mt-4">
          {integrityLoading ? (
            <AlertsSkeleton />
          ) : integrity ? (
            <div className="space-y-4">
              {/* Overall Status */}
              <Card className={integrity.isHealthy ? "border-green-300" : "border-yellow-300"}>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    {integrity.isHealthy ? (
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-8 w-8 text-yellow-500" />
                    )}
                    <div>
                      <CardTitle>
                        {integrity.isHealthy ? 'البيانات سليمة' : 'تحذيرات في البيانات'}
                      </CardTitle>
                      <CardDescription>
                        آخر فحص: {new Date().toLocaleString('ar-SA')}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Issues List */}
              {integrity.issues && integrity.issues.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">المشاكل المكتشفة</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {integrity.issues.map((issue, index) => (
                        <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                          <AlertCircle className={`h-5 w-5 ${issue.severity === 'high' ? 'text-red-500' : issue.severity === 'medium' ? 'text-yellow-500' : 'text-blue-500'}`} />
                          <div>
                            <p className="font-medium">{issue.type}</p>
                            <p className="text-sm text-muted-foreground">{issue.description}</p>
                            {issue.affectedCount > 0 && (
                              <Badge variant="secondary" className="mt-1">{issue.affectedCount} حالة</Badge>
                            )}
                            {issue.recommendation && (
                              <p className="text-sm text-blue-600 mt-1">{issue.recommendation}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Summary */}
              {integrity.summary && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">ملخص الفحص</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <p className="text-2xl font-bold">{integrity.summary.totalChecks || 0}</p>
                        <p className="text-sm text-muted-foreground">إجمالي الفحوصات</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-600">{integrity.summary.passedChecks || 0}</p>
                        <p className="text-sm text-muted-foreground">فحوصات ناجحة</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <p className="text-2xl font-bold text-red-600">{integrity.summary.failedChecks || 0}</p>
                        <p className="text-sm text-muted-foreground">فحوصات فاشلة</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold">لا توجد بيانات</h3>
                <p className="text-muted-foreground">يرجى اختيار فرع لفحص سلامة البيانات</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AlertsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
