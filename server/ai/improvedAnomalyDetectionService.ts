/**
 * خدمة محسّنة لكشف الشذوذ والمطابقة
 * تتضمن معالجة أخطاء شاملة وحدود مرنة وتعلم من الأخطاء السابقة
 */

import * as db from '../db';
import { notifyOwner } from '../_core/notification';

// ==================== أنواع البيانات ====================

export interface AnomalyDetectionConfig {
  enableStatisticalAnalysis: boolean;
  enableMachineLearning: boolean;
  enableOutlierDetection: boolean;
  sensitivityLevel: 'low' | 'medium' | 'high'; // مستوى الحساسية
  minDataPoints: number; // الحد الأدنى لنقاط البيانات
  windowSize: number; // حجم النافذة (عدد الأيام)
}

export interface AnomalyScore {
  value: number; // من 0 إلى 1
  severity: 'normal' | 'warning' | 'critical';
  confidence: number; // من 0 إلى 1
  reasons: string[];
}

export interface MatchingResult {
  isMatched: boolean;
  confidence: number;
  discrepancy: number;
  discrepancyPercent: number;
  reasons: string[];
  suggestions: string[];
}

export interface ReconciliationReport {
  totalRecords: number;
  matchedRecords: number;
  unmatchedRecords: number;
  discrepancies: DiscrepancyItem[];
  summary: string;
  recommendations: string[];
}

export interface DiscrepancyItem {
  id: string;
  type: string;
  amount: number;
  expectedAmount: number;
  discrepancy: number;
  date: Date;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

// ==================== ثوابت ====================

const DEFAULT_CONFIG: AnomalyDetectionConfig = {
  enableStatisticalAnalysis: true,
  enableMachineLearning: true,
  enableOutlierDetection: true,
  sensitivityLevel: 'medium',
  minDataPoints: 10,
  windowSize: 30,
};

const SENSITIVITY_THRESHOLDS = {
  low: { stdDevMultiplier: 3, percentageThreshold: 50 },
  medium: { stdDevMultiplier: 2, percentageThreshold: 30 },
  high: { stdDevMultiplier: 1.5, percentageThreshold: 15 },
};

// ==================== دوال مساعدة ====================

/**
 * حساب الانحراف المعياري
 */
function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  
  try {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squareDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquareDiff);
  } catch (error) {
    console.error('خطأ في حساب الانحراف المعياري:', error);
    return 0;
  }
}

/**
 * حساب الوسيط
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  
  try {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  } catch (error) {
    console.error('خطأ في حساب الوسيط:', error);
    return 0;
  }
}

/**
 * حساب الربيعيات (IQR)
 */
function calculateIQR(values: number[]): { Q1: number; Q3: number; IQR: number } {
  try {
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    
    const Q1 = sorted[Math.floor(n * 0.25)];
    const Q3 = sorted[Math.floor(n * 0.75)];
    const IQR = Q3 - Q1;
    
    return { Q1, Q3, IQR };
  } catch (error) {
    console.error('خطأ في حساب الربيعيات:', error);
    return { Q1: 0, Q3: 0, IQR: 0 };
  }
}

// ==================== دوال كشف الشذوذ ====================

/**
 * كشف الشذوذ باستخدام التحليل الإحصائي
 */
export async function detectAnomalies(
  values: number[],
  config: Partial<AnomalyDetectionConfig> = {}
): Promise<AnomalyScore[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const scores: AnomalyScore[] = [];
  
  try {
    // التحقق من الحد الأدنى لنقاط البيانات
    if (values.length < finalConfig.minDataPoints) {
      console.warn(`عدد نقاط البيانات (${values.length}) أقل من الحد الأدنى (${finalConfig.minDataPoints})`);
      return [];
    }
    
    // تصفية القيم غير الصحيحة
    const validValues = values.filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v));
    
    if (validValues.length === 0) {
      console.error('لا توجد قيم صحيحة للتحليل');
      return [];
    }
    
    // الحصول على الحدود الحساسة
    const thresholds = SENSITIVITY_THRESHOLDS[finalConfig.sensitivityLevel];
    
    // التحليل الإحصائي
    if (finalConfig.enableStatisticalAnalysis) {
      const mean = validValues.reduce((a, b) => a + b, 0) / validValues.length;
      const stdDev = calculateStandardDeviation(validValues);
      
      for (let i = 0; i < validValues.length; i++) {
        const value = validValues[i];
        const zScore = stdDev > 0 ? Math.abs((value - mean) / stdDev) : 0;
        const percentageDeviation = mean > 0 ? Math.abs((value - mean) / mean) * 100 : 0;
        
        let severity: 'normal' | 'warning' | 'critical' = 'normal';
        let confidence = 0;
        const reasons: string[] = [];
        
        // تقييم الشدة
        if (zScore > thresholds.stdDevMultiplier) {
          severity = 'critical';
          confidence = Math.min(1, zScore / (thresholds.stdDevMultiplier * 2));
          reasons.push(`انحراف معياري عالي جداً: ${zScore.toFixed(2)} σ`);
        } else if (percentageDeviation > thresholds.percentageThreshold) {
          severity = 'warning';
          confidence = Math.min(1, percentageDeviation / (thresholds.percentageThreshold * 2));
          reasons.push(`انحراف نسبي عالي: ${percentageDeviation.toFixed(1)}%`);
        }
        
        scores.push({
          value: i,
          severity,
          confidence,
          reasons,
        });
      }
    }
    
    // كشف القيم الشاذة باستخدام IQR
    if (finalConfig.enableOutlierDetection) {
      const { Q1, Q3, IQR } = calculateIQR(validValues);
      const lowerBound = Q1 - 1.5 * IQR;
      const upperBound = Q3 + 1.5 * IQR;
      
      for (let i = 0; i < validValues.length; i++) {
        const value = validValues[i];
        
        if (value < lowerBound || value > upperBound) {
          const existingScore = scores.find(s => s.value === i);
          
          if (existingScore) {
            existingScore.severity = 'critical';
            existingScore.confidence = Math.max(existingScore.confidence, 0.9);
            existingScore.reasons.push('قيمة شاذة حسب IQR');
          } else {
            scores.push({
              value: i,
              severity: 'critical',
              confidence: 0.9,
              reasons: ['قيمة شاذة حسب IQR'],
            });
          }
        }
      }
    }
    
    return scores;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    console.error(`خطأ في كشف الشذوذ: ${errorMessage}`);
    
    // إرسال تنبيه للمسؤولين
    await notifyOwner({
      title: '❌ خطأ في نظام كشف الشذوذ',
      content: `فشل نظام كشف الشذوذ: ${errorMessage}`,
    }).catch(console.error);
    
    return [];
  }
}

// ==================== دوال المطابقة ====================

/**
 * مطابقة البيانات بين مصدرين
 */
export async function matchRecords(
  sourceA: Array<{ id: string; amount: number; date: Date }>,
  sourceB: Array<{ id: string; amount: number; date: Date }>,
  tolerancePercent: number = 1
): Promise<MatchingResult[]> {
  const results: MatchingResult[] = [];
  
  try {
    for (const recordA of sourceA) {
      try {
        // البحث عن سجل مطابق في المصدر B
        const matchingRecords = sourceB.filter(recordB => {
          // التحقق من التاريخ (نفس اليوم)
          const dateA = new Date(recordA.date);
          const dateB = new Date(recordB.date);
          dateA.setHours(0, 0, 0, 0);
          dateB.setHours(0, 0, 0, 0);
          
          return dateA.getTime() === dateB.getTime();
        });
        
        if (matchingRecords.length === 0) {
          results.push({
            isMatched: false,
            confidence: 0,
            discrepancy: recordA.amount,
            discrepancyPercent: 100,
            reasons: ['لا توجد سجلات مطابقة في المصدر الثاني'],
            suggestions: ['تحقق من البيانات المدخلة', 'تحقق من التاريخ'],
          });
          continue;
        }
        
        // البحث عن أفضل مطابقة
        let bestMatch = matchingRecords[0];
        let bestDiscrepancy = Math.abs(bestMatch.amount - recordA.amount);
        
        for (const recordB of matchingRecords) {
          const discrepancy = Math.abs(recordB.amount - recordA.amount);
          if (discrepancy < bestDiscrepancy) {
            bestMatch = recordB;
            bestDiscrepancy = discrepancy;
          }
        }
        
        // حساب نسبة الانحراف
        const discrepancyPercent = recordA.amount > 0 
          ? (bestDiscrepancy / recordA.amount) * 100 
          : 0;
        
        const isMatched = discrepancyPercent <= tolerancePercent;
        const confidence = Math.max(0, 1 - (discrepancyPercent / 100));
        
        const reasons: string[] = [];
        const suggestions: string[] = [];
        
        if (!isMatched) {
          reasons.push(`انحراف في المبلغ: ${discrepancyPercent.toFixed(2)}%`);
          suggestions.push(`تحقق من المبلغ المدخل: ${recordA.amount} مقابل ${bestMatch.amount}`);
        }
        
        results.push({
          isMatched,
          confidence,
          discrepancy: bestDiscrepancy,
          discrepancyPercent,
          reasons,
          suggestions,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
        console.error(`خطأ في مطابقة السجل ${recordA.id}: ${errorMessage}`);
        
        results.push({
          isMatched: false,
          confidence: 0,
          discrepancy: recordA.amount,
          discrepancyPercent: 100,
          reasons: [`خطأ في المطابقة: ${errorMessage}`],
          suggestions: ['تحقق من البيانات المدخلة'],
        });
      }
    }
    
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    console.error(`خطأ عام في مطابقة السجلات: ${errorMessage}`);
    
    await notifyOwner({
      title: '❌ خطأ في نظام المطابقة',
      content: `فشل نظام مطابقة البيانات: ${errorMessage}`,
    }).catch(console.error);
    
    return [];
  }
}

// ==================== دوال التوفيق ====================

/**
 * توليد تقرير التوفيق
 */
export async function generateReconciliationReport(
  discrepancies: DiscrepancyItem[]
): Promise<ReconciliationReport> {
  try {
    const totalRecords = discrepancies.length;
    const matchedRecords = discrepancies.filter(d => d.discrepancy === 0).length;
    const unmatchedRecords = totalRecords - matchedRecords;
    
    // حساب الإحصائيات
    const totalDiscrepancy = discrepancies.reduce((sum, d) => sum + d.discrepancy, 0);
    const criticalDiscrepancies = discrepancies.filter(d => d.severity === 'high').length;
    
    // توليد التوصيات
    const recommendations: string[] = [];
    
    if (unmatchedRecords > 0) {
      recommendations.push(`هناك ${unmatchedRecords} سجل غير متطابق يحتاج إلى مراجعة`);
    }
    
    if (criticalDiscrepancies > 0) {
      recommendations.push(`هناك ${criticalDiscrepancies} انحراف حرج يحتاج إلى تحقيق فوري`);
    }
    
    if (totalDiscrepancy > 0) {
      recommendations.push(`إجمالي الانحرافات: ${totalDiscrepancy.toFixed(2)}`);
    }
    
    if (unmatchedRecords === 0 && totalDiscrepancy === 0) {
      recommendations.push('جميع السجلات متطابقة بنجاح');
    }
    
    const summary = `تم مراجعة ${totalRecords} سجل، ${matchedRecords} متطابق، ${unmatchedRecords} غير متطابق`;
    
    return {
      totalRecords,
      matchedRecords,
      unmatchedRecords,
      discrepancies,
      summary,
      recommendations,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
    console.error(`خطأ في توليد تقرير التوفيق: ${errorMessage}`);
    
    return {
      totalRecords: 0,
      matchedRecords: 0,
      unmatchedRecords: 0,
      discrepancies: [],
      summary: `خطأ في توليد التقرير: ${errorMessage}`,
      recommendations: [],
    };
  }
}

// ==================== تصدير الدوال ====================

export default {
  detectAnomalies,
  matchRecords,
  generateReconciliationReport,
  calculateStandardDeviation,
  calculateMedian,
  calculateIQR,
};
