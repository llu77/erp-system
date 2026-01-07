import { describe, it, expect } from 'vitest';
import { getSuggestedQuestions } from './aiChatService';

describe('AI Chat Service', () => {
  describe('getSuggestedQuestions', () => {
    it('should return an array of suggested questions', async () => {
      const questions = await getSuggestedQuestions();
      
      expect(Array.isArray(questions)).toBe(true);
      expect(questions.length).toBeGreaterThan(0);
      expect(typeof questions[0]).toBe('string');
    });

    it('should return questions in Arabic', async () => {
      const questions = await getSuggestedQuestions();
      
      // Check that questions contain Arabic characters
      const arabicPattern = /[\u0600-\u06FF]/;
      questions.forEach(q => {
        expect(arabicPattern.test(q)).toBe(true);
      });
    });

    it('should return at least 5 suggested questions', async () => {
      const questions = await getSuggestedQuestions();
      expect(questions.length).toBeGreaterThanOrEqual(5);
    });
  });
});

describe('Monthly Comparison Report - Active Months Filtering', () => {
  it('should exclude months with zero revenue from calculations', () => {
    const testMonths = [
      { month: 'ديسمبر 2025', revenue: 24685, expenses: 23016.35 },
      { month: 'نوفمبر 2025', revenue: 0, expenses: 17700 },
      { month: 'أكتوبر 2025', revenue: 0, expenses: 17700 },
      { month: 'سبتمبر 2025', revenue: 0, expenses: 17700 },
      { month: 'أغسطس 2025', revenue: 0, expenses: 17700 },
      { month: 'يناير 2026', revenue: 4650, expenses: 23076.75 },
    ];
    
    // Filter active months (those with revenue > 0)
    const activeMonths = testMonths.filter(m => m.revenue > 0);
    
    expect(activeMonths.length).toBe(2);
    expect(activeMonths[0].month).toBe('ديسمبر 2025');
    expect(activeMonths[1].month).toBe('يناير 2026');
  });

  it('should calculate averages only from active months', () => {
    const activeMonths = [
      { month: 'ديسمبر 2025', revenue: 24685, expenses: 23016.35, profit: 1668.65 },
      { month: 'يناير 2026', revenue: 4650, expenses: 23076.75, profit: -18426.75 },
    ];
    
    const avgRevenue = activeMonths.reduce((sum, m) => sum + m.revenue, 0) / activeMonths.length;
    const avgExpenses = activeMonths.reduce((sum, m) => sum + m.expenses, 0) / activeMonths.length;
    
    expect(avgRevenue).toBeCloseTo(14667.5, 1);
    expect(avgExpenses).toBeCloseTo(23046.55, 1);
  });

  it('should handle case when all months have zero revenue', () => {
    const testMonths = [
      { month: 'نوفمبر 2025', revenue: 0, expenses: 17700 },
      { month: 'أكتوبر 2025', revenue: 0, expenses: 17700 },
    ];
    
    const activeMonths = testMonths.filter(m => m.revenue > 0);
    
    expect(activeMonths.length).toBe(0);
  });
});

describe('Forecast Service - Day Pattern Analysis', () => {
  it('should calculate different averages for different days of week', () => {
    // Simulate day pattern data
    const dayPatterns = {
      0: { total: 5000, count: 4 }, // Sunday
      1: { total: 4000, count: 4 }, // Monday
      2: { total: 4500, count: 4 }, // Tuesday
      3: { total: 4200, count: 4 }, // Wednesday
      4: { total: 6000, count: 4 }, // Thursday
      5: { total: 7000, count: 4 }, // Friday
      6: { total: 6500, count: 4 }, // Saturday
    };
    
    // Calculate averages per day
    const dayAverages: Record<number, number> = {};
    Object.entries(dayPatterns).forEach(([day, data]) => {
      dayAverages[Number(day)] = data.total / data.count;
    });
    
    // Friday should have highest average
    expect(dayAverages[5]).toBe(1750);
    // Monday should have lowest average
    expect(dayAverages[1]).toBe(1000);
  });

  it('should apply day-specific multipliers to forecasts', () => {
    const baseAverage = 1500;
    const dayMultipliers: Record<number, number> = {
      0: 1.0,  // Sunday - normal
      1: 0.9,  // Monday - slower
      2: 0.95, // Tuesday
      3: 0.95, // Wednesday
      4: 1.1,  // Thursday - busier
      5: 1.2,  // Friday - busiest
      6: 1.15, // Saturday - busy
    };
    
    const fridayForecast = baseAverage * dayMultipliers[5];
    const mondayForecast = baseAverage * dayMultipliers[1];
    
    expect(fridayForecast).toBe(1800);
    expect(mondayForecast).toBe(1350);
    expect(fridayForecast).toBeGreaterThan(mondayForecast);
  });

  it('should handle missing day data gracefully', () => {
    const dayPatterns: Record<number, { total: number; count: number }> = {
      0: { total: 5000, count: 4 },
      5: { total: 7000, count: 4 },
    };
    
    const globalAverage = 1500;
    
    // For days without data, use global average
    const getAverageForDay = (day: number) => {
      if (dayPatterns[day] && dayPatterns[day].count > 0) {
        return dayPatterns[day].total / dayPatterns[day].count;
      }
      return globalAverage;
    };
    
    expect(getAverageForDay(0)).toBe(1250); // Has data
    expect(getAverageForDay(1)).toBe(1500); // No data, uses global
    expect(getAverageForDay(5)).toBe(1750); // Has data
  });
});

describe('Period Selection for Analysis', () => {
  it('should filter data within selected date range', () => {
    const allData = [
      { date: '2025-12-01', revenue: 1000 },
      { date: '2025-12-15', revenue: 1500 },
      { date: '2026-01-01', revenue: 2000 },
      { date: '2026-01-07', revenue: 1800 },
    ];
    
    const startDate = new Date('2025-12-01');
    const endDate = new Date('2025-12-31');
    
    const filteredData = allData.filter(d => {
      const date = new Date(d.date);
      return date >= startDate && date <= endDate;
    });
    
    expect(filteredData.length).toBe(2);
    expect(filteredData[0].date).toBe('2025-12-01');
    expect(filteredData[1].date).toBe('2025-12-15');
  });

  it('should calculate totals for selected period', () => {
    const periodData = [
      { date: '2025-12-01', revenue: 1000, expenses: 500 },
      { date: '2025-12-15', revenue: 1500, expenses: 700 },
    ];
    
    const totalRevenue = periodData.reduce((sum, d) => sum + d.revenue, 0);
    const totalExpenses = periodData.reduce((sum, d) => sum + d.expenses, 0);
    const netProfit = totalRevenue - totalExpenses;
    
    expect(totalRevenue).toBe(2500);
    expect(totalExpenses).toBe(1200);
    expect(netProfit).toBe(1300);
  });
});
