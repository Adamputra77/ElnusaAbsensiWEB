import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw, X } from 'lucide-react';

interface ScannerProps {
  onScan: (decodedText: string) => void;
}

export default function Scanner({ onScan }: ScannerProps) {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [boxSize, setBoxSize] = useState(250);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "qr-reader-internal";

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const computedSize = isMobile ? Math.min(window.innerWidth * 0.7, 220) : 250;
    setBoxSize(computedSize);

    html5QrCodeRef.current = new Html5Qrcode(scannerId);

    const startCamera = async () => {
      try {
        const config = { 
          fps: 15, 
          qrbox: { width: computedSize, height: computedSize },
          aspectRatio: 1.0,
          formatsToSupport: [ 
            Html5QrcodeSupportedFormats.QR_CODE, 
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_39
          ]
        };

        // Prefer back camera
        await html5QrCodeRef.current?.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            // Success
            onScan(decodedText);
          },
          () => {
            // Ignore frame errors
          }
        );
        setIsCameraReady(true);
      } catch (err) {
        console.error("Camera Start Error:", err);
        setError("Gagal mengakses kamera. Pastikan izin diberikan.");
      }
    };

    startCamera();

    return () => {
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(e => console.error("Stop error", e));
      }
    };
  }, []);

  return (
    <div className="w-full aspect-square relative bg-black overflow-hidden flex items-center justify-center">
      <div id={scannerId} className="w-full h-full" />
      
      {!isCameraReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/80 backdrop-blur-sm z-10">
          <RefreshCw className="text-blue-500 animate-spin" size={32} />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Menyiapkan Kamera...</p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-red-950/90 backdrop-blur-sm z-10 p-6 text-center">
          <Camera className="text-red-500 mb-2" size={40} />
          <p className="text-sm font-bold text-red-200">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-red-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest"
          >
            Refresh Halaman
          </button>
        </div>
      )}

      {isCameraReady && (
        <div className="absolute inset-0 pointer-events-none z-20">
          {/* Scanning Box Outline */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/20 rounded-2xl"
            style={{ width: `${boxSize}px`, height: `${boxSize}px` }}
          >
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-sm animate-pulse"></div>
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-sm animate-pulse"></div>
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-sm animate-pulse"></div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-sm animate-pulse"></div>
          </div>
          
          <div className="absolute top-4 left-0 right-0 text-center">
            <span className="bg-black/50 backdrop-blur-md text-[8px] font-black text-white px-3 py-1 rounded-full uppercase tracking-widest border border-white/10">
              Arahkan ke Barcode / QR Code
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
