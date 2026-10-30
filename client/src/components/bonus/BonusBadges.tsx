import { Badge } from "@/components/ui/badge";
import { Banknote, CheckCircle, Clock, Send, XCircle, type LucideIcon } from "lucide-react";
import { getBonusStatusLabel, getTierColorHex, getTierDisplayName } from "@shared/bonusHelpers";
import { getReadableTextColor } from "@/lib/bonusUi";

// ألوان وأيقونات حالات البونص
const STATUS_STYLES: Record<string, { className: string; Icon: LucideIcon }> = {
  pending: { className: "bg-gray-500 text-white", Icon: Clock },
  requested: { className: "bg-blue-500 text-white", Icon: Send },
  approved: { className: "bg-green-600 text-white", Icon: CheckCircle },
  rejected: { className: "bg-red-500 text-white", Icon: XCircle },
  paid: { className: "bg-purple-600 text-white", Icon: Banknote },
};

/** شارة حالة البونص (قيد الاحتساب / بانتظار الموافقة / موافق عليه / مرفوض / تم الصرف) */
export function BonusStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  const Icon = style.Icon;
  return (
    <Badge className={`${style.className} gap-1 border-transparent`}>
      <Icon className="h-3 w-3" />
      {getBonusStatusLabel(status)}
    </Badge>
  );
}

export type BonusTierLike = {
  tierKey: string;
  tierName?: string | null;
  color?: string | null;
};

/** شارة المستوى: الاسم من الخادم (tierLabel / tierName) واللون من إعدادات المدير */
export function BonusTierBadge({
  tierKey,
  label,
  tiers,
}: {
  tierKey: string | null | undefined;
  label?: string | null;
  tiers?: BonusTierLike[] | null;
}) {
  const normalized = tiers?.map(t => ({ tierKey: t.tierKey, tierName: t.tierName ?? "", color: t.color ?? undefined })) ?? null;
  const name = label || getTierDisplayName(tierKey, null, normalized);
  const hex = getTierColorHex(tierKey, normalized);
  return (
    <Badge className="border-transparent" style={{ backgroundColor: hex, color: getReadableTextColor(hex) }}>
      {name}
    </Badge>
  );
}
