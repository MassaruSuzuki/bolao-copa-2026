import { useEffect, useRef } from "react";

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  rotation: number;
  rotSpeed: number;
}

interface MousePos {
  x: number;
  y: number;
}

function drawField(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mx: number,
  my: number
) {
  // --- Background: dark cinematic green ---
  ctx.fillStyle = "#050c06";
  ctx.fillRect(0, 0, w, h);

  // Subtle mouse-reactive radial light over the field
  if (mx > 0) {
    const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 320);
    glow.addColorStop(0, "rgba(255,255,220,0.045)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
  }

  // Field dimensions (centered, proportional)
  const fieldW = Math.min(w * 0.88, 900);
  const fieldH = fieldW * 0.63;
  const fx = (w - fieldW) / 2;
  const fy = (h - fieldH) / 2;

  // --- Grass stripes ---
  const stripeCount = 14;
  const stripeW = fieldW / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(15,48,20,0.92)" : "rgba(18,56,24,0.92)";
    ctx.fillRect(fx + i * stripeW, fy, stripeW, fieldH);
  }

  // --- Field border glow ---
  ctx.save();
  ctx.shadowColor = "rgba(50,255,80,0.18)";
  ctx.shadowBlur = 18;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2.5;
  ctx.strokeRect(fx, fy, fieldW, fieldH);
  ctx.restore();

  const lineStyle = () => {
    ctx.strokeStyle = "rgba(255,255,255,0.50)";
    ctx.lineWidth = 1.8;
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
  };

  ctx.save();

  // --- Midfield line ---
  lineStyle();
  ctx.beginPath();
  ctx.moveTo(fx + fieldW / 2, fy);
  ctx.lineTo(fx + fieldW / 2, fy + fieldH);
  ctx.stroke();

  // --- Center circle ---
  const cr = fieldH * 0.155;
  ctx.beginPath();
  ctx.arc(fx + fieldW / 2, fy + fieldH / 2, cr, 0, Math.PI * 2);
  ctx.stroke();

  // Center dot
  ctx.beginPath();
  ctx.arc(fx + fieldW / 2, fy + fieldH / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fill();

  // --- Penalty areas ---
  const paW = fieldW * 0.16;
  const paH = fieldH * 0.56;
  const paY = fy + (fieldH - paH) / 2;

  // Left penalty area
  ctx.strokeRect(fx, paY, paW, paH);
  // Right penalty area
  ctx.strokeRect(fx + fieldW - paW, paY, paW, paH);

  // --- Goal areas (6-yard box) ---
  const gaW = fieldW * 0.065;
  const gaH = fieldH * 0.28;
  const gaY = fy + (fieldH - gaH) / 2;

  ctx.strokeRect(fx, gaY, gaW, gaH);
  ctx.strokeRect(fx + fieldW - gaW, gaY, gaW, gaH);

  // --- Goals ---
  const goalW = fieldW * 0.012;
  const goalH = fieldH * 0.14;
  const goalY = fy + (fieldH - goalH) / 2;

  ctx.strokeStyle = "rgba(255,255,255,0.40)";
  ctx.lineWidth = 2;
  ctx.strokeRect(fx - goalW, goalY, goalW, goalH);
  ctx.strokeRect(fx + fieldW, goalY, goalW, goalH);

  // --- Penalty spots ---
  const spotR = 3;
  ctx.fillStyle = "rgba(255,255,255,0.50)";
  ctx.beginPath();
  ctx.arc(fx + fieldW * 0.115, fy + fieldH / 2, spotR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(fx + fieldW * 0.885, fy + fieldH / 2, spotR, 0, Math.PI * 2);
  ctx.fill();

  // --- Penalty arc ---
  const arcR = cr;
  ctx.strokeStyle = "rgba(255,255,255,0.50)";
  ctx.lineWidth = 1.8;

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx + paW, fy, fieldW - 2 * paW, fieldH);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(fx + fieldW * 0.115, fy + fieldH / 2, arcR, -Math.PI * 0.62, Math.PI * 0.62);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(fx, fy, fieldW - paW, fieldH);
  ctx.clip();
  ctx.beginPath();
  ctx.arc(fx + fieldW * 0.885, fy + fieldH / 2, arcR, Math.PI - Math.PI * 0.62, Math.PI + Math.PI * 0.62);
  ctx.stroke();
  ctx.restore();

  // --- Corner arcs ---
  const cornerR = fieldH * 0.05;
  ctx.strokeStyle = "rgba(255,255,255,0.48)";
  ctx.lineWidth = 1.8;

  ctx.beginPath();
  ctx.arc(fx, fy, cornerR, 0, Math.PI / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fx + fieldW, fy, cornerR, Math.PI / 2, Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fx, fy + fieldH, cornerR, -Math.PI / 2, 0);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(fx + fieldW, fy + fieldH, cornerR, Math.PI, Math.PI * 1.5);
  ctx.stroke();

  ctx.restore();

  // --- Dark vignette overlay ---
  const vig = ctx.createRadialGradient(w / 2, h / 2, fieldH * 0.2, w / 2, h / 2, w * 0.75);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(0.55, "rgba(0,0,0,0.3)");
  vig.addColorStop(1, "rgba(0,0,0,0.85)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Return field bounds for use in particle clipping / positioning
  return { fx, fy, fieldW, fieldH };
}

function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  rotation: number,
  opacity: number
) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(x, y);
  ctx.rotate(rotation);

  // Ball circle
  ctx.beginPath();
  ctx.arc(0, 0, size, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Classic pentagon patch pattern (simplified)
  ctx.fillStyle = "rgba(20,20,20,0.80)";
  const patches = [
    [0, 0],
    [0, -size * 0.58],
    [size * 0.55, -size * 0.18],
    [size * 0.34, size * 0.47],
    [-size * 0.34, size * 0.47],
    [-size * 0.55, -size * 0.18],
  ];
  for (const [px, py] of patches) {
    ctx.beginPath();
    const pr = size * (px === 0 && py === 0 ? 0.22 : 0.16);
    // Draw a pentagon
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const ppx = px + pr * Math.cos(angle);
      const ppy = py + pr * Math.sin(angle);
      if (i === 0) ctx.moveTo(ppx, ppy);
      else ctx.lineTo(ppx, ppy);
    }
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

export function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<MousePos>({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const ballsRef = useRef<Ball[]>([]);
  const fieldRef = useRef({ fx: 0, fy: 0, fieldW: 800, fieldH: 500 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      initBalls();
    };

    const initBalls = () => {
      const count = 12;
      ballsRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: 4 + Math.random() * 8,
        opacity: 0.08 + Math.random() * 0.18,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
      }));
    };

    const draw = () => {
      const { width: w, height: h } = canvas;
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Draw football field
      const fieldBounds = drawField(ctx, w, h, mx, my);
      fieldRef.current = fieldBounds;

      // Draw floating balls
      for (const b of ballsRef.current) {
        // Mouse repulsion
        const dx = b.x - mx;
        const dy = b.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 140) {
          const force = (1 - dist / 140) * 0.8;
          b.vx += (dx / dist) * force * 0.06;
          b.vy += (dy / dist) * force * 0.06;
        }

        // Damping
        b.vx *= 0.985;
        b.vy *= 0.985;

        // Speed cap
        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (speed > 2.5) { b.vx = (b.vx / speed) * 2.5; b.vy = (b.vy / speed) * 2.5; }

        b.x += b.vx;
        b.y += b.vy;
        b.rotation += b.rotSpeed;

        // Wrap
        if (b.x < -20) b.x = w + 20;
        if (b.x > w + 20) b.x = -20;
        if (b.y < -20) b.y = h + 20;
        if (b.y > h + 20) b.y = -20;

        // Boost opacity near mouse
        const boostOpacity = dist < 160 ? b.opacity + (1 - dist / 160) * 0.25 : b.opacity;

        drawBall(ctx, b.x, b.y, b.size, b.rotation, boostOpacity);
      }

      // Spotlight follow: subtle golden light near mouse
      if (mx > 0 && mx < w) {
        const spot = ctx.createRadialGradient(mx, my, 0, mx, my, 90);
        spot.addColorStop(0, "rgba(201,162,39,0.07)");
        spot.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, w, h);
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    resize();
    draw();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}
