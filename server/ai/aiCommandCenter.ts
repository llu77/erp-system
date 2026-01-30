/**
 * مركز التحكم بالذكاء الاصطناعي
 * AI Command Center
 * 
 * واجهة موحدة للتحكم بجميع أدوات وقدرات الذكاء الاصطناعي
 * مع تنفيذ أوامر معقدة بالمحادثة الطبيعية
 */

import { invokeLLM } from "../_core/llm";
import { getDb } from "../db";
import { 
  executeAITool, 
  getAvailableTools, 
  AIToolContext, 
  AIToolResult,
  AIToolName 
} from "./aiToolsHub";
import { 
  RecommendationEngine, 
  createRecommendationContext, 
  Recommendation 
} from "./advancedRecommendationEngine";
import { 
  checkPermission, 
  PermissionContext, 
  PermissionDecision 
} from "./smartPermissions";
import { 
  generateReport, 
  ReportType,
  AnalyzedQuestion 
} from "./reportAssistantService";

// ==================== أنواع البيانات ====================

export interface CommandContext {
  userId: number;
  userRole: string;
  branchId?: number;
  sessionId: string;
  conversationHistory: ConversationMessage[];
  activeTools: string[];
  permissions: string[];
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    toolUsed?: string;
    executionTime?: number;
    confidence?: number;
  };
}

export interface CommandResult {
  success: boolean;
  type: 'text' | 'data' | 'chart' | 'action' | 'confirmation' | 'error';
  content: string;
  data?: any;
  suggestions?: string[];
  relatedCommands?: string[];
  executionTime: number;
}

export interface ParsedCommand {
  intent: CommandIntent;
  entities: Record<string, any>;
  confidence: number;
  rawQuery: string;
}

export type CommandIntent = 
  | 'query_data'      // استعلام عن بيانات
  | 'generate_report' // توليد تقرير
  | 'analyze'         // تحليل
  | 'predict'         // تنبؤ
  | 'recommend'       // توصية
  | 'execute_action'  // تنفيذ إجراء
  | 'help'            // مساعدة
  | 'unknown';        // غير معروف

// ==================== مركز التحكم ====================

export class AICommandCenter {
  private context: CommandContext;
  private conversationMemory: Map<string, any> = new Map();

  constructor(context: CommandContext) {
    this.context = context;
  }

  /**
   * معالجة أمر من المستخدم
   */
  async processCommand(userInput: string): Promise<CommandResult> {
    const startTime = Date.now();

    try {
      // 1. تحليل الأمر
      const parsedCommand = await this.parseCommand(userInput);
      
      // 2. التحقق من الصلاحيات
      const permissionCheck = await this.checkCommandPermission(parsedCommand);
      if (!permissionCheck.allowed) {
        return {
          success: false,
          type: 'error',
          content: permissionCheck.reason,
          executionTime: Date.now() - startTime
        };
      }

      // 3. تنفيذ الأمر
      const result = await this.executeCommand(parsedCommand);

      // 4. تحديث سجل المحادثة
      this.updateConversationHistory(userInput, result);

      return {
        ...result,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        type: 'error',
        content: `حدث خطأ أثناء معالجة الأمر: ${error}`,
        executionTime: Date.now() - startTime
      };
    }
  }

  /**
   * تحليل الأمر باستخدام الذكاء الاصطناعي
   */
  private async parseCommand(userInput: string): Promise<ParsedCommand> {
    const systemPrompt = `أنت محلل أوامر ذكي. حلل طلب المستخدم واستخرج:
1. النية (intent): أحد الخيارات التالية:
   - query_data: استعلام عن بيانات (مثل: كم المبيعات؟ ما هو المخزون؟)
   - generate_report: توليد تقرير (مثل: أنشئ تقرير مبيعات)
   - analyze: تحليل (مثل: حلل أداء الفرع)
   - predict: تنبؤ (مثل: توقع المبيعات)
   - recommend: توصية (مثل: ماذا تنصح؟)
   - execute_action: تنفيذ إجراء (مثل: أضف منتج)
   - help: مساعدة (مثل: كيف أستخدم النظام؟)
   - unknown: غير واضح

2. الكيانات (entities): استخرج المعلومات المهمة مثل:
   - period: الفترة الزمنية (today, week, month, year, custom)
   - startDate: تاريخ البداية إن وجد
   - endDate: تاريخ النهاية إن وجد
   - branch: اسم أو رقم الفرع
   - product: اسم أو رقم المنتج
   - customer: اسم أو رقم العميل
   - reportType: نوع التقرير
   - metric: المقياس المطلوب

أجب بصيغة JSON فقط.`;

    try {
      const response = await invokeLLM({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userInput }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'command_analysis',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                intent: { 
                  type: 'string',
                  enum: ['query_data', 'generate_report', 'analyze', 'predict', 'recommend', 'execute_action', 'help', 'unknown']
                },
                entities: {
                  type: 'object',
                  properties: {
                    period: { type: 'string' },
                    startDate: { type: 'string' },
                    endDate: { type: 'string' },
                    branch: { type: 'string' },
                    product: { type: 'string' },
                    customer: { type: 'string' },
                    reportType: { type: 'string' },
                    metric: { type: 'string' }
                  },
                  additionalProperties: true
                },
                confidence: { type: 'number' }
              },
              required: ['intent', 'entities', 'confidence'],
              additionalProperties: false
            }
          }
        }
      });

      const parsed = JSON.parse(response.choices[0]?.message?.content as string || '{}');
      return {
        intent: parsed.intent || 'unknown',
        entities: parsed.entities || {},
        confidence: parsed.confidence || 0.5,
        rawQuery: userInput
      };
    } catch (error) {
      // تحليل بسيط في حالة فشل الذكاء الاصطناعي
      return this.fallbackParse(userInput);
    }
  }

  /**
   * تحليل بديل بسيط
   */
  private fallbackParse(userInput: string): ParsedCommand {
    const input = userInput.toLowerCase();
    let intent: CommandIntent = 'unknown';
    const entities: Record<string, any> = {};

    // كشف النية
    if (input.includes('تقرير') || input.includes('report')) {
      intent = 'generate_report';
    } else if (input.includes('حلل') || input.includes('تحليل') || input.includes('analyze')) {
      intent = 'analyze';
    } else if (input.includes('توقع') || input.includes('تنبؤ') || input.includes('predict')) {
      intent = 'predict';
    } else if (input.includes('نصيحة') || input.includes('توصية') || input.includes('recommend')) {
      intent = 'recommend';
    } else if (input.includes('مساعدة') || input.includes('help') || input.includes('كيف')) {
      intent = 'help';
    } else if (input.includes('كم') || input.includes('ما') || input.includes('أين')) {
      intent = 'query_data';
    }

    // كشف الفترة
    if (input.includes('اليوم') || input.includes('today')) {
      entities.period = 'today';
    } else if (input.includes('الأسبوع') || input.includes('week')) {
      entities.period = 'week';
    } else if (input.includes('الشهر') || input.includes('month')) {
      entities.period = 'month';
    } else if (input.includes('السنة') || input.includes('year')) {
      entities.period = 'year';
    }

    // كشف نوع التقرير
    if (input.includes('مبيعات') || input.includes('sales')) {
      entities.reportType = 'sales';
    } else if (input.includes('مخزون') || input.includes('inventory')) {
      entities.reportType = 'inventory';
    } else if (input.includes('مصروفات') || input.includes('expenses')) {
      entities.reportType = 'expenses';
    } else if (input.includes('أرباح') || input.includes('profit')) {
      entities.reportType = 'profit';
    }

    return {
      intent,
      entities,
      confidence: 0.6,
      rawQuery: userInput
    };
  }

  /**
   * التحقق من صلاحية تنفيذ الأمر
   */
  private async checkCommandPermission(command: ParsedCommand): Promise<PermissionDecision> {
    const actionMap: Record<CommandIntent, string> = {
      query_data: 'view',
      generate_report: 'export',
      analyze: 'view',
      predict: 'view',
      recommend: 'view',
      execute_action: 'create',
      help: 'view',
      unknown: 'view'
    };

    const permissionContext: PermissionContext = {
      userId: this.context.userId,
      userRole: this.context.userRole,
      branchId: this.context.branchId,
      action: actionMap[command.intent],
      resource: command.entities.reportType || 'general',
      timestamp: new Date()
    };

    return checkPermission(permissionContext);
  }

  /**
   * تنفيذ الأمر
   */
  private async executeCommand(command: ParsedCommand): Promise<CommandResult> {
    switch (command.intent) {
      case 'query_data':
        return this.handleQueryData(command);
      case 'generate_report':
        return this.handleGenerateReport(command);
      case 'analyze':
        return this.handleAnalyze(command);
      case 'predict':
        return this.handlePredict(command);
      case 'recommend':
        return this.handleRecommend(command);
      case 'execute_action':
        return this.handleExecuteAction(command);
      case 'help':
        return this.handleHelp(command);
      default:
        return this.handleUnknown(command);
    }
  }

  /**
   * معالجة استعلام البيانات
   */
  private async handleQueryData(command: ParsedCommand): Promise<CommandResult> {
    const { entities } = command;
    const period = this.resolvePeriod(entities.period);

    // استخدام أداة تحليل المبيعات
    const toolContext: AIToolContext = {
      userId: this.context.userId,
      userRole: this.context.userRole,
      branchId: this.context.branchId,
      timestamp: new Date()
    };

    const result = await executeAITool({
      tool: 'sales_intelligence',
      context: toolContext,
      options: {
        startDate: period.start,
        endDate: period.end,
        branchId: this.context.branchId,
        includeAIInsights: true
      }
    });

    if (!result.success) {
      return {
        success: false,
        type: 'error',
        content: result.error || 'فشل في جلب البيانات',
        executionTime: result.executionTime
      };
    }

    // تنسيق الرد
    const data = result.data;
    let content = `📊 **ملخص البيانات للفترة ${period.start.toLocaleDateString('ar-SA')} - ${period.end.toLocaleDateString('ar-SA')}**\n\n`;
    
    if (data?.summary) {
      content += `- إجمالي المبيعات: ${data.summary.totalSales.toLocaleString()} ر.س.\n`;
      content += `- عدد المعاملات: ${data.summary.transactionCount}\n`;
      content += `- متوسط الفاتورة: ${data.summary.averageTicket.toFixed(0)} ر.س.\n`;
      content += `- معدل النمو: ${data.summary.growthRate.toFixed(1)}%\n`;
    }

    if (result.insights.length > 0) {
      content += `\n**رؤى:**\n${result.insights.join('\n')}`;
    }

    return {
      success: true,
      type: 'data',
      content,
      data: result.data,
      suggestions: [
        'هل تريد تقريراً مفصلاً؟',
        'هل تريد مقارنة مع فترة سابقة؟',
        'هل تريد تحليل منتج معين؟'
      ],
      executionTime: result.executionTime
    };
  }

  /**
   * معالجة توليد التقارير
   */
  private async handleGenerateReport(command: ParsedCommand): Promise<CommandResult> {
    const { entities } = command;
    const period = this.resolvePeriod(entities.period);
    
    // تحديد نوع التقرير
    const reportTypeMap: Record<string, ReportType> = {
      'sales': 'sales_summary',
      'مبيعات': 'sales_summary',
      'inventory': 'inventory_status',
      'مخزون': 'inventory_status',
      'expenses': 'expenses_summary',
      'مصروفات': 'expenses_summary',
      'profit': 'profit_loss',
      'أرباح': 'profit_loss',
      'customers': 'customer_analysis',
      'عملاء': 'customer_analysis',
      'employees': 'employee_performance',
      'موظفين': 'employee_performance'
    };

    const reportType = reportTypeMap[entities.reportType] || 'sales_summary';

    try {
      // إنشاء تحليل للتقرير
      const analysis: AnalyzedQuestion = {
        originalQuestion: command.rawQuery,
        reportType,
        chartType: 'bar',
        dateRange: {
          start: period.start,
          end: period.end,
          label: 'الفترة المحددة'
        },
        filters: {
          branchId: this.context.branchId
        },
        confidence: 0.9,
        interpretation: 'تقرير مولد بناءً على طلب المستخدم'
      };

      const report = await generateReport(analysis);

      // تنسيق الملخص
      const summaryText = `تقرير ${report.title}\n` +
        `الإجمالي: ${report.summary.total?.toLocaleString() || 0} ر.س.\n` +
        `العدد: ${report.summary.count || 0}\n` +
        (report.insights.length > 0 ? `الرؤى: ${report.insights.join(', ')}` : '');

      return {
        success: true,
        type: 'data',
        content: summaryText,
        data: {
          report,
          data: report.data,
          recommendations: report.recommendations
        },
        suggestions: [
          'هل تريد تصدير التقرير؟',
          'هل تريد تحليل أعمق؟',
          'هل تريد مقارنة مع فترة أخرى؟'
        ],
        executionTime: 0
      };
    } catch (error) {
      return {
        success: false,
        type: 'error',
        content: `فشل في توليد التقرير: ${error}`,
        executionTime: 0
      };
    }
  }

  /**
   * معالجة التحليل
   */
  private async handleAnalyze(command: ParsedCommand): Promise<CommandResult> {
    const { entities } = command;
    const period = this.resolvePeriod(entities.period);

    const toolContext: AIToolContext = {
      userId: this.context.userId,
      userRole: this.context.userRole,
      branchId: this.context.branchId,
      timestamp: new Date()
    };

    // تحديد الأداة المناسبة
    let toolName: AIToolName = 'sales_intelligence';
    if (entities.reportType === 'customers' || entities.reportType === 'عملاء') {
      toolName = 'customer_behavior';
    } else if (entities.reportType === 'fraud' || entities.reportType === 'احتيال') {
      toolName = 'fraud_detection';
    }

    const result = await executeAITool({
      tool: toolName,
      context: toolContext,
      options: {
        startDate: period.start,
        endDate: period.end,
        includeAIInsights: true
      }
    });

    if (!result.success) {
      return {
        success: false,
        type: 'error',
        content: result.error || 'فشل في التحليل',
        executionTime: result.executionTime
      };
    }

    let content = `🔍 **نتائج التحليل**\n\n`;
    content += result.insights.join('\n');

    if (result.recommendations.length > 0) {
      content += `\n\n**التوصيات:**\n`;
      result.recommendations.forEach((rec, i) => {
        content += `${i + 1}. ${rec.title}: ${rec.description}\n`;
      });
    }

    return {
      success: true,
      type: 'data',
      content,
      data: result.data,
      suggestions: [
        'هل تريد تفاصيل أكثر؟',
        'هل تريد تنفيذ إحدى التوصيات؟'
      ],
      executionTime: result.executionTime
    };
  }

  /**
   * معالجة التنبؤ
   */
  private async handlePredict(command: ParsedCommand): Promise<CommandResult> {
    const { entities } = command;

    const toolContext: AIToolContext = {
      userId: this.context.userId,
      userRole: this.context.userRole,
      branchId: this.context.branchId,
      timestamp: new Date()
    };

    const result = await executeAITool({
      tool: 'demand_forecast',
      context: toolContext,
      options: {
        forecastPeriods: 7,
        granularity: 'daily'
      }
    });

    if (!result.success) {
      return {
        success: false,
        type: 'error',
        content: result.error || 'فشل في التنبؤ',
        executionTime: result.executionTime
      };
    }

    let content = `🔮 **التنبؤات**\n\n`;
    
    if (result.data?.forecasts) {
      content += `**توقعات الطلب للأيام القادمة:**\n`;
      result.data.forecasts.slice(0, 5).forEach((f: any) => {
        content += `- ${f.period}: ${f.predictedDemand.toLocaleString()} ر.س. (ثقة: ${(f.confidence * 100).toFixed(0)}%)\n`;
      });
    }

    if (result.data?.productForecasts) {
      const highRisk = result.data.productForecasts.filter((p: any) => p.stockoutRisk > 50);
      if (highRisk.length > 0) {
        content += `\n**⚠️ منتجات معرضة لنفاد المخزون:**\n`;
        highRisk.slice(0, 5).forEach((p: any) => {
          content += `- ${p.productName}: خطر ${p.stockoutRisk.toFixed(0)}%\n`;
        });
      }
    }

    return {
      success: true,
      type: 'data',
      content,
      data: result.data,
      suggestions: [
        'هل تريد إنشاء أوامر شراء؟',
        'هل تريد تنبؤات لفترة أطول؟'
      ],
      executionTime: result.executionTime
    };
  }

  /**
   * معالجة التوصيات
   */
  private async handleRecommend(command: ParsedCommand): Promise<CommandResult> {
    const context = createRecommendationContext(
      this.context.userId,
      this.context.userRole,
      this.context.branchId
    );

    const engine = new RecommendationEngine(context);
    const recommendations = await engine.generateAllRecommendations();

    if (recommendations.length === 0) {
      return {
        success: true,
        type: 'text',
        content: '✅ لا توجد توصيات عاجلة حالياً. الأمور تسير بشكل جيد!',
        executionTime: 0
      };
    }

    let content = `💡 **التوصيات (${recommendations.length})**\n\n`;
    
    const priorityEmoji: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢'
    };

    recommendations.slice(0, 5).forEach((rec, i) => {
      content += `${priorityEmoji[rec.priority]} **${rec.title}**\n`;
      content += `${rec.description}\n`;
      content += `التأثير المتوقع: ${rec.impact.changePercent > 0 ? '+' : ''}${rec.impact.changePercent.toFixed(0)}% على ${rec.impact.metric}\n\n`;
    });

    return {
      success: true,
      type: 'data',
      content,
      data: { recommendations },
      suggestions: [
        'هل تريد تفاصيل توصية معينة؟',
        'هل تريد تنفيذ إحدى التوصيات؟'
      ],
      executionTime: 0
    };
  }

  /**
   * معالجة تنفيذ الإجراءات
   */
  private async handleExecuteAction(command: ParsedCommand): Promise<CommandResult> {
    return {
      success: true,
      type: 'confirmation',
      content: `⚠️ هل تريد تنفيذ هذا الإجراء؟\n\n${command.rawQuery}\n\nاكتب "نعم" للتأكيد أو "لا" للإلغاء.`,
      data: { pendingAction: command },
      executionTime: 0
    };
  }

  /**
   * معالجة طلبات المساعدة
   */
  private async handleHelp(command: ParsedCommand): Promise<CommandResult> {
    const helpContent = `🤖 **مركز التحكم بالذكاء الاصطناعي**

**الأوامر المتاحة:**

📊 **استعلامات البيانات:**
- "كم المبيعات اليوم؟"
- "ما هو المخزون الحالي؟"
- "أعطني إحصائيات الأسبوع"

📈 **التقارير:**
- "أنشئ تقرير مبيعات شهري"
- "تقرير المصروفات"
- "تقرير أداء الموظفين"

🔍 **التحليل:**
- "حلل أداء الفرع"
- "حلل سلوك العملاء"
- "اكتشف الأنماط غير الطبيعية"

🔮 **التنبؤات:**
- "توقع المبيعات للأسبوع القادم"
- "ما المنتجات التي ستنفد؟"

💡 **التوصيات:**
- "ماذا تنصح؟"
- "أعطني توصيات لتحسين المبيعات"

**نصائح:**
- يمكنك تحديد الفترة: "اليوم"، "الأسبوع"، "الشهر"
- يمكنك تحديد الفرع: "فرع الرياض"
- اسأل بشكل طبيعي وسأفهم طلبك!`;

    return {
      success: true,
      type: 'text',
      content: helpContent,
      suggestions: [
        'كم المبيعات اليوم؟',
        'أنشئ تقرير شهري',
        'ماذا تنصح؟'
      ],
      executionTime: 0
    };
  }

  /**
   * معالجة الأوامر غير المعروفة
   */
  private async handleUnknown(command: ParsedCommand): Promise<CommandResult> {
    // محاولة فهم الطلب باستخدام الذكاء الاصطناعي
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `أنت مساعد ذكي لنظام ERP. حاول فهم طلب المستخدم وقدم رداً مفيداً.
            إذا لم تفهم الطلب، اقترح بدائل واضحة.
            أجب بالعربية بشكل موجز ومفيد.`
          },
          {
            role: 'user',
            content: command.rawQuery
          }
        ]
      });

      const aiResponse = response.choices[0]?.message?.content as string;

      return {
        success: true,
        type: 'text',
        content: aiResponse || 'عذراً، لم أفهم طلبك. هل يمكنك إعادة صياغته؟',
        suggestions: [
          'اكتب "مساعدة" لعرض الأوامر المتاحة',
          'كم المبيعات اليوم؟',
          'أنشئ تقرير'
        ],
        executionTime: 0
      };
    } catch (error) {
      return {
        success: false,
        type: 'error',
        content: 'عذراً، لم أفهم طلبك. اكتب "مساعدة" لعرض الأوامر المتاحة.',
        suggestions: ['مساعدة'],
        executionTime: 0
      };
    }
  }

  /**
   * تحويل الفترة النصية إلى تواريخ
   */
  private resolvePeriod(period?: string): { start: Date; end: Date } {
    const now = new Date();
    const end = new Date(now);
    let start = new Date(now);

    switch (period) {
      case 'today':
      case 'اليوم':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
      case 'الأسبوع':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
      case 'الشهر':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'year':
      case 'السنة':
        start.setFullYear(start.getFullYear() - 1);
        break;
      default:
        // افتراضي: آخر 30 يوم
        start.setDate(start.getDate() - 30);
    }

    return { start, end };
  }

  /**
   * تحديث سجل المحادثة
   */
  private updateConversationHistory(userInput: string, result: CommandResult): void {
    // إضافة رسالة المستخدم
    this.context.conversationHistory.push({
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: userInput,
      timestamp: new Date()
    });

    // إضافة رد المساعد
    this.context.conversationHistory.push({
      id: `msg_${Date.now()}_assistant`,
      role: 'assistant',
      content: result.content,
      timestamp: new Date(),
      metadata: {
        executionTime: result.executionTime
      }
    });

    // الاحتفاظ بآخر 50 رسالة فقط
    if (this.context.conversationHistory.length > 50) {
      this.context.conversationHistory = this.context.conversationHistory.slice(-50);
    }
  }

  /**
   * الحصول على الأدوات المتاحة للمستخدم
   */
  getAvailableTools(): { name: string; description: string }[] {
    const allTools = getAvailableTools();
    return allTools.filter(tool => 
      tool.requiredRole.includes(this.context.userRole) || 
      this.context.userRole === 'admin'
    );
  }

  /**
   * الحصول على سجل المحادثة
   */
  getConversationHistory(): ConversationMessage[] {
    return this.context.conversationHistory;
  }

  /**
   * مسح سجل المحادثة
   */
  clearConversationHistory(): void {
    this.context.conversationHistory = [];
    this.conversationMemory.clear();
  }
}

// ==================== دوال مساعدة ====================

export function createCommandContext(
  userId: number,
  userRole: string,
  branchId?: number,
  sessionId?: string
): CommandContext {
  return {
    userId,
    userRole,
    branchId,
    sessionId: sessionId || `session_${Date.now()}`,
    conversationHistory: [],
    activeTools: [],
    permissions: []
  };
}

export async function processAICommand(
  userId: number,
  userRole: string,
  command: string,
  branchId?: number,
  sessionId?: string
): Promise<CommandResult> {
  const context = createCommandContext(userId, userRole, branchId, sessionId);
  const commandCenter = new AICommandCenter(context);
  return commandCenter.processCommand(command);
}
