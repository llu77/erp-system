/**
 * مركز التحكم بالذكاء الاصطناعي
 * AI Command Center
 * 
 * واجهة موحدة للتفاعل مع جميع أدوات الذكاء الاصطناعي
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Bot, Send, Sparkles, TrendingUp, Users, Package, 
  AlertTriangle, Lightbulb, BarChart3, Brain, 
  MessageSquare, History, Settings, Zap, Shield,
  ChevronRight, Loader2, RefreshCw
} from "lucide-react";

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'data' | 'chart' | 'error';
  data?: any;
  suggestions?: string[];
}

interface Recommendation {
  id: string;
  type: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  confidence: number;
  impact: {
    metric: string;
    currentValue: number;
    projectedValue: number;
    changePercent: number;
    timeframe: string;
  };
}

export default function AICommandCenter() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionId] = useState(() => `session_${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // tRPC mutations & queries
  const processCommand = trpc.aiCommand.process.useMutation();
  const getHelp = trpc.aiCommand.getHelp.useQuery();
  const getRecommendations = trpc.recommendations.getAll.useQuery();
  const getAvailableTools = trpc.aiTools.getAvailableTools.useQuery();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: `مرحباً ${user?.name || 'بك'}! 👋\n\nأنا مساعدك الذكي في نظام ERP. يمكنني مساعدتك في:\n\n📊 **استعلامات البيانات** - اسألني عن المبيعات، المخزون، المصروفات\n📈 **التقارير** - أنشئ تقارير تلقائية بأي فترة\n🔍 **التحليل** - حلل الأداء واكتشف الأنماط\n🔮 **التنبؤات** - توقع المبيعات والطلب\n💡 **التوصيات** - احصل على نصائح ذكية\n\nاكتب سؤالك أو اختر من الأسئلة المقترحة أدناه.`,
        timestamp: new Date(),
        type: 'text',
        suggestions: [
          'كم المبيعات اليوم؟',
          'أنشئ تقرير مبيعات شهري',
          'ما المنتجات منخفضة المخزون؟',
          'ماذا تنصح لتحسين الأداء؟'
        ]
      }]);
    }
  }, [user?.name, messages.length]);

  // Handle send message
  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: input,
      timestamp: new Date(),
      type: 'text'
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsProcessing(true);

    try {
      const result = await processCommand.mutateAsync({
        command: input,
        sessionId
      });

      const assistantMessage: Message = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: result.content,
        timestamp: new Date(),
        type: result.type as Message['type'],
        data: result.data,
        suggestions: result.suggestions
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: `msg_${Date.now()}_error`,
        role: 'assistant',
        content: 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.',
        timestamp: new Date(),
        type: 'error'
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      inputRef.current?.focus();
    }
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  };

  // Priority colors
  const priorityColors: Record<string, string> = {
    critical: 'bg-red-500',
    high: 'bg-orange-500',
    medium: 'bg-yellow-500',
    low: 'bg-green-500'
  };

  const priorityLabels: Record<string, string> = {
    critical: 'حرج',
    high: 'مرتفع',
    medium: 'متوسط',
    low: 'منخفض'
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">مركز الذكاء الاصطناعي</h1>
            <p className="text-sm text-slate-400">تحكم بجميع أدوات الذكاء الاصطناعي من مكان واحد</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-violet-500 text-violet-400">
            <Sparkles className="h-3 w-3 mr-1" />
            AI مُفعّل
          </Badge>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-l border-slate-700 bg-slate-800/50 p-4 hidden lg:block">
          <h3 className="text-sm font-semibold text-slate-300 mb-3">الأدوات المتاحة</h3>
          <div className="space-y-2">
            {getAvailableTools.data?.map((tool, index) => (
              <div 
                key={index}
                className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  {tool.name === 'sales_intelligence' && <TrendingUp className="h-4 w-4 text-emerald-400" />}
                  {tool.name === 'customer_behavior' && <Users className="h-4 w-4 text-blue-400" />}
                  {tool.name === 'demand_forecast' && <BarChart3 className="h-4 w-4 text-purple-400" />}
                  {tool.name === 'fraud_detection' && <Shield className="h-4 w-4 text-red-400" />}
                  <span className="text-sm text-slate-300">{tool.description}</span>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-4 bg-slate-700" />

          <h3 className="text-sm font-semibold text-slate-300 mb-3">اختصارات سريعة</h3>
          <div className="space-y-2">
            {getHelp.data?.commands.slice(0, 3).map((cmd, index) => (
              <div key={index} className="text-xs text-slate-400">
                <span className="text-violet-400">{cmd.category}:</span>
                <div className="mt-1 space-y-1">
                  {cmd.examples.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(ex)}
                      className="block w-full text-right p-1 rounded hover:bg-slate-700 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="mx-4 mt-4 bg-slate-800 border border-slate-700">
              <TabsTrigger value="chat" className="data-[state=active]:bg-violet-600">
                <MessageSquare className="h-4 w-4 ml-2" />
                المحادثة
              </TabsTrigger>
              <TabsTrigger value="recommendations" className="data-[state=active]:bg-violet-600">
                <Lightbulb className="h-4 w-4 ml-2" />
                التوصيات
                {getRecommendations.data && getRecommendations.data.length > 0 && (
                  <Badge className="mr-2 bg-red-500 text-white text-xs">
                    {getRecommendations.data.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tools" className="data-[state=active]:bg-violet-600">
                <Zap className="h-4 w-4 ml-2" />
                الأدوات
              </TabsTrigger>
            </TabsList>

            {/* Chat Tab */}
            <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-4">
              <ScrollArea className="flex-1 pr-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 ${
                          message.role === 'user'
                            ? 'bg-violet-600 text-white'
                            : message.type === 'error'
                            ? 'bg-red-900/50 border border-red-700 text-red-200'
                            : 'bg-slate-700 text-slate-100'
                        }`}
                      >
                        {message.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2">
                            <Bot className="h-4 w-4 text-violet-400" />
                            <span className="text-xs text-violet-400">المساعد الذكي</span>
                          </div>
                        )}
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </div>
                        
                        {/* Suggestions */}
                        {message.suggestions && message.suggestions.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <p className="text-xs text-slate-400 mb-2">اقتراحات:</p>
                            <div className="flex flex-wrap gap-2">
                              {message.suggestions.map((suggestion, index) => (
                                <button
                                  key={index}
                                  onClick={() => handleSuggestionClick(suggestion)}
                                  className="text-xs px-3 py-1 rounded-full bg-slate-600 hover:bg-violet-600 transition-colors"
                                >
                                  {suggestion}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Data visualization */}
                        {message.data && message.type === 'data' && (
                          <div className="mt-3 pt-3 border-t border-slate-600">
                            <Badge variant="outline" className="text-xs">
                              بيانات متاحة للتصدير
                            </Badge>
                          </div>
                        )}

                        <div className="text-xs text-slate-500 mt-2">
                          {new Date(message.timestamp).toLocaleTimeString('ar-SA')}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {isProcessing && (
                    <div className="flex justify-end">
                      <div className="bg-slate-700 rounded-2xl p-4">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                          <span className="text-sm text-slate-300">جاري التحليل...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Input Area */}
              <div className="mt-4 flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="اكتب سؤالك هنا... (مثال: كم المبيعات اليوم؟)"
                  className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  disabled={isProcessing}
                />
                <Button 
                  onClick={handleSend} 
                  disabled={!input.trim() || isProcessing}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {isProcessing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </TabsContent>

            {/* Recommendations Tab */}
            <TabsContent value="recommendations" className="flex-1 m-0 p-4 overflow-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">التوصيات الذكية</h2>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => getRecommendations.refetch()}
                  className="border-slate-600"
                >
                  <RefreshCw className={`h-4 w-4 ml-2 ${getRecommendations.isFetching ? 'animate-spin' : ''}`} />
                  تحديث
                </Button>
              </div>

              {getRecommendations.isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                </div>
              ) : getRecommendations.data && getRecommendations.data.length > 0 ? (
                <div className="grid gap-4">
                  {getRecommendations.data.map((rec: Recommendation) => (
                    <Card key={rec.id} className="bg-slate-800 border-slate-700">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${priorityColors[rec.priority]}`} />
                            <Badge variant="outline" className="text-xs">
                              {priorityLabels[rec.priority]}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {rec.category}
                            </Badge>
                          </div>
                          <span className="text-xs text-slate-500">
                            ثقة: {(rec.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                        <CardTitle className="text-white text-base mt-2">{rec.title}</CardTitle>
                        <CardDescription className="text-slate-400">
                          {rec.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between text-sm">
                          <div className="text-slate-400">
                            <span>التأثير المتوقع: </span>
                            <span className={rec.impact.changePercent > 0 ? 'text-emerald-400' : 'text-red-400'}>
                              {rec.impact.changePercent > 0 ? '+' : ''}{rec.impact.changePercent.toFixed(0)}%
                            </span>
                            <span className="text-slate-500"> على {rec.impact.metric}</span>
                          </div>
                          <Button size="sm" variant="ghost" className="text-violet-400">
                            تنفيذ
                            <ChevronRight className="h-4 w-4 mr-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                  <Lightbulb className="h-12 w-12 mb-4 opacity-50" />
                  <p>لا توجد توصيات حالياً</p>
                  <p className="text-sm">الأمور تسير بشكل جيد!</p>
                </div>
              )}
            </TabsContent>

            {/* Tools Tab */}
            <TabsContent value="tools" className="flex-1 m-0 p-4 overflow-auto">
              <h2 className="text-lg font-semibold text-white mb-4">أدوات الذكاء الاصطناعي</h2>
              
              <div className="grid md:grid-cols-2 gap-4">
                {/* Sales Intelligence */}
                <Card className="bg-slate-800 border-slate-700 hover:border-emerald-500 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/20">
                        <TrendingUp className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-base">تحليل المبيعات الذكي</CardTitle>
                        <CardDescription>تحليل شامل لأداء المبيعات مع رؤى ذكية</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full bg-emerald-600 hover:bg-emerald-700"
                      onClick={() => handleSuggestionClick('حلل المبيعات للشهر الحالي')}
                    >
                      تشغيل التحليل
                    </Button>
                  </CardContent>
                </Card>

                {/* Customer Behavior */}
                <Card className="bg-slate-800 border-slate-700 hover:border-blue-500 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-500/20">
                        <Users className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-base">تحليل سلوك العملاء</CardTitle>
                        <CardDescription>فهم أنماط الشراء وتوقع سلوك العملاء</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => handleSuggestionClick('حلل سلوك العملاء')}
                    >
                      تشغيل التحليل
                    </Button>
                  </CardContent>
                </Card>

                {/* Demand Forecast */}
                <Card className="bg-slate-800 border-slate-700 hover:border-purple-500 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <BarChart3 className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-base">التنبؤ بالطلب</CardTitle>
                        <CardDescription>توقع المبيعات والطلب المستقبلي</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      onClick={() => handleSuggestionClick('توقع المبيعات للأسبوع القادم')}
                    >
                      تشغيل التنبؤ
                    </Button>
                  </CardContent>
                </Card>

                {/* Fraud Detection */}
                <Card className="bg-slate-800 border-slate-700 hover:border-red-500 transition-colors cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/20">
                        <Shield className="h-5 w-5 text-red-400" />
                      </div>
                      <div>
                        <CardTitle className="text-white text-base">كشف الاحتيال</CardTitle>
                        <CardDescription>اكتشاف الأنماط المشبوهة والمعاملات غير الطبيعية</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full bg-red-600 hover:bg-red-700"
                      onClick={() => handleSuggestionClick('اكتشف الأنماط المشبوهة')}
                    >
                      تشغيل الفحص
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
