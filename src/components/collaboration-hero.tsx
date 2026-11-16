import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Sparkles, Zap, Award } from "lucide-react";
import { Typewriter } from "@/components/ui/typewriter-text";

export function CollaborationHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Canvas particle animation with glowing ember & constellation effects
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = canvas.parentElement?.clientWidth || 600);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 800);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener("resize", handleResize);

    // Particle pool
    const count = 48;
    const particles = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.45,
      vy: -0.25 - Math.random() * 0.55, // Upward floating embers
      size: Math.random() * 2.2 + 0.8,
      alpha: Math.random() * 0.7 + 0.3,
      pulse: Math.random() * Math.PI * 2,
      color:
        Math.random() > 0.4
          ? "217, 93, 57" // Terracotta Orange
          : Math.random() > 0.5
          ? "251, 191, 36" // Warm Gold
          : "255, 255, 255", // Crisp White
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw constellation proximity lines
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        if (!p1) continue;
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          if (!p2) continue;
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 85) {
            const lineAlpha = (1 - dist / 85) * 0.16;
            ctx.strokeStyle = `rgba(217, 93, 57, ${lineAlpha})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }

      // Draw glowing particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += 0.03;

        // Wrap around borders
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        const currentAlpha = Math.max(0.15, p.alpha + Math.sin(p.pulse) * 0.2);

        // Radial glow
        const rad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
        rad.addColorStop(0, `rgba(${p.color}, ${currentAlpha})`);
        rad.addColorStop(1, `rgba(${p.color}, 0)`);
        ctx.fillStyle = rad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2);
        ctx.fill();

        // Core dot
        ctx.fillStyle = `rgba(${p.color}, ${Math.min(1, currentAlpha + 0.3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const typewriterQuotes = [
    "Where Visionary Ideas Converge with Autonomous Evaluation.",
    "Official Hackathon Partnership: INNOVEDGE × NEXUS.",
    "Empowering Student Builders with AI Evaluation Intelligence.",
  ];

  return (
    <div className="relative h-full min-h-[600px] w-full overflow-hidden bg-[#0A0C10] flex flex-col items-center justify-between p-8 sm:p-12 select-none">
      {/* Dynamic 3D Mesh Glowing Nebulas */}
      <motion.div
        animate={{
          scale: [1, 1.18, 1],
          opacity: [0.35, 0.55, 0.35],
          x: [0, 20, 0],
          y: [0, -15, 0],
        }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-24 -right-24 size-[440px] rounded-full bg-gradient-to-br from-terracotta/40 via-amber-500/25 to-transparent blur-[90px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.25, 1],
          opacity: [0.25, 0.45, 0.25],
          x: [0, -25, 0],
          y: [0, 20, 0],
        }}
        transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-24 -left-24 size-[480px] rounded-full bg-gradient-to-tr from-amber-600/35 via-rose-500/20 to-transparent blur-[100px] pointer-events-none"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-terracotta/10 via-transparent to-black/60 pointer-events-none" />

      {/* Interactive Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 size-full pointer-events-none z-0" />

      {/* Subtle Tech Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.15) 1px, transparent 1px)`,
          backgroundSize: "44px 44px",
        }}
      />

      {/* Top Header Pill Badge */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="relative z-10 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 backdrop-blur-md px-4 py-1.5 shadow-lg shadow-amber-500/5"
      >
        <span className="flex size-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-[11px] font-bold tracking-widest uppercase text-amber-200">
          Official Partnership Edition
        </span>
        <Sparkles className="size-3 text-amber-300" />
      </motion.div>

      {/* Center 3D Showcase: Floating Favicon + INNOVEDGE ✕ NEXUS */}
      <div className="relative z-10 my-auto flex flex-col items-center text-center max-w-lg w-full">
        {/* Animated Favicon Logo with Glowing Orbital Rings */}
        <motion.div
          animate={{
            y: [-7, 7, -7],
            rotateZ: [-1.5, 1.5, -1.5],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative mb-6 group cursor-pointer"
        >
          {/* Outer Pulsing Glow Aura */}
          <div className="absolute -inset-4 rounded-full bg-gradient-to-r from-terracotta/40 via-amber-400/30 to-terracotta/40 blur-xl opacity-75 group-hover:opacity-100 transition-opacity animate-pulse" />

          {/* Rotating Dashed Orbital Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
            className="absolute -inset-3 rounded-full border border-dashed border-amber-400/30"
          />

          {/* Inner Glowing Badge Frame */}
          <div className="relative size-28 sm:size-32 rounded-3xl p-1 bg-gradient-to-b from-amber-300/40 via-terracotta/30 to-amber-600/40 shadow-2xl shadow-terracotta/30 backdrop-blur-xl">
            <div className="size-full rounded-[22px] bg-gradient-to-b from-[#181B22] to-[#0D0F14] flex items-center justify-center border border-white/10 overflow-hidden relative">
              {/* Specular sheen reflection */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />

              <img
                src="/favicon.png"
                alt="INNOVEDGE Crest Logo"
                className="size-20 sm:size-24 object-contain filter drop-shadow-[0_8px_16px_rgba(217,93,57,0.45)] transition-transform duration-500 group-hover:scale-110"
              />
            </div>
          </div>
        </motion.div>

        {/* ─── LINE 1: INNOVEDGE ─── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-1"
        >
          <h2 className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-400 drop-shadow-[0_2px_18px_rgba(251,191,36,0.25)]">
            INNOVEDGE
          </h2>
          <div className="text-[10px] sm:text-xs font-semibold tracking-[0.28em] uppercase text-amber-200/75">
            Innovation & Entrepreneurship Development
          </div>
        </motion.div>

        {/* ─── LINE 2: CROSS "✕" (COLLABORATION DIVIDER) ─── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="my-3 sm:my-4 flex items-center justify-center gap-3 w-full max-w-[280px]"
        >
          <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-amber-500/40 to-amber-500/80" />
          <motion.div
            animate={{
              scale: [1, 1.15, 1],
              boxShadow: [
                "0 0 10px rgba(217,93,57,0.3)",
                "0 0 22px rgba(217,93,57,0.7)",
                "0 0 10px rgba(217,93,57,0.3)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center justify-center size-9 sm:size-10 rounded-full bg-gradient-to-br from-terracotta to-amber-600 border border-amber-300/40 text-white font-extrabold text-base sm:text-lg shadow-lg cursor-default select-none"
          >
            ✕
          </motion.div>
          <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent via-terracotta/40 to-terracotta/80" />
        </motion.div>

        {/* ─── LINE 3: NEXUS ─── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="space-y-1"
        >
          <h2 className="font-display font-black text-3xl sm:text-4xl lg:text-5xl tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-terracotta via-orange-400 to-amber-300 drop-shadow-[0_2px_22px_rgba(217,93,57,0.35)]">
            NEXUS
          </h2>
          <div className="text-[10px] sm:text-xs font-semibold tracking-[0.28em] uppercase text-orange-200/80">
            Sapthagiri Tech Hackathon Ecosystem
          </div>
        </motion.div>

        {/* Collaboration Feature Badges */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-3 py-1 text-[11px] text-white/90">
            <Zap className="size-3 text-amber-400" />
            <span>AI Automated Grading</span>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-3 py-1 text-[11px] text-white/90">
            <Award className="size-3 text-terracotta" />
            <span>Official Qualifier 2026</span>
          </div>
        </motion.div>
      </div>

      {/* Bottom Footer: Typewriter Tagline & Live Indicator */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.8 }}
        className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-4 text-center shadow-xl shadow-black/20"
      >
        <blockquote className="space-y-1.5 text-white">
          <p className="text-xs sm:text-sm font-medium tracking-wide text-amber-100/90 leading-relaxed">
            “
            <Typewriter
              text={typewriterQuotes}
              loop={true}
              speed={45}
              delay={2200}
              deleteSpeed={25}
            />
            ”
          </p>
          <div className="flex items-center justify-center gap-2 pt-1 text-[10px] tracking-widest uppercase font-mono text-white/50">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            INNOVEDGE × NEXUS LIVE PLATFORM
          </div>
        </blockquote>
      </motion.div>
    </div>
  );
}
