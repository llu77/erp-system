import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { 
  Home,
  Info,
  FileText,
  HelpCircle,
  Search,
  CheckCircle2,
  Circle,
  Sparkles,
  Users,
  Target,
  Heart,
  Lightbulb,
  Shield,
  Clock,
  Gift,
  Briefcase,
  GraduationCap,
  Coffee,
  Plane,
  HeartPulse,
  Wallet,
  ChevronRight,
  Star
} from "lucide-react";

// بيانات قيم الشركة
const companyValues = [
  {
    icon: Lightbulb,
    title: "Innovation",
    titleAr: "الابتكار",
    description: "We embrace new ideas and technologies to drive progress",
    descriptionAr: "نتبنى الأفكار والتقنيات الجديدة لدفع عجلة التقدم"
  },
  {
    icon: Users,
    title: "Collaboration",
    titleAr: "التعاون",
    description: "We work together as one team to achieve our goals",
    descriptionAr: "نعمل معاً كفريق واحد لتحقيق أهدافنا"
  },
  {
    icon: Target,
    title: "Excellence",
    titleAr: "التميز",
    description: "We strive for the highest quality in everything we do",
    descriptionAr: "نسعى لأعلى جودة في كل ما نقوم به"
  },
  {
    icon: Heart,
    title: "Integrity",
    titleAr: "النزاهة",
    description: "We act with honesty and transparency in all interactions",
    descriptionAr: "نتصرف بصدق وشفافية في جميع تعاملاتنا"
  },
  {
    icon: Shield,
    title: "Trust",
    titleAr: "الثقة",
    description: "We build lasting relationships based on mutual respect",
    descriptionAr: "نبني علاقات دائمة قائمة على الاحترام المتبادل"
  },
  {
    icon: Sparkles,
    title: "Growth",
    titleAr: "النمو",
    description: "We invest in continuous learning and development",
    descriptionAr: "نستثمر في التعلم والتطوير المستمر"
  }
];

// قائمة مهام الموظف الجديد
const onboardingChecklist = [
  { id: 1, task: "Complete HR paperwork and documentation", taskAr: "إكمال الأوراق والوثائق المطلوبة", category: "Day 1" },
  { id: 2, task: "Set up your workstation and equipment", taskAr: "إعداد محطة العمل والمعدات", category: "Day 1" },
  { id: 3, task: "Activate your email and system accounts", taskAr: "تفعيل البريد الإلكتروني وحسابات النظام", category: "Day 1" },
  { id: 4, task: "Meet your team members and manager", taskAr: "التعرف على أعضاء الفريق والمدير", category: "Week 1" },
  { id: 5, task: "Complete security and compliance training", taskAr: "إكمال تدريب الأمان والامتثال", category: "Week 1" },
  { id: 6, task: "Review company policies and handbook", taskAr: "مراجعة سياسات الشركة ودليل الموظف", category: "Week 1" },
  { id: 7, task: "Set up benefits enrollment", taskAr: "التسجيل في برنامج المزايا", category: "Week 2" },
  { id: 8, task: "Complete department-specific training", taskAr: "إكمال التدريب الخاص بالقسم", category: "Week 2" },
  { id: 9, task: "Schedule 30-day check-in with HR", taskAr: "جدولة اجتماع المتابعة بعد 30 يوم", category: "Month 1" },
  { id: 10, task: "Set performance goals with manager", taskAr: "تحديد أهداف الأداء مع المدير", category: "Month 1" },
];

// مزايا الموظفين
const benefits = [
  { icon: HeartPulse, title: "Health Insurance", titleAr: "التأمين الصحي", description: "Comprehensive medical, dental, and vision coverage" },
  { icon: Plane, title: "Paid Time Off", titleAr: "إجازات مدفوعة", description: "Generous vacation days and holidays" },
  { icon: GraduationCap, title: "Learning & Development", titleAr: "التعلم والتطوير", description: "Training programs and education assistance" },
  { icon: Wallet, title: "Competitive Salary", titleAr: "راتب تنافسي", description: "Market-competitive compensation packages" },
  { icon: Coffee, title: "Work-Life Balance", titleAr: "التوازن بين العمل والحياة", description: "Flexible working hours and remote options" },
  { icon: Gift, title: "Employee Perks", titleAr: "امتيازات الموظفين", description: "Discounts, wellness programs, and more" },
];

// الأسئلة الشائعة
const faqs = [
  {
    question: "What are the working hours?",
    questionAr: "ما هي ساعات العمل؟",
    answer: "Our standard working hours are 9:00 AM to 6:00 PM, Sunday through Thursday. We offer flexible scheduling options based on your role and team requirements.",
    answerAr: "ساعات العمل القياسية من 9:00 صباحاً إلى 6:00 مساءً، من الأحد إلى الخميس. نوفر خيارات جدولة مرنة حسب دورك ومتطلبات الفريق.",
    category: "General"
  },
  {
    question: "How do I request time off?",
    questionAr: "كيف أطلب إجازة؟",
    answer: "Submit your leave request through the HR portal at least 2 weeks in advance for planned vacations. Emergency leave can be requested with shorter notice.",
    answerAr: "قدم طلب الإجازة عبر بوابة الموارد البشرية قبل أسبوعين على الأقل للإجازات المخططة. يمكن طلب الإجازة الطارئة بإشعار أقصر.",
    category: "Leave"
  },
  {
    question: "When will I receive my first paycheck?",
    questionAr: "متى سأستلم راتبي الأول؟",
    answer: "Salaries are paid on the 27th of each month. If you joined mid-month, your first payment will be prorated accordingly.",
    answerAr: "تُصرف الرواتب في 27 من كل شهر. إذا انضممت في منتصف الشهر، سيتم احتساب راتبك الأول بشكل نسبي.",
    category: "Payroll"
  },
  {
    question: "How do I enroll in health insurance?",
    questionAr: "كيف أسجل في التأمين الصحي؟",
    answer: "Health insurance enrollment is completed during your first week. HR will guide you through the available plans and help you select the best option for you and your family.",
    answerAr: "يتم التسجيل في التأمين الصحي خلال أسبوعك الأول. سيرشدك قسم الموارد البشرية إلى الخطط المتاحة ويساعدك في اختيار الأنسب لك ولعائلتك.",
    category: "Benefits"
  },
  {
    question: "What is the dress code?",
    questionAr: "ما هو الزي المطلوب؟",
    answer: "We maintain a business casual dress code. Smart casual attire is appropriate for most days, with formal wear expected for client meetings.",
    answerAr: "نتبع زياً رسمياً غير متكلف. الملابس الأنيقة غير الرسمية مناسبة لمعظم الأيام، مع توقع الزي الرسمي لاجتماعات العملاء.",
    category: "General"
  },
  {
    question: "How can I access training resources?",
    questionAr: "كيف يمكنني الوصول إلى موارد التدريب؟",
    answer: "Training materials are available through our Learning Management System (LMS). You'll receive login credentials during your first day orientation.",
    answerAr: "مواد التدريب متاحة عبر نظام إدارة التعلم (LMS). ستحصل على بيانات تسجيل الدخول خلال التوجيه في يومك الأول.",
    category: "Training"
  },
  {
    question: "Who do I contact for IT support?",
    questionAr: "بمن أتواصل للدعم التقني؟",
    answer: "For IT support, submit a ticket through the IT helpdesk portal or email it@symbolai.net. For urgent issues, call the IT hotline at extension 100.",
    answerAr: "للدعم التقني، قدم تذكرة عبر بوابة مكتب المساعدة أو أرسل بريداً إلى it@symbolai.net. للمشاكل العاجلة، اتصل بخط الدعم التقني على الرقم الداخلي 100.",
    category: "IT"
  },
  {
    question: "What is the performance review process?",
    questionAr: "ما هي عملية تقييم الأداء؟",
    answer: "Performance reviews are conducted semi-annually. You'll have a mid-year check-in and an annual review with your manager to discuss goals, achievements, and development plans.",
    answerAr: "تُجرى تقييمات الأداء نصف سنوياً. ستحصل على مراجعة منتصف العام ومراجعة سنوية مع مديرك لمناقشة الأهداف والإنجازات وخطط التطوير.",
    category: "Performance"
  },
];

// سياسات الشركة
const policies = [
  {
    title: "Code of Conduct",
    titleAr: "مدونة السلوك",
    description: "Guidelines for professional behavior and ethical standards",
    descriptionAr: "إرشادات السلوك المهني والمعايير الأخلاقية"
  },
  {
    title: "Information Security",
    titleAr: "أمن المعلومات",
    description: "Protecting company and client data",
    descriptionAr: "حماية بيانات الشركة والعملاء"
  },
  {
    title: "Anti-Harassment",
    titleAr: "مكافحة التحرش",
    description: "Creating a safe and respectful workplace",
    descriptionAr: "خلق بيئة عمل آمنة ومحترمة"
  },
  {
    title: "Remote Work",
    titleAr: "العمل عن بُعد",
    description: "Guidelines for working from home",
    descriptionAr: "إرشادات العمل من المنزل"
  },
  {
    title: "Travel & Expenses",
    titleAr: "السفر والمصاريف",
    description: "Reimbursement policies and procedures",
    descriptionAr: "سياسات وإجراءات استرداد المصاريف"
  },
  {
    title: "Leave Policy",
    titleAr: "سياسة الإجازات",
    description: "Types of leave and how to request them",
    descriptionAr: "أنواع الإجازات وكيفية طلبها"
  },
];

export default function HROnboarding() {
  const [activeTab, setActiveTab] = useState("home");
  const [searchQuery, setSearchQuery] = useState("");
  const [checkedItems, setCheckedItems] = useState<number[]>([]);

  const toggleCheckItem = (id: number) => {
    setCheckedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.questionAr.includes(searchQuery) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answerAr.includes(searchQuery)
  );

  const completedTasks = checkedItems.length;
  const totalTasks = onboardingChecklist.length;
  const progressPercentage = (completedTasks / totalTasks) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img 
                src="/symbol-ai-logo.png" 
                alt="Symbol AI" 
                className="h-10 w-auto"
              />
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold text-white">Symbol AI</h1>
                <p className="text-xs text-slate-400">HR Onboarding Portal</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 bg-slate-800/50 rounded-lg p-1">
              {[
                { id: "home", label: "Home", icon: Home },
                { id: "about", label: "About", icon: Info },
                { id: "policies", label: "Policies", icon: FileText },
                { id: "faq", label: "FAQ", icon: HelpCircle },
              ].map(tab => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                  className={`gap-2 ${activeTab === tab.id 
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700/50'}`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Home Tab */}
        {activeTab === "home" && (
          <div className="space-y-8">
            {/* Welcome Section */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600/20 via-cyan-600/20 to-blue-600/20 border border-blue-500/20 p-8">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-50"></div>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                    Welcome Aboard!
                  </Badge>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4">
                  Welcome to Symbol AI
                </h2>
                <p className="text-lg text-slate-300 max-w-2xl">
                  We're thrilled to have you join our team! This portal will guide you through your onboarding journey 
                  and help you get started with everything you need to succeed at Symbol AI.
                </p>
                <p className="text-lg text-slate-400 mt-4 max-w-2xl" dir="rtl">
                  يسعدنا انضمامك إلى فريقنا! ستساعدك هذه البوابة في رحلة التأهيل وتوفر لك كل ما تحتاجه للنجاح في Symbol AI.
                </p>
              </div>
            </div>

            {/* Progress Card */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                  Your Onboarding Progress
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Complete these tasks to get fully set up
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-400">{completedTasks} of {totalTasks} tasks completed</span>
                    <span className="text-cyan-400 font-medium">{Math.round(progressPercentage)}%</span>
                  </div>
                  <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Checklist */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">Onboarding Checklist</CardTitle>
                <CardDescription className="text-slate-400">قائمة مهام التأهيل</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {["Day 1", "Week 1", "Week 2", "Month 1"].map(category => (
                    <div key={category} className="mb-4">
                      <h4 className="text-sm font-medium text-cyan-400 mb-2">{category}</h4>
                      <div className="space-y-2">
                        {onboardingChecklist.filter(item => item.category === category).map(item => (
                          <div 
                            key={item.id}
                            className={`flex items-start gap-3 p-3 rounded-lg transition-all cursor-pointer
                              ${checkedItems.includes(item.id) 
                                ? 'bg-green-500/10 border border-green-500/20' 
                                : 'bg-slate-700/30 border border-slate-600/30 hover:bg-slate-700/50'}`}
                            onClick={() => toggleCheckItem(item.id)}
                          >
                            <Checkbox 
                              checked={checkedItems.includes(item.id)}
                              className="mt-1 border-slate-500 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                            />
                            <div className="flex-1">
                              <p className={`text-sm ${checkedItems.includes(item.id) ? 'text-green-400 line-through' : 'text-white'}`}>
                                {item.task}
                              </p>
                              <p className={`text-xs mt-1 ${checkedItems.includes(item.id) ? 'text-green-400/60 line-through' : 'text-slate-400'}`} dir="rtl">
                                {item.taskAr}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Company Values */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-400" />
                Our Values | قيمنا
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {companyValues.map((value, index) => (
                  <Card key={index} className="bg-slate-800/50 border-slate-700/50 hover:border-blue-500/30 transition-all group">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 group-hover:from-blue-500/30 group-hover:to-cyan-500/30 transition-all">
                          <value.icon className="h-6 w-6 text-cyan-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{value.title}</h4>
                          <p className="text-xs text-cyan-400 mb-2">{value.titleAr}</p>
                          <p className="text-sm text-slate-400">{value.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Benefits */}
            <div>
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-400" />
                Benefits | المزايا
              </h3>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {benefits.map((benefit, index) => (
                  <Card key={index} className="bg-slate-800/50 border-slate-700/50 hover:border-pink-500/30 transition-all group">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20 group-hover:from-pink-500/30 group-hover:to-purple-500/30 transition-all">
                          <benefit.icon className="h-6 w-6 text-pink-400" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-white">{benefit.title}</h4>
                          <p className="text-xs text-pink-400 mb-2">{benefit.titleAr}</p>
                          <p className="text-sm text-slate-400">{benefit.description}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* About Tab */}
        {activeTab === "about" && (
          <div className="space-y-8">
            <div className="text-center max-w-3xl mx-auto">
              <img 
                src="/symbol-ai-logo.png" 
                alt="Symbol AI" 
                className="h-32 w-auto mx-auto mb-6"
              />
              <h2 className="text-3xl font-bold text-white mb-4">About Symbol AI</h2>
              <p className="text-lg text-slate-300 mb-6">
                Symbol AI is a leading artificial intelligence company dedicated to transforming businesses 
                through innovative AI solutions. Our mission is to make AI accessible and impactful for organizations worldwide.
              </p>
              <p className="text-lg text-slate-400" dir="rtl">
                Symbol AI هي شركة رائدة في مجال الذكاء الاصطناعي، مكرسة لتحويل الأعمال من خلال حلول الذكاء الاصطناعي المبتكرة. 
                مهمتنا هي جعل الذكاء الاصطناعي متاحاً ومؤثراً للمؤسسات في جميع أنحاء العالم.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <Card className="bg-slate-800/50 border-slate-700/50 text-center p-6">
                <div className="text-4xl font-bold text-cyan-400 mb-2">2020</div>
                <div className="text-slate-400">Founded | تأسست</div>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700/50 text-center p-6">
                <div className="text-4xl font-bold text-cyan-400 mb-2">100+</div>
                <div className="text-slate-400">Team Members | أعضاء الفريق</div>
              </Card>
              <Card className="bg-slate-800/50 border-slate-700/50 text-center p-6">
                <div className="text-4xl font-bold text-cyan-400 mb-2">50+</div>
                <div className="text-slate-400">Clients | العملاء</div>
              </Card>
            </div>

            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">Our Mission | مهمتنا</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 mb-4">
                  To empower businesses with cutting-edge AI technology that drives growth, efficiency, and innovation.
                </p>
                <p className="text-slate-400" dir="rtl">
                  تمكين الأعمال من خلال تقنيات الذكاء الاصطناعي المتطورة التي تدفع النمو والكفاءة والابتكار.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-white">Our Vision | رؤيتنا</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-300 mb-4">
                  To be the global leader in AI solutions, setting the standard for innovation and excellence in the industry.
                </p>
                <p className="text-slate-400" dir="rtl">
                  أن نكون الرائد العالمي في حلول الذكاء الاصطناعي، ووضع معايير الابتكار والتميز في الصناعة.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === "policies" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Company Policies</h2>
              <p className="text-slate-400">سياسات الشركة</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {policies.map((policy, index) => (
                <Card key={index} className="bg-slate-800/50 border-slate-700/50 hover:border-blue-500/30 transition-all cursor-pointer group">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                          {policy.title}
                        </h4>
                        <p className="text-xs text-cyan-400 mb-2">{policy.titleAr}</p>
                        <p className="text-sm text-slate-400">{policy.description}</p>
                        <p className="text-xs text-slate-500 mt-1" dir="rtl">{policy.descriptionAr}</p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-cyan-400 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="bg-blue-500/10 border-blue-500/20">
              <CardContent className="p-6">
                <p className="text-blue-300 text-center">
                  📄 For detailed policy documents, please contact HR at <span className="font-medium">hr@symbolai.net</span>
                </p>
                <p className="text-blue-400/70 text-center mt-2" dir="rtl">
                  للحصول على وثائق السياسات التفصيلية، يرجى التواصل مع الموارد البشرية
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* FAQ Tab */}
        {activeTab === "faq" && (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Frequently Asked Questions</h2>
              <p className="text-slate-400">الأسئلة الشائعة</p>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-xl mx-auto mb-8">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search FAQs... | ابحث في الأسئلة..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-cyan-500"
                dir="auto"
              />
            </div>

            {/* FAQ Categories */}
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {["All", "General", "Leave", "Payroll", "Benefits", "Training", "IT", "Performance"].map(cat => (
                <Badge 
                  key={cat}
                  variant="outline"
                  className="cursor-pointer border-slate-600 text-slate-400 hover:border-cyan-500 hover:text-cyan-400 transition-colors"
                >
                  {cat}
                </Badge>
              ))}
            </div>

            {/* FAQ Accordion */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardContent className="p-6">
                {filteredFaqs.length > 0 ? (
                  <Accordion type="single" collapsible className="space-y-2">
                    {filteredFaqs.map((faq, index) => (
                      <AccordionItem 
                        key={index} 
                        value={`item-${index}`}
                        className="border border-slate-700/50 rounded-lg px-4 data-[state=open]:bg-slate-700/30"
                      >
                        <AccordionTrigger className="text-white hover:text-cyan-400 hover:no-underline">
                          <div className="text-right">
                            <div>{faq.question}</div>
                            <div className="text-xs text-slate-400 font-normal mt-1" dir="rtl">{faq.questionAr}</div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="text-slate-300">
                          <p className="mb-3">{faq.answer}</p>
                          <p className="text-slate-400 text-sm" dir="rtl">{faq.answerAr}</p>
                          <Badge variant="outline" className="mt-3 border-slate-600 text-slate-500">
                            {faq.category}
                          </Badge>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                ) : (
                  <div className="text-center py-8">
                    <HelpCircle className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No FAQs found matching your search</p>
                    <p className="text-slate-500 text-sm" dir="rtl">لم يتم العثور على أسئلة تطابق بحثك</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-cyan-500/10 border-cyan-500/20">
              <CardContent className="p-6">
                <p className="text-cyan-300 text-center">
                  🤔 Can't find what you're looking for? Contact HR at <span className="font-medium">hr@symbolai.net</span>
                </p>
                <p className="text-cyan-400/70 text-center mt-2" dir="rtl">
                  لم تجد ما تبحث عنه؟ تواصل مع الموارد البشرية
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 mt-12 py-8">
        <div className="container mx-auto px-4 text-center">
          <img 
            src="/symbol-ai-logo.png" 
            alt="Symbol AI" 
            className="h-8 w-auto mx-auto mb-4 opacity-50"
          />
          <p className="text-slate-500 text-sm">
            © {new Date().getFullYear()} Symbol AI. All rights reserved.
          </p>
          <p className="text-slate-600 text-xs mt-2">
            HR Onboarding Portal | بوابة تأهيل الموظفين
          </p>
        </div>
      </footer>
    </div>
  );
}
