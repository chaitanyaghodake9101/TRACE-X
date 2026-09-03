import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Zap,
  ArrowRight,
  Lock,
  Network,
  Cpu,
  Fingerprint,
  Radio,
  FileCheck2,
  Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';
import { authApi } from '../services/api';

interface LoadingStep {
  label: string;
  detail: string;
  icon: React.ElementType;
}

const INITIALIZATION_STEPS: LoadingStep[] = [
  {
    label: 'Cryptographic Security Core',
    detail: 'Initializing SHA-256 evidentiary chain-of-custody engine...',
    icon: Fingerprint
  },
  {
    label: 'Graph Analytics Engine',
    detail: 'Connecting to Neo4j multi-hop crime relationship network...',
    icon: Network
  },
  {
    label: 'Bayesian Hypothesis Engine',
    detail: 'Calibrating ACH scoring matrices and inconsistency penalizers...',
    icon: Cpu
  },
  {
    label: 'Evidentiary Provenance DB',
    detail: 'System verified. Ready for authorized law enforcement intake.',
    icon: FileCheck2
  }
];

export const WelcomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  const existingToken = localStorage.getItem('tracex_token');
  const existingUser = localStorage.getItem('tracex_user');
  const isLoggedIn = !!(existingToken && existingUser);

  // 1. Dynamic Interactive Particle Network Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Particle nodes definition
    const particleCount = Math.min(Math.floor((width * height) / 14000), 75);
    const particles: Array<{
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      pulse: number;
      pulseSpeed: number;
    }> = [];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        radius: Math.random() * 2 + 1.5,
        pulse: Math.random() * Math.PI,
        pulseSpeed: 0.02 + Math.random() * 0.03
      });
    }

    let mouseX = width / 2;
    let mouseY = height / 2;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    window.addEventListener('mousemove', handleMouseMove);

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Node colors based on theme
      const nodeColor = isDark ? 'rgba(6, 182, 212, ' : 'rgba(14, 116, 144, ';
      const linkColor = isDark ? 'rgba(6, 182, 212, ' : 'rgba(59, 130, 246, ';

      // Update and draw particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.pulse += p.pulseSpeed;

        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Interactive mouse gravity / drift
        const dx = mouseX - p.x;
        const dy = mouseY - p.y;
        const distToMouse = Math.sqrt(dx * dx + dy * dy);
        if (distToMouse < 180) {
          p.x += (dx / distToMouse) * 0.4;
          p.y += (dy / distToMouse) * 0.4;
        }

        const currentRadius = p.radius + Math.sin(p.pulse) * 0.8;
        const opacity = 0.4 + Math.sin(p.pulse) * 0.3;

        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(currentRadius, 1), 0, Math.PI * 2);
        ctx.fillStyle = `${nodeColor}${opacity})`;
        ctx.fill();

        // Connect nearby nodes with relationship edges
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 130) {
            const lineOpacity = (1 - dist / 130) * (isDark ? 0.22 : 0.16);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `${linkColor}${lineOpacity})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDark]);

  // 2. Animated Initialization Sequence
  useEffect(() => {
    const totalDuration = 2200; // ms
    const intervalTime = 35;
    const stepIncrement = 100 / (totalDuration / intervalTime);

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + stepIncrement;
        if (next >= 100) {
          clearInterval(interval);
          setIsReady(true);
          return 100;
        }

        // Update step index based on progress
        if (next < 25) setCurrentStepIndex(0);
        else if (next < 50) setCurrentStepIndex(1);
        else if (next < 75) setCurrentStepIndex(2);
        else setCurrentStepIndex(3);

        return next;
      });
    }, intervalTime);

    return () => clearInterval(interval);
  }, []);

  // 3. Automatic Enter / Redirect after loading completes
  useEffect(() => {
    if (isReady) {
      const redirectTimer = setTimeout(() => {
        const token = localStorage.getItem('tracex_token');
        if (token) {
          navigate('/cases', { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      }, 600);

      return () => clearTimeout(redirectTimer);
    }
  }, [isReady, navigate]);

  const handleEnterWorkspace = () => {
    if (isLoggedIn) {
      navigate('/cases');
    } else {
      navigate('/login');
    }
  };

  const handleDemoAccess = async () => {
    try {
      setDemoLoading(true);
      const data = await authApi.loginGoogle('mock-demo-token');
      localStorage.setItem('tracex_token', data.access_token);
      localStorage.setItem('tracex_user', JSON.stringify(data.user));
      navigate('/cases');
    } catch (err) {
      // Fallback demo storage if backend is disconnected
      localStorage.setItem('tracex_token', 'mock-demo-token-fallback');
      localStorage.setItem(
        'tracex_user',
        JSON.stringify({
          id: 'demo-officer-01',
          full_name: 'Inspector Rajesh Malhotra (Demo)',
          email: 'demo.investigator@tracex.gov.in',
          role: 'senior_investigator',
          badge_number: 'DL-POL-8841',
          station: 'Special Cell / Connaught Place PS',
          is_active: true
        })
      );
      navigate('/cases');
    } finally {
      setDemoLoading(false);
    }
  };

  const ActiveIcon = INITIALIZATION_STEPS[currentStepIndex]?.icon || Sparkles;

  return (
    <div className={`relative min-h-screen flex flex-col justify-between overflow-hidden selection:bg-cyan-500 selection:text-white transition-colors duration-500 ${
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    }`}>
      {/* Background Interactive Network Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-auto z-0 opacity-80"
      />

      {/* Ambient Gradient Glows */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full blur-[140px] pointer-events-none transition-opacity duration-700 ${
        isDark ? 'bg-cyan-500/15 opacity-100' : 'bg-cyan-400/20 opacity-80'
      }`} />
      <div className={`absolute bottom-0 right-10 w-[500px] h-[300px] rounded-full blur-[130px] pointer-events-none transition-opacity duration-700 ${
        isDark ? 'bg-blue-600/10 opacity-100' : 'bg-blue-400/15 opacity-70'
      }`} />

      {/* Top Header / Status Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-xl border flex items-center justify-center transition-all ${
            isDark
              ? 'bg-cyan-950/80 border-cyan-800/80 text-cyan-400 shadow-lg shadow-cyan-500/20'
              : 'bg-white border-slate-200 text-cyan-600 shadow-md shadow-slate-200'
          }`}>
            <Shield className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold tracking-wider text-sm bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
                TRACE-X
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                isDark ? 'bg-slate-900 text-cyan-300 border-slate-800' : 'bg-slate-100 text-cyan-800 border-slate-200'
              }`}>
                v1.0 • MHA SIH26189
              </span>
            </div>
            <span className={`text-[10px] tracking-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Ministry of Home Affairs Evaluation
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className={`hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-mono ${
            isDark ? 'bg-slate-900/80 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
          }`}>
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Nodes: Connected</span>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="relative z-10 w-full max-w-3xl mx-auto px-6 py-8 flex flex-col items-center text-center space-y-8 my-auto">
        {/* Animated Cyber Shield Insignia */}
        <div className="relative group">
          {/* Pulsing Radar Ring */}
          <div className="absolute -inset-4 rounded-full border border-cyan-500/30 animate-ping opacity-25 pointer-events-none" />
          <div className="absolute -inset-8 rounded-full border border-dashed border-cyan-500/20 animate-radar-sweep pointer-events-none" />

          {/* Central Shield Icon Container */}
          <div className={`relative p-5 rounded-3xl border shadow-2xl transition-all duration-500 animate-pulse-glow ${
            isDark
              ? 'bg-gradient-to-b from-slate-900 to-slate-950 border-cyan-500/50 text-cyan-400 shadow-cyan-500/20'
              : 'bg-gradient-to-b from-white to-slate-100 border-cyan-400 text-cyan-600 shadow-cyan-500/20'
          }`}>
            <Shield className="w-14 h-14" />
          </div>
        </div>

        {/* Title & Tagline Hierarchy */}
        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-500 bg-clip-text text-transparent">
              TRACE-X
            </span>
          </h1>

          <p className={`text-base sm:text-lg md:text-xl font-semibold tracking-wide ${
            isDark ? 'text-slate-200' : 'text-slate-800'
          }`}>
            Trusted Relationship & Analytical Crime Engine
          </p>

          <p className={`text-xs sm:text-sm max-w-lg mx-auto font-normal leading-relaxed ${
            isDark ? 'text-slate-400' : 'text-slate-600'
          }`}>
            AI-assisted, human-reviewed criminal network analysis for law enforcement intelligence teams.
          </p>
        </div>

        {/* Prototype Synthetic Data Disclaimer Banner */}
        <div className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-all ${
          isDark
            ? 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300'
            : 'bg-cyan-50 border-cyan-200 text-cyan-800'
        }`}>
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
          <span>Prototype uses synthetic demonstration data.</span>
        </div>

        {/* Loading Progress & System Initialization Diagnostics */}
        <div className={`w-full max-w-lg p-5 rounded-2xl border backdrop-blur-md shadow-xl transition-all space-y-4 ${
          isDark
            ? 'bg-slate-900/80 border-slate-800 shadow-slate-950/60'
            : 'bg-white/90 border-slate-200 shadow-slate-200/80'
        }`}>
          {/* Progress Bar & Percentage */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-mono">
              <div className="flex items-center space-x-2">
                <ActiveIcon className={`w-4 h-4 ${isReady ? 'text-emerald-400' : 'text-cyan-400 animate-spin'}`} />
                <span className={`font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                  {INITIALIZATION_STEPS[currentStepIndex]?.label}
                </span>
              </div>
              <span className="text-cyan-400 font-bold">{Math.round(progress)}%</span>
            </div>

            {/* Visual Bar */}
            <div className={`w-full h-2 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-teal-400 to-blue-500 transition-all duration-150 ease-out rounded-full shadow-lg shadow-cyan-500/50"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Diagnostic Subtext */}
          <p className={`text-[11px] font-mono leading-relaxed truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            {INITIALIZATION_STEPS[currentStepIndex]?.detail}
          </p>

          {/* Initialization Stages Badges */}
          <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-800/40">
            {INITIALIZATION_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isCompleted = progress >= (idx + 1) * 25;
              const isCurrent = currentStepIndex === idx;

              return (
                <div
                  key={step.label}
                  className={`flex flex-col items-center p-1.5 rounded-lg border text-[10px] font-mono transition-all ${
                    isCompleted
                      ? isDark
                        ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : isCurrent
                      ? isDark
                        ? 'bg-cyan-950/40 border-cyan-800/70 text-cyan-300'
                        : 'bg-cyan-50 border-cyan-300 text-cyan-800'
                      : isDark
                      ? 'bg-slate-900/40 border-slate-800/50 text-slate-600'
                      : 'bg-slate-100 border-slate-200 text-slate-400'
                  }`}
                >
                  <StepIcon className="w-3.5 h-3.5 mb-1" />
                  <span className="truncate w-full text-center text-[9px]">
                    {idx === 0 ? 'Security' : idx === 1 ? 'Graph' : idx === 2 ? 'ACH AI' : 'Ready'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Gateways */}
        <div className="w-full max-w-lg space-y-3 pt-2">
          {/* Primary Action Button */}
          <button
            onClick={handleEnterWorkspace}
            className="w-full py-3.5 px-6 bg-gradient-to-r from-cyan-600 via-teal-600 to-blue-600 hover:from-cyan-500 hover:via-teal-500 hover:to-blue-500 text-white font-semibold text-sm rounded-xl shadow-xl shadow-cyan-600/30 flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <span>
              {isReady
                ? (isLoggedIn ? 'Entering Investigation Workspace...' : 'Redirecting to Official Sign In...')
                : (isLoggedIn ? 'Enter Investigation Workspace' : 'Launch Investigation Console')}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Quick Demo Access & Sign In Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={handleDemoAccess}
              disabled={demoLoading}
              className={`py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                isDark
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700 shadow-md'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <span>{demoLoading ? 'Initializing Demo...' : 'One-Click Officer Demo'}</span>
            </button>

            <button
              onClick={() => navigate('/login')}
              className={`py-2.5 px-4 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-2 transition-all ${
                isDark
                  ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-700 shadow-md'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-sm'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
              <span>Official Credentials Sign-In</span>
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-[11px] gap-2">
        <div className={isDark ? 'text-slate-500' : 'text-slate-400'}>
          TRACE-X Analytical Engine • Smart India Hackathon (SIH26189) • Law Enforcement R&D
        </div>

        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/about')}
            className={`hover:underline transition-colors ${isDark ? 'text-slate-400 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'}`}
          >
            System Architecture
          </button>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>•</span>
          <button
            onClick={() => navigate('/help')}
            className={`hover:underline transition-colors ${isDark ? 'text-slate-400 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'}`}
          >
            Evidentiary Standards
          </button>
          <span className={isDark ? 'text-slate-700' : 'text-slate-300'}>•</span>
          <button
            onClick={() => navigate('/tutorials')}
            className={`hover:underline transition-colors ${isDark ? 'text-slate-400 hover:text-cyan-400' : 'text-slate-600 hover:text-cyan-600'}`}
          >
            Officer Academy
          </button>
        </div>
      </footer>
    </div>
  );
};

export default WelcomePage;
