import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '../utils/logger';
import type { Html5Qrcode as Html5QrcodeType } from 'html5-qrcode';
import type { User, FodmapRating } from '../types';
import { useOpenFoodFacts } from '../hooks/useOpenFoodFacts';
import { useDiary } from '../hooks/useDiary';
import { analyzeIngredients } from '../utils/fodmapAnalyzer';
import { toDateString } from '../utils/dateHelpers';
import IngredientAnalysis from '../components/IngredientAnalysis';
import ProductNameFallback from '../components/ProductNameFallback';

type ScanState = 'idle' | 'scanning' | 'result';

// Quick log button for scan results
function LogToDiaryButton({ productName, rating, addEntry }: {
  productName: string;
  rating: FodmapRating;
  addEntry: (date: string, meal: 'breakfast' | 'lunch' | 'dinner' | 'snack', foods: { name: string; rating: FodmapRating; fodmapTypes: string[] }[]) => void;
}) {
  const [logged, setLogged] = useState(false);
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);

  const today = toDateString(new Date());

  if (logged) {
    return (
      <div className="p-3 bg-fodmap-green/10 rounded-xl text-center">
        <p className="text-sm text-fodmap-green font-medium">Added to diary!</p>
      </div>
    );
  }

  if (meal === null) {
    return (
      <div className="p-3 bg-primary-light/50 rounded-xl">
        <p className="text-xs text-gray-500 mb-2">Log this to your diary?</p>
        <div className="grid grid-cols-4 gap-2">
          {([
            { key: 'breakfast' as const, label: '🌅' },
            { key: 'lunch' as const, label: '☀️' },
            { key: 'dinner' as const, label: '🌙' },
            { key: 'snack' as const, label: '🍎' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                setMeal(key);
                addEntry(today, key, [{
                  name: productName,
                  rating,
                  fodmapTypes: [],
                }]);
                setLogged(true);
              }}
              className="py-2 bg-white rounded-lg text-center text-lg active:scale-95 transition-transform shadow-sm"
              title={key}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

interface Props {
  user: User;
}

export default function ScanScreen({ user }: Props) {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [manualBarcode, setManualBarcode] = useState('');
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef<Html5QrcodeType | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const torchOnRef = useRef(false);
  const scannerContainerId = 'barcode-scanner';

  const { loading, product, error, notFound, lookup, reset } = useOpenFoodFacts();
  const { addEntry } = useDiary(user);

  const stopScanner = useCallback(async () => {
    // Turn off torch before stopping
    if (videoTrackRef.current && torchOnRef.current) {
      try {
        await videoTrackRef.current.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] });
      } catch { /* ignore */ }
      torchOnRef.current = false;
      setTorchOn(false);
    }
    videoTrackRef.current = null;
    setTorchSupported(false);

    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
      } catch (err) {
        logger.warn('scan_stop_scanner_failed', { message: err instanceof Error ? err.message : String(err) });
      }
      scannerRef.current = null;
    }
  }, []);

  const handleBarcode = useCallback(async (barcode: string) => {
    setScannedBarcode(barcode);
    await stopScanner();
    setScanState('result');
    lookup(barcode);
  }, [stopScanner, lookup]);

  const toggleTorch = useCallback(async () => {
    const track = videoTrackRef.current;
    if (!track) return;
    const newState = !torchOnRef.current;
    try {
      await track.applyConstraints({ advanced: [{ torch: newState } as MediaTrackConstraintSet] });
      torchOnRef.current = newState;
      setTorchOn(newState);
    } catch (err) {
      logger.warn('torch_toggle_failed', { message: err instanceof Error ? err.message : String(err) });
    }
  }, []);

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setScanState('scanning');

    await new Promise((r) => setTimeout(r, 100));

    try {
      // Dynamic import — html5-qrcode (~200KB) only loads when user taps scan
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');

      const scanner = new Html5Qrcode(scannerContainerId, {
        // Only scan barcode formats (skip QR — faster detection)
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });
      scannerRef.current = scanner;

      // Use most of the viewport width for scan area — larger box helps small screens
      const containerWidth = Math.min(window.innerWidth - 32, 500);
      const scanWidth = Math.round(containerWidth * 0.92);
      const scanHeight = Math.round(scanWidth * 0.5);

      await scanner.start(
        {
          facingMode: 'environment',
          // Prefer 720p — ideal means "accept lower on older cameras"
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // Autofocus hint: continuous mode helps older cameras lock on barcodes faster
          // (in advanced so unsupported browsers silently ignore it)
          advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet],
        },
        {
          fps: 10, // Lower fps reduces CPU load on older phones
          qrbox: { width: scanWidth, height: scanHeight },
          aspectRatio: 1.5,
          disableFlip: false,
        },
        (decodedText) => {
          handleBarcode(decodedText);
        },
        () => {
          // ignore scan failures (no barcode in frame)
        }
      );

      // Probe for torch support after camera stream is live
      setTimeout(() => {
        const videoEl = document.querySelector(`#${scannerContainerId} video`) as HTMLVideoElement | null;
        const track = (videoEl?.srcObject as MediaStream | null)?.getVideoTracks?.()[0];
        if (track) {
          videoTrackRef.current = track;
          const capabilities = track.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
          if (capabilities?.torch) {
            setTorchSupported(true);
          }
        }
      }, 600);

    } catch (err) {
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access and try again.');
      } else if (errName === 'NotFoundError') {
        setCameraError('No camera found. Use manual barcode entry below.');
      } else if (errName === 'OverconstrainedError') {
        // Retry without advanced constraints (autofocus hint not supported)
        setCameraError('Could not start camera. Try manual entry instead.');
      } else {
        setCameraError('Could not start camera. Try manual entry instead.');
      }
      setScanState('idle');
    }
  }, [handleBarcode]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, [stopScanner]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const barcode = manualBarcode.trim();
    if (!barcode) return;
    if (!/^\d{8}$|^\d{12,13}$/.test(barcode)) {
      setBarcodeError('Please enter an 8 or 13-digit barcode number.');
      return;
    }
    setBarcodeError(null);
    handleBarcode(barcode);
  };

  const handleScanAgain = () => {
    reset();
    setScannedBarcode('');
    setManualBarcode('');
    setScanState('idle');
  };

  const ingredientText =
    product?.ingredients_text ||
    product?.ingredients_text_nl ||
    product?.ingredients_text_fr ||
    '';

  const analysis = ingredientText ? analyzeIngredients(ingredientText) : null;

  return (
    <div className="flex-1 px-4 pt-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Scan Product</h1>

      {/* Scanner area */}
      {scanState === 'idle' && (
        <>
          <button
            onClick={startScanner}
            className="w-full flex flex-col items-center justify-center bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl h-48 mb-4 active:bg-gray-100 transition-colors"
          >
            <svg className="w-12 h-12 text-primary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Tap to scan barcode</span>
            <span className="text-xs text-gray-400 mt-1">Point camera at product barcode</span>
          </button>

          {cameraError && (
            <div className="p-3 bg-fodmap-red/10 rounded-xl mb-4">
              <p className="text-sm text-fodmap-red">{cameraError}</p>
            </div>
          )}
        </>
      )}

      {scanState === 'scanning' && (
        <div className="mb-4">
          <div id={scannerContainerId} className="rounded-xl overflow-hidden mb-3" style={{ minHeight: '280px' }} />
          <p className="text-xs text-gray-400 text-center mb-2">Hold steady — keep barcode inside the box</p>
          <div className="flex gap-2">
            <button
              onClick={async () => { await stopScanner(); setScanState('idle'); }}
              className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl"
            >
              Cancel scan
            </button>
            {torchSupported && (
              <button
                onClick={toggleTorch}
                aria-label={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  torchOn
                    ? 'bg-yellow-400 text-yellow-900'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {torchOn ? '🔦 On' : '🔦 Off'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {scanState === 'result' && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs bg-gray-100 px-2 py-1 rounded-full text-gray-500 font-mono">
              {scannedBarcode}
            </span>
            <button
              onClick={handleScanAgain}
              className="text-xs text-primary font-medium ml-auto"
            >
              Scan another
            </button>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm text-gray-500">Looking up product...</p>
              <p className="text-xs text-gray-300 mt-1">Searching Open Food Facts database</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-fodmap-red/10 rounded-xl">
              <p className="text-sm text-fodmap-red">{error}</p>
            </div>
          )}

          {notFound && (
            <div className="p-4 bg-gray-50 rounded-xl text-center">
              <span className="text-3xl mb-2 block">🤷</span>
              <p className="text-sm font-medium text-gray-700 mb-1">Product not found</p>
              <p className="text-xs text-gray-500">
                This barcode isn't in the Open Food Facts database. Try taking a photo of the ingredient list instead.
              </p>
            </div>
          )}

          {product && (
            <div className="flex flex-col gap-3">
              {/* Product info card */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex gap-3">
                  {product.image_front_small_url && (
                    <img
                      src={product.image_front_small_url}
                      alt={product.product_name}
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {product.product_name || 'Unknown product'}
                    </h3>
                    {product.brands && (
                      <p className="text-xs text-gray-400">{product.brands}</p>
                    )}
                  </div>
                </div>
              </div>

              {/* FODMAP analysis */}
              {analysis ? (
                <IngredientAnalysis
                  rating={analysis.rating}
                  flags={analysis.flags}
                  ingredientText={ingredientText}
                />
              ) : (
                <ProductNameFallback productName={product.product_name} />
              )}

              {/* Log to diary — Fix #5 */}
              <LogToDiaryButton
                productName={product.product_name || 'Unknown product'}
                rating={analysis?.rating || 'green'}
                addEntry={addEntry}
              />
            </div>
          )}
        </div>
      )}

      {/* Manual barcode entry */}
      <form onSubmit={handleManualSubmit} className="mt-2">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Manual barcode entry
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            placeholder="Enter barcode number..."
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="submit"
            disabled={!manualBarcode.trim()}
            className="px-5 py-3 bg-primary text-white text-sm font-medium rounded-xl disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            Look up
          </button>
        </div>
        {barcodeError && (
          <p className="text-xs text-fodmap-red mt-1.5">{barcodeError}</p>
        )}
      </form>

      {/* File input fallback for camera issues */}
      <div className="mt-4">
        <label className="block text-xs text-gray-400 mb-1">
          Or upload a photo of the barcode
        </label>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const { Html5Qrcode } = await import('html5-qrcode');
              const scanner = new Html5Qrcode('file-scanner-temp');
              const result = await scanner.scanFile(file, true);
              handleBarcode(result);
            } catch {
              setCameraError('Could not read barcode from image. Try manual entry.');
            }
          }}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:bg-gray-100 file:text-gray-600"
        />
        <div id="file-scanner-temp" className="hidden" />
      </div>
    </div>
  );
}
