import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import type { User, FodmapRating } from '../types';
import { useOpenFoodFacts } from '../hooks/useOpenFoodFacts';
import { useDiary } from '../hooks/useDiary';
import { analyzeIngredients, searchFoods } from '../utils/fodmapAnalyzer';
import IngredientAnalysis from '../components/IngredientAnalysis';
import FoodCard from '../components/FoodCard';

type ScanState = 'idle' | 'scanning' | 'result';

function ProductNameFallback({ productName }: { productName: string }) {
  const words = productName.toLowerCase().split(/[\s,\-\/]+/).filter(w => w.length > 2);
  const matches = words.flatMap(w => searchFoods(w));
  const unique = [...new Map(matches.map(f => [f.name, f])).values()];

  if (unique.length > 0) {
    return (
      <div>
        <p className="text-xs text-gray-400 mb-2">
          No ingredient list available. Based on the product name, here's what we found:
        </p>
        <div className="flex flex-col gap-2">
          {unique.slice(0, 3).map((food) => (
            <FoodCard key={food.name} food={food} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 bg-gray-50 rounded-xl">
      <p className="text-sm text-gray-500">
        No ingredient list available for this product. Try taking a photo of the ingredient list instead.
      </p>
    </div>
  );
}

// Quick log button for scan results
function LogToDiaryButton({ productName, rating, user }: {
  productName: string;
  rating: FodmapRating;
  user: User;
}) {
  const { addEntry } = useDiary(user);
  const [logged, setLogged] = useState(false);
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);

  const today = new Date().toISOString().split('T')[0];

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
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-scanner';

  const { loading, product, error, notFound, lookup, reset } = useOpenFoodFacts();

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2) { // SCANNING
          await scannerRef.current.stop();
        }
      } catch {
        // ignore stop errors
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

  const startScanner = useCallback(async () => {
    setCameraError(null);
    setScanState('scanning');

    await new Promise((r) => setTimeout(r, 100));

    try {
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          handleBarcode(decodedText);
        },
        () => {
          // ignore scan failures (no barcode in frame)
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setCameraError('Camera permission denied. Please allow camera access and try again.');
      } else if (msg.includes('NotFound') || msg.includes('device')) {
        setCameraError('No camera found. Use manual barcode entry below.');
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
    if (manualBarcode.trim()) {
      handleBarcode(manualBarcode.trim());
    }
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
          <div id={scannerContainerId} className="rounded-xl overflow-hidden mb-3" />
          <button
            onClick={async () => { await stopScanner(); setScanState('idle'); }}
            className="w-full py-2.5 text-sm text-gray-600 bg-gray-100 rounded-xl"
          >
            Cancel scan
          </button>
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
                user={user}
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
            className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="submit"
            disabled={!manualBarcode.trim()}
            className="px-5 py-3 bg-primary text-white text-sm font-medium rounded-xl disabled:opacity-40 active:scale-[0.98] transition-transform"
          >
            Look up
          </button>
        </div>
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
