/**
 * خوارزميات معالجة الصور المتقدمة
 * Advanced Image Processing Algorithms
 * 
 * تقنيات متقدمة لتحسين جودة الصور للـ OCR:
 * 1. Bilateral Filter - تنعيم مع الحفاظ على الحواف
 * 2. Unsharp Masking - تحسين الحدة المتقدم
 * 3. Multi-scale Retinex - تحسين الإضاءة الديناميكي
 * 4. Super Resolution - رفع الدقة
 * 5. Adaptive Binarization - تحويل ثنائي تكيفي
 */

// ==================== الأنواع ====================

export interface ProcessingOptions {
  enableBilateralFilter?: boolean;
  enableUnsharpMasking?: boolean;
  enableRetinex?: boolean;
  enableSuperResolution?: boolean;
  enableAdaptiveBinarization?: boolean;
  superResolutionScale?: number;
}

export interface ProcessingResult {
  success: boolean;
  canvas: HTMLCanvasElement;
  enhancements: string[];
  processingTimeMs: number;
}

// ==================== الثوابت ====================

const DEFAULT_OPTIONS: Required<ProcessingOptions> = {
  enableBilateralFilter: true,
  enableUnsharpMasking: true,
  enableRetinex: true,
  enableSuperResolution: false, // يزيد الحجم، اختياري
  enableAdaptiveBinarization: false, // للإيصالات الحرارية فقط
  superResolutionScale: 2
};

// ==================== Bilateral Filter ====================
/**
 * Bilateral Filter - تنعيم الصورة مع الحفاظ على الحواف
 * يزيل الضوضاء دون تشويش الحواف الحادة (النص)
 */
export function applyBilateralFilter(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spatialSigma: number = 3,
  rangeSigma: number = 30
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const original = new Uint8ClampedArray(data);
  
  const kernelSize = Math.ceil(spatialSigma * 3) * 2 + 1;
  const halfKernel = Math.floor(kernelSize / 2);
  
  // Pre-compute spatial Gaussian weights
  const spatialWeights: number[][] = [];
  for (let dy = -halfKernel; dy <= halfKernel; dy++) {
    spatialWeights[dy + halfKernel] = [];
    for (let dx = -halfKernel; dx <= halfKernel; dx++) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      spatialWeights[dy + halfKernel][dx + halfKernel] = 
        Math.exp(-(dist * dist) / (2 * spatialSigma * spatialSigma));
    }
  }
  
  // Apply bilateral filter
  for (let y = halfKernel; y < height - halfKernel; y++) {
    for (let x = halfKernel; x < width - halfKernel; x++) {
      const idx = (y * width + x) * 4;
      
      for (let c = 0; c < 3; c++) {
        let weightedSum = 0;
        let totalWeight = 0;
        const centerValue = original[idx + c];
        
        for (let dy = -halfKernel; dy <= halfKernel; dy++) {
          for (let dx = -halfKernel; dx <= halfKernel; dx++) {
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            const neighborValue = original[nIdx + c];
            
            // Range weight (intensity similarity)
            const intensityDiff = Math.abs(neighborValue - centerValue);
            const rangeWeight = Math.exp(-(intensityDiff * intensityDiff) / (2 * rangeSigma * rangeSigma));
            
            // Combined weight
            const weight = spatialWeights[dy + halfKernel][dx + halfKernel] * rangeWeight;
            
            weightedSum += neighborValue * weight;
            totalWeight += weight;
          }
        }
        
        data[idx + c] = Math.round(weightedSum / totalWeight);
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

// ==================== Unsharp Masking ====================
/**
 * Unsharp Masking المتقدم - تحسين الحدة باستخدام 7x7 kernel
 * يزيد وضوح الحواف والنص بشكل كبير
 */
export function applyUnsharpMasking(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  amount: number = 1.5,
  radius: number = 2,
  threshold: number = 3
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const original = new Uint8ClampedArray(data);
  
  // Create Gaussian blur kernel (7x7)
  const kernelSize = 7;
  const halfKernel = 3;
  const sigma = radius;
  
  const kernel: number[][] = [];
  let kernelSum = 0;
  
  for (let y = 0; y < kernelSize; y++) {
    kernel[y] = [];
    for (let x = 0; x < kernelSize; x++) {
      const dx = x - halfKernel;
      const dy = y - halfKernel;
      const value = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
      kernel[y][x] = value;
      kernelSum += value;
    }
  }
  
  // Normalize kernel
  for (let y = 0; y < kernelSize; y++) {
    for (let x = 0; x < kernelSize; x++) {
      kernel[y][x] /= kernelSum;
    }
  }
  
  // Apply unsharp masking
  for (let y = halfKernel; y < height - halfKernel; y++) {
    for (let x = halfKernel; x < width - halfKernel; x++) {
      const idx = (y * width + x) * 4;
      
      for (let c = 0; c < 3; c++) {
        // Calculate blurred value
        let blurredValue = 0;
        
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const nIdx = ((y + ky - halfKernel) * width + (x + kx - halfKernel)) * 4;
            blurredValue += original[nIdx + c] * kernel[ky][kx];
          }
        }
        
        // Calculate difference (high-frequency component)
        const diff = original[idx + c] - blurredValue;
        
        // Apply threshold
        if (Math.abs(diff) > threshold) {
          // Sharpen
          const sharpened = original[idx + c] + diff * amount;
          data[idx + c] = clamp(sharpened);
        }
      }
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

// ==================== Multi-scale Retinex ====================
/**
 * Multi-scale Retinex (MSR) - تحسين الإضاءة الديناميكي
 * يوازن الإضاءة عبر الصورة ويحسن التباين المحلي
 */
export function applyMultiScaleRetinex(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scales: number[] = [15, 80, 250]
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Convert to float for processing
  const floatData: number[][] = [[], [], []];
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      floatData[c].push(Math.log(data[i + c] + 1));
    }
  }
  
  // Apply Retinex for each scale
  const retinexResults: number[][][] = [];
  
  for (const scale of scales) {
    const scaleResult: number[][] = [[], [], []];
    
    // Create Gaussian kernel for this scale
    const kernelSize = Math.min(Math.ceil(scale * 3) * 2 + 1, 51); // Limit kernel size
    const halfKernel = Math.floor(kernelSize / 2);
    
    // Simple box blur approximation for large scales (faster)
    for (let c = 0; c < 3; c++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          
          // Calculate local average
          let sum = 0;
          let count = 0;
          
          const startY = Math.max(0, y - halfKernel);
          const endY = Math.min(height - 1, y + halfKernel);
          const startX = Math.max(0, x - halfKernel);
          const endX = Math.min(width - 1, x + halfKernel);
          
          for (let ny = startY; ny <= endY; ny += 2) { // Sample every 2 pixels for speed
            for (let nx = startX; nx <= endX; nx += 2) {
              sum += floatData[c][ny * width + nx];
              count++;
            }
          }
          
          const localAvg = sum / count;
          scaleResult[c].push(floatData[c][idx] - localAvg);
        }
      }
    }
    
    retinexResults.push(scaleResult);
  }
  
  // Combine scales
  const numScales = scales.length;
  for (let i = 0; i < data.length / 4; i++) {
    for (let c = 0; c < 3; c++) {
      let sum = 0;
      for (let s = 0; s < numScales; s++) {
        sum += retinexResults[s][c][i];
      }
      
      // Normalize and convert back
      const retinexValue = sum / numScales;
      
      // Apply gain and offset for better visualization
      const gain = 128;
      const offset = 128;
      const finalValue = retinexValue * gain + offset;
      
      data[i * 4 + c] = clamp(finalValue);
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

// ==================== Super Resolution ====================
/**
 * Super Resolution - رفع دقة الصورة باستخدام Bicubic Interpolation
 * يضاعف حجم الصورة مع الحفاظ على التفاصيل
 */
export function applySuperResolution(
  canvas: HTMLCanvasElement,
  scale: number = 2
): HTMLCanvasElement {
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  
  const originalWidth = canvas.width;
  const originalHeight = canvas.height;
  const newWidth = Math.round(originalWidth * scale);
  const newHeight = Math.round(originalHeight * scale);
  
  // Create new canvas
  const newCanvas = document.createElement('canvas');
  newCanvas.width = newWidth;
  newCanvas.height = newHeight;
  
  const newCtx = newCanvas.getContext('2d');
  if (!newCtx) return canvas;
  
  // Use high-quality scaling
  newCtx.imageSmoothingEnabled = true;
  newCtx.imageSmoothingQuality = 'high';
  
  // Draw scaled image
  newCtx.drawImage(canvas, 0, 0, newWidth, newHeight);
  
  // Apply sharpening to compensate for interpolation blur
  applyUnsharpMasking(newCtx, newWidth, newHeight, 0.8, 1.5, 2);
  
  return newCanvas;
}

// ==================== Adaptive Binarization ====================
/**
 * Adaptive Binarization (Sauvola's method) - تحويل ثنائي تكيفي
 * مثالي للإيصالات الحرارية والنصوص على خلفيات متغيرة
 */
export function applyAdaptiveBinarization(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  windowSize: number = 25,
  k: number = 0.2
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Convert to grayscale
  const gray: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    gray.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }
  
  const halfWindow = Math.floor(windowSize / 2);
  const R = 128; // Dynamic range of standard deviation
  
  // Calculate integral image and integral squared image
  const integral: number[] = new Array(width * height).fill(0);
  const integralSq: number[] = new Array(width * height).fill(0);
  
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSumSq = 0;
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const val = gray[idx];
      rowSum += val;
      rowSumSq += val * val;
      
      if (y === 0) {
        integral[idx] = rowSum;
        integralSq[idx] = rowSumSq;
      } else {
        integral[idx] = integral[(y - 1) * width + x] + rowSum;
        integralSq[idx] = integralSq[(y - 1) * width + x] + rowSumSq;
      }
    }
  }
  
  // Apply Sauvola's thresholding
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      
      // Calculate window bounds
      const x1 = Math.max(0, x - halfWindow);
      const y1 = Math.max(0, y - halfWindow);
      const x2 = Math.min(width - 1, x + halfWindow);
      const y2 = Math.min(height - 1, y + halfWindow);
      
      const count = (x2 - x1 + 1) * (y2 - y1 + 1);
      
      // Calculate sum using integral image
      let sum = integral[y2 * width + x2];
      let sumSq = integralSq[y2 * width + x2];
      
      if (x1 > 0) {
        sum -= integral[y2 * width + (x1 - 1)];
        sumSq -= integralSq[y2 * width + (x1 - 1)];
      }
      if (y1 > 0) {
        sum -= integral[(y1 - 1) * width + x2];
        sumSq -= integralSq[(y1 - 1) * width + x2];
      }
      if (x1 > 0 && y1 > 0) {
        sum += integral[(y1 - 1) * width + (x1 - 1)];
        sumSq += integralSq[(y1 - 1) * width + (x1 - 1)];
      }
      
      const mean = sum / count;
      const variance = (sumSq / count) - (mean * mean);
      const stdDev = Math.sqrt(Math.max(0, variance));
      
      // Sauvola's threshold
      const threshold = mean * (1 + k * ((stdDev / R) - 1));
      
      // Apply threshold
      const binaryValue = gray[idx] > threshold ? 255 : 0;
      
      data[idx * 4] = binaryValue;
      data[idx * 4 + 1] = binaryValue;
      data[idx * 4 + 2] = binaryValue;
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
}

// ==================== الدالة الرئيسية ====================
/**
 * معالجة الصورة المتقدمة - تطبيق جميع التحسينات
 */
export async function processImageAdvanced(
  canvas: HTMLCanvasElement,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  const startTime = performance.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const enhancements: string[] = [];
  
  try {
    let currentCanvas = canvas;
    let ctx = currentCanvas.getContext('2d', { willReadFrequently: true });
    
    if (!ctx) {
      throw new Error('فشل إنشاء سياق الرسم');
    }
    
    const width = currentCanvas.width;
    const height = currentCanvas.height;
    
    // 1. Bilateral Filter - تنعيم مع الحفاظ على الحواف
    if (opts.enableBilateralFilter) {
      applyBilateralFilter(ctx, width, height, 3, 30);
      enhancements.push('تنعيم ذكي');
    }
    
    // 2. Multi-scale Retinex - تحسين الإضاءة
    if (opts.enableRetinex) {
      applyMultiScaleRetinex(ctx, width, height, [15, 80, 250]);
      enhancements.push('تحسين الإضاءة المتقدم');
    }
    
    // 3. Unsharp Masking - تحسين الحدة
    if (opts.enableUnsharpMasking) {
      applyUnsharpMasking(ctx, width, height, 1.5, 2, 3);
      enhancements.push('تحسين الحدة القصوى');
    }
    
    // 4. Super Resolution - رفع الدقة (اختياري)
    if (opts.enableSuperResolution) {
      currentCanvas = applySuperResolution(currentCanvas, opts.superResolutionScale);
      ctx = currentCanvas.getContext('2d', { willReadFrequently: true });
      enhancements.push(`رفع الدقة ${opts.superResolutionScale}x`);
    }
    
    // 5. Adaptive Binarization - تحويل ثنائي (اختياري)
    if (opts.enableAdaptiveBinarization && ctx) {
      applyAdaptiveBinarization(ctx, currentCanvas.width, currentCanvas.height, 25, 0.2);
      enhancements.push('تحويل ثنائي تكيفي');
    }
    
    const processingTimeMs = Math.round(performance.now() - startTime);
    
    return {
      success: true,
      canvas: currentCanvas,
      enhancements,
      processingTimeMs
    };
    
  } catch (error) {
    console.error('فشل معالجة الصورة المتقدمة:', error);
    return {
      success: false,
      canvas,
      enhancements: [],
      processingTimeMs: Math.round(performance.now() - startTime)
    };
  }
}

// ==================== دوال مساعدة ====================

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

/**
 * تحويل الصورة إلى Canvas
 */
export async function imageToCanvas(base64Data: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('فشل إنشاء سياق الرسم'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error('فشل تحميل الصورة'));
    img.src = base64Data;
  });
}

/**
 * تحويل Canvas إلى base64
 */
export function canvasToBase64(canvas: HTMLCanvasElement, format: string = 'jpeg', quality: number = 0.9): string {
  return canvas.toDataURL(`image/${format}`, quality);
}

/**
 * معالجة الصورة الكاملة من base64 إلى base64
 */
export async function processBase64ImageAdvanced(
  base64Data: string,
  options: ProcessingOptions = {}
): Promise<{ success: boolean; base64Data: string; enhancements: string[]; processingTimeMs: number }> {
  try {
    const canvas = await imageToCanvas(base64Data);
    const result = await processImageAdvanced(canvas, options);
    
    if (!result.success) {
      return {
        success: false,
        base64Data,
        enhancements: [],
        processingTimeMs: result.processingTimeMs
      };
    }
    
    const processedBase64 = canvasToBase64(result.canvas, 'jpeg', 0.92);
    
    return {
      success: true,
      base64Data: processedBase64,
      enhancements: result.enhancements,
      processingTimeMs: result.processingTimeMs
    };
    
  } catch (error) {
    console.error('فشل معالجة الصورة:', error);
    return {
      success: false,
      base64Data,
      enhancements: [],
      processingTimeMs: 0
    };
  }
}
