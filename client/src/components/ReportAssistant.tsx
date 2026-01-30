/**
 * مكون مساعد التقارير الذكي - Nawab AI
 * واجهة محادثة ذكية لتوليد التقارير بناءً على أسئلة المستخدم بالعربية
 */

import React, { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Bot, 
  Send, 
  Sparkles, 
  BarChart3, 
  PieChart, 
  LineChart, 
  Table2, 
  TrendingUp,
  Download,
  RefreshCw,
  MessageSquare,
  Lightbulb,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import ReportChart from './ReportChart';

// أنواع البيانات
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  reportData?: ReportData;
  timestamp: Date;
}

interface ReportDataItem {
  id?: number | null;
  label: string;
  value: number;
  sku?: string;
  code?: string;
  quantity?: number;
  count?: number;
  invoiceCount?: number;
  avgInvoice?: number;
  percentage?: number;
  minQuantity?: number;
  deficit?: number;
  estimatedCost?: number;
  status?: string;
  date?: Date | string;
  supplier?: string;
  lastPurchase?: string;
  avgPurchase?: number;
  type?: string;
  suffix?: string;
}

interface ReportData {
  title: string;
  subtitle?: string;
  type: string;
  chartType: string;
  data: ReportDataItem[];
  summary: {
    total?: number;
    count?: number;
    average?: number;
    change?: number;
    changePercent?: number;
  };
  insights: string[];
  recommendations: string[];
  generatedAt: Date;
}

// أيقونات أنواع الرسوم البيانية
const chartIcons: Record<string, React.ReactNode> = {
  bar: <BarChart3 className="h-4 w-4" />,
  line: <LineChart className="h-4 w-4" />,
  pie: <PieChart className="h-4 w-4" />,
  doughnut: <PieChart className="h-4 w-4" />,
  area: <TrendingUp className="h-4 w-4" />,
  table: <Table2 className="h-4 w-4" />,
  kpi: <TrendingUp className="h-4 w-4" />,
};

export default function ReportAssistant() {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // جلب الأسئلة المقترحة
  const { data: suggestedQuestions } = trpc.reportAssistant.getSuggestedQuestions.useQuery();

  // mutation لمعالجة السؤال
  const processQuestion = trpc.reportAssistant.processQuestion.useMutation({
    onSuccess: (data) => {
      const assistantMessage: ConversationMessage = {
        role: 'assistant',
        content: data.response,
        reportData: data.reportData as ReportData,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    },
    onError: (error) => {
      const errorMessage: ConversationMessage = {
        role: 'assistant',
        content: `عذراً، حدث خطأ أثناء معالجة سؤالك: ${error.message}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsLoading(false);
    },
  });

  // التمرير لأسفل عند إضافة رسالة جديدة
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // إرسال السؤال
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ConversationMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setShowSuggestions(false);

    // تحويل تاريخ الرسائل إلى string للإرسال
    const conversationHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    }));

    processQuestion.mutate({
      question: userMessage.content,
      conversationHistory,
    });
  };

  // اختيار سؤال مقترح
  const handleSuggestedQuestion = (question: string) => {
    setInputValue(question);
    inputRef.current?.focus();
  };

  // تنسيق الأرقام
  const formatNumber = (num: number | undefined, suffix?: string) => {
    if (num === undefined) return '-';
    const formatted = num.toLocaleString('ar-SA', { maximumFractionDigits: 2 });
    return suffix ? `${formatted}${suffix}` : `${formatted} ر.س.`;
  };

  // تنسيق التاريخ
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-xl">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              نواب AI
              <Sparkles className="h-5 w-5 text-yellow-300" />
            </h1>
            <p className="text-sm text-blue-100">مساعد التقارير الذكي</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Welcome Message */}
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="inline-flex p-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mb-4">
                <Bot className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">
                مرحباً! أنا نواب AI
              </h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">
                مساعدك الذكي لتوليد التقارير. اسألني عن أي شيء يتعلق بالمبيعات، المخزون، المصروفات، أو أداء الموظفين.
              </p>
            </div>
          )}

          {/* Suggested Questions */}
          {showSuggestions && messages.length === 0 && suggestedQuestions && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3 text-slate-600 dark:text-slate-400">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                <span className="font-medium">أسئلة مقترحة:</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {suggestedQuestions.map((question, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestedQuestion(question)}
                    className="text-right p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-all duration-200 text-sm text-slate-700 dark:text-slate-300"
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[85%] ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-white rounded-2xl rounded-tl-sm shadow-lg'
                } p-4`}
              >
                {/* Message Content */}
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {message.content}
                </div>

                {/* Report Data */}
                {message.reportData && (
                  <div className="mt-4 space-y-4">
                    {/* Report Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {chartIcons[message.reportData.chartType]}
                        <span className="font-semibold">{message.reportData.title}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {message.reportData.subtitle}
                      </Badge>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {message.reportData.summary.total !== undefined && (
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-3 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400">الإجمالي</div>
                          <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                            {formatNumber(message.reportData.summary.total)}
                          </div>
                        </div>
                      )}
                      {message.reportData.summary.count !== undefined && (
                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-3 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400">العدد</div>
                          <div className="text-lg font-bold text-green-700 dark:text-green-300">
                            {message.reportData.summary.count.toLocaleString('ar-SA')}
                          </div>
                        </div>
                      )}
                      {message.reportData.summary.average !== undefined && (
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 p-3 rounded-lg">
                          <div className="text-xs text-slate-500 dark:text-slate-400">المتوسط</div>
                          <div className="text-lg font-bold text-purple-700 dark:text-purple-300">
                            {formatNumber(message.reportData.summary.average)}
                          </div>
                        </div>
                      )}
                      {message.reportData.summary.changePercent !== undefined && (
                        <div className={`bg-gradient-to-br ${
                          message.reportData.summary.changePercent >= 0
                            ? 'from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30'
                            : 'from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30'
                        } p-3 rounded-lg`}>
                          <div className="text-xs text-slate-500 dark:text-slate-400">التغير</div>
                          <div className={`text-lg font-bold ${
                            message.reportData.summary.changePercent >= 0
                              ? 'text-emerald-700 dark:text-emerald-300'
                              : 'text-red-700 dark:text-red-300'
                          }`}>
                            {message.reportData.summary.changePercent >= 0 ? '+' : ''}
                            {message.reportData.summary.changePercent.toFixed(1)}%
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chart */}
                    {message.reportData.data.length > 0 && message.reportData.chartType !== 'table' && (
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg">
                        <ReportChart
                          data={message.reportData.data}
                          chartType={message.reportData.chartType}
                          title={message.reportData.title}
                        />
                      </div>
                    )}

                    {/* Table View */}
                    {message.reportData.chartType === 'table' && message.reportData.data.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-700">
                              <th className="p-2 text-right">الاسم</th>
                              <th className="p-2 text-right">القيمة</th>
                              {message.reportData.data[0]?.quantity !== undefined && (
                                <th className="p-2 text-right">الكمية</th>
                              )}
                              {message.reportData.data[0]?.status !== undefined && (
                                <th className="p-2 text-right">الحالة</th>
                              )}
                            </tr>
                          </thead>
                          <tbody>
                            {message.reportData.data.slice(0, 10).map((item, idx) => (
                              <tr key={idx} className="border-b border-slate-200 dark:border-slate-600">
                                <td className="p-2">{item.label}</td>
                                <td className="p-2">{formatNumber(item.value)}</td>
                                {item.quantity !== undefined && (
                                  <td className="p-2">{item.quantity.toLocaleString('ar-SA')}</td>
                                )}
                                {item.status !== undefined && (
                                  <td className="p-2">
                                    <Badge variant={
                                      item.status === 'good' ? 'default' :
                                      item.status === 'medium' ? 'secondary' : 'destructive'
                                    }>
                                      {item.status === 'good' ? 'جيد' :
                                       item.status === 'medium' ? 'متوسط' : 'منخفض'}
                                    </Badge>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Insights */}
                    {message.reportData.insights.length > 0 && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300">
                          <Lightbulb className="h-4 w-4" />
                          <span className="font-medium text-sm">التحليلات</span>
                        </div>
                        <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
                          {message.reportData.insights.map((insight, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-amber-500">•</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Recommendations */}
                    {message.reportData.recommendations.length > 0 && (
                      <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
                        <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-300">
                          <TrendingUp className="h-4 w-4" />
                          <span className="font-medium text-sm">التوصيات</span>
                        </div>
                        <ul className="space-y-1 text-sm text-emerald-800 dark:text-emerald-200">
                          {message.reportData.recommendations.map((rec, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-emerald-500">•</span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                <div className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-blue-200' : 'text-slate-400'
                }`}>
                  {formatDate(message.timestamp)}
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-end">
              <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm shadow-lg p-4 max-w-[85%]">
                <div className="flex items-center gap-3">
                  <div className="animate-pulse flex items-center gap-2">
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span className="text-sm text-slate-500">جاري تحليل سؤالك...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="اسألني عن التقارير... مثال: ما هي المبيعات هذا الشهر؟"
              className="flex-1 text-right"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-slate-500">
            <span>اضغط Enter للإرسال</span>
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="flex items-center gap-1 hover:text-blue-500 transition-colors"
            >
              {showSuggestions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showSuggestions ? 'إخفاء الاقتراحات' : 'إظهار الاقتراحات'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
