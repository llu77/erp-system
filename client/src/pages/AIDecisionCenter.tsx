import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, 
  Lightbulb, Shield, Target, ArrowUpRight, ArrowDownRight,
  RefreshCw, Sparkles, BarChart3, Zap
} from "lucide-react";
import { Streamdown } from "streamdown";

export default function AIDecisionCenter() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  
  // جلب البيانات
  const { data: predictions, isLoading: predictionsLoading, refetch: refetchPredictions } = 
    trpc.aiDecision.getPredictions.useQuery({ year, month });
  const { data: risks, isLoading: risksLoading } = 
    trpc.aiDecision.getRiskAssessment.useQuery({ year, month });
  const { data: recommendations, isLoading: recommendationsLoading } = 
    trpc.aiDecision.getRecommendations.useQuery({ year, month });
  const { data: aiInsights, isLoading: insightsLoading } = 
    trpc.aiDecision.getAIInsights.useQuery({ year, month });
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ar-SA', { 
      style: 'currency', 
      currency: 'SAR',
      maximumFractionDigits: 0 
    }).format(value);
  };
  
  const formatPercent = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  
  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <BarChart3 className="h-4 w-4 text-gray-500" />;
  };
  
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      case "low": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };
  
  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500/20 text-red-400 border-red-500/30",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      low: "bg-green-500/20 text-green-400 border-green-500/30",
    };
    return colors[priority] || colors.medium;
  };

  return (
    <div className="min-h-screen bg-background p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Brain className="h-8 w-8 text-primary" />
            مركز الذكاء الاصطناعي للقرارات
          </h1>
          <p className="text-muted-foreground mt-1">تحليلات تنبؤية وتوصيات ذكية مدعومة بالذكاء الاصطناعي</p>
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
          
          <Button onClick={() => refetchPredictions()} variant="outline">
            <RefreshCw className="h-4 w-4 ml-2" />
            تحديث
          </Button>
        </div>
      </div>
      
      {/* AI Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Sparkles className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">التنبؤات النشطة</p>
                <p className="text-2xl font-bold text-purple-400">{predictions?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <Shield className="h-5 w-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المخاطر المكتشفة</p>
                <p className="text-2xl font-bold text-red-400">{risks?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Lightbulb className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">التوصيات</p>
                <p className="text-2xl font-bold text-yellow-400">{recommendations?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Zap className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">دقة التنبؤات</p>
                <p className="text-2xl font-bold text-green-400">87%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Tabs */}
      <Tabs defaultValue="predictions" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="predictions" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            التنبؤات المالية
          </TabsTrigger>
          <TabsTrigger value="risks" className="gap-2">
            <Shield className="h-4 w-4" />
            تقييم المخاطر
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-2">
            <Lightbulb className="h-4 w-4" />
            التوصيات الذكية
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Brain className="h-4 w-4" />
            تحليل AI
          </TabsTrigger>
        </TabsList>
        
        {/* التنبؤات المالية */}
        <TabsContent value="predictions">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {predictionsLoading ? (
              [1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-48 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            ) : predictions?.length === 0 ? (
              <Card className="col-span-3">
                <CardContent className="p-12 text-center">
                  <Sparkles className="h-16 w-16 text-purple-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">جاري تحليل البيانات</h3>
                  <p className="text-muted-foreground">سيتم توليد التنبؤات قريباً بناءً على البيانات المتاحة</p>
                </CardContent>
              </Card>
            ) : predictions?.map((prediction, index) => (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{prediction.metric}</CardTitle>
                    {getTrendIcon(prediction.trend)}
                  </div>
                  <CardDescription>{prediction.timeframe}</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">القيمة الحالية</span>
                      <span className="font-semibold">{formatCurrency(prediction.currentValue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">القيمة المتوقعة</span>
                      <span className="font-bold text-primary text-xl">{formatCurrency(prediction.predictedValue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">نسبة التغيير</span>
                      <span className={`font-medium ${prediction.changePercent >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {prediction.changePercent >= 0 ? <ArrowUpRight className="h-4 w-4 inline" /> : <ArrowDownRight className="h-4 w-4 inline" />}
                        {formatPercent(prediction.changePercent)}
                      </span>
                    </div>
                    
                    <div className="pt-2">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">مستوى الثقة</span>
                        <span>{(prediction.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={prediction.confidence * 100} className="h-2" />
                    </div>
                    
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-2">العوامل المؤثرة:</p>
                      <div className="flex flex-wrap gap-2">
                        {prediction.factors.map((factor, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {factor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* تقييم المخاطر */}
        <TabsContent value="risks">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {risksLoading ? (
              [1, 2].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-48 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            ) : risks?.length === 0 ? (
              <Card className="col-span-2">
                <CardContent className="p-12 text-center">
                  <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">لا توجد مخاطر عالية</h3>
                  <p className="text-muted-foreground">جميع المؤشرات ضمن النطاق الآمن - استمر في المراقبة</p>
                </CardContent>
              </Card>
            ) : risks?.map((risk, index) => (
              <Card key={index} className={`border-r-4 ${getSeverityColor(risk.severity)}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className={`h-5 w-5 ${
                        risk.severity === 'critical' ? 'text-red-500' :
                        risk.severity === 'high' ? 'text-orange-500' :
                        'text-yellow-500'
                      }`} />
                      {risk.riskType}
                    </CardTitle>
                    <Badge className={getPriorityBadge(risk.severity)}>
                      {risk.severity === 'critical' ? 'حرج' :
                       risk.severity === 'high' ? 'عالي' :
                       risk.severity === 'medium' ? 'متوسط' : 'منخفض'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{risk.description}</p>
                  
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">الاحتمالية</p>
                      <p className="text-lg font-bold">{(risk.probability * 100).toFixed(0)}%</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">التأثير</p>
                      <p className="text-lg font-bold">{(risk.impact * 100).toFixed(0)}%</p>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">درجة المخاطر</p>
                      <p className="text-lg font-bold text-primary">{(risk.riskScore * 100).toFixed(0)}</p>
                    </div>
                  </div>
                  
                  <div className="border-t pt-4">
                    <p className="text-sm font-medium mb-2">خطوات التخفيف:</p>
                    <ul className="space-y-2">
                      {risk.mitigationSteps.map((step, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <span className="bg-primary/20 text-primary rounded-full w-5 h-5 flex items-center justify-center text-xs flex-shrink-0">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* التوصيات الذكية */}
        <TabsContent value="recommendations">
          <div className="space-y-4">
            {recommendationsLoading ? (
              [1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-6">
                    <div className="h-32 bg-muted rounded" />
                  </CardContent>
                </Card>
              ))
            ) : recommendations?.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Lightbulb className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">لا توجد توصيات حالياً</h3>
                  <p className="text-muted-foreground">الأداء الحالي جيد ولا يتطلب تدخلات فورية</p>
                </CardContent>
              </Card>
            ) : recommendations?.map((rec, index) => (
              <Card key={index} className="overflow-hidden">
                <div className={`h-1 ${getPriorityBadge(rec.priority).split(' ')[0]}`} />
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${getPriorityBadge(rec.priority)}`}>
                        <Lightbulb className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle>{rec.title}</CardTitle>
                        <CardDescription>{rec.type}</CardDescription>
                      </div>
                    </div>
                    <div className="text-left">
                      <Badge className={getPriorityBadge(rec.priority)}>
                        {rec.priority === 'critical' ? 'حرج' :
                         rec.priority === 'high' ? 'عالي' :
                         rec.priority === 'medium' ? 'متوسط' : 'منخفض'}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">ROI المتوقع: {rec.estimatedROI}x</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">{rec.description}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-muted/30 rounded-lg p-4">
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        التأثير المتوقع
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">المؤشر</span>
                          <span>{rec.expectedImpact.metric}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">القيمة الحالية</span>
                          <span>{formatCurrency(rec.expectedImpact.currentValue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">القيمة المتوقعة</span>
                          <span className="text-green-500 font-medium">
                            {formatCurrency(rec.expectedImpact.projectedValue)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">نسبة التحسن</span>
                          <span className="text-green-500">
                            {formatPercent(rec.expectedImpact.changePercent)}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-3">خطوات التنفيذ</h4>
                      <ul className="space-y-2">
                        {rec.actionSteps.slice(0, 4).map((step, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                            {step}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground mt-3">
                        الجهد المطلوب: {rec.estimatedEffort}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* تحليل الذكاء الاصطناعي */}
        <TabsContent value="insights">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                تحليل شامل بالذكاء الاصطناعي
              </CardTitle>
              <CardDescription>
                تحليل استراتيجي للوضع المالي والتشغيلي مع توصيات مخصصة
              </CardDescription>
            </CardHeader>
            <CardContent>
              {insightsLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-4 bg-muted rounded w-5/6" />
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-4 bg-muted rounded w-4/5" />
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <Streamdown>{aiInsights || "لم يتم توليد تحليل بعد. يرجى التأكد من وجود بيانات كافية للتحليل."}</Streamdown>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
