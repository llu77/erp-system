import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { trpc } from '@/lib/trpc';
import { 
  Bot, 
  Send, 
  User, 
  LogOut, 
  FileText, 
  Calendar, 
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  MessageSquare,
  Sparkles,
  Building2
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface EmployeeInfo {
  id: number;
  name: string;
  code: string;
  branchId: number;
  branchName: string;
  position: string | null;
}

export default function EmployeePortal() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // جلب معلومات الموظف من localStorage
  useEffect(() => {
    const storedEmployee = localStorage.getItem('employeeInfo');
    if (storedEmployee) {
      setEmployeeInfo(JSON.parse(storedEmployee));
    } else {
      // إذا لم يكن هناك معلومات موظف، توجيه لصفحة تسجيل الدخول
      setLocation('/employee-login');
    }
  }, [setLocation]);

  // رسالة ترحيب
  useEffect(() => {
    if (employeeInfo && messages.length === 0) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `مرحباً ${employeeInfo.name}! 👋\n\nأنا Symbol AI، مساعدك الذكي في نظام إدارة الموارد.\n\nيمكنني مساعدتك في:\n• تقديم طلبات (إجازة، سلفة، استئذان، وغيرها)\n• الاستعلام عن رصيد إجازاتك\n• عرض تقارير البونص والإيرادات\n• حساب الأسعار والخصومات\n• الإجابة على استفساراتك\n\nكيف يمكنني مساعدتك اليوم؟`,
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, [employeeInfo, messages.length]);

  // التمرير التلقائي
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const chatMutation = trpc.employeeAssistant.chat.useMutation();

  const handleSend = async () => {
    if (!input.trim() || isLoading || !employeeInfo) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatMutation.mutateAsync({
        message: input,
        employeeContext: {
          employeeId: employeeInfo.id,
          employeeName: employeeInfo.name,
          branchId: employeeInfo.branchId,
          branchName: employeeInfo.branchName,
        },
        conversationHistory: messages.map(m => ({
          role: m.role as 'user' | 'assistant' | 'system' | 'tool',
          content: m.content,
        })),
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: typeof response.message === 'string' ? response.message : 'حدث خطأ',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'عذراً، حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('employeeInfo');
    localStorage.removeItem('employeeToken');
    setLocation('/employee-login');
  };

  const quickActions = [
    { label: 'طلب إجازة', icon: Calendar, prompt: 'أريد تقديم طلب إجازة' },
    { label: 'طلب سلفة', icon: DollarSign, prompt: 'أريد تقديم طلب سلفة' },
    { label: 'طلب استئذان', icon: Clock, prompt: 'أريد تقديم طلب استئذان' },
    { label: 'تقرير البونص', icon: FileText, prompt: 'أريد الاطلاع على تقرير البونص الخاص بي' },
  ];

  if (!employeeInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" dir="rtl">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2 rounded-xl">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Symbol AI</h1>
              <p className="text-xs text-slate-400">بوابة الموظفين</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-left">
              <p className="text-sm font-medium text-white">{employeeInfo.name}</p>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Building2 className="h-3 w-3" />
                <span>{employeeInfo.branchName}</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white hover:bg-slate-700"
            >
              <LogOut className="h-4 w-4 ml-2" />
              خروج
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Quick Actions */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-amber-500" />
                  إجراءات سريعة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="ghost"
                    className="w-full justify-start text-slate-300 hover:text-white hover:bg-slate-700"
                    onClick={() => {
                      setInput(action.prompt);
                    }}
                  >
                    <action.icon className="h-4 w-4 ml-2 text-amber-500" />
                    {action.label}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Employee Info Card */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-500" />
                  معلوماتك
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">الكود</span>
                  <span className="text-white font-mono">{employeeInfo.code}</span>
                </div>
                <Separator className="bg-slate-700" />
                <div className="flex justify-between">
                  <span className="text-slate-400">الفرع</span>
                  <span className="text-white">{employeeInfo.branchName}</span>
                </div>
                {employeeInfo.position && (
                  <>
                    <Separator className="bg-slate-700" />
                    <div className="flex justify-between">
                      <span className="text-slate-400">المنصب</span>
                      <span className="text-white">{employeeInfo.position}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Chat Area */}
          <div className="lg:col-span-3">
            <Card className="bg-slate-800/50 border-slate-700 h-[calc(100vh-200px)] flex flex-col">
              <CardHeader className="border-b border-slate-700 pb-3">
                <div className="flex items-center gap-3">
                  <Avatar className="bg-gradient-to-br from-amber-500 to-orange-600">
                    <AvatarFallback className="bg-transparent">
                      <Bot className="h-5 w-5 text-white" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-white text-lg">Symbol AI</CardTitle>
                    <p className="text-xs text-slate-400">مساعدك الذكي • متصل</p>
                  </div>
                  <Badge className="mr-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full ml-1 animate-pulse"></span>
                    نشط
                  </Badge>
                </div>
              </CardHeader>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${
                        message.role === 'user' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <Avatar className={
                        message.role === 'assistant' 
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600' 
                          : 'bg-slate-600'
                      }>
                        <AvatarFallback className="bg-transparent">
                          {message.role === 'assistant' ? (
                            <Bot className="h-4 w-4 text-white" />
                          ) : (
                            <User className="h-4 w-4 text-white" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-700 text-slate-100'
                        }`}
                      >
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {message.content}
                        </p>
                        <p className={`text-xs mt-2 ${
                          message.role === 'user' ? 'text-amber-200' : 'text-slate-400'
                        }`}>
                          {message.timestamp.toLocaleTimeString('ar-SA', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                  
                  {isLoading && (
                    <div className="flex gap-3">
                      <Avatar className="bg-gradient-to-br from-amber-500 to-orange-600">
                        <AvatarFallback className="bg-transparent">
                          <Bot className="h-4 w-4 text-white" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-slate-700 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
                          <span className="text-sm text-slate-300">جاري الكتابة...</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <div className="p-4 border-t border-slate-700">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                  className="flex gap-3"
                >
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    className="flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 focus:border-amber-500"
                    disabled={isLoading}
                  />
                  <Button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
