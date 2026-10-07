import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Upload, ExternalLink, Copy, ScanLine } from 'lucide-react';
import { Panel, EmptyState, Spinner } from '../components/ui';
import { summarisePayload } from '../lib/payloads';
import { useApp } from '../store';

/**
 * Scanner.
 *
 * Uses the browser's native `BarcodeDetector`, which is hardware-accelerated
 * and needs no multi-megabyte decoding library. It is not available everywhere
 * (notably Safari and Firefox), so the UI says so plainly rather than failing
 * silently.
 *
 * This closes the loop on the whole app: generate a code here, scan it here,
 * and confirm it resolves to exactly what you encoded before you print 10,000
 * labels.
 */

interface DetectedCode {
  rawValue: string;
  format: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedCode[]>;
}

type BarcodeDetectorCtor = {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats(): Promise<string[]>;
};

function getDetectorCtor(): BarcodeDetectorCtor | null {
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

/** Classifies a scanned payload so we can offer the right follow-up action. */
function actionFor(value: string): { label: string; href: string } | null {
  if (/^https?:\/\//i.test(value)) return { label: 'Open link', href: value };
  if (/^mailto:/i.test(value)) return { label: 'Compose email', href: value };
  if (/^tel:/i.test(value)) return { label: 'Call number', href: value };
  if (/^geo:/i.test(value)) return { label: 'Open in maps', href: value };
  if (/^upi:\/\//i.test(value)) return { label: 'Open payment app', href: value };
  return null;
}

export default function Scanner() {
  const notify = useApp((s) => s.notify);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  const [supported] = useState(() => getDetectorCtor() !== null);
  const [scanning, setScanning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [results, setResults] = useState<DetectedCode[]>([]);

  // Always release the camera when leaving the page.
  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanning(false);
  }

  async function startCamera() {
    const Ctor = getDetectorCtor();
    if (!Ctor) return;

    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();

      const detector = new Ctor();
      setScanning(true);

      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          if (found.length > 0) {
            setResults(found.map((f) => ({ rawValue: f.rawValue, format: f.format })));
          }
        } catch {
          // Transient decode failures are normal between frames.
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };
      void tick();
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access and try again.'
          : 'Could not start the camera.';
      notify(msg, 'error');
    } finally {
      setStarting(false);
    }
  }

  async function scanImage(file: File | undefined) {
    const Ctor = getDetectorCtor();
    if (!file || !Ctor) return;
    try {
      const bitmap = await createImageBitmap(file);
      const found = await new Ctor().detect(bitmap);
      bitmap.close();
      if (found.length === 0) {
        notify('No code was found in that image.', 'error');
        return;
      }
      setResults(found.map((f) => ({ rawValue: f.rawValue, format: f.format })));
      notify(`Found ${found.length} code(s)`, 'success');
    } catch {
      notify('Could not read that image.', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">Scanner</h1>
        <p className="muted mt-1 text-[13px]">
          Verify a code before a production run: scan it and confirm it resolves to exactly what you
          encoded.
        </p>
      </header>

      {!supported ? (
        <Panel>
          <EmptyState
            icon={<CameraOff className="h-10 w-10" strokeWidth={1.5} />}
            title="Scanning is not available in this browser"
            description="CodeForge uses the browser's built-in barcode detector, which is currently supported in Chrome, Edge and other Chromium browsers on desktop and Android. Generation works everywhere."
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          <Panel
            title="Camera"
            action={
              scanning ? (
                <button className="btn-subtle px-2 py-1 text-[12px]" onClick={stopCamera}>
                  Stop
                </button>
              ) : null
            }
          >
            <div
              className="relative grid aspect-video place-items-center overflow-hidden rounded-xl2"
              style={{ background: 'rgb(var(--surface-sunken))', border: '1px solid rgb(var(--border))' }}
            >
              <video
                ref={videoRef}
                playsInline
                muted
                className={scanning ? 'h-full w-full object-cover' : 'hidden'}
              />

              {scanning && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <div className="h-48 w-48 rounded-xl2 border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              )}

              {!scanning && (
                <div className="p-6 text-center">
                  <ScanLine className="muted mx-auto mb-3 h-9 w-9 opacity-50" strokeWidth={1.5} />
                  <div className="flex flex-wrap justify-center gap-2">
                    <button className="btn-primary" onClick={startCamera} disabled={starting}>
                      {starting ? <Spinner /> : <Camera className="h-4 w-4" />}
                      Start camera
                    </button>
                    <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4" />
                      Scan an image
                    </button>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => scanImage(e.target.files?.[0])}
                  />
                </div>
              )}
            </div>
          </Panel>

          {results.length > 0 && (
            <Panel title="Scanned">
              <div className="space-y-3">
                {results.map((r, i) => {
                  const action = actionFor(r.rawValue);
                  return (
                    <div
                      key={`${r.rawValue}-${i}`}
                      className="rounded-lg border p-3.5"
                      style={{ background: 'rgb(var(--surface-sunken))' }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="chip bg-brand-600/12 font-mono text-brand-500">
                          {r.format}
                        </span>
                        <span className="muted text-[11.5px]">{summarisePayload(r.rawValue)}</span>
                      </div>

                      <p className="break-all font-mono text-[12.5px] leading-relaxed">
                        {r.rawValue}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          className="btn-ghost px-2.5 py-1.5 text-[12px]"
                          onClick={() => {
                            void navigator.clipboard.writeText(r.rawValue);
                            notify('Copied', 'success');
                          }}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Copy
                        </button>
                        {action && (
                          <a
                            className="btn-ghost px-2.5 py-1.5 text-[12px]"
                            href={action.href}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {action.label}
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}
