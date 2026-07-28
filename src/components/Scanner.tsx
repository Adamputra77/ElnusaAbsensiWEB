import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, RefreshCw, ExternalLink } from 'lucide-react';

interface ScannerProps {
  onScan: (decodedText: string) => void;
}

function isIOSPwa(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.navigator as any).standalone === true
  );
}

function isIOS(): boolean {
  return (
    typeof window !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
}

function getCameraErrorMessage(err: unknown): string {
  const e = err as DOMException;
  switch (e.name) {
    case 'NotAllowedError':
      return 'Izin kamera ditolak. Buka Pengaturan Safari > Kamera > Izinkan.';
    case 'NotFoundError':
      return 'Kamera tidak ditemukan di perangkat ini.';
    case 'NotReadableError':
      return 'Kamera sedang digunakan aplikasi lain. Tutup aplikasi kamera lain.';
    case 'OverconstrainedError':
      return 'Kamera belakang tidak tersedia. Coba gunakan input manual NIK.';
    default:
      return 'Gagal mengakses kamera. Pastikan izin diberikan.';
  }
}

export default function Scanner({ onScan }: ScannerProps) {
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [boxSize, setBoxSize] = useState(250);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = 'qr-reader-internal';
  const isPwa = isIOSPwa();
  const isiOS = isIOS();
  const computedSize = useRef(250);

  const calcBoxSize = () => {
    const isMobile = window.innerWidth < 768;
    return isMobile ? Math.min(window.innerWidth * 0.7, 220) : 250;
  };

  useEffect(() => {
    const size = calcBoxSize();
    computedSize.current = size;
    setBoxSize(size);

    const handleResize = () => {
      const s = calcBoxSize();
      computedSize.current = s;
      setBoxSize(s);
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
        startCameraWithRetry();
      }
    };

    window.addEventListener('resize', handleResize);

    html5QrCodeRef.current = new Html5Qrcode(scannerId);

    const tryStart = async (facing: 'environment' | 'user'): Promise<boolean> => {
      try {
        const config = {
          fps: 15,
          qrbox: { width: computedSize.current, height: computedSize.current },
          aspectRatio: 1.0,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.CODE_39,
          ],
        };

        await html5QrCodeRef.current!.start(
          { facingMode: facing },
          config,
          (decodedText) => onScan(decodedText),
          () => {}
        );
        setCameraFacing(facing);
        setIsCameraReady(true);
        return true;
      } catch {
        return false;
      }
    };

    const startCameraWithRetry = async () => {
      setError(null);
      setIsCameraReady(false);

      const ok = await tryStart('environment');
      if (ok) return;

      const ok2 = await tryStart('user');
      if (ok2) return;

      try {
        await html5QrCodeRef.current!.start(
          { facingMode: { exact: 'environment' } },
          {
            fps: 10,
            qrbox: { width: computedSize.current, height: computedSize.current },
            formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          },
          (decodedText) => onScan(decodedText),
          () => {}
        );
        setCameraFacing('environment');
        setIsCameraReady(true);
      } catch (err) {
        console.error('Camera Start Error:', err);
        setError(getCameraErrorMessage(err));
      }
    };

    if (isPwa && isiOS) {
      setError('Buka halaman ini di Safari, bukan dari Home Screen. Tap "Share" > "Add to Home Screen" lalu buka dari Safari dulu sekali untuk izinkan kamera.');
      return;
    }

    startCameraWithRetry();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
    };
  }, []);

  return (
    <div className="w-full aspect-square relative bg-black overflow-hidden flex items-center justify-center">
      <div id={scannerId} className="w-full h-full" />

      {!isCameraReady && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-900/80 backdrop-blur-sm z-10">
          <RefreshCw className="text-blue-500 animate-spin" size={32} />
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            Menyiapkan Kamera...
          </p>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-red-950/90 backdrop-blur-sm z-10 p-6 text-center">
          <Camera className="text-red-500 mb-2" size={40} />
          <p className="text-sm font-bold text-red-200 leading-relaxed">{error}</p>
          <div className="flex flex-col gap-2 mt-2">
            {!isPwa && (
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-red-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-red-500"
              >
                Coba Lagi
              </button>
            )}
            {isiOS && (
              <a
                href={window.location.href}
                className="px-6 py-2 bg-blue-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:bg-blue-500 flex items-center justify-center gap-2"
              >
                <ExternalLink size={12} />
                Buka di Safari
              </a>
            )}
          </div>
        </div>
      )}

      {isCameraReady && (
        <div className="absolute inset-0 pointer-events-none z-20">
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border-2 border-white/20 rounded-2xl"
            style={{ width: `${boxSize}px`, height: `${boxSize}px` }}
          >
            <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-blue-500 rounded-tl-sm animate-pulse" />
            <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-blue-500 rounded-tr-sm animate-pulse" />
            <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-blue-500 rounded-bl-sm animate-pulse" />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-blue-500 rounded-br-sm animate-pulse" />
          </div>

          <div className="absolute top-4 left-0 right-0 text-center">
            <span className="bg-black/50 backdrop-blur-md text-[8px] font-black text-white px-3 py-1 rounded-full uppercase tracking-widest border border-white/10">
              {cameraFacing === 'user' ? 'Gunakan Kamera Depan' : 'Arahkan ke Barcode / QR Code'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
