import { useState, useRef, useEffect } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Streamdown } from 'streamdown';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  MessageCircle,
  Sparkles,
  FileText,
  Calculator,
  Calendar,
  HelpCircle
} from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
}

interface EmployeeContext {
  employeeId?: number;
  employeeName?: string;
  branchId?: number;
  branchName?: string;
}

export default function EmployeeAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [employeeContext, setEmployeeContext] = useState<EmployeeContext | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // جلب رسالة الترحيب
  const { data: welcomeData } = trpc.employeeAssistant.getWelcomeMessage.useQuery();

  // mutation للمحادثة
  const chatMutation = trpc.employeeAssistant.chat.useMutation({
    onSuccess: (data) => {
      const messageContent = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
      setMessages(prev => [...prev, { role: 'assistant', content: messageContent }]);
      if (data.employeeContext) {
        setEmployeeContext(data.employeeContext);
      }
      setIsLoading(false);
    },
    onError: (error) => {
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ حدث خطأ: ${error.message}` 
      }]);
      setIsLoading(false);
    }
  });

  // تمرير تلقائي للأسفل
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // إضافة رسالة الترحيب عند التحميل
  useEffect(() => {
    if (welcomeData && messages.length === 0) {
      setMessages([{ role: 'assistant', content: welcomeData.message }]);
    }
  }, [welcomeData]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    // إرسال الرسالة
    chatMutation.mutate({
      message: userMessage,
      conversationHistory: messages.slice(-10), // آخر 10 رسائل فقط
      employeeContext,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 shadow-lg">
        <div className="container mx-auto flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg">
            <Bot className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">مساعد الموظفين الذكي</h1>
            <p className="text-emerald-100 text-sm">Symbol AI - خدمتك بذكاء</p>
          </div>
          {employeeContext?.employeeName && (
            <div className="mr-auto bg-white/20 px-4 py-2 rounded-lg">
              <span className="text-sm">مرحباً، </span>
              <span className="font-bold">{employeeContext.employeeName}</span>
              {employeeContext.branchName && (
                <span className="text-emerald-100 text-sm"> ({employeeContext.branchName})</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto p-4 max-w-4xl">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <Card 
            className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-all"
            onClick={() => handleSuggestedQuestion('أريد رفع طلب إجازة')}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
              <Calendar className="w-8 h-8 text-blue-400" />
              <span className="text-gray-200 text-sm">طلب إجازة</span>
            </CardContent>
          </Card>
          <Card 
            className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-all"
            onClick={() => handleSuggestedQuestion('أريد طلب سلفة')}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
              <FileText className="w-8 h-8 text-green-400" />
              <span className="text-gray-200 text-sm">طلب سلفة</span>
            </CardContent>
          </Card>
          <Card 
            className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-all"
            onClick={() => handleSuggestedQuestion('كم بونصي هذا الأسبوع؟')}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
              <Sparkles className="w-8 h-8 text-yellow-400" />
              <span className="text-gray-200 text-sm">البونص</span>
            </CardContent>
          </Card>
          <Card 
            className="bg-gray-800/50 border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-all"
            onClick={() => handleSuggestedQuestion('احسب لي سعر قص شعر مع صبغة')}
          >
            <CardContent className="p-4 flex flex-col items-center gap-2 text-center">
              <Calculator className="w-8 h-8 text-purple-400" />
              <span className="text-gray-200 text-sm">حساب الأسعار</span>
            </CardContent>
          </Card>
        </div>

        {/* Chat Area */}
        <Card className="bg-gray-800/80 border-gray-700 shadow-2xl">
          <CardHeader className="border-b border-gray-700 pb-4">
            <CardTitle className="flex items-center gap-2 text-gray-100">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
              المحادثة
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Messages */}
            <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      message.role === 'user' 
                        ? 'bg-blue-600' 
                        : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                    }`}>
                      {message.role === 'user' ? (
                        <User className="w-5 h-5 text-white" />
                      ) : (
                        <Bot className="w-5 h-5 text-white" />
                      )}
                    </div>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-100'
                    }`}>
                      {message.role === 'assistant' ? (
                        <Streamdown>{message.content}</Streamdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                      <Bot className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-gray-700 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2 text-gray-300">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري التفكير...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Suggested Questions */}
            {welcomeData?.suggestedQuestions && messages.length <= 1 && (
              <div className="px-4 pb-4">
                <p className="text-gray-400 text-sm mb-2 flex items-center gap-1">
                  <HelpCircle className="w-4 h-4" />
                  أسئلة مقترحة:
                </p>
                <div className="flex flex-wrap gap-2">
                  {welcomeData.suggestedQuestions.map((q, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="bg-gray-700/50 border-gray-600 text-gray-200 hover:bg-gray-600"
                      onClick={() => handleSuggestedQuestion(q)}
                    >
                      {q}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="اكتب رسالتك هنا..."
                  className="flex-1 bg-gray-700 border-gray-600 text-gray-100 placeholder:text-gray-400"
                  disabled={isLoading}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-4 text-gray-500 text-sm">
          <p>مساعد الموظفين الذكي - Symbol AI © 2024</p>
          <p className="text-xs mt-1">يمكنني مساعدتك في رفع الطلبات، عرض التقارير، وحساب الأسعار</p>
        </div>
      </div>
    </div>
  );
}
