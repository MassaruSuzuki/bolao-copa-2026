import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
  pulse: number;
  pulseSpeed: number;
}

interface MousePos {
  x: number;
  y: number;
}

const GOLD = "201,162,39";
const WHITE = "255,255,255";

function hexPath(cx: number, cy: number, r: number, ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function LoginBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef<MousePos>({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      init();
    };

    const init = () => {
      const count = Math.floor((canvas.width * canvas.height) / 18000);
      particlesRef.current = Array.from({ length: Math.min(count, 60) }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 4 + Math.random() * 10,
        opacity: 0.04 + Math.random() * 0.10,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.005 + Math.random() * 0.01,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const bg = ctx.createRadialGradient(
        canvas.width * 0.5, canvas.height * 0.5, 0,
        canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.8
      );
      bg.addColorStop(0, "hsl(220,20%,9%)");
      bg.addColorStop(0.5, "hsl(220,20%,7%)");
      bg.addColorStop(1, "hsl(220,20%,4%)");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      if (mx > 0) {
        const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 280);
        glow.addColorStop(0, `rgba(${GOLD},0.06)`);
        glow.addColorStop(1, `rgba(${GOLD},0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      const particles = particlesRef.current;
      for (const p of particles) {
        p.pulse += p.pulseSpeed;
        const pulsedOpacity = p.opacity + Math.sin(p.pulse) * 0.03;

        const dx = p.x - mx;
        const dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const attracted = dist < 180;
        const boostOpacity = attracted ? pulsedOpacity + (1 - dist / 180) * 0.18 : pulsedOpacity;
        const boostRadius = attracted ? p.radius + (1 - dist / 180) * 4 : p.radius;

        hexPath(p.x, p.y, boostRadius, ctx);
        const isGold = p.radius > 9;
        ctx.strokeStyle = `rgba(${isGold ? GOLD : WHITE},${boostOpacity})`;
        ctx.lineWidth = isGold ? 1.2 : 0.6;
        ctx.stroke();

        if (isGold && boostOpacity > 0.08) {
          hexPath(p.x, p.y, boostRadius * 0.5, ctx);
          ctx.strokeStyle = `rgba(${GOLD},${boostOpacity * 0.5})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -30) p.x = canvas.width + 30;
        if (p.x > canvas.width + 30) p.x = -30;
        if (p.y < -30) p.y = canvas.height + 30;
        if (p.y > canvas.height + 30) p.y = -30;
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(${GOLD},${(1 - d / 120) * 0.06})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      const scanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
      scanGrad.addColorStop(0, `rgba(${GOLD},0.015)`);
      scanGrad.addColorStop(0.5, `rgba(${GOLD},0)`);
      scanGrad.addColorStop(1, `rgba(${GOLD},0.02)`);
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

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
