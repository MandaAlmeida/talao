"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

export default function QRCodeDisplay({
  value,
  size = 220,
  dim = false,
}: {
  value: string;
  size?: number;
  dim?: boolean;
}) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    QRCode.toString(value, { type: "svg", margin: 1, width: size }).then(
      (result) => {
        if (!cancelado) setSvg(result);
      },
    );
    return () => {
      cancelado = true;
    };
  }, [value, size]);

  if (!svg) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
      />
    );
  }

  return (
    <div
      className={`inline-block rounded-lg bg-white p-3 ${dim ? "opacity-40 grayscale" : ""}`}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
