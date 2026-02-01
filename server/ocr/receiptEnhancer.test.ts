/**
 * اختبارات ReceiptEnhancer v2.0
 * ================================
 * 
 * اختبارات شاملة لخوارزمية معالجة صور الإيصالات المحسّنة
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ReceiptEnhancer,
  enhanceReceiptImage,
  enhanceWeakReceiptImage,
  analyzeReceiptImage,
  OPTIMAL_CONFIG,
  WEAK_IMAGE_CONFIG,
  type EnhancementConfig,
  type EnhancementResult,
  type ImageStats,
  type OCRReadiness
} from "./receiptEnhancer";

// Mock sharp
vi.mock("sharp", () => {
  const mockSharp = vi.fn(() => ({
    rotate: vi.fn().mockReturnThis(),
    grayscale: vi.fn().mockReturnThis(),
    median: vi.fn().mockReturnThis(),
    normalize: vi.fn().mockReturnThis(),
    sharpen: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("mock-processed-image")),
    stats: vi.fn().mockResolvedValue({
      channels: [
        { mean: 128, stdev: 40 },
        { mean: 128, stdev: 40 },
        { mean: 128, stdev: 40 }
      ]
    }),
    metadata: vi.fn().mockResolvedValue({
      width: 800,
      height: 1200
    })
  }));
  return { default: mockSharp };
});

describe("ReceiptEnhancer v2.0", () => {
  let enhancer: ReceiptEnhancer;
  const mockImageBuffer = Buffer.from("mock-image-data");

  beforeEach(() => {
    enhancer = new ReceiptEnhancer();
    vi.clearAllMocks();
  });

  // ==================== اختبارات التكوين ====================
  describe("التكوين", () => {
    it("يجب أن يستخدم الإعدادات الافتراضية", () => {
      const config = enhancer.getConfig();
      expect(config.compressionQuality).toBe(92);
      expect(config.maxCompressionPercent).toBe(10);
      expect(config.enableProcessing).toBe(false);
    });

    it("يجب أن يقبل إعدادات مخصصة", () => {
      const customEnhancer = new ReceiptEnhancer({
        compressionQuality: 95,
        enableProcessing: true
      });
      const config = customEnhancer.getConfig();
      expect(config.compressionQuality).toBe(95);
      expect(config.enableProcessing).toBe(true);
    });

    it("يجب أن يحدّث التكوين", () => {
      enhancer.updateConfig({ sharpenStrength: 1.5 });
      expect(enhancer.getConfig().sharpenStrength).toBe(1.5);
    });
  });

  // ==================== اختبارات OPTIMAL_CONFIG ====================
  describe("OPTIMAL_CONFIG", () => {
    it("يجب أن يكون enableProcessing معطلاً افتراضياً", () => {
      expect(OPTIMAL_CONFIG.enableProcessing).toBe(false);
    });

    it("يجب أن يكون الضغط ≤10%", () => {
      expect(OPTIMAL_CONFIG.maxCompressionPercent).toBe(10);
    });

    it("يجب أن تكون الجودة عالية (≥90)", () => {
      expect(OPTIMAL_CONFIG.compressionQuality).toBeGreaterThanOrEqual(90);
    });
  });

  // ==================== اختبارات WEAK_IMAGE_CONFIG ====================
  describe("WEAK_IMAGE_CONFIG", () => {
    it("يجب أن يكون enableProcessing مفعلاً للصور الضعيفة", () => {
      expect(WEAK_IMAGE_CONFIG.enableProcessing).toBe(true);
    });

    it("يجب أن تكون الحدة أقوى للصور الضعيفة", () => {
      expect(WEAK_IMAGE_CONFIG.sharpenStrength).toBeGreaterThanOrEqual(OPTIMAL_CONFIG.sharpenStrength);
    });
  });

  // ==================== اختبارات المعالجة ====================
  describe("enhance()", () => {
    it("يجب أن يرجع الصورة بدون معالجة عندما enableProcessing = false", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      expect(result.wasProcessed).toBe(false);
      expect(result.buffer).toBeDefined();
      expect(result.base64).toContain("data:image/jpeg;base64,");
    });

    it("يجب أن يطبق المعالجة عندما enableProcessing = true", async () => {
      const processingEnhancer = new ReceiptEnhancer({ enableProcessing: true });
      const result = await processingEnhancer.enhance(mockImageBuffer);
      
      expect(result.wasProcessed).toBe(true);
      expect(result.appliedSteps.length).toBeGreaterThan(0);
    });

    it("يجب أن يحسب نسبة الضغط بشكل صحيح", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      expect(result.originalSize).toBe(mockImageBuffer.length);
      expect(result.finalSize).toBeDefined();
      expect(result.compressionPercent).toBeGreaterThanOrEqual(0);
    });

    it("يجب أن يرجع وقت المعالجة", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== اختبارات تحليل الصورة ====================
  describe("analyzeImage()", () => {
    it("يجب أن يرجع إحصائيات الصورة", async () => {
      const stats = await enhancer.analyzeImage(mockImageBuffer);
      
      expect(stats.width).toBeDefined();
      expect(stats.height).toBeDefined();
      expect(stats.contrast).toBeDefined();
      expect(stats.brightness).toBeDefined();
      expect(stats.sharpness).toBeDefined();
      expect(stats.noiseLevel).toBeDefined();
    });

    it("يجب أن يرجع قيم افتراضية عند فشل التحليل", async () => {
      // Mock sharp to throw error
      const sharp = await import("sharp");
      (sharp.default as any).mockImplementationOnce(() => {
        throw new Error("Analysis failed");
      });
      
      const stats = await enhancer.analyzeImage(mockImageBuffer);
      
      expect(stats.contrast).toBe(50);
      expect(stats.brightness).toBe(128);
    });
  });

  // ==================== اختبارات جاهزية OCR ====================
  describe("OCR Readiness", () => {
    it("يجب أن يحسب جاهزية OCR", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      expect(result.ocrReadiness).toBeDefined();
      expect(result.ocrReadiness.score).toBeGreaterThanOrEqual(0);
      expect(result.ocrReadiness.score).toBeLessThanOrEqual(100);
      expect(["ممتاز", "جيد", "مقبول", "ضعيف"]).toContain(result.ocrReadiness.level);
    });

    it("يجب أن يحدد المشاكل في الصورة", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      expect(Array.isArray(result.ocrReadiness.issues)).toBe(true);
    });
  });

  // ==================== اختبارات الدوال المساعدة ====================
  describe("enhanceReceiptImage()", () => {
    it("يجب أن تعمل بالإعدادات الافتراضية", async () => {
      const result = await enhanceReceiptImage(mockImageBuffer);
      
      expect(result.wasProcessed).toBe(false);
      expect(result.buffer).toBeDefined();
    });

    it("يجب أن تقبل إعدادات مخصصة", async () => {
      const result = await enhanceReceiptImage(mockImageBuffer, {
        compressionQuality: 95
      });
      
      expect(result.buffer).toBeDefined();
    });
  });

  describe("enhanceWeakReceiptImage()", () => {
    it("يجب أن تفعّل المعالجة للصور الضعيفة", async () => {
      const result = await enhanceWeakReceiptImage(mockImageBuffer);
      
      expect(result.wasProcessed).toBe(true);
    });
  });

  describe("analyzeReceiptImage()", () => {
    it("يجب أن ترجع الإحصائيات وجاهزية OCR", async () => {
      const { stats, ocrReadiness } = await analyzeReceiptImage(mockImageBuffer);
      
      expect(stats).toBeDefined();
      expect(ocrReadiness).toBeDefined();
      expect(ocrReadiness.score).toBeDefined();
    });
  });

  // ==================== اختبارات خطوات المعالجة ====================
  describe("خطوات المعالجة", () => {
    it("يجب أن تتضمن تصحيح الاتجاه دائماً", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      expect(result.appliedSteps).toContain("تصحيح الاتجاه");
    });

    it("يجب أن تتضمن الضغط دائماً", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      expect(result.appliedSteps.some(s => s.includes("ضغط"))).toBe(true);
    });

    it("يجب أن تتضمن التحويل للرمادي عند تفعيل المعالجة", async () => {
      const processingEnhancer = new ReceiptEnhancer({ 
        enableProcessing: true,
        grayscale: true 
      });
      const result = await processingEnhancer.enhance(mockImageBuffer);
      
      expect(result.appliedSteps).toContain("تحويل للرمادي");
    });
  });

  // ==================== اختبارات تحذيرات الضغط ====================
  describe("تحذيرات الضغط", () => {
    it("يجب أن لا يكون هناك تحذير عند ضغط ≤10%", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      // Mock returns smaller buffer, so compression should be within limits
      if (result.compressionPercent <= 10) {
        expect(result.compressionWarning).toBeNull();
      }
    });
  });

  // ==================== اختبارات تحسين الجودة ====================
  describe("تحسين الجودة", () => {
    it("يجب أن يرجع قيم تحسين الجودة", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      expect(result.qualityImprovement).toBeDefined();
      expect(result.qualityImprovement.contrast).toBeDefined();
      expect(result.qualityImprovement.sharpness).toBeDefined();
      expect(result.qualityImprovement.noiseReduction).toBeDefined();
    });

    it("يجب أن تكون قيم التحسين 0 عند عدم المعالجة", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      if (!result.wasProcessed) {
        expect(result.qualityImprovement.contrast).toBe(0);
        expect(result.qualityImprovement.sharpness).toBe(0);
        expect(result.qualityImprovement.noiseReduction).toBe(0);
      }
    });
  });

  // ==================== اختبارات Base64 ====================
  describe("Base64 Output", () => {
    it("يجب أن يرجع base64 بتنسيق صحيح", async () => {
      const result = await enhancer.enhance(mockImageBuffer);
      
      expect(result.base64).toMatch(/^data:image\/jpeg;base64,/);
    });
  });
});

// ==================== اختبارات التكامل ====================
describe("ReceiptEnhancer Integration", () => {
  it("يجب أن تعمل Pipeline المعالجة بالترتيب الصحيح", async () => {
    const enhancer = new ReceiptEnhancer({ enableProcessing: true });
    const mockBuffer = Buffer.from("test-image");
    
    const result = await enhancer.enhance(mockBuffer);
    
    // التحقق من أن الخطوات بالترتيب الصحيح
    const steps = result.appliedSteps;
    const rotateIndex = steps.indexOf("تصحيح الاتجاه");
    const grayscaleIndex = steps.indexOf("تحويل للرمادي");
    
    // تصحيح الاتجاه يجب أن يكون أولاً
    expect(rotateIndex).toBe(0);
    
    // إذا تم تطبيق الرمادي، يجب أن يكون بعد تصحيح الاتجاه
    if (grayscaleIndex !== -1) {
      expect(grayscaleIndex).toBeGreaterThan(rotateIndex);
    }
  });

  it("يجب أن لا يطبق التنعيم بعد الحدة", async () => {
    const enhancer = new ReceiptEnhancer({ enableProcessing: true });
    const mockBuffer = Buffer.from("test-image");
    
    const result = await enhancer.enhance(mockBuffer);
    
    // التحقق من عدم وجود تنعيم بعد الحدة
    const steps = result.appliedSteps;
    const sharpenIndex = steps.indexOf("تحسين الحدة");
    const smoothIndex = steps.findIndex(s => s.includes("تنعيم"));
    
    // لا يجب أن يكون هناك تنعيم بعد الحدة
    if (sharpenIndex !== -1 && smoothIndex !== -1) {
      expect(smoothIndex).toBeLessThan(sharpenIndex);
    }
  });
});
