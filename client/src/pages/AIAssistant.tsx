/**
 * صفحة المساعد الذكي - AI Assistant
 * ==================================
 * 
 * واجهة المحادثة مع المساعدين الذكيين
 */

import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  Trash2, 
  RefreshCw,
  Sparkles,
  BarChart3,
  FileText,
  Headphones,
  Settings2,
  MessageSquare
} from "lucide-react";
import { Streamdown } from "streamdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

interface Assistant {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  category: string;
}

export default function AIAssistant() {
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // الحصول على قائمة المساعدين
  const { data: assistants, isLoading: loadingAssistants } = trpc.aiAgents.getAssistants.useQuery();

  // إنشاء جلسة
  const createSessionMutation = trpc.aiAgents.createSession.useMutation();

  // إرسال رسالة
  const chatMutation = trpc.aiAgents.chat.useMutation();

  // مسح السجل
  const clearHistoryMutation = trpc.aiAgents.clearHistory.useMutation();

  // التمرير لآخر رسالة
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // اختيار مساعد
  const handleSelectAssistant = async (assistant: Assistant) => {
    setSelectedAssistant(assistant);
    setMessages([]);
    
    try {
      const result = await createSessionMutation.mutateAsync({
        assistantId: assistant.id,
      });
      setSessionId(result.sessionId);
      
      // رسالة ترحيب
      setMessages([{
        role: "assistant",
        content: `مرحباً! أنا **${assistant.name}**. ${assistant.description}\n\nكيف يمكنني مساعدتك اليوم؟`,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error("خطأ في إنشاء الجلسة:", error);
    }
  };

  // إرسال رسالة
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !sessionId || !selectedAssistant || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");
    setIsLoading(true);

    // إضافة رسالة المستخدم
    setMessages(prev => [...prev, {
      role: "user",
      content: userMessage,
      timestamp: new Date(),
    }]);

    try {
      const response = await chatMutation.mutateAsync({
        sessionId,
        assistantId: selectedAssistant.id,
        message: userMessage,
      });

      // إضافة رد المساعد
      setMessages(prev => [...prev, {
        role: "assistant",
        content: response.text,
        timestamp: new Date(),
      }]);
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `عذراً، حدث خطأ: ${error.message}`,
        timestamp: new Date(),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // مسح المحادثة
  const handleClearChat = async () => {
    if (!sessionId) return;
    
    try {
      await clearHistoryMutation.mutateAsync({ sessionId });
      setMessages([{
        role: "assistant",
        content: `تم مسح المحادثة. كيف يمكنني مساعدتك؟`,
        timestamp: new Date(),
      }]);
    } catch (error) {
      console.error("خطأ في مسح المحادثة:", error);
    }
  };

  // أيقونة المساعد
  const getAssistantIcon = (category: string) => {
    switch (category) {
      case "analysis":
        return <BarChart3 className="h-5 w-5" />;
      case "automation":
        return <Settings2 className="h-5 w-5" />;
      case "support":
        return <Headphones className="h-5 w-5" />;
      default:
        return <Bot className="h-5 w-5" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-4rem)] flex">
        {/* قائمة المساعدين */}
        <div className="w-80 border-l bg-muted/30 p-4 overflow-auto">
          <div className="mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              المساعدون الذكيون
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              اختر مساعداً للبدء
            </p>
          </div>

          {loadingAssistants ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {assistants?.map((assistant) => (
                <Card
                  key={assistant.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedAssistant?.id === assistant.id
                      ? "ring-2 ring-primary"
                      : ""
                  }`}
                  onClick={() => handleSelectAssistant(assistant)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="p-2 rounded-lg"
                        style={{ backgroundColor: assistant.color + "20" }}
                      >
                        <span className="text-xl">{assistant.icon}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-sm">{assistant.name}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {assistant.description}
                        </p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {assistant.category === "analysis" && "تحليل"}
                          {assistant.category === "automation" && "أتمتة"}
                          {assistant.category === "support" && "دعم"}
                          {assistant.category === "general" && "عام"}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* منطقة المحادثة */}
        <div className="flex-1 flex flex-col">
          {selectedAssistant ? (
            <>
              {/* رأس المحادثة */}
              <div className="border-b p-4 flex items-center justify-between bg-background">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={{ backgroundColor: selectedAssistant.color + "20" }}
                  >
                    <span className="text-2xl">{selectedAssistant.icon}</span>
                  </div>
                  <div>
                    <h2 className="font-bold">{selectedAssistant.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {selectedAssistant.description}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearChat}
                    disabled={messages.length <= 1}
                  >
                    <Trash2 className="h-4 w-4 ml-1" />
                    مسح
                  </Button>
                </div>
              </div>

              {/* الرسائل */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4 max-w-3xl mx-auto">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex gap-3 ${
                        message.role === "user" ? "flex-row-reverse" : ""
                      }`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarFallback
                          className={
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }
                        >
                          {message.role === "user" ? (
                            <User className="h-4 w-4" />
                          ) : (
                            <Bot className="h-4 w-4" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`flex-1 max-w-[80%] ${
                          message.role === "user" ? "text-left" : "text-right"
                        }`}
                      >
                        <div
                          className={`rounded-lg p-3 inline-block ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          {message.role === "assistant" ? (
                            <div className="prose prose-sm dark:prose-invert max-w-none text-right">
                              <Streamdown>{message.content}</Streamdown>
                            </div>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">
                              {message.content}
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {message.timestamp.toLocaleTimeString("ar-SA")}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-muted">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg p-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* حقل الإدخال */}
              <div className="border-t p-4 bg-background">
                <div className="max-w-3xl mx-auto flex gap-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isLoading}
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!inputMessage.trim() || isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            /* شاشة الترحيب */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold mb-2">مرحباً بك في المساعد الذكي</h2>
                <p className="text-muted-foreground mb-4">
                  اختر أحد المساعدين من القائمة للبدء في المحادثة.
                  يمكن للمساعدين مساعدتك في تحليل البيانات، إنشاء التقارير،
                  والإجابة على أسئلتك.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="secondary">
                    <BarChart3 className="h-3 w-3 ml-1" />
                    تحليل البيانات
                  </Badge>
                  <Badge variant="secondary">
                    <FileText className="h-3 w-3 ml-1" />
                    إنشاء التقارير
                  </Badge>
                  <Badge variant="secondary">
                    <Settings2 className="h-3 w-3 ml-1" />
                    الأتمتة
                  </Badge>
                  <Badge variant="secondary">
                    <Headphones className="h-3 w-3 ml-1" />
                    الدعم الفني
                  </Badge>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
