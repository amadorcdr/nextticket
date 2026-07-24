import { useEffect, useRef } from 'react';

export function AuroraBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;
    let t = 0;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    const orbs = [
      { x: 0.2, y: 0.3, r: 0.55, color: '124,58,237', speed: 0.00018 },
      { x: 0.8, y: 0.6, r: 0.50, color: '0,83,219', speed: 0.00022 },
      { x: 0.5, y: 0.8, r: 0.45, color: '167,139,250', speed: 0.00015 },
      { x: 0.1, y: 0.7, r: 0.40, color: '88,28,220', speed: 0.00020 },
    ];
    const draw = () => {
      const w = canvas.width, h = canvas.height;
      t += 1;
      ctx.clearRect(0, 0, w, h);
      orbs.forEach((orb, i) => {
        const angle = t * orb.speed * Math.PI * 2 + i * 1.2;
        const px = (orb.x + Math.sin(angle) * 0.18) * w;
        const py = (orb.y + Math.cos(angle * 0.7) * 0.14) * h;
        const radius = orb.r * Math.min(w, h);
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, `rgba(${orb.color},0.22)`);
        grad.addColorStop(0.4, `rgba(${orb.color},0.10)`);
        grad.addColorStop(1, `rgba(${orb.color},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(px, py, radius * 1.3, radius * 0.8, angle * 0.3, 0, Math.PI * 2);
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }} />
  );
}
