import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Shield, FileSearch, AlertTriangle, CheckCircle, Clock,
  User, Activity, FileText, Eye, RefreshCw, Download
} from "lucide-react";

export default function AuditCompliance() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  
  // جلب البيانات
  const { data: auditEvents, isLoading: eventsLoading, refetch: refetchEvents } = 
    trpc.auditCompliance.getEvents.useQuery({ limit: 100, offset: 0 });
  const { data: anomalies, isLoading: anomaliesLoading } = 
    trpc.auditCompliance.detectAnomalies.useQuery({ year, month });
  const { data: complianceReport, isLoading: complianceLoading } = 
    trpc.auditCompliance.getComplianceReport.useQuery({ year, month });
  
  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "create": return <FileText className="h-4 w-4 text-green-500" />;
      case "update": return <Activity className="h-4 w-4 text-blue-500" />;
      case "delete": return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "login": return <User className="h-4 w-4 text-purple-500" />;
      case "view": return <Eye className="h-4 w-4 text-gray-500" />;
      default: return <FileSearch className="h-4 w-4 text-gray-500" />;
    }
  };
  
  const getEventTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      create: "bg-green-500/20 text-green-400",
      update: "bg-blue-500/20 text-blue-400",
      delete: "bg-red-500/20 text-red-400",
      login: "bg-purple-500/20 text-purple-400",
      view: "bg-gray-500/20 text-gray-400",
    };
    const labels: Record<string, string> = {
      create: "إنشاء",
      update: "تحديث",
      delete: "حذف",
      login: "دخول",
      view: "عرض",
    };
    return (
      <Badge className={colors[type] || colors.view}>
        {labels[type] || type}
      </Badge>
    );
  };
  
  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400",
      high: "bg-orange-500/20 text-orange-400",
      medium: "bg-yellow-500/20 text-yellow-400",
      low: "bg-green-500/20 text-green-400",
    };
    const labels: Record<string, string> = {
      critical: "حرج",
      high: "عالي",
      medium: "متوسط",
      low: "منخفض",
    };
    return (
      <Badge className={colors[severity] || colors.low}>
        {labels[severity] || severity}
      </Badge>
    );
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            نظام التدقيق والامتثال
          </h1>
          <p className="text-muted-foreground mt-1">مراقبة العمليات وكشف الشذوذ وتقارير الامتثال</p>
        </div>
        
        <div className="flex items-center gap-4">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {new Date(2024, i).toLocaleDateString('ar-SA', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button onClick={() => refetchEvents()} variant="outline">
            <RefreshCw className="h-4 w-4 ml-2" />
            تحديث
          </Button>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <FileSearch className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي الأحداث</p>
                <p className="text-2xl font-bold text-blue-400">{auditEvents?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الشذوذ المكتشف</p>
                <p className="text-2xl font-bold text-red-400">{anomalies?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نسبة الامتثال</p>
                <p className="text-2xl font-bold text-green-400">
                  {complianceReport?.overallScore?.toFixed(0) || 0}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">آخر تدقيق</p>
                <p className="text-lg font-bold text-purple-400">
                  {new Date().toLocaleDateString('ar-SA')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Tabs */}
      <Tabs defaultValue="events" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="events" className="gap-2">
            <FileSearch className="h-4 w-4" />
            سجل الأحداث
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            كشف الشذوذ
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <Shield className="h-4 w-4" />
            تقرير الامتثال
          </TabsTrigger>
        </TabsList>
        
        {/* سجل الأحداث */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>سجل أحداث التدقيق</CardTitle>
              <CardDescription>جميع العمليات المسجلة في النظام</CardDescription>
            </CardHeader>
            <CardContent>
              {eventsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-muted/30 rounded-lg">
                      <div className="h-10 w-10 bg-muted rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : auditEvents?.length === 0 ? (
                <div className="text-center py-12">
                  <FileSearch className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">لا توجد أحداث مسجلة</h3>
                  <p className="text-muted-foreground">سيتم تسجيل الأحداث تلقائياً عند إجراء العمليات</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {auditEvents?.map((event: any, index: number) => (
                    <div 
                      key={index} 
                      className="flex items-center gap-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="p-2 bg-background rounded-full">
                        {getEventTypeIcon(event.eventType)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium">{event.description}</span>
                          {getEventTypeBadge(event.eventType)}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.userName || 'مجهول'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(event.createdAt).toLocaleString('ar-SA')}
                          </span>
                          {event.entityType && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">
                              {event.entityType}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* كشف الشذوذ */}
        <TabsContent value="anomalies">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {anomaliesLoading ? (
              [1, 2].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-40 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            ) : anomalies?.length === 0 ? (
              <Card className="col-span-2">
                <CardContent className="p-12 text-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">لم يتم اكتشاف شذوذ</h3>
                  <p className="text-muted-foreground">جميع العمليات ضمن النطاق الطبيعي</p>
                </CardContent>
              </Card>
            ) : anomalies?.map((anomaly: any, index: number) => (
              <Card key={index} className="border-r-4 border-r-orange-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      {anomaly.type}
                    </CardTitle>
                    {getSeverityBadge(anomaly.severity)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{anomaly.description}</p>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">القيمة المتوقعة</p>
                      <p className="text-lg font-bold">{anomaly.expectedValue}</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">القيمة الفعلية</p>
                      <p className="text-lg font-bold text-orange-400">{anomaly.actualValue}</p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">التوصية:</p>
                    <p className="text-sm text-muted-foreground">{anomaly.recommendation}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* تقرير الامتثال */}
        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>تقرير الامتثال الشهري</CardTitle>
                  <CardDescription>
                    {new Date(year, month - 1).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })}
                  </CardDescription>
                </div>
                <Button variant="outline">
                  <Download className="h-4 w-4 ml-2" />
                  تصدير PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {complianceLoading ? (
                <div className="animate-pulse space-y-6">
                  <div className="h-8 bg-muted rounded w-1/4" />
                  <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-24 bg-muted rounded" />
                    ))}
                  </div>
                </div>
              ) : complianceReport ? (
                <div className="space-y-8">
                  {/* Overall Score */}
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-4 border-primary/30 mb-4">
                      <span className="text-4xl font-bold text-primary">
                        {complianceReport.overallScore?.toFixed(0) || 0}%
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold">نسبة الامتثال الإجمالية</h3>
                    <p className="text-muted-foreground">
                      {complianceReport.overallScore >= 90 ? 'ممتاز' :
                       complianceReport.overallScore >= 70 ? 'جيد' :
                       complianceReport.overallScore >= 50 ? 'مقبول' : 'يحتاج تحسين'}
                    </p>
                  </div>
                  
                  {/* Categories */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {complianceReport.categories?.map((category: any, index: number) => (
                      <Card key={index} className="bg-muted/30">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="font-medium">{category.name}</span>
                            <span className={`font-bold ${
                              category.score >= 90 ? 'text-green-500' :
                              category.score >= 70 ? 'text-yellow-500' : 'text-red-500'
                            }`}>
                              {category.score?.toFixed(0)}%
                            </span>
                          </div>
                          <Progress 
                            value={category.score} 
                            className={`h-2 ${
                              category.score >= 90 ? '[&>div]:bg-green-500' :
                              category.score >= 70 ? '[&>div]:bg-yellow-500' : '[&>div]:bg-red-500'
                            }`}
                          />
                          <p className="text-xs text-muted-foreground mt-2">
                            {category.passed || 0} من {category.total || 0} متطلب
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  
                  {/* Issues */}
                  {complianceReport.issues && complianceReport.issues.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-4 flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        المشكلات المكتشفة ({complianceReport.issues.length})
                      </h4>
                      <div className="space-y-3">
                        {complianceReport.issues.map((issue: any, index: number) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="font-medium">{issue.title}</p>
                              <p className="text-sm text-muted-foreground">{issue.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Shield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">لا يوجد تقرير</h3>
                  <p className="text-muted-foreground">سيتم توليد التقرير تلقائياً</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
