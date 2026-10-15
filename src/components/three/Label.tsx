// Billboard text label drawn to a canvas texture.
// Used instead of drei <Html>, whose per-label React roots race with React 19
// unmounts (removeChild errors when leaving a 3D view).

import React, { useEffect, useMemo } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';

interface LabelProps {
  lines: string[];
  position: [number, number, number];
  accent?: string;
  /** world-units height of one text line */
  size?: number;
}

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif';

export const Label: React.FC<LabelProps> = ({ lines, position, accent, size = 0.22 }) => {
  const { texture, aspect, rows } = useMemo(() => {
    const scale = 4; // supersample for crisp text
    const padX = 14 * scale;
    const padY = 8 * scale;
    const lineH = 22 * scale;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const fonts = lines.map((_, i) => `${i === 0 ? 700 : 500} ${(i === 0 ? 15 : 13) * scale}px ${FONT}`);
    const width = Math.max(
      ...lines.map((l, i) => {
        ctx.font = fonts[i];
        return ctx.measureText(l).width;
      })
    );
    canvas.width = Math.ceil(width + padX * 2 + (accent ? 6 * scale : 0));
    canvas.height = Math.ceil(lines.length * lineH + padY * 2);

    const r = 8 * scale;
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath();
    ctx.roundRect(0, 0, canvas.width, canvas.height, r);
    ctx.fill();
    if (accent) {
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.roundRect(0, 0, 6 * scale, canvas.height, [r, 0, 0, r]);
      ctx.fill();
    }
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      ctx.font = fonts[i];
      ctx.fillStyle = i === 0 ? '#1d1d1f' : '#6e6e73';
      ctx.fillText(l, padX + (accent ? 6 * scale : 0), padY + lineH * i + lineH / 2);
    });

    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = 4;
    return { texture: tex, aspect: canvas.width / canvas.height, rows: lines.length };
  }, [lines.join('\n'), accent]);

  useEffect(() => () => texture.dispose(), [texture]);

  const h = size * rows + size * 0.7;
  return (
    <sprite position={position} scale={[h * aspect, h, 1]} renderOrder={10}>
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
};
