"use client";
import { useEffect, useState } from "react";
import { CheckCircle, Circle, Loader2, Brain, Code2, BookOpen, Rocket, AlertCircle, ShieldCheck } from "lucide-react";
import type { GenerationStep, GenerationState } from "@/lib/types";

const STEPS: { id: GenerationStep; label: string; icon: React.ReactNode; description: string }[] = [
  {
    id: "planning",
    label: "Planning",
    icon: <Brain size={16} />,
    description: "Nova Pro analyzing your requirements...",
  },
  {
    id: "scaffolding",
    label: "Scaffolding",
    icon: <Code2 size={16} />,
    description: "Creating file structure and architecture...",
  },
  {
    id: "generating",
    label: "Generating Code",
    icon: <Code2 size={16} />,
    description: "Writing all source files with Nova Pro...",
  },
  {
    id: "architecture",
    label: "Architecture",
    icon: <Brain size={16} />,
    description: "Nova Lite generating system diagram...",
  },
  {
    id: "documenting",
    label: "Documenting",
    icon: <BookOpen size={16} />,
    description: "Creating README and deployment guide...",
  },
  {
    id: "security",
    label: "Security Scan",
    icon: <ShieldCheck size={16} className="text-emerald-400" />,
    description: "Running Threat Modeling Analysis...",
  },
  {
    id: "ready",
    label: "Ready!",
    icon: <Rocket size={16} />,
    description: "Your production app is ready",
  },
];

interface GenerationProgressProps {
  state: GenerationState;
}

export default function GenerationProgress({ state }: GenerationProgressProps) {
  const [dots, setDots] = useState(".");
  const [visibleTokens, setVisibleTokens] = useState("");

  useEffect(() => {
    if (state.step === "idle" || state.step === "ready" || state.step === "error") return;
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 400);
    return () => clearInterval(interval);
  }, [state.step]);

  useEffect(() => {
    if (state.streamedTokens) {
      setVisibleTokens(state.streamedTokens.slice(-200));
    }
  }, [state.streamedTokens]);

  if (state.step === "idle") return null;

  const currentStepIndex = STEPS.findIndex((s) => s.id === state.step);

  return (
    <div className="w-full space-y-6 animate-slide-up">
      {/* Header */}
      <div className="text-center space-y-2">
        {state.step === "error" ? (
          <>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20">
              <AlertCircle size={16} className="text-red-400" />
              <span className="text-sm text-red-400 font-medium">Generation Failed</span>
            </div>
            <p className="text-slate-400 text-sm">{state.error}</p>
          </>
        ) : state.step === "ready" ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle size={16} className="text-emerald-400" />
            <span className="text-sm text-emerald-400 font-medium">Generation Complete!</span>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/20">
              <Loader2 size={16} className="text-brand-400 animate-spin" />
              <span className="text-sm text-brand-400 font-medium">
                {state.message || "Forging your app"}
                {dots}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      {state.step !== "error" && (
        <div className="relative h-1.5 bg-surface-500 rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${state.progress}%`,
              background: "linear-gradient(90deg, #6366f1, #d946ef, #06b6d4)",
              backgroundSize: "200% 100%",
              animation: "gradient-shift 2s linear infinite",
            }}
          />
          {state.step !== "ready" && (
            <div
              className="absolute inset-y-0 rounded-full opacity-60"
              style={{
                left: `${state.progress - 5}%`,
                width: "30px",
                background: "linear-gradient(90deg, transparent, white)",
                filter: "blur(3px)",
              }}
            />
          )}
        </div>
      )}

      {/* Steps */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {STEPS.map((step, idx) => {
          const status =
            state.step === "error"
              ? idx <= currentStepIndex ? "error" : "pending"
              : idx < currentStepIndex
              ? "done"
              : idx === currentStepIndex
              ? "active"
              : "pending";

          return (
            <div
              key={step.id}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all duration-500 ${
                status === "done"
                  ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400"
                  : status === "active"
                  ? "bg-brand-500/10 border-brand-500/30 text-brand-400"
                  : status === "error"
                  ? "bg-red-500/5 border-red-500/20 text-red-400 opacity-60"
                  : "bg-surface-600/30 border-white/5 text-slate-600"
              }`}
            >
              <div className="relative">
                {status === "done" ? (
                  <CheckCircle size={18} className="text-emerald-400" />
                ) : status === "active" ? (
                  <div className="relative">
                    <div className="w-4 h-4 rounded-full border-2 border-brand-400 animate-ping absolute" />
                    <Loader2 size={18} className="animate-spin relative" />
                  </div>
                ) : (
                  <Circle size={18} />
                )}
              </div>
              <span className="text-xs font-medium text-center leading-tight">{step.label}</span>
            </div>
          );
        })}
      </div>

      {/* Live token stream */}
      {visibleTokens && state.step !== "ready" && state.step !== "error" && (
        <div className="glass rounded-xl p-4 font-mono text-xs text-slate-500 leading-relaxed max-h-32 overflow-hidden relative">
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-surface-800/80 to-transparent" />
          <span>{visibleTokens}</span>
          <span className="typing-cursor" />
        </div>
      )}

      {/* Stats when generation is complete */}
      {state.step === "ready" && (
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <div className="text-center">
            <div className="text-2xl font-bold gradient-text">{state.progress}%</div>
            <div className="text-xs text-slate-500">Complete</div>
          </div>
        </div>
      )}
    </div>
  );
}
