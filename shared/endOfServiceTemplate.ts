/**
 * قالب طباعة إنهاء الخدمة: خطاب انتهاء العقد وعدم التجديد + المخالصة النهائية
 * - صفحات A4 طولية باتجاه RTL، بنفس هوية السندات (الترويسة والخط والتوقيعات والختم)
 * - يُستخدم في الواجهة (نافذة الطباعة والمعاينة) وفي الخادم (PDF عبر puppeteer)
 * - التوقيعات والختم لا تظهر إلا بعد اعتماد المدير (معتمد / تم الصرف)
 * - جميع النصوص المُدخلة من المستخدم تُهرّب قبل إدراجها في HTML
 * - تنبيهات الحساب (calculation.warnings) للمراجعة الداخلية فقط ولا تُطبع أبداً
 */

import { SIGNATURES, isPlaceholderValue, type CompanyInfo } from "./branding";
import {
  END_OF_SERVICE_DOCUMENT_TITLES,
  END_OF_SERVICE_PAYMENT_METHODS,
  END_OF_SERVICE_REASON_LABELS,
  getEndOfServiceStatusLabel,
  isEndOfServiceSigned,
  parseDateOnly,
  type EndOfServiceDeductionItem,
  type EndOfServiceDocumentData,
  type EndOfServiceDocumentKind,
  type EndOfServiceReason,
} from "./endOfService";
import {
  escapeHtml,
  formatVoucherAmount,
  formatVoucherDate,
  formatVoucherDateTime,
} from "./vouchers";
import {
  autoPrintScript,
  bilingualHtml as bi,
  logoImgHtml,
  printFontFaceCss,
  resolveDocumentCompany,
  resolveVoucherAssets,
  textOrBlank,
  type ResolvedVoucherAssets,
  type VoucherTemplateAssets,
} from "./voucherTemplate";

export type EndOfServiceTemplateAssets = VoucherTemplateAssets;

export interface EndOfServiceTemplateOptions {
  /** أساس روابط الصور (مثال: window.location.origin). يُتجاهل للصور المُمررة صراحةً في assets */
  assetBaseUrl?: string;
  /** صور مُمررة صراحةً (مثل data URIs في الخادم) */
  assets?: EndOfServiceTemplateAssets;
  /** تجاوز بيانات المنشأة (الافتراضي: مؤسسة فرع الموظف) */
  company?: Partial<CompanyInfo>;
  /** إضافة سكربت طباعة تلقائية بعد تحميل الصفحة */
  autoPrint?: boolean;
  /** وقت الطباعة (للاختبارات) */
  printedAt?: Date;
}

// ==================== أدوات مساعدة ====================

const ACCENT = "#1f3a5f";
const ACCENT_SOFT = "#eef3f9";
const GOLD = "#b08d57";
const NEGATIVE = "#8b1e1e";
/** خط المستندات: يُعرَّف بوزن عادي حتى يُولّد المتصفح الخط العريض من الملف الوحيد المتوفر */
const FONT_FAMILY = "EosArabic";

const WEEKDAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

/** اسم اليوم بالعربية لتاريخ YYYY-MM-DD (أو null إن كان التاريخ غير صالح) */
export function arabicWeekdayName(
  ymd: string | null | undefined
): string | null {
  const d = parseDateOnly(ymd);
  if (!d) return null;
  return WEEKDAYS_AR[
    new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay()
  ];
}

const esc = escapeHtml;

/** القيمة نصاً بعد التقليم، أو null إن كانت فارغة */
function present(value: unknown): string | null {
  const s = value === null || value === undefined ? "" : String(value).trim();
  return s ? s : null;
}

/** تاريخ DD/MM/YYYY (أو "-" إن كان فارغاً أو تاريخاً مستحيلاً مثل 2026-13-01) */
function dateText(value: Date | string | null | undefined): string {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value.trim()) &&
    !parseDateOnly(value)
  )
    return "-";
  return formatVoucherDate(value);
}

/** تاريخ ميلادي داخل النص: DD/MM/YYYYم */
function proseDate(value: Date | string | null | undefined): string {
  const s = dateText(value);
  return s === "-" ? "-" : `${s}م`;
}

/** عدد أيام: صحيح كما هو، وإلا برقمين عشريين بدون أصفار زائدة */
function formatDays(value: number): string {
  const n = Number(value) || 0;
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, "");
}

function money(value: unknown): string {
  return formatVoucherAmount(value);
}

function statusKey(status: string): string {
  return /^[a-z_]+$/.test(status) ? status : "unknown";
}

function reasonLabel(reason: string): string {
  return (
    END_OF_SERVICE_REASON_LABELS[reason as EndOfServiceReason]?.ar ?? reason
  );
}

interface DocContext {
  data: EndOfServiceDocumentData;
  company: CompanyInfo;
  assets: ResolvedVoucherAssets;
  status: string;
  signed: boolean;
  cancelled: boolean;
  printedAt: Date;
}

function buildContext(
  data: EndOfServiceDocumentData,
  options: EndOfServiceTemplateOptions
): DocContext {
  const status = String(data.status || "draft");
  const company = resolveDocumentCompany(data.branchName, options.company);
  return {
    data,
    company,
    assets: resolveVoucherAssets(options, company),
    status,
    signed: isEndOfServiceSigned(status),
    cancelled: status === "cancelled",
    printedAt: options.printedAt ?? new Date(),
  };
}

// ==================== الأجزاء المشتركة ====================

function renderLetterhead(ctx: DocContext): string {
  const c = ctx.company;
  const shown = (v: string | null | undefined) =>
    !isPlaceholderValue(v) ? esc(String(v).trim()) : "";
  // العنوان والهاتف والرقم الموحد والضريبي في سطر واحد (لا يزيد طول الترويسة)
  const metaAr = [shown(c.address), shown(c.phone), shown(c.cr), shown(c.vat)]
    .filter(Boolean)
    .join(" &nbsp;|&nbsp; ");
  const email = shown(c.email);
  const subtitle = present(c.subtitle);
  return `
    <header class="letterhead">
      <div class="lh-side lh-ar">
        <div class="lh-name">${esc(c.nameAr)}</div>
        ${subtitle ? `<div class="lh-sub">${esc(subtitle)}</div>` : ""}
        ${metaAr ? `<div class="lh-meta">${metaAr}</div>` : ""}
      </div>
      ${ctx.assets.logo ? `<div class="lh-logo">${logoImgHtml(ctx.assets.logo, "lh-logo-img")}</div>` : ""}
      <div class="lh-side lh-en">
        ${present(c.name) ? `<div class="lh-name">${esc(c.name)}</div>` : ""}
        ${email ? `<div class="lh-meta">${email}</div>` : ""}
      </div>
    </header>`;
}

function renderWatermark(ctx: DocContext): string {
  if (ctx.cancelled) return `<div class="watermark cancelled">ملغاة</div>`;
  if (!ctx.signed)
    return `<div class="watermark draft">مسودة - غير معتمدة</div>`;
  return "";
}

function renderCancelBox(ctx: DocContext): string {
  if (!ctx.cancelled) return "";
  const d = ctx.data;
  return `
    <div class="cancel-box">
      <b>سبب الإلغاء:</b> ${textOrBlank(d.cancellationReason)}
      ${present(d.cancelledByName) ? ` &nbsp;|&nbsp; <b>ألغيت بواسطة:</b> ${esc(present(d.cancelledByName))}` : ""}
      ${d.cancelledAt ? ` &nbsp;|&nbsp; ${esc(formatVoucherDateTime(d.cancelledAt))}` : ""}
    </div>`;
}

function pendingText(ctx: DocContext): string {
  return ctx.cancelled ? "ملغاة" : "بانتظار الاعتماد";
}

/** كتلة توقيع (المدير العام / المشرف العام) مع الختم فوق كتلة المدير بعد الاعتماد */
function renderSigner(
  ctx: DocContext,
  key: "manager" | "supervisor",
  withStamp: boolean
): string {
  const info = SIGNATURES[key];
  const img =
    key === "manager"
      ? ctx.assets.managerSignature
      : ctx.assets.supervisorSignature;
  let area: string;
  if (ctx.signed) {
    area = `<img class="sig-img" src="${esc(img)}" alt="${esc(info.name)}" />`;
    if (withStamp)
      area += `<img class="stamp-img" src="${esc(ctx.assets.stamp)}" alt="${esc(SIGNATURES.stamp.label)}" />`;
  } else {
    area = `<div class="sig-pending">${pendingText(ctx)}</div>`;
    if (withStamp) area += `<div class="stamp-placeholder">الختم</div>`;
  }
  return `
      <div class="sig sig-${key}">
        <div class="sig-title">${bi(esc(info.title), esc(info.titleEn))}</div>
        <div class="sig-area">${area}</div>
        <div class="sig-line"></div>
        <div class="sig-name">${esc(info.name)}</div>
        <div class="sig-name-en">${esc(info.nameEn)}</div>
      </div>`;
}

function renderFooter(ctx: DocContext, kind: EndOfServiceDocumentKind): string {
  const title = END_OF_SERVICE_DOCUMENT_TITLES[kind].ar;
  return `
    <footer class="doc-footer">
      <span>${esc(ctx.company.nameAr)}${present(ctx.company.name) ? ` - ${esc(ctx.company.name)}` : ""}</span>
      <span>${esc(title)} &nbsp;|&nbsp; رقم المستند: <b class="ltr">${esc(ctx.data.settlementNumber)}</b></span>
      <span>تاريخ الطباعة: <span class="ltr">${esc(formatVoucherDateTime(ctx.printedAt))}</span></span>
    </footer>`;
}

function renderDocument(
  ctx: DocContext,
  kind: EndOfServiceDocumentKind,
  body: string,
  autoPrint: boolean | undefined
): string {
  const title = END_OF_SERVICE_DOCUMENT_TITLES[kind];
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(title.ar)} - ${esc(ctx.data.employeeName)} - ${esc(ctx.data.settlementNumber)}</title>
  <style>${STYLES(printFontFaceCss(ctx.assets.font, FONT_FAMILY, "normal"))}</style>
</head>
<body>
  ${renderWatermark(ctx)}
  <div class="sheet doc-${kind} status-${statusKey(ctx.status)}">
    ${renderLetterhead(ctx)}
    ${body}
    <div class="push"></div>
    ${renderFooter(ctx, kind)}
  </div>
  ${autoPrint ? autoPrintScript() : ""}
</body>
</html>`;
}

// ==================== الخطاب ====================

/** خطاب إشعار انتهاء عقد العمل وعدم التجديد (صفحة A4 كاملة RTL) */
export function renderEndOfServiceLetterHtml(
  data: EndOfServiceDocumentData,
  options: EndOfServiceTemplateOptions = {}
): string {
  const ctx = buildContext(data, options);
  const title = END_OF_SERVICE_DOCUMENT_TITLES.letter;
  const companyAr = `<strong>${esc(ctx.company.nameAr)}</strong>`;
  const strong = (v: string) => `<strong>${v}</strong>`;

  const info: Array<[string, string | null]> = [
    ["الرقم الوظيفي", present(data.employeeCode)],
    ["الجنسية", present(data.nationality)],
    ["رقم الهوية / الإقامة", present(data.idNumber)],
    ["المسمى الوظيفي", present(data.position)],
    ["الفرع", present(data.branchName)],
  ];
  const infoCells = info
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(
      ([label, value]) =>
        `<div class="cell"><div class="lbl">${label}</div><div class="val">${esc(value)}</div></div>`
    )
    .join("");

  const weekday = arabicWeekdayName(data.lastWorkingDay);
  const lastDay = strong(esc(proseDate(data.lastWorkingDay)));
  const lastDayText = weekday
    ? `يوم ${strong(weekday)} الموافق ${lastDay}`
    : lastDay;

  const body = `
    <div class="doc-title">
      <h1>${esc(title.ar)}</h1>
      <h2>${esc(title.en.toUpperCase())}</h2>
      <div class="title-rule"></div>
    </div>

    <div class="ref-bar">
      <span>الرقم: <b class="ltr">${esc(data.settlementNumber)}</b></span>
      <span>التاريخ: <b>${esc(proseDate(data.letterDate))}</b></span>
      <span>المرفقات: <b>${esc(END_OF_SERVICE_DOCUMENT_TITLES.settlement.ar)}</b></span>
    </div>

    <main class="letter-body">
      <div class="addressee">
        <span>المكرم / <strong>${esc(data.employeeName)}</strong></span>
        <span>المحترم</span>
      </div>
      ${infoCells ? `<div class="emp-info">${infoCells}</div>` : ""}

      <p class="greeting">السلام عليكم ورحمة الله وبركاته، وبعد:</p>
      <p class="subject"><span>الموضوع: إشعار بانتهاء عقد العمل وعدم تجديده</span></p>

      <p class="para">تود ${companyAr} إحاطتكم علماً بأن عقد العمل المبرم معكم، والذي بدأ اعتباراً من تاريخ ${strong(esc(proseDate(data.hireDate)))}، تنتهي مدته بتاريخ ${strong(esc(proseDate(data.contractEndDate)))}، وقد قررت المنشأة عدم تجديده بعد انتهاء مدته، وذلك وفقاً لأحكام نظام العمل في المملكة العربية السعودية ولائحته التنفيذية.</p>

      <p class="para">وبناءً عليه، يكون آخر يوم عمل لكم لدى المنشأة هو ${lastDayText}، وتنتهي العلاقة التعاقدية بانتهاء هذا اليوم.</p>

      <p class="para">وستُصرف لكم كامل مستحقاتكم النظامية، والتي تشمل مكافأة نهاية الخدمة عن مدة خدمتكم البالغة (${strong(esc(data.calculation.serviceText))})، والأجر المستحق حتى آخر يوم عمل، بعد خصم ما قد يكون عليكم من التزامات للمنشأة، وذلك وفق المخالصة النهائية المرفقة وخلال المدة المحددة نظاماً.</p>

      <p class="para tight">ونأمل منكم التكرم بما يلي قبل آخر يوم عمل:</p>
      <ol class="duties">
        <li>تسليم جميع العُهد والممتلكات الخاصة بالمنشأة (الأجهزة، المفاتيح، البطاقات، المستندات) إلى الإدارة.</li>
        <li>استكمال إجراءات إخلاء الطرف مع الإدارة المختصة.</li>
        <li>تسليم ما لديكم من أعمال ومهام قائمة إلى من تحدده الإدارة.</li>
      </ol>

      <p class="para">ويحق لكم الحصول على شهادة خدمة توضح مدة عملكم ومهنتكم وآخر أجر تقاضيتموه، وذلك عند طلبها.</p>

      <p class="para">وتتقدم إدارة المنشأة لكم بخالص الشكر والتقدير على ما بذلتموه من جهود خلال فترة عملكم، متمنين لكم دوام التوفيق والنجاح.</p>

      <p class="closing">وتقبلوا خالص التحية والتقدير،،</p>
    </main>

    ${renderCancelBox(ctx)}

    <section class="sign-row two">
      ${renderSigner(ctx, "supervisor", false)}
      ${renderSigner(ctx, "manager", true)}
    </section>

    <section class="ack">
      <div class="ack-text"><b>إقرار استلام:</b> أقر أنا الموقع أدناه بأنني استلمت أصل هذا الإشعار وعلمت بما ورد فيه.</div>
      <div class="ack-fields">
        <div class="ack-field"><span>الاسم:</span> <span class="blank">${esc(data.employeeName)}</span></div>
        <div class="ack-field"><span>التوقيع:</span> <span class="blank">&nbsp;</span></div>
        <div class="ack-field short"><span>التاريخ:</span> <span class="blank">&nbsp;</span></div>
      </div>
    </section>`;

  return renderDocument(ctx, "letter", body, options.autoPrint);
}

// ==================== المخالصة النهائية ====================

function deductionRows(
  items: EndOfServiceDeductionItem[],
  tag: string
): string {
  return items
    .map(
      item => `
          <tr>
            <td><span class="tag">${tag}</span> ${esc(item.label)}</td>
            <td class="calc">${item.date ? esc(dateText(item.date)) : "-"}</td>
            <td class="amt">${money(item.amount)}</td>
          </tr>`
    )
    .join("");
}

function renderEntitlements(data: EndOfServiceDocumentData): string {
  const c = data.calculation;
  // صيغة تُعيد إنتاج المبلغ: الأيام × (الأجر ÷ 30) بدل أجر يوم مقرّب
  const perDay = `(${money(c.monthlyWage)} ÷ 30)`;

  let salaryDetail = "";
  if (c.salaryDaysIsManual) {
    salaryDetail = present(data.salaryNote)
      ? `(${esc(present(data.salaryNote))})`
      : "(عدد أيام معتمد يدوياً)";
  } else if (c.salaryFromDate && c.salaryDays > 0) {
    salaryDetail = `من ${esc(dateText(c.salaryFromDate))} حتى ${esc(dateText(data.lastWorkingDay))}`;
  } else if (c.salaryCoveredByPayroll) {
    salaryDetail = "(مصروف ضمن مسير الرواتب)";
  }

  const otherRow =
    c.otherAdditions > 0
      ? `
          <tr>
            <td>مستحقات أخرى</td>
            <td class="calc">${present(data.otherAdditionsNote) ? esc(present(data.otherAdditionsNote)) : "-"}</td>
            <td class="amt">${money(c.otherAdditions)}</td>
          </tr>`
      : "";

  return `
    <section class="sec">
      <table class="fin">
        <thead>
          <tr>
            <th class="col-item">${bi("المستحقات", "Entitlements")}</th>
            <th class="col-calc">${bi("طريقة الحساب", "Calculation")}</th>
            <th class="col-amt">${bi("المبلغ", "SAR")}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>مكافأة نهاية الخدمة</td>
            <td class="calc"><div>مبلغ ثابت حسب سياسة المنشأة</div><div class="sub">عن مدة الخدمة: ${esc(c.serviceText)}</div></td>
            <td class="amt">${money(c.eosAward)}</td>
          </tr>
          <tr>
            <td>الأجر المستحق حتى آخر يوم عمل</td>
            <td class="calc"><div>${formatDays(c.salaryDays)} يوم × ${perDay}</div>${salaryDetail ? `<div class="sub">${salaryDetail}</div>` : ""}</td>
            <td class="amt">${money(c.salaryDue)}</td>
          </tr>${otherRow}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">إجمالي المستحقات</td>
            <td class="amt">${money(c.totalEntitlements)}</td>
          </tr>
        </tfoot>
      </table>
    </section>`;
}

function renderDeductions(data: EndOfServiceDocumentData): string {
  const c = data.calculation;
  let rows =
    deductionRows(data.advances ?? [], "سلفة") +
    deductionRows(data.violations ?? [], "مخالفة");
  if (c.otherDeductions > 0) {
    rows += `
          <tr>
            <td>خصومات أخرى</td>
            <td class="calc">${present(data.otherDeductionsNote) ? esc(present(data.otherDeductionsNote)) : "-"}</td>
            <td class="amt">${money(c.otherDeductions)}</td>
          </tr>`;
  }
  if (!rows) {
    rows = `
          <tr>
            <td colspan="3" class="empty">لا توجد خصومات</td>
          </tr>`;
  }
  return `
    <section class="sec">
      <table class="fin">
        <thead>
          <tr>
            <th class="col-item">${bi("الخصومات", "Deductions")}</th>
            <th class="col-calc">${bi("التاريخ والتفاصيل", "Details")}</th>
            <th class="col-amt">${bi("المبلغ", "SAR")}</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2">إجمالي الخصومات</td>
            <td class="amt">${money(c.totalDeductions)}</td>
          </tr>
        </tfoot>
      </table>
    </section>`;
}

function renderDeclaration(ctx: DocContext): string {
  const d = ctx.data;
  const c = d.calculation;
  const name = `<strong>${esc(d.employeeName)}</strong>`;
  const idClause = present(d.idNumber)
    ? `، رقم الهوية / الإقامة (<strong>${esc(present(d.idNumber))}</strong>)`
    : "";
  const company = `<strong>${esc(ctx.company.nameAr)}</strong>`;
  const amount = `<strong>${money(Math.abs(c.netAmount))} ريال سعودي</strong>`;
  const words = esc(c.netAmountWords);

  const period = `عن كامل مدة خدمتي لديها من تاريخ <strong>${esc(proseDate(d.hireDate))}</strong> حتى تاريخ <strong>${esc(proseDate(d.lastWorkingDay))}</strong>`;
  let text: string;
  if (c.netAmount >= 0) {
    text = `أقر أنا الموقع أدناه / ${name}${idClause}، بأنني استلمت من ${company} كامل مستحقاتي العمالية ${period}، بما في ذلك مكافأة نهاية الخدمة والأجور وجميع البدلات، بمبلغ صافٍ وقدره (${amount}) ${words}، وأنه لم يعد لي أي حق أو مطالبة من أي نوع قِبَل المنشأة، وأبرئ ذمتها إبراءً عاماً شاملاً نهائياً.`;
  } else if (ctx.status === "paid") {
    // صافٍ سالب تم تحصيله: الموظف سدّد المتبقي عليه
    text = `أقر أنا الموقع أدناه / ${name}${idClause}، بأنه بعد تسوية جميع مستحقاتي العمالية ${period} مع ما عليّ من التزامات، قد سددت لـ${company} المتبقي عليّ وقدره (${amount}) ${words}، وبذلك لم يعد لأي من الطرفين حق أو مطالبة قِبَل الآخر.`;
  } else {
    text = `أقر أنا الموقع أدناه / ${name}${idClause}، بأن ذمتي مشغولة للمنشأة بمبلغ وقدره (${amount}) ${words} بعد تسوية جميع مستحقاتي، وأتعهد بسداده.`;
  }

  return `
    <section class="declaration">
      <div class="sec-title">${bi("إقرار ومخالصة نهائية", "Final Release Declaration")}</div>
      <div class="fingerprint"><span>البصمة</span></div>
      <p class="decl-text">${text}</p>
      <div class="emp-fields">
        <div class="ack-field"><span>اسم الموظف:</span> <span class="blank">${esc(d.employeeName)}</span></div>
        <div class="ack-field"><span>التوقيع:</span> <span class="blank">&nbsp;</span></div>
        <div class="ack-field short"><span>التاريخ:</span> <span class="blank">&nbsp;</span></div>
      </div>
    </section>`;
}

function renderSettlementSignatures(ctx: DocContext): string {
  const d = ctx.data;
  const preparedBy = `
      <div class="sig sig-prepared">
        <div class="sig-title">${bi("أعدّه", "Prepared By")}</div>
        <div class="sig-area"></div>
        <div class="sig-line"></div>
        <div class="sig-name">${textOrBlank(d.createdByName)}</div>
        <div class="sig-name-en">${d.createdAt ? esc(formatVoucherDateTime(d.createdAt)) : "&nbsp;"}</div>
      </div>`;

  let note = "";
  if (ctx.signed) {
    const approved = `اعتُمدت بواسطة ${esc(present(d.approvedByName) ?? SIGNATURES.manager.title)}${d.approvedAt ? ` بتاريخ ${esc(formatVoucherDateTime(d.approvedAt))}` : ""}`;
    const paidWord = d.calculation.netAmount < 0 ? "تم التحصيل" : "تم الصرف";
    const paid =
      ctx.status === "paid"
        ? ` &nbsp;|&nbsp; ${paidWord}${present(d.paidByName) ? ` بواسطة ${esc(present(d.paidByName))}` : ""}${d.paidAt ? ` بتاريخ ${esc(formatVoucherDateTime(d.paidAt))}` : ""}`
        : "";
    note = `<div class="approval-note">&#10004; ${approved}${paid}</div>`;
  }

  return `
    <section class="sign-row three">
      ${preparedBy}
      ${renderSigner(ctx, "supervisor", false)}
      ${renderSigner(ctx, "manager", true)}
    </section>
    ${note}`;
}

/** المخالصة النهائية وإبراء الذمة (صفحة A4 كاملة RTL) */
export function renderFinalSettlementHtml(
  data: EndOfServiceDocumentData,
  options: EndOfServiceTemplateOptions = {}
): string {
  const ctx = buildContext(data, options);
  const c = data.calculation;
  const title = END_OF_SERVICE_DOCUMENT_TITLES.settlement;
  const negative = c.netAmount < 0;
  // صافٍ سالب: "الصرف" يعني تحصيل المبلغ من الموظف
  const statusLabel =
    ctx.status === "paid" && negative
      ? { ar: "تم التحصيل", en: "Collected" }
      : getEndOfServiceStatusLabel(ctx.status);
  const payWord = negative ? "التحصيل" : "الصرف";

  const cell = (label: string, value: unknown, cls = "") =>
    `<div class="cell${cls ? ` ${cls}` : ""}"><div class="lbl">${label}</div><div class="val">${present(value) ? esc(present(value)) : "-"}</div></div>`;

  const paymentMethod = present(data.paymentMethod);
  const payment =
    ctx.status === "paid"
      ? `
    <div class="payment-line">
      <span><b>طريقة ${payWord}:</b> ${paymentMethod ? esc(END_OF_SERVICE_PAYMENT_METHODS[paymentMethod]?.ar ?? paymentMethod) : "-"}</span>
      <span><b>المرجع:</b> ${present(data.paymentReference) ? esc(present(data.paymentReference)) : "-"}</span>
      ${data.paidAt ? `<span><b>تاريخ ${payWord}:</b> ${esc(formatVoucherDateTime(data.paidAt))}</span>` : ""}
    </div>`
      : "";

  const notes = present(data.notes)
    ? `
    <div class="notes"><b>ملاحظات:</b> ${esc(present(data.notes))}</div>`
    : "";

  const body = `
    <div class="title-row">
      <div class="info-box">
        <div class="lbl">${bi("رقم المخالصة", "Settlement No.")}</div>
        <div class="val ltr">${esc(data.settlementNumber)}</div>
      </div>
      <div class="doc-title compact">
        <h1>${esc(title.ar)}</h1>
        <h2>${esc(title.en.toUpperCase())}</h2>
      </div>
      <div class="info-box">
        <div class="lbl">${bi("التاريخ", "Date")}</div>
        <div class="val">${esc(dateText(data.letterDate))}</div>
        <div class="badge-wrap"><span class="status-badge status-${statusKey(ctx.status)}">${esc(statusLabel.ar)}</span></div>
      </div>
    </div>

    <section class="sec">
      <div class="sec-title">${bi("بيانات الموظف", "Employee Details")}</div>
      <div class="grid">
        ${cell("اسم الموظف", data.employeeName, "span2 strong")}
        ${cell("الرقم الوظيفي", data.employeeCode)}
        ${cell("الجنسية", data.nationality)}
        ${cell("رقم الهوية / الإقامة", data.idNumber)}
        ${cell("المسمى الوظيفي", data.position)}
        ${cell("الفرع", data.branchName)}
        ${cell("تاريخ المباشرة", dateText(data.hireDate))}
        ${cell("تاريخ انتهاء العقد", dateText(data.contractEndDate))}
        ${cell("آخر يوم عمل", dateText(data.lastWorkingDay))}
        ${cell("سبب انتهاء الخدمة", reasonLabel(String(data.reason ?? "")), "span2")}
        ${cell("مدة الخدمة", `${c.serviceText} (${c.service.totalDays} يوماً)`, "span3 strong")}
      </div>
    </section>

    <section class="sec basis">
      <div class="basis-title">${bi("أساس الحساب", "Basis")}</div>
      <div class="basis-item"><span class="lbl">الأجر الأساسي</span> <b>${money(data.baseSalary)}</b></div>
      <div class="basis-item"><span class="lbl">البدلات الثابتة</span> <b>${money(data.fixedAllowances)}</b></div>
      <div class="basis-item main"><span class="lbl">الأجر الشهري المعتمد</span> <b>${money(c.monthlyWage)}</b></div>
      <div class="basis-item"><span class="lbl">أجر اليوم (الأجر ÷ 30)</span> <b>${money(c.dailyWage)}</b></div>
    </section>

    ${renderEntitlements(data)}
    ${renderDeductions(data)}

    <div class="net${negative ? " negative" : ""}">
      <div class="net-lbl">${negative ? "صافي المستحق على الموظف" : "صافي المستحق للموظف"}</div>
      <div class="net-val"><span class="ltr">${money(Math.abs(c.netAmount))}</span><small>ريال سعودي</small></div>
      <div class="net-words">${esc(c.netAmountWords)}</div>
    </div>
    ${payment}
    ${notes}
    ${renderCancelBox(ctx)}
    <div class="closing-block">
      ${renderDeclaration(ctx)}
      ${renderSettlementSignatures(ctx)}
    </div>`;

  return renderDocument(ctx, "settlement", body, options.autoPrint);
}

/** اختيار القالب حسب نوع المستند */
export function renderEndOfServiceDocumentHtml(
  kind: EndOfServiceDocumentKind,
  data: EndOfServiceDocumentData,
  options: EndOfServiceTemplateOptions = {}
): string {
  return kind === "letter"
    ? renderEndOfServiceLetterHtml(data, options)
    : renderFinalSettlementHtml(data, options);
}

// ==================== التنسيق ====================

const STYLES = (fontFace: string) => `
  ${fontFace}
  @page { size: A4; margin: 10mm 11mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #ffffff; }
  body {
    font-family: '${FONT_FAMILY}', 'VoucherArabic', 'Tajawal', 'Noto Sans Arabic', 'Segoe UI', Tahoma, Arial, sans-serif;
    color: #111111; font-size: 11.5px; line-height: 1.55; direction: rtl;
    -webkit-print-color-adjust: exact; print-color-adjust: exact;
  }
  .ltr { direction: ltr; unicode-bidi: isolate; }
  .ar { display: inline; unicode-bidi: isolate; }
  .sep { color: #999; }
  .en { display: inline; direction: ltr; unicode-bidi: isolate; color: #5b6573; font-size: 0.82em; font-weight: normal; }

  /* الصفحة: عند الطباعة الهوامش من @page، والتذييل يُدفع لأسفل الصفحة */
  .sheet { position: relative; display: flex; flex-direction: column; min-height: 276mm; }
  @media screen {
    html, body { background: #e9ecf1; }
    .sheet { width: 210mm; max-width: 100%; min-height: 297mm; margin: 12px auto; padding: 10mm 11mm; background: #ffffff; box-shadow: 0 2px 14px rgba(15, 23, 42, 0.18); }
  }

  .watermark {
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-32deg);
    font-size: 70px; font-weight: 700; white-space: nowrap; pointer-events: none; z-index: 20; letter-spacing: 2px;
  }
  .watermark.draft { color: rgba(15, 23, 42, 0.07); }
  .watermark.cancelled { color: rgba(185, 28, 28, 0.14); font-size: 110px; }

  /* الترويسة */
  .letterhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-bottom: 7px; border-bottom: 3px double ${ACCENT}; }
  .lh-side { flex: 1; min-width: 0; }
  .lh-ar { text-align: right; }
  .lh-en { text-align: left; direction: ltr; }
  .lh-name { font-size: 17px; font-weight: 700; color: ${ACCENT}; line-height: 1.3; }
  .lh-en .lh-name { letter-spacing: 0.6px; }
  .lh-sub { font-size: 10.5px; color: #3f4753; }
  .lh-meta { font-size: 9.5px; color: #5b6573; }
  .lh-logo img { width: 62px; height: 62px; object-fit: contain; display: block; }

  .doc-title { text-align: center; margin: 12px 0 8px; }
  .doc-title h1 { font-size: 20px; font-weight: 700; color: ${ACCENT}; line-height: 1.35; }
  .doc-title h2 { font-size: 10px; font-weight: 600; letter-spacing: 2.4px; color: #5b6573; direction: ltr; }
  .title-rule { width: 110px; height: 2px; background: ${GOLD}; margin: 5px auto 0; }

  /* الخطاب */
  .ref-bar { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 16px; padding: 5px 10px; margin-bottom: 12px; background: ${ACCENT_SOFT}; border-right: 4px solid ${ACCENT}; border-radius: 3px; font-size: 11px; }
  .letter-body { font-size: 12.5px; line-height: 1.85; }
  .addressee { display: flex; justify-content: space-between; align-items: baseline; font-size: 14px; font-weight: 700; margin-bottom: 6px; }
  .emp-info { display: flex; flex-wrap: wrap; border: 1px solid #cfd6df; border-radius: 4px; margin-bottom: 10px; overflow: hidden; }
  .emp-info .cell { flex: 1 1 0; min-width: 28mm; padding: 2px 8px 3px; border-left: 1px solid #cfd6df; line-height: 1.45; }
  .emp-info .cell:last-child { border-left: none; }
  .emp-info .lbl { font-size: 9px; color: #5b6573; }
  .emp-info .val { font-size: 11.5px; font-weight: 700; }
  .greeting { font-weight: 700; margin-bottom: 2px; }
  .subject { text-align: center; font-weight: 700; font-size: 13.5px; margin: 4px 0 8px; }
  .subject span { border-bottom: 1.5px solid ${ACCENT}; padding-bottom: 1px; }
  .para { text-align: justify; margin-bottom: 6px; }
  .para.tight { margin-bottom: 1px; }
  .duties { padding-inline-start: 24px; margin-bottom: 6px; }
  .duties li { margin-bottom: 1px; }
  .closing { text-align: center; font-weight: 700; margin-top: 8px; }

  /* التوقيعات */
  .sign-row { display: flex; justify-content: space-between; gap: 10px; margin-top: 12px; break-inside: avoid; page-break-inside: avoid; }
  .sign-row.two .sig { flex: 0 0 68mm; }
  .sign-row.three .sig { flex: 1 1 0; }
  .sig { text-align: center; }
  .sig-title { font-size: 11px; font-weight: 700; }
  .sig-title .sep { display: none; }
  .sig-title .en { display: block; }
  .sig-area { position: relative; height: 70px; display: flex; align-items: center; justify-content: center; }
  /* صور التوقيع فيها مساحات شفافة كبيرة: نعرض الشريط الأوسط الذي يحتوي التوقيع */
  .sig-img { width: 150px; height: 64px; object-fit: cover; object-position: center; position: relative; z-index: 2; }
  .stamp-img { position: absolute; left: -16px; bottom: -16px; width: 132px; height: 132px; transform: rotate(-10deg); object-fit: contain; opacity: 0.9; z-index: 1; }
  .sig-pending { font-size: 10px; color: #8a8f98; border: 1px dashed #b9bec7; border-radius: 4px; padding: 4px 10px; }
  .stamp-placeholder { position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 76px; height: 76px; border: 1.5px dashed #c3c8d0; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9.5px; color: #9aa0a9; }
  .sig-line { border-bottom: 1px solid #333; margin: 2px 12px 3px; }
  .sig-name { font-size: 11.5px; font-weight: 700; }
  .sig-name-en { font-size: 9.5px; color: #5b6573; direction: ltr; }
  .approval-note { margin-top: 5px; text-align: center; font-size: 10.5px; color: #065f46; font-weight: 700; }

  .ack { margin-top: 12px; padding: 7px 10px 8px; border: 1px dashed #7b8390; border-radius: 4px; break-inside: avoid; page-break-inside: avoid; }
  .ack-text { font-size: 11.5px; }
  .ack-fields { display: flex; gap: 14px; margin-top: 10px; }
  .ack-field { flex: 1; display: flex; align-items: flex-end; gap: 5px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  .ack-field.short { flex: 0.7; }
  .ack-field .blank { flex: 1; min-width: 0; border-bottom: 1px solid #333; min-height: 19px; padding: 0 4px; font-weight: 600; white-space: normal; }

  .cancel-box { margin-top: 8px; padding: 6px 9px; border: 1.5px solid #ef4444; background: #fef2f2; color: #7f1d1d; border-radius: 4px; font-size: 11px; break-inside: avoid; }

  /* فاصل مرن يدفع التذييل لأسفل الصفحة مع مسافة دنيا عن المحتوى */
  .push { flex: 1 0 10px; }
  .doc-footer { padding-top: 5px; border-top: 1px solid #cfd6df; display: flex; justify-content: space-between; gap: 10px; font-size: 9px; color: #5b6573; }
  .doc-footer .ltr { white-space: nowrap; }

  /* المخالصة: مضغوطة لتتسع في صفحة واحدة للحالات المعتادة */
  .doc-settlement .lh-logo img { width: 50px; height: 50px; }
  .doc-settlement .lh-name { font-size: 15.5px; }
  .doc-settlement .letterhead { padding-bottom: 5px; }
  .title-row { display: flex; align-items: stretch; justify-content: space-between; gap: 10px; margin: 7px 0 6px; }
  .info-box { width: 26%; border: 1.5px solid ${ACCENT}; border-radius: 6px; text-align: center; overflow: hidden; }
  .info-box .lbl { background: ${ACCENT}; color: #fff; font-size: 10px; padding: 1px 4px; }
  .info-box .lbl .en, .info-box .lbl .sep { color: #dbe3ee; }
  .info-box .val { font-size: 13px; font-weight: 700; padding: 2px 4px 0; letter-spacing: 0.5px; }
  .info-box .badge-wrap { padding-bottom: 2px; }
  .doc-title.compact { flex: 1; margin: 0; align-self: center; }
  .doc-title.compact h1 { font-size: 19px; }
  .status-badge { display: inline-block; padding: 0 8px; border-radius: 10px; font-size: 10px; font-weight: 700; border: 1px solid #999; }
  .status-badge.status-draft { background: #fff7ed; border-color: #f59e0b; color: #92400e; }
  .status-badge.status-approved, .status-badge.status-paid { background: #ecfdf5; border-color: #10b981; color: #065f46; }
  .status-badge.status-cancelled { background: #fef2f2; border-color: #ef4444; color: #991b1b; }

  .sec { margin-bottom: 6px; break-inside: avoid; page-break-inside: avoid; }
  .sec-title { font-size: 11.5px; font-weight: 700; color: ${ACCENT}; border-bottom: 1.5px solid ${ACCENT}; padding-bottom: 1px; margin-bottom: 3px; }
  .grid { display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid #cfd6df; border-right: 1px solid #cfd6df; }
  .grid .cell { border-left: 1px solid #cfd6df; border-bottom: 1px solid #cfd6df; padding: 1px 7px 2px; line-height: 1.38; min-width: 0; }
  .grid .cell.span2 { grid-column: span 2; }
  .grid .cell.span3 { grid-column: span 3; }
  .grid .lbl { font-size: 9px; color: #5b6573; }
  .grid .val { font-size: 11px; font-weight: 600; overflow-wrap: anywhere; }
  .grid .cell.strong .val { font-weight: 700; }

  .basis { display: flex; align-items: stretch; border: 1px solid #cfd6df; border-radius: 4px; overflow: hidden; background: ${ACCENT_SOFT}; }
  .basis-title { background: ${ACCENT}; color: #fff; font-weight: 700; font-size: 11px; padding: 3px 10px; display: flex; align-items: center; gap: 2px; white-space: nowrap; }
  .basis-title .en, .basis-title .sep { color: #dbe3ee; }
  .basis-item { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 3px 8px; border-left: 1px solid #cfd6df; font-size: 11px; white-space: nowrap; }
  .basis-item:last-child { border-left: none; }
  .basis-item .lbl { font-size: 9.5px; color: #5b6573; }
  .basis-item.main b { color: ${ACCENT}; }

  table.fin { width: 100%; border-collapse: collapse; font-size: 11px; }
  table.fin th { background: ${ACCENT}; color: #fff; padding: 2px 6px; border: 1px solid ${ACCENT}; font-weight: 700; text-align: right; line-height: 1.4; white-space: nowrap; }
  table.fin th .en { color: #dbe3ee; }
  table.fin th .sep { color: #9fb0c6; }
  table.fin th.col-item { width: 36%; }
  table.fin th.col-amt { width: 17%; text-align: left; }
  table.fin td { border: 1px solid #cfd6df; padding: 2px 6px; vertical-align: top; line-height: 1.4; }
  table.fin tr { break-inside: avoid; page-break-inside: avoid; }
  table.fin td.amt { text-align: left; direction: ltr; white-space: nowrap; font-weight: 700; }
  table.fin td.calc { color: #222; }
  table.fin td.empty { text-align: center; color: #5b6573; }
  table.fin .sub { font-size: 9.5px; color: #5b6573; }
  table.fin tfoot td { background: ${ACCENT_SOFT}; font-weight: 700; border-top: 2px solid ${ACCENT}; font-size: 11.5px; }
  .tag { display: inline-block; font-size: 9px; font-weight: 700; color: ${ACCENT}; background: ${ACCENT_SOFT}; border: 1px solid #c7d3e3; border-radius: 3px; padding: 0 4px; line-height: 1.5; }

  .net { display: flex; align-items: stretch; border: 2px solid ${ACCENT}; border-radius: 6px; overflow: hidden; margin: 7px 0 6px; break-inside: avoid; page-break-inside: avoid; }
  .net-lbl { background: ${ACCENT}; color: #fff; font-size: 12.5px; font-weight: 700; padding: 5px 12px; display: flex; align-items: center; white-space: nowrap; }
  .net-val { font-size: 18px; font-weight: 700; padding: 3px 12px; white-space: nowrap; display: flex; align-items: center; gap: 5px; border-left: 1px solid #cfd6df; }
  .net-val small { font-size: 10px; font-weight: 600; color: #5b6573; }
  .net-words { flex: 1; padding: 4px 12px; font-size: 11px; font-weight: 600; display: flex; align-items: center; background: ${ACCENT_SOFT}; }
  .net.negative { border-color: ${NEGATIVE}; }
  .net.negative .net-lbl { background: ${NEGATIVE}; }
  .net.negative .net-val { color: ${NEGATIVE}; }

  .payment-line { display: flex; flex-wrap: wrap; gap: 2px 18px; padding: 2px 9px; margin-bottom: 6px; border: 1px solid #10b981; background: #ecfdf5; border-radius: 4px; font-size: 11px; }
  .notes { padding: 2px 9px; margin-bottom: 6px; border: 1px solid #cfd6df; border-radius: 4px; font-size: 10.5px; white-space: pre-wrap; }

  .declaration { display: flow-root; padding: 3px 10px 7px; border: 1.5px solid ${ACCENT}; border-radius: 5px; background: #fbfcfe; break-inside: avoid; page-break-inside: avoid; }
  .decl-text { text-align: justify; font-size: 11px; line-height: 1.7; }
  .emp-fields { display: flex; gap: 14px; margin-top: 8px; }
  .fingerprint { float: left; width: 21mm; height: 23mm; margin: 3px 12px 2px 0; border: 1px dashed #7b8390; border-radius: 4px; background: #ffffff; display: flex; align-items: flex-end; justify-content: center; padding-bottom: 1px; font-size: 9px; color: #7b8390; }
  /* الإقرار وتوقيعات المنشأة كتلة واحدة لا تنقسم بين صفحتين */
  .closing-block { break-inside: avoid; page-break-inside: avoid; }
  .doc-settlement .sign-row { margin-top: 5px; }
  .doc-settlement .approval-note { margin-top: 3px; }
  .doc-settlement .push { flex-basis: 6px; }
  .doc-settlement .sig-area { height: 56px; }
  .doc-settlement .sig-img { height: 54px; width: 136px; }
  .doc-settlement .stamp-img { width: 112px; height: 112px; }
  .doc-settlement .stamp-placeholder { width: 66px; height: 66px; }
`;
