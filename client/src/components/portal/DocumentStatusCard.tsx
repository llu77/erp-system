/**
 * DocumentStatusCard - Displays document status with visual indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  FileWarning,
  IdCard,
  Heart,
  FileSignature,
  AlertTriangle
} from 'lucide-react';
import { 
  DOCUMENT_STATUS_COLORS, 
  DOCUMENT_TYPE_NAMES 
} from '@/lib/portal/constants';
import { 
  formatDateArabic, 
  getDocumentStatusLabel 
} from '@/lib/portal/utils';
import type { DocumentStatusInfo } from '@/lib/portal/types';

interface DocumentStatusCardProps {
  documents: DocumentStatusInfo[];
  healthScore: number;
  compact?: boolean;
  showProgress?: boolean;
  onDocumentClick?: (type: string) => void;
}

const DOCUMENT_ICONS: Record<string, React.ReactNode> = {
  iqama: <IdCard className="h-5 w-5" />,
  healthCert: <Heart className="h-5 w-5" />,
  contract: <FileSignature className="h-5 w-5" />,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  expired: <AlertCircle className="h-4 w-4 text-red-400" />,
  critical: <AlertTriangle className="h-4 w-4 text-orange-400" />,
  warning: <Clock className="h-4 w-4 text-amber-400" />,
  upcoming: <Clock className="h-4 w-4 text-blue-400" />,
  valid: <CheckCircle2 className="h-4 w-4 text-emerald-400" />,
  missing: <FileWarning className="h-4 w-4 text-slate-400" />,
};

export function DocumentStatusCard({
  documents,
  healthScore,
  compact = false,
  showProgress = true,
  onDocumentClick,
}: DocumentStatusCardProps) {
  // Get health score color
  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-emerald-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Count issues
  const issueCount = documents.filter(d => 
    d.status === 'expired' || d.status === 'critical' || d.status === 'warning'
  ).length;

  if (compact) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`text-2xl font-bold ${getHealthColor(healthScore)}`}>
                {healthScore}%
              </div>
              <div className="text-sm text-slate-400">
                صحة الوثائق
              </div>
            </div>
            {issueCount > 0 && (
              <Badge variant="destructive" className="bg-red-500/20 text-red-400">
                {issueCount} تحتاج اهتمام
              </Badge>
            )}
          </div>
          {showProgress && (
            <div className="mt-3">
              <Progress 
                value={healthScore} 
                className="h-2 bg-slate-700"
              />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">
            حالة الوثائق
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${getHealthColor(healthScore)}`}>
              {healthScore}%
            </span>
          </div>
        </div>
        {showProgress && (
          <Progress 
            value={healthScore} 
            className="h-2 bg-slate-700 mt-2"
          />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.type}
            className={`flex items-center justify-between p-3 rounded-lg bg-slate-900/50 border border-slate-700/50 transition-colors ${
              onDocumentClick ? 'cursor-pointer hover:bg-slate-800/50' : ''
            }`}
            onClick={() => onDocumentClick?.(doc.type)}
          >
            <div className="flex items-center gap-3">
              <div className="text-slate-400">
                {DOCUMENT_ICONS[doc.type]}
              </div>
              <div>
                <div className="font-medium text-white">
                  {DOCUMENT_TYPE_NAMES[doc.type] || doc.name}
                </div>
                <div className="text-sm text-slate-400">
                  {doc.expiryDate 
                    ? formatDateArabic(doc.expiryDate)
                    : 'غير مسجل'
                  }
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {doc.daysRemaining !== null && doc.status !== 'missing' && (
                <span className="text-sm text-slate-400">
                  {doc.daysRemaining <= 0 
                    ? 'منتهي' 
                    : `${doc.daysRemaining} يوم`
                  }
                </span>
              )}
              <Badge 
                className={`${DOCUMENT_STATUS_COLORS[doc.status]} border`}
              >
                <span className="flex items-center gap-1">
                  {STATUS_ICONS[doc.status]}
                  {getDocumentStatusLabel(doc.status)}
                </span>
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * DocumentStatusSummary - Compact summary for dashboard headers
 */
interface DocumentStatusSummaryProps {
  expiredCount: number;
  criticalCount: number;
  warningCount: number;
  onClick?: () => void;
}

export function DocumentStatusSummary({
  expiredCount,
  criticalCount,
  warningCount,
  onClick,
}: DocumentStatusSummaryProps) {
  const totalIssues = expiredCount + criticalCount + warningCount;

  if (totalIssues === 0) {
    return (
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 ${
          onClick ? 'cursor-pointer hover:bg-emerald-500/20' : ''
        }`}
        onClick={onClick}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        <span className="text-sm text-emerald-400">جميع الوثائق سارية</span>
      </div>
    );
  }

  return (
    <div 
      className={`flex items-center gap-3 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 ${
        onClick ? 'cursor-pointer hover:bg-red-500/20' : ''
      }`}
      onClick={onClick}
    >
      <AlertCircle className="h-4 w-4 text-red-400" />
      <div className="flex items-center gap-2 text-sm">
        {expiredCount > 0 && (
          <span className="text-red-400">{expiredCount} منتهي</span>
        )}
        {criticalCount > 0 && (
          <span className="text-orange-400">{criticalCount} حرج</span>
        )}
        {warningCount > 0 && (
          <span className="text-amber-400">{warningCount} قريب</span>
        )}
      </div>
    </div>
  );
}
