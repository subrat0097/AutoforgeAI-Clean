"use client";
import { useState, useCallback } from "react";
import { Zap, Github, Star, ArrowRight, Cpu, FileCode, Network, BookOpen, ShieldCheck } from "lucide-react";
import PromptInput from "@/components/PromptInput";
import GenerationProgress from "@/components/GenerationProgress";
import OutputTabs from "@/components/OutputTabs";
import type { ProjectOutput, GenerationState, StackType } from "@/lib/types";

const FEATURES = [
  { icon: <Cpu size={18} />, title: "AWS Nova Pro", desc: "Full-stack code generation" },
  { icon: <Network size={18} />, title: "Architecture", desc: "Auto Mermaid diagrams" },
  { icon: <ShieldCheck size={18} className="text-emerald-400" />, title: "Threat Modeling", desc: "Auto Security Reports", highlight: true },
  { icon: <BookOpen size={18} />, title: "Full Docs", desc: "README + Deploy guide" },
];

const STEP_SEQUENCE: Array<{ step: GenerationState["step"]; message: string; progress: number; delay: number }> = [
  { step: "planning", message: "Nova Pro analyzing your prompt", progress: 5, delay: 0 },
  { step: "scaffolding", message: "Creating project structure", progress: 12, delay: 1500 },
  { step: "generating", message: "Writing all source files (this may take a minute)", progress: 40, delay: 3500 },
  { step: "architecture", message: "Generating architecture diagram", progress: 75, delay: 45000 },
  { step: "documenting", message: "Creating README and docs", progress: 85, delay: 52000 },
  { step: "security", message: "Running Threat Modeling & Security Analysis", progress: 95, delay: 60000 },
];

export default function HomePage() {
  const [genState, setGenState] = useState<GenerationState>({
    step: "idle",
    message: "",
    progress: 0,
  });
  const [output, setOutput] = useState<ProjectOutput | null>(null);

  const handleGenerate = useCallback(
    async (opts: {
      prompt: string;
      stack: StackType;
      imageBase64?: string;
      additionalInstructions?: string;
    }) => {
      setOutput(null);
      setGenState({ step: "planning", message: "Nova Pro analyzing your prompt", progress: 5 });

      // Animate through steps while API call runs
      const timers: ReturnType<typeof setTimeout>[] = [];
      STEP_SEQUENCE.forEach(({ step, message, progress, delay }) => {
        const t = setTimeout(() => {
          setGenState((prev) => {
            if (prev.step === "ready" || prev.step === "error") return prev;
            return { step, message, progress };
          });
        }, delay);
        timers.push(t);
      });

      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(opts),
        });

        // Clear step timers
        timers.forEach(clearTimeout);

        const data = await res.json();

        if (!res.ok || data.error) {
          setGenState({
            step: "error",
            message: "Generation failed",
            progress: 0,
            error: data.error || "Unknown error occurred",
          });
          return;
        }

        setGenState({ step: "ready", message: "Your app is ready!", progress: 100 });
        setOutput(data as ProjectOutput);
      } catch (err) {
        timers.forEach(clearTimeout);
        setGenState({
          step: "error",
          message: "Network error",
          progress: 0,
          error: err instanceof Error ? err.message : "Failed to connect to generation service",
        });
      }
    },
    []
  );

  const isGenerating = genState.step !== "idle" && genState.step !== "ready" && genState.step !== "error";
  const showOutput = output !== null && genState.step === "ready";

  return (
    <main className="min-h-screen">
      {/* ─── Hero Section ───────────────────────────────────────────── */}
      {!showOutput && (
        <section className="relative flex flex-col items-center justify-center min-h-screen px-4 pb-20 pt-24 max-w-7xl mx-auto w-full">
          {/* Badge */}
          <div className="mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-brand-500/20 text-sm text-brand-300">
              <Zap size={14} className="text-brand-400" />
              <span>Powered by AWS Amazon Nova Multimodal AI</span>
              <span className="ml-1 px-2 py-0.5 bg-brand-500/20 rounded-full text-xs text-brand-400 font-semibold">LIVE</span>
            </div>
          </div>

          {/* Headline */}
          <div className="text-center mb-8 space-y-4 animate-slide-up">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight">
              <span className="text-white">Forge Any App</span>
              <br />
              <span className="gradient-text">In Seconds</span>
            </h1>
            <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
              Type a prompt → get a{" "}
              <span className="text-white font-medium">fully production-ready</span> website or app,
              complete with <span className="text-brand-400">architecture diagrams</span> and{" "}
              <span className="text-nova-400">downloadable docs</span>.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mb-14 animate-fade-in">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={`flex items-center gap-2 px-4 py-2 rounded-full glass border text-sm ${
                  f.highlight ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/5"
                }`}
              >
                <span className={f.highlight ? "text-emerald-400" : "text-brand-400"}>{f.icon}</span>
                <span className="text-slate-300 font-medium">{f.title}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">{f.desc}</span>
              </div>
            ))}
          </div>

          {/* Prompt Input */}
          <div className="w-full max-w-3xl">
            {genState.step === "idle" ? (
              <PromptInput onGenerate={handleGenerate} isGenerating={false} />
            ) : (
              <div className="space-y-8">
                <GenerationProgress state={genState} />
                {genState.step === "error" && (
                  <div className="text-center">
                    <button
                      onClick={() => setGenState({ step: "idle", message: "", progress: 0 })}
                      className="btn-secondary text-sm"
                    >
                      ← Try Again
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Scroll hint */}
          {genState.step === "idle" && (
            <div className="mt-20 text-center">
              <p className="text-xs text-slate-700 uppercase tracking-widest mb-8">Trusted technology</p>
              <div className="flex items-center justify-center gap-8 flex-wrap opacity-30">
                {["AWS Nova Pro", "Nova Lite", "Amazon Bedrock", "Next.js 14", "TypeScript"].map((t) => (
                  <span key={t} className="text-slate-400 text-sm font-medium">{t}</span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─── Output Section ─────────────────────────────────────────── */}
      {showOutput && output && (
        <section className="flex flex-col min-h-screen px-4 py-6">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6 max-w-screen-2xl mx-auto w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setOutput(null);
                  setGenState({ step: "idle", message: "", progress: 0 });
                }}
                className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm"
              >
                ← New Project
              </button>
              <div className="h-4 border-l border-white/10" />
              <div>
                <span className="text-slate-300 text-sm font-medium">
                  {output.files.length} files generated
                </span>
                <span className="text-slate-600 text-xs ml-2">
                  · {output.stack} · {output.tokensUsed?.toLocaleString()} tokens
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Production Ready
              </div>
            </div>
          </div>

          {/* Output panel — full height */}
          <div className="flex-1 max-w-screen-2xl mx-auto w-full" style={{ height: "calc(100vh - 140px)", minHeight: "600px" }}>
            <OutputTabs output={output} />
          </div>

          {/* Another prompt bar at bottom */}
          <div className="max-w-2xl mx-auto w-full mt-6">
            <PromptInput onGenerate={handleGenerate} isGenerating={isGenerating} isEditMode={true} />
          </div>
        </section>
      )}

      {/* ─── Footer (only on hero page) ─────────────────────────────── */}
      {!showOutput && genState.step === "idle" && (
        <footer className="py-10 border-t border-white/5 text-center">
          <p className="text-slate-700 text-sm">
            Built for AWS Hackathon 2025 ·{" "}
            <span className="gradient-text font-semibold">AutoForgeAI</span>
            {" "}· Powered by Amazon Nova
          </p>
        </footer>
      )}
    </main>
  );
}
