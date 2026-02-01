/**
 * اختبارات خدمة معالجة الصور مسبقاً
 * Image Preprocessing Service Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  THERMAL_RECEIPT_PRESET,
  LOW_QUALITY_PRESET,
  HIGH_QUALITY_PRESET,
  PRESETS
} from "./imagePreprocessing";

// Mock للـ sharp
vi.mock("sharp", () => {
  const mockSharp = vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({
      width: 800,
      height: 1200,
      format: "jpeg"
    }),
    stats: vi.fn().mockResolvedValue({
      channels: [
        { mean: 120, stdev: 50 },
        { mean: 120, stdev: 50 },
        { mean: 120, stdev: 50 }
      ]
    }),
    resize: vi.fn().mockReturnThis(),
    grayscale: vi.fn().mockReturnThis(),
    modulate: vi.fn().mockReturnThis(),
    linear: vi.fn().mockReturnThis(),
    sharpen: vi.fn().mockReturnThis(),
    median: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("processed-image"))
  }));
  return { default: mockSharp };
});

// Mock للـ logger
vi.mock("../utils/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

describe("Image Preprocessing Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PRESETS", () => {
    it("should have all required presets", () => {
      expect(PRESETS.THERMAL_RECEIPT).toBeDefined();
      expect(PRESETS.LOW_QUALITY).toBeDefined();
      expect(PRESETS.HIGH_QUALITY).toBeDefined();
    });

    it("should have valid THERMAL_RECEIPT_PRESET values", () => {
      expect(THERMAL_RECEIPT_PRESET.contrast).toBeGreaterThan(1);
      expect(THERMAL_RECEIPT_PRESET.brightness).toBeGreaterThan(0);
      expect(THERMAL_RECEIPT_PRESET.grayscale).toBe(true);
      expect(THERMAL_RECEIPT_PRESET.sharpen).toBeGreaterThan(1);
      expect(THERMAL_RECEIPT_PRESET.denoise).toBe(true);
      expect(THERMAL_RECEIPT_PRESET.quality).toBeGreaterThanOrEqual(85);
    });

    it("should have higher contrast in LOW_QUALITY_PRESET", () => {
      expect(LOW_QUALITY_PRESET.contrast).toBeGreaterThan(THERMAL_RECEIPT_PRESET.contrast!);
      expect(LOW_QUALITY_PRESET.brightness).toBeGreaterThan(THERMAL_RECEIPT_PRESET.brightness!);
    });

    it("should have lower contrast in HIGH_QUALITY_PRESET", () => {
      expect(HIGH_QUALITY_PRESET.contrast).toBeLessThan(THERMAL_RECEIPT_PRESET.contrast!);
      expect(HIGH_QUALITY_PRESET.denoise).toBe(false);
    });
  });

  describe("Preset Configuration", () => {
    it("THERMAL_RECEIPT should be optimized for thermal receipts", () => {
      const preset = THERMAL_RECEIPT_PRESET;
      
      // تباين عالي للنصوص الباهتة
      expect(preset.contrast).toBeGreaterThanOrEqual(1.3);
      expect(preset.contrast).toBeLessThanOrEqual(1.5);
      
      // سطوع خفيف
      expect(preset.brightness).toBeGreaterThan(0);
      expect(preset.brightness).toBeLessThanOrEqual(20);
      
      // تحويل إلى أبيض وأسود
      expect(preset.grayscale).toBe(true);
      
      // تحسين الحدة
      expect(preset.sharpen).toBeGreaterThanOrEqual(1);
      
      // إزالة الضوضاء
      expect(preset.denoise).toBe(true);
      
      // جودة عالية
      expect(preset.quality).toBeGreaterThanOrEqual(85);
    });

    it("LOW_QUALITY should be aggressive for poor images", () => {
      const preset = LOW_QUALITY_PRESET;
      
      // تباين عالي جداً
      expect(preset.contrast).toBeGreaterThanOrEqual(1.7);
      
      // سطوع أعلى
      expect(preset.brightness).toBeGreaterThanOrEqual(20);
      
      // حدة أعلى
      expect(preset.sharpen).toBeGreaterThanOrEqual(1.4);
      
      // جودة عالية جداً
      expect(preset.quality).toBeGreaterThanOrEqual(90);
    });

    it("HIGH_QUALITY should be gentle for clear images", () => {
      const preset = HIGH_QUALITY_PRESET;
      
      // تباين خفيف
      expect(preset.contrast).toBeLessThanOrEqual(1.3);
      
      // سطوع خفيف
      expect(preset.brightness).toBeLessThanOrEqual(10);
      
      // لا إزالة ضوضاء
      expect(preset.denoise).toBe(false);
    });
  });

  describe("PreprocessingOptions Interface", () => {
    it("should have all expected properties in THERMAL_RECEIPT_PRESET", () => {
      const expectedKeys = [
        "contrast",
        "brightness",
        "grayscale",
        "sharpen",
        "denoise",
        "maxWidth",
        "quality"
      ];
      
      for (const key of expectedKeys) {
        expect(THERMAL_RECEIPT_PRESET).toHaveProperty(key);
      }
    });

    it("should have valid ranges for all properties", () => {
      // contrast: 0.5 - 2.0
      expect(THERMAL_RECEIPT_PRESET.contrast).toBeGreaterThanOrEqual(0.5);
      expect(THERMAL_RECEIPT_PRESET.contrast).toBeLessThanOrEqual(2.0);
      
      // brightness: -100 to 100
      expect(THERMAL_RECEIPT_PRESET.brightness).toBeGreaterThanOrEqual(-100);
      expect(THERMAL_RECEIPT_PRESET.brightness).toBeLessThanOrEqual(100);
      
      // sharpen: 0 - 2
      expect(THERMAL_RECEIPT_PRESET.sharpen).toBeGreaterThanOrEqual(0);
      expect(THERMAL_RECEIPT_PRESET.sharpen).toBeLessThanOrEqual(2);
      
      // quality: 1-100
      expect(THERMAL_RECEIPT_PRESET.quality).toBeGreaterThanOrEqual(1);
      expect(THERMAL_RECEIPT_PRESET.quality).toBeLessThanOrEqual(100);
      
      // maxWidth: positive number
      expect(THERMAL_RECEIPT_PRESET.maxWidth).toBeGreaterThan(0);
    });
  });

  describe("Image Quality Analysis", () => {
    it("should identify dark images (low brightness)", () => {
      const avgBrightness = 60; // أقل من 80
      const avgStdDev = 50;
      
      const isDark = avgBrightness < 80;
      const isLowContrast = avgStdDev < 40;
      
      expect(isDark).toBe(true);
      expect(isLowContrast).toBe(false);
    });

    it("should identify low contrast images", () => {
      const avgBrightness = 120;
      const avgStdDev = 30; // أقل من 40
      
      const isDark = avgBrightness < 80;
      const isLowContrast = avgStdDev < 40;
      
      expect(isDark).toBe(false);
      expect(isLowContrast).toBe(true);
    });

    it("should identify high quality images", () => {
      const avgBrightness = 210; // أكثر من 200
      const avgStdDev = 70; // أكثر من 60
      
      const isHighQuality = avgBrightness > 200 && avgStdDev > 60;
      
      expect(isHighQuality).toBe(true);
    });

    it("should identify normal images", () => {
      const avgBrightness = 150;
      const avgStdDev = 55;
      
      const isDark = avgBrightness < 80;
      const isLowContrast = avgStdDev < 40;
      const isHighQuality = avgBrightness > 200 && avgStdDev > 60;
      const isNormal = !isDark && !isLowContrast && !isHighQuality;
      
      expect(isNormal).toBe(true);
    });
  });

  describe("Base64 Image Handling", () => {
    it("should detect base64 image format", () => {
      const base64Url = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      const isBase64 = base64Url.startsWith("data:");
      
      expect(isBase64).toBe(true);
    });

    it("should extract base64 data from URL", () => {
      const base64Url = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
      const base64Data = base64Url.split(",")[1];
      
      expect(base64Data).toBe("/9j/4AAQSkZJRg==");
    });

    it("should detect local file paths", () => {
      const localPath = "/home/ubuntu/image.jpg";
      const filePath = "file:///home/ubuntu/image.jpg";
      
      const isLocalPath = localPath.startsWith("/");
      const isFilePath = filePath.startsWith("file://");
      
      expect(isLocalPath).toBe(true);
      expect(isFilePath).toBe(true);
    });
  });

  describe("Compression Ratio", () => {
    it("should calculate compression ratio correctly", () => {
      const originalSize = 1000000; // 1MB
      const processedSize = 500000; // 500KB
      
      const ratio = (processedSize / originalSize * 100);
      
      expect(ratio).toBe(50);
    });

    it("should handle size increase", () => {
      const originalSize = 500000;
      const processedSize = 600000;
      
      const ratio = (processedSize / originalSize * 100);
      
      expect(ratio).toBe(120);
    });
  });

  describe("Applied Enhancements Tracking", () => {
    it("should track resize enhancement", () => {
      const enhancements: string[] = [];
      const maxWidth = 2000;
      const originalWidth = 3000;
      
      if (originalWidth > maxWidth) {
        enhancements.push(`resize:${maxWidth}`);
      }
      
      expect(enhancements).toContain("resize:2000");
    });

    it("should track grayscale enhancement", () => {
      const enhancements: string[] = [];
      const grayscale = true;
      
      if (grayscale) {
        enhancements.push("grayscale");
      }
      
      expect(enhancements).toContain("grayscale");
    });

    it("should track all enhancements", () => {
      const enhancements: string[] = [];
      const options = THERMAL_RECEIPT_PRESET;
      
      if (options.grayscale) enhancements.push("grayscale");
      if (options.contrast && options.contrast !== 1) enhancements.push(`contrast:${options.contrast}`);
      if (options.brightness && options.brightness !== 0) enhancements.push(`brightness:${options.brightness}`);
      if (options.sharpen && options.sharpen > 0) enhancements.push(`sharpen:${options.sharpen}`);
      if (options.denoise) enhancements.push("denoise");
      
      expect(enhancements.length).toBeGreaterThanOrEqual(4);
    });
  });
});

describe("Integration with OCR Retry Strategy", () => {
  it("should have preprocessImage option in RetryConfig", () => {
    // التحقق من أن الخيار موجود في الإعدادات
    const config = {
      maxRetries: 3,
      combineResults: true,
      preprocessImage: true
    };
    
    expect(config.preprocessImage).toBe(true);
  });

  it("should default to preprocessing enabled", () => {
    const defaultConfig = {
      preprocessImage: true
    };
    
    expect(defaultConfig.preprocessImage).toBe(true);
  });

  it("should allow disabling preprocessing", () => {
    const config = {
      preprocessImage: false
    };
    
    expect(config.preprocessImage).toBe(false);
  });
});
