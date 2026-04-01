import { useRef, useState } from 'react';
import { logger } from '../utils/logger';

interface Props {
  onCapture: (base64: string) => void;
  loading?: boolean;
}

function compressImage(file: File, maxWidth = 1024, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) { reject(new Error('Image read failed')); return; }
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas context not available')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Strip the data:image/jpeg;base64, prefix
        resolve(dataUrl.split(',')[1]);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CameraCapture({ onCapture, loading }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setCaptureError(null);
    try {
      const base64 = await compressImage(file);
      onCapture(base64);
    } catch (err) {
      logger.error('camera_compression_failed', { message: err instanceof Error ? err.message : String(err) });
      setCaptureError('Could not process image. Please try another photo.');
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Take photo button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="w-full flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-48 active:bg-gray-100 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <>
            <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-sm font-medium text-gray-500">Analyzing your food...</span>
          </>
        ) : (
          <>
            <svg className="w-12 h-12 text-primary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Take a photo of your food</span>
            <span className="text-xs text-gray-400 mt-1">AI will identify and rate each item</span>
          </>
        )}
      </button>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {/* Or choose from gallery */}
      <button
        onClick={() => galleryInputRef.current?.click()}
        disabled={loading}
        className="w-full py-3 text-sm text-primary font-medium bg-primary-light/50 rounded-xl disabled:opacity-50 active:bg-primary-light transition-colors"
      >
        Choose from photo library
      </button>

      {captureError && (
        <div className="p-3 bg-fodmap-red/10 rounded-xl">
          <p className="text-sm text-fodmap-red">{captureError}</p>
        </div>
      )}
    </div>
  );
}
