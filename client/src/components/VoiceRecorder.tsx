/**
 * مكون التسجيل الصوتي للمساعد الذكي
 * يدعم تسجيل الصوت وتحويله إلى نص تلقائياً
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceRecorder({ 
  onTranscription, 
  onError, 
  disabled = false,
  className 
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // تنظيف عند إلغاء التحميل
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // تحليل مستوى الصوت للرسوم المتحركة
  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    setAudioLevel(average / 255);
    
    if (isRecording) {
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  // بدء التسجيل
  const startRecording = useCallback(async () => {
    try {
      // طلب إذن الميكروفون
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];
      
      // إعداد محلل الصوت للرسوم المتحركة
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      // إنشاء MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
        ? 'audio/webm;codecs=opus' 
        : 'audio/webm';
      
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        // إيقاف تتبع مستوى الصوت
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        
        // إيقاف المؤقت
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        
        // إيقاف البث
        stream.getTracks().forEach(track => track.stop());
        
        // معالجة الصوت
        await processAudio();
      };
      
      // بدء التسجيل
      mediaRecorder.start(100); // جمع البيانات كل 100ms
      setIsRecording(true);
      setRecordingDuration(0);
      
      // بدء المؤقت
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
      // بدء تتبع مستوى الصوت
      updateAudioLevel();
      
    } catch (error) {
      console.error('خطأ في بدء التسجيل:', error);
      onError?.('لم يتم السماح بالوصول إلى الميكروفون');
    }
  }, [onError, updateAudioLevel]);

  // إيقاف التسجيل
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  // معالجة الصوت وتحويله إلى نص
  const processAudio = async () => {
    if (audioChunksRef.current.length === 0) {
      onError?.('لم يتم تسجيل أي صوت');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // إنشاء Blob من chunks
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      // التحقق من حجم الملف (الحد الأقصى 16MB)
      const sizeMB = audioBlob.size / (1024 * 1024);
      if (sizeMB > 16) {
        onError?.('الملف الصوتي كبير جداً (الحد الأقصى 16MB)');
        setIsProcessing(false);
        return;
      }
      
      // رفع الملف إلى S3
      const formData = new FormData();
      formData.append('file', audioBlob, `voice-${Date.now()}.webm`);
      
      const uploadResponse = await fetch('/api/upload-audio', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('فشل رفع الملف الصوتي');
      }
      
      const { url: audioUrl } = await uploadResponse.json();
      
      // تحويل الصوت إلى نص
      const transcribeResponse = await fetch('/api/trpc/voice.transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          json: {
            audioUrl,
            language: 'ar',
            prompt: 'تحويل صوت الموظف إلى نص باللغة العربية',
          }
        }),
      });
      
      if (!transcribeResponse.ok) {
        throw new Error('فشل تحويل الصوت إلى نص');
      }
      
      const result = await transcribeResponse.json();
      const text = result.result?.data?.json?.text || result.result?.data?.text;
      
      if (text) {
        onTranscription(text);
      } else {
        onError?.('لم يتم التعرف على أي كلام');
      }
      
    } catch (error) {
      console.error('خطأ في معالجة الصوت:', error);
      onError?.(error instanceof Error ? error.message : 'حدث خطأ أثناء معالجة الصوت');
    } finally {
      setIsProcessing(false);
      setRecordingDuration(0);
      setAudioLevel(0);
    }
  };

  // تنسيق المدة
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* زر التسجيل */}
      <Button
        type="button"
        variant={isRecording ? 'destructive' : 'outline'}
        size="icon"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={disabled || isProcessing}
        className={cn(
          'relative transition-all duration-200',
          isRecording && 'animate-pulse'
        )}
        title={isRecording ? 'إيقاف التسجيل' : 'بدء التسجيل الصوتي'}
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <Square className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        
        {/* مؤشر مستوى الصوت */}
        {isRecording && (
          <span 
            className="absolute inset-0 rounded-md border-2 border-red-500 animate-ping opacity-75"
            style={{ 
              transform: `scale(${1 + audioLevel * 0.3})`,
              opacity: 0.3 + audioLevel * 0.4 
            }}
          />
        )}
      </Button>
      
      {/* مؤشر التسجيل */}
      {isRecording && (
        <div className="flex items-center gap-2 text-sm text-red-500 animate-pulse">
          <span className="w-2 h-2 bg-red-500 rounded-full" />
          <span>{formatDuration(recordingDuration)}</span>
        </div>
      )}
      
      {/* مؤشر المعالجة */}
      {isProcessing && (
        <span className="text-sm text-muted-foreground">
          جاري التحويل...
        </span>
      )}
    </div>
  );
}

export default VoiceRecorder;
