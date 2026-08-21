"use client";

import { useEffect, useRef, useState } from "react";
import QrScanner from "qr-scanner";

const INTERVALO_ENTRE_LEITURAS_MS = 10_000;

export default function CameraQrScanner({
  ativo,
  onResultado,
}: {
  ativo: boolean;
  onResultado: (codigo: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const ultimaLeituraRef = useRef(0);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!ativo || !videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        const agora = Date.now();
        if (agora - ultimaLeituraRef.current < INTERVALO_ENTRE_LEITURAS_MS) {
          return;
        }
        ultimaLeituraRef.current = agora;
        onResultado(result.data);
      },
      {
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 5,
      },
    );
    scannerRef.current = scanner;

    scanner.start().catch(() => {
      setErro(
        "Não foi possível acessar a câmera. Verifique as permissões do navegador.",
      );
    });

    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
  }, [ativo, onResultado]);

  if (!ativo) return null;

  return (
    <div className="overflow-hidden rounded-xl bg-[#111111]">
      {erro ? (
        <p className="p-6 text-center text-sm text-red-400">{erro}</p>
      ) : (
        <video ref={videoRef} className="aspect-square w-full object-cover" />
      )}
    </div>
  );
}
