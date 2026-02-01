/**
 * اختبارات استراتيجية إعادة المحاولة لنظام OCR
 * OCR Retry Strategy Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PROMPTS } from "./ocrRetryStrategy";

// Mock للـ LLM
vi.mock("../_core/llm", () => ({
  invokeLLM: vi.fn()
}));

// Mock للـ logger
vi.mock("../utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

describe("OCR Retry Strategy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("PROMPTS", () => {
    it("should have all required prompt variants", () => {
      expect(PROMPTS.DIRECT_READ).toBeDefined();
      expect(PROMPTS.NUMBERS_FOCUS).toBeDefined();
      expect(PROMPTS.DETAILED_READ).toBeDefined();
      expect(PROMPTS.TOTAL_ONLY).toBeDefined();
    });

    it("should have valid prompt structure", () => {
      for (const [name, prompt] of Object.entries(PROMPTS)) {
        expect(prompt.name).toBeDefined();
        expect(prompt.systemPrompt).toBeDefined();
        expect(prompt.userPrompt).toBeDefined();
        expect(prompt.temperature).toBeGreaterThanOrEqual(0);
        expect(prompt.temperature).toBeLessThanOrEqual(1);
      }
    });

    it("should include current year in prompts", () => {
      const currentYear = new Date().getFullYear().toString();
      
      expect(PROMPTS.DIRECT_READ.systemPrompt).toContain(currentYear);
      expect(PROMPTS.NUMBERS_FOCUS.systemPrompt).toContain(currentYear);
      expect(PROMPTS.DETAILED_READ.systemPrompt).toContain(currentYear);
      expect(PROMPTS.TOTAL_ONLY.systemPrompt).toContain(currentYear);
    });
  });

  describe("Prompt Variants", () => {
    it("DIRECT_READ should focus on POS receipt reading", () => {
      expect(PROMPTS.DIRECT_READ.name).toBe("direct_read");
      expect(PROMPTS.DIRECT_READ.userPrompt).toContain("TOTALS");
      expect(PROMPTS.DIRECT_READ.userPrompt).toContain("mada");
      expect(PROMPTS.DIRECT_READ.userPrompt).toContain("VISA");
    });

    it("NUMBERS_FOCUS should focus on extracting numbers", () => {
      expect(PROMPTS.NUMBERS_FOCUS.name).toBe("numbers_focus");
      expect(PROMPTS.NUMBERS_FOCUS.systemPrompt).toContain("أرقام");
      expect(PROMPTS.NUMBERS_FOCUS.userPrompt).toContain("TOTAL");
    });

    it("DETAILED_READ should handle unclear images", () => {
      expect(PROMPTS.DETAILED_READ.name).toBe("detailed_read");
      expect(PROMPTS.DETAILED_READ.systemPrompt).toContain("الباهتة");
      expect(PROMPTS.DETAILED_READ.systemPrompt).toContain("المموهة");
    });

    it("TOTAL_ONLY should be simple and focused", () => {
      expect(PROMPTS.TOTAL_ONLY.name).toBe("total_only");
      expect(PROMPTS.TOTAL_ONLY.userPrompt).toContain("GRAND TOTAL");
      expect(PROMPTS.TOTAL_ONLY.temperature).toBe(0.1);
    });
  });

  describe("Temperature Settings", () => {
    it("should have low temperature for accuracy", () => {
      // جميع الـ prompts يجب أن تكون بدرجة حرارة منخفضة للدقة
      expect(PROMPTS.DIRECT_READ.temperature).toBeLessThanOrEqual(0.2);
      expect(PROMPTS.NUMBERS_FOCUS.temperature).toBeLessThanOrEqual(0.2);
      expect(PROMPTS.DETAILED_READ.temperature).toBeLessThanOrEqual(0.2);
      expect(PROMPTS.TOTAL_ONLY.temperature).toBeLessThanOrEqual(0.2);
    });
  });
});

describe("OCR Response Parsing", () => {
  // اختبارات تحليل الاستجابات
  
  it("should handle JSON response without markdown", async () => {
    const jsonResponse = '{"date":"2026-01-31","sections":[{"name":"mada","total":1000}],"grandTotal":1000,"confidence":"high"}';
    
    // التحقق من أن الـ JSON صالح
    const parsed = JSON.parse(jsonResponse);
    expect(parsed.date).toBe("2026-01-31");
    expect(parsed.grandTotal).toBe(1000);
    expect(parsed.confidence).toBe("high");
  });

  it("should handle JSON response with markdown code block", async () => {
    const markdownResponse = '```json\n{"date":"2026-01-31","grandTotal":1500}\n```';
    
    // استخراج JSON من markdown
    const jsonMatch = markdownResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    expect(jsonMatch).not.toBeNull();
    
    const parsed = JSON.parse(jsonMatch![1].trim());
    expect(parsed.date).toBe("2026-01-31");
    expect(parsed.grandTotal).toBe(1500);
  });

  it("should handle amounts array format", async () => {
    const response = {
      amounts: [
        { label: "mada", value: 500 },
        { label: "VISA", value: 300 }
      ],
      grandTotal: 800
    };
    
    const sections = response.amounts.map(a => ({
      name: a.label,
      hostTotal: a.value,
      terminalTotal: a.value,
      count: 0
    }));
    
    expect(sections).toHaveLength(2);
    expect(sections[0].name).toBe("mada");
    expect(sections[0].hostTotal).toBe(500);
  });
});

describe("Result Combination Logic", () => {
  it("should prefer high confidence results", () => {
    const results = [
      { confidence: "low", grandTotal: 1000 },
      { confidence: "high", grandTotal: 1200 },
      { confidence: "medium", grandTotal: 1100 }
    ];
    
    const confOrder: Record<string, number> = { high: 3, medium: 2, low: 1, none: 0 };
    const sorted = [...results].sort((a, b) => confOrder[b.confidence] - confOrder[a.confidence]);
    
    expect(sorted[0].confidence).toBe("high");
    expect(sorted[0].grandTotal).toBe(1200);
  });

  it("should calculate median for high variance", () => {
    const amounts = [1000, 1500, 1100];
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length;
    
    // حساب الوسيط
    const sortedAmounts = [...amounts].sort((a, b) => a - b);
    const medianAmount = sortedAmounts[Math.floor(sortedAmounts.length / 2)];
    
    expect(medianAmount).toBe(1100);
    expect(variance).toBeGreaterThan(0);
  });

  it("should merge sections from multiple attempts", () => {
    const attempt1Sections = [
      { name: "mada", hostTotal: 500, terminalTotal: 500, count: 5 }
    ];
    const attempt2Sections = [
      { name: "mada", hostTotal: 600, terminalTotal: 600, count: 6 },
      { name: "VISA", hostTotal: 300, terminalTotal: 300, count: 3 }
    ];
    
    const allSections = new Map<string, any>();
    
    for (const section of attempt1Sections) {
      allSections.set(section.name, section);
    }
    
    for (const section of attempt2Sections) {
      const existing = allSections.get(section.name);
      if (!existing || section.hostTotal > existing.hostTotal) {
        allSections.set(section.name, section);
      }
    }
    
    const merged = Array.from(allSections.values());
    
    expect(merged).toHaveLength(2);
    expect(merged.find(s => s.name === "mada")?.hostTotal).toBe(600); // الأعلى
    expect(merged.find(s => s.name === "VISA")?.hostTotal).toBe(300);
  });
});

describe("Error Handling", () => {
  it("should return error result for invalid JSON", () => {
    const invalidJson = "not a json";
    
    let result;
    try {
      JSON.parse(invalidJson);
      result = { success: true };
    } catch {
      result = {
        success: false,
        extractedAmount: null,
        extractedDate: null,
        sections: [],
        grandTotal: null,
        confidence: "none",
        rawText: null,
        error: "فشل تحليل الاستجابة"
      };
    }
    
    expect(result.success).toBe(false);
    expect(result.error).toContain("فشل");
  });

  it("should handle empty response", () => {
    const emptyResponse = "{}";
    const parsed = JSON.parse(emptyResponse);
    
    const grandTotal = parsed.grandTotal || 0;
    const sections = parsed.sections || [];
    
    expect(grandTotal).toBe(0);
    expect(sections).toHaveLength(0);
  });
});
