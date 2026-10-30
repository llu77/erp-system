import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Loader2,
  MessageSquare,
  Sparkles,
  Building2,
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertCircle,
  History,
  Mic,
  Wallet,
  CalendarDays,
  UserCircle,
  Gift
} from 'lucide-react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { SalarySlip, LeaveBalance, EmployeeProfile, BonusReport, RequestTimeline, RequestAttachments, EmployeeInfoForm } from '@/components/portal';
import { NotificationBell } from '@/components/portal/NotificationBell';
import { EmailSetupModal } from '@/components/portal/EmailSetupModal';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  hasPendingRequest?: boolean;
  pendingRequestType?: string;
}

interface EmployeeInfo {
  id: number;
  name: string;
  code: string;
  branchId: number;
  branchName: string;
  position: string | null;
  email: string | null;
  emailVerified: boolean;
  isSupervisor?: boolean;
}

// أنواع الطلبات بالعربية
const REQUEST_TYPE_NAMES: Record<string, string> = {
  advance: 'سلفة',
  vacation: 'إجازة',
  arrears: 'صرف متأخرات',
  permission: 'استئذان',
  objection: 'اعتراض على مخالفة',
  resignation: 'استقالة',
  end_of_service: 'إنهاء خدمة',
};

// حالات الطلب بالعربية
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

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <AlertCircle className="h-4 w-4" />,
  approved: <CheckCircle2 className="h-4 w-4" />,
  rejected: <XCircle className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
};

export default function EmployeePortal() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);
  const [activeTab, setActiveTab] = useState('chat');
  const scrollRef = useRef<HTMLDivElement>(null);

  // جلب طلبات الموظف
  const { data: myRequests, isLoading: requestsLoading, refetch: refetchRequests } = trpc.employeeAuth.getMyRequests.useQuery(
    { employeeId: employeeInfo?.id || 0 },
    { enabled: !!employeeInfo?.id }
  );

  // جلب معلومات الموظف من localStorage
  useEffect(() => {
    const storedEmployee = localStorage.getItem('employeeInfo');
    if (storedEmployee) {
      setEmployeeInfo(JSON.parse(storedEmployee));
    } else {
      setLocation('/employee-login');
    }
  }, [setLocation]);

  // رسالة ترحيب
  useEffect(() => {
    if (employeeInfo && messages.length === 0) {
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `مرحباً ${employeeInfo.name}! 👋\n\nأنا مساعدك الذكي. اختر من الإجراءات السريعة أدناه أو اكتب طلبك مباشرة.`,
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
    setLoadingMessage('جاري معالجة طلبك...');
    setLastFailedMessage(null);

    // تحديث رسالة التحميل بشكل تدريجي
    const loadingMessages = [
      'جاري معالجة طلبك...',
      'جاري تحليل البيانات...',
      'جاري جلب المعلومات...',
      'يرجى الانتظار قليلاً...',
    ];
    let messageIndex = 0;
    const loadingInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % loadingMessages.length;
      setLoadingMessage(loadingMessages[messageIndex]);
    }, 3000);

    try {
      const response = await chatMutation.mutateAsync({
        message: input,
        employeeContext: {
          employeeId: employeeInfo.id,
          employeeName: employeeInfo.name,
          branchId: employeeInfo.branchId,
          branchName: employeeInfo.branchName,
          isSupervisor: employeeInfo.isSupervisor || false,
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
        hasPendingRequest: response.hasPendingRequest,
        pendingRequestType: response.pendingRequestType,
      };

      clearInterval(loadingInterval);
      setMessages(prev => [...prev, assistantMessage]);
      
      // تحديث الطلبات بعد كل رسالة (قد يكون تم إنشاء طلب جديد)
      refetchRequests();
    } catch (error: unknown) {
      clearInterval(loadingInterval);
      
      // تحديد نوع الخطأ
      let errorContent = 'عذراً، حدث خطأ أثناء معالجة طلبك.';
      const errorObj = error as { message?: string };
      
      if (errorObj?.message?.includes('timeout') || errorObj?.message?.includes('TIMEOUT')) {
        errorContent = 'عذراً، استغرق الطلب وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.';
      } else if (errorObj?.message?.includes('network') || errorObj?.message?.includes('fetch')) {
        errorContent = 'عذراً، حدثت مشكلة في الاتصال. تأكد من اتصالك بالإنترنت وحاول مرة أخرى.';
      }
      
      // حفظ الرسالة الفاشلة لإعادة المحاولة
      setLastFailedMessage(input);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      clearInterval(loadingInterval);
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // دالة إعادة المحاولة
  const handleRetry = () => {
    if (lastFailedMessage) {
      setInput(lastFailedMessage);
      setLastFailedMessage(null);
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

  // إحصائيات الطلبات
  const requestStats = {
    total: myRequests?.length || 0,
    pending: myRequests?.filter(r => r.status === 'pending').length || 0,
    approved: myRequests?.filter(r => r.status === 'approved').length || 0,
    rejected: myRequests?.filter(r => r.status === 'rejected').length || 0,
  };

  if (!employeeInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" dir="rtl">
      {/* Header - محسّن للموبايل */}
      <header className="bg-slate-800/80 backdrop-blur-md border-b border-slate-700/50 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
          {/* الصف الأول: الشعار وزر الخروج */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-1.5 sm:p-2 rounded-lg sm:rounded-xl shadow-lg">
                <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-white">Symbol AI</h1>
                <p className="text-[10px] sm:text-xs text-slate-400">بوابة الموظفين</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4">
              {/* جرس الإشعارات */}
              {employeeInfo.id && (
                <NotificationBell 
                  employeeId={employeeInfo.id} 
                  className="text-slate-400 hover:text-white"
                />
              )}
              
              {/* معلومات الموظف - مخفية على الموبايل الصغير */}
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium text-white">{employeeInfo.name}</p>
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <Building2 className="h-3 w-3" />
                  <span>{employeeInfo.branchName}</span>
                </div>
              </div>
              {/* زر الخروج - مكبّر وواضح */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-300 hover:text-white hover:bg-slate-700/80 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-slate-600/50 hover:border-slate-500"
              >
                <LogOut className="h-4 w-4 sm:ml-2" />
                <span className="hidden sm:inline">خروج</span>
              </Button>
            </div>
          </div>
          
          {/* الصف الثاني: معلومات الموظف على الموبايل */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-700/50 sm:hidden">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <User className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">{employeeInfo.name}</p>
                <div className="flex items-center gap-1 text-[10px] text-slate-400">
                  <Building2 className="h-2.5 w-2.5" />
                  <span>{employeeInfo.branchName}</span>
                </div>
              </div>
            </div>
            <Badge className="bg-slate-700/50 text-slate-300 text-[10px] px-2 py-0.5">
              {employeeInfo.code}
            </Badge>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 sm:py-6">
        {/* Tabs للتنقل بين المساعد وسجل الطلبات */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* شريط التبويبات الرئيسي */}
          <div className="overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:max-w-2xl sm:mx-auto sm:grid-cols-6 mb-6 bg-slate-800/50 gap-1">
              <TabsTrigger 
                value="chat" 
                className="data-[state=active]:bg-amber-500 data-[state=active]:text-white whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3"
              >
                <MessageSquare className="h-4 w-4 ml-1 sm:ml-2" />
                <span className="hidden sm:inline">المساعد</span>
                <span className="sm:hidden">AI</span>
              </TabsTrigger>
              <TabsTrigger 
                value="requests"
                className="data-[state=active]:bg-amber-500 data-[state=active]:text-white whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3"
              >
                <ClipboardList className="h-4 w-4 ml-1 sm:ml-2" />
                طلباتي
                {requestStats.pending > 0 && (
                  <Badge className="mr-1 sm:mr-2 bg-amber-500/30 text-amber-300 text-xs">
                    {requestStats.pending}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="salary"
                className="data-[state=active]:bg-amber-500 data-[state=active]:text-white whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3"
              >
                <Wallet className="h-4 w-4 ml-1 sm:ml-2" />
                الراتب
              </TabsTrigger>
              <TabsTrigger 
                value="leaves"
                className="data-[state=active]:bg-amber-500 data-[state=active]:text-white whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3"
              >
                <CalendarDays className="h-4 w-4 ml-1 sm:ml-2" />
                الإجازات
              </TabsTrigger>
              <TabsTrigger 
                value="bonus"
                className="data-[state=active]:bg-amber-500 data-[state=active]:text-white whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3"
              >
                <Gift className="h-4 w-4 ml-1 sm:ml-2" />
                البونص
              </TabsTrigger>
              <TabsTrigger 
                value="profile"
                className="data-[state=active]:bg-amber-500 data-[state=active]:text-white whitespace-nowrap text-xs sm:text-sm px-2 sm:px-3"
              >
                <UserCircle className="h-4 w-4 ml-1 sm:ml-2" />
                ملفي
              </TabsTrigger>
            </TabsList>
          </div>

          {/* المساعد الذكي - محسّن للموبايل */}
          <TabsContent value="chat" className="mt-0">
            {/* تصميم جديد: الشات أولاً ثم الإجراءات السريعة */}
            <div className="flex flex-col h-[calc(100vh-200px)] sm:h-[calc(100vh-180px)]">
              {/* Main Chat Area - يأخذ كل المساحة المتاحة */}
              <Card className="bg-slate-800/50 border-slate-700 flex-1 flex flex-col overflow-hidden min-h-0">
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
                  <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
                    <div className="p-4 space-y-4">
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
                            className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 ${
                              message.role === 'user'
                                ? 'bg-amber-500 text-white'
                                : 'bg-slate-700 text-slate-100'
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.content}
                            </p>
                            
                            {/* أزرار التأكيد/الإلغاء عند وجود طلب معلق */}
                            {message.role === 'assistant' && message.hasPendingRequest && (
                              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-600">
                                <Button
                                  size="sm"
                                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    setInput('نعم');
                                    setTimeout(() => {
                                      const form = document.querySelector('form');
                                      if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
                                    }, 100);
                                  }}
                                  disabled={isLoading}
                                >
                                  <CheckCircle2 className="h-4 w-4 ml-1" />
                                  نعم، أكد الطلب
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10"
                                  onClick={() => {
                                    setInput('لا، ألغي الطلب');
                                    setTimeout(() => {
                                      const form = document.querySelector('form');
                                      if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
                                    }, 100);
                                  }}
                                  disabled={isLoading}
                                >
                                  <XCircle className="h-4 w-4 ml-1" />
                                  لا، ألغي
                                </Button>
                              </div>
                            )}
                            
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
                            <div className="flex items-center gap-3">
                              {/* نقاط متحركة لمؤشر الكتابة */}
                              <div className="flex gap-1">
                                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                <span className="w-2 h-2 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                              </div>
                              <span className="text-sm text-slate-300">{loadingMessage || 'جارٍ الكتابة...'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* زر إعادة المحاولة عند فشل الطلب */}
                      {lastFailedMessage && !isLoading && (
                        <div className="flex justify-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                            onClick={handleRetry}
                          >
                            <History className="h-4 w-4 ml-1" />
                            إعادة المحاولة
                          </Button>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* الإجراءات السريعة - محسّنة للموبايل */}
                  <div className="px-3 py-2 border-t border-slate-700/50 bg-slate-800/30">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-slate-400">إجراءات سريعة</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {quickActions.map((action, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          className="text-[11px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3 bg-slate-700/50 border-slate-600/50 text-slate-300 hover:text-white hover:bg-slate-600/50 hover:border-amber-500/50"
                          onClick={() => {
                            setInput(action.prompt);
                          }}
                        >
                          <action.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 ml-1 text-amber-500" />
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Input - محسّن للموبايل */}
                  <div className="p-3 sm:p-4 border-t border-slate-700 bg-slate-800/50">
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSend();
                      }}
                      className="flex gap-2 sm:gap-3 items-center"
                    >
                      {/* زر التسجيل الصوتي */}
                      <VoiceRecorder
                        onTranscription={(text) => {
                          setInput(text);
                          // إرسال تلقائي بعد التحويل
                          setTimeout(() => {
                            const userMessage: Message = {
                              id: Date.now().toString(),
                              role: 'user',
                              content: text,
                              timestamp: new Date(),
                            };
                            setMessages(prev => [...prev, userMessage]);
                            setInput('');
                            setIsLoading(true);
                            
                            chatMutation.mutateAsync({
                              message: text,
                              employeeContext: {
                                employeeId: employeeInfo!.id,
                                employeeName: employeeInfo!.name,
                                branchId: employeeInfo!.branchId,
                                branchName: employeeInfo!.branchName,
                                isSupervisor: employeeInfo!.isSupervisor || false,
                              },
                              conversationHistory: [...messages, userMessage].map(m => ({
                                role: m.role as 'user' | 'assistant' | 'system' | 'tool',
                                content: m.content,
                              })),
                            }).then(response => {
                              const assistantMessage: Message = {
                                id: (Date.now() + 1).toString(),
                                role: 'assistant',
                                content: typeof response.message === 'string' ? response.message : 'حدث خطأ',
                                timestamp: new Date(),
                              };
                              setMessages(prev => [...prev, assistantMessage]);
                              refetchRequests();
                            }).catch(() => {
                              const errorMessage: Message = {
                                id: (Date.now() + 1).toString(),
                                role: 'assistant',
                                content: 'عذراً، حدث خطأ أثناء معالجة طلبك.',
                                timestamp: new Date(),
                              };
                              setMessages(prev => [...prev, errorMessage]);
                            }).finally(() => {
                              setIsLoading(false);
                            });
                          }, 100);
                        }}
                        onError={(error) => {
                          const errorMessage: Message = {
                            id: Date.now().toString(),
                            role: 'assistant',
                            content: `خطأ في التسجيل الصوتي: ${error}`,
                            timestamp: new Date(),
                          };
                          setMessages(prev => [...prev, errorMessage]);
                        }}
                        disabled={isLoading}
                      />
                      <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="اكتب هنا أو اضغط على الميكروفون"
                        className="flex-1 bg-slate-700/80 border-slate-600/50 text-white text-sm placeholder:text-slate-500 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 h-10 sm:h-11 rounded-xl"
                        disabled={isLoading}
                      />
                      <Button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white h-10 sm:h-11 w-10 sm:w-11 rounded-xl shadow-lg shadow-amber-500/20"
                      >
                        <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                      </Button>
                    </form>
                  </div>
                </Card>
            </div>
          </TabsContent>

          {/* سجل الطلبات */}
          <TabsContent value="requests" className="mt-0">
            <div className="space-y-6">
              {/* إحصائيات الطلبات */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="bg-slate-800/50 border-slate-700">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-white">{requestStats.total}</div>
                    <div className="text-xs text-slate-400">إجمالي الطلبات</div>
                  </CardContent>
                </Card>
                <Card className="bg-amber-500/10 border-amber-500/30">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-amber-400">{requestStats.pending}</div>
                    <div className="text-xs text-amber-400/70">قيد المراجعة</div>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-500/10 border-emerald-500/30">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{requestStats.approved}</div>
                    <div className="text-xs text-emerald-400/70">موافق عليها</div>
                  </CardContent>
                </Card>
                <Card className="bg-red-500/10 border-red-500/30">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-400">{requestStats.rejected}</div>
                    <div className="text-xs text-red-400/70">مرفوضة</div>
                  </CardContent>
                </Card>
              </div>

              {/* قائمة الطلبات */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="border-b border-slate-700">
                  <CardTitle className="text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-amber-500" />
                    سجل طلباتي
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {requestsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                    </div>
                  ) : !myRequests || myRequests.length === 0 ? (
                    <div className="text-center py-12">
                      <ClipboardList className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                      <p className="text-slate-400">لا توجد طلبات سابقة</p>
                      <Button
                        variant="ghost"
                        className="mt-4 text-amber-500 hover:text-amber-400"
                        onClick={() => setActiveTab('chat')}
                      >
                        <MessageSquare className="h-4 w-4 ml-2" />
                        تقديم طلب جديد
                      </Button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-700">
                      {myRequests.map((request) => (
                        <div
                          key={request.id}
                          className="p-4 hover:bg-slate-700/30 transition-colors"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-white font-medium">
                                  {REQUEST_TYPE_NAMES[request.requestType] || request.requestType}
                                </span>
                                <Badge className={STATUS_COLORS[request.status]}>
                                  {STATUS_ICONS[request.status]}
                                  <span className="mr-1">{STATUS_NAMES[request.status]}</span>
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-400 line-clamp-2">
                                {request.title || request.description || 'لا يوجد وصف'}
                              </p>
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                <span>رقم الطلب: {request.requestNumber}</span>
                                <span>
                                  {new Date(request.createdAt).toLocaleDateString('ar-SA', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              </div>
                            </div>
                            
                            {/* تفاصيل إضافية حسب نوع الطلب */}
                            <div className="text-left sm:text-right">
                              {request.requestType === 'advance' && request.advanceAmount && (
                                <div className="text-lg font-bold text-amber-400">
                                  {Number(request.advanceAmount).toLocaleString('ar-SA')} ر.س
                                </div>
                              )}
                              {request.requestType === 'vacation' && request.vacationStartDate && request.vacationEndDate && (
                                <div className="text-sm text-slate-400">
                                  <div>من: {new Date(request.vacationStartDate).toLocaleDateString('ar-SA')}</div>
                                  <div>إلى: {new Date(request.vacationEndDate).toLocaleDateString('ar-SA')}</div>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* ملاحظات المراجع */}
                          {request.reviewNotes && (request.status === 'approved' || request.status === 'rejected') && (
                            <div className="mt-3 p-3 bg-slate-700/50 rounded-lg">
                              <p className="text-xs text-slate-400 mb-1">ملاحظات المراجع:</p>
                              <p className="text-sm text-slate-300">{request.reviewNotes}</p>
                            </div>
                          )}
                          
                          {/* أزرار التتبع والمرفقات */}
                          <div className="mt-3 flex items-center gap-2 border-t border-slate-700 pt-3">
                            <RequestTimeline 
                              requestId={request.id} 
                              requestType={REQUEST_TYPE_NAMES[request.requestType] || request.requestType}
                              currentStatus={request.status}
                            />
                            <RequestAttachments 
                              requestId={request.id} 
                              employeeId={employeeInfo.id}
                              canEdit={request.status === 'pending'}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* كشف الراتب */}
          <TabsContent value="salary" className="mt-0">
            <SalarySlip employeeId={employeeInfo.id} employeeName={employeeInfo.name} />
          </TabsContent>

          {/* رصيد الإجازات */}
          <TabsContent value="leaves" className="mt-0">
            <LeaveBalance employeeId={employeeInfo.id} />
          </TabsContent>

          {/* تقرير البونص */}
          <TabsContent value="bonus" className="mt-0">
            <BonusReport employeeId={employeeInfo.id} />
          </TabsContent>

          {/* الملف الشخصي */}
          <TabsContent value="profile" className="mt-0">
            <div className="space-y-6">
              <EmployeeProfile employeeId={employeeInfo.id} />
              <EmployeeInfoForm employeeId={employeeInfo.id} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* نموذج إدخال البريد الإلكتروني الإجباري */}
      {employeeInfo && !employeeInfo.emailVerified && (
        <EmailSetupModal
          isOpen={true}
          employeeId={employeeInfo.id}
          employeeName={employeeInfo.name}
          onSuccess={() => {
            // تحديث معلومات الموظف في localStorage
            const updatedInfo = { ...employeeInfo, emailVerified: true };
            localStorage.setItem('employeeInfo', JSON.stringify(updatedInfo));
            setEmployeeInfo(updatedInfo);
          }}
        />
      )}

      {/* شعار Symbol AI */}
      <footer className="py-4 border-t border-slate-700/50 mt-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-center gap-2">
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-1.5 rounded-lg shadow-lg">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">Symbol AI</span>
            <span className="text-xs text-slate-400">بوابة الموظفين الذكية</span>
          </div>
          <p className="text-center text-[10px] text-slate-500 mt-1">جميع الحقوق محفوظة © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
