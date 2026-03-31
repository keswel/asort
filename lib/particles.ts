export function initParticles(count = 60) {
  if (typeof window === "undefined") return;
  const canvas = document.createElement("canvas");
  Object.assign(canvas.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    zIndex: "1",
    pointerEvents: "none",
  });
  document.body.prepend(canvas);
  const ctx = canvas.getContext("2d")!;
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);
  type Particle = { x: number; y: number; vx: number; vy: number; r: number; alpha: number };
  const particles: Particle[] = Array.from({ length: count }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 2 + 1,
    alpha: Math.random() * 0.5 + 0.1,
  }));
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const contentLeft = (canvas.width - 672) / 2;
    const contentRight = contentLeft + 672;
    const inContent = (p: Particle) => p.x > contentLeft && p.x < contentRight;

    // draw connection lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        if (inContent(particles[i]) || inContent(particles[j])) continue;
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(0, 0, 0, ${0.08 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    // draw particles
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 0, 0, ${inContent(p) ? p.alpha * 0.15 : p.alpha})`;
      ctx.fill();
    }

    requestAnimationFrame(tick);
  };
  tick();
}
