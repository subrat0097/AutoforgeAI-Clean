"use client";
import { useState, useCallback } from "react";
import { Zap, Cpu, Network, BookOpen, ShieldCheck } from "lucide-react";
import PromptInput from "@/components/PromptInput";
import GenerationProgress from "@/components/GenerationProgress";
import OutputTabs from "@/components/OutputTabs";
import type { ProjectOutput, StackType, GeneratedFile } from "@/lib/types";

const FEATURES = [
  { icon: <Cpu size={18} />, title: "AWS Nova Pro", desc: "Full-stack code generation" },
  { icon: <Network size={18} />, title: "Architecture", desc: "Auto Mermaid diagrams" },
  { icon: <ShieldCheck size={18} className="text-emerald-400" />, title: "Threat Modeling", desc: "Auto Security Reports", highlight: true },
  { icon: <BookOpen size={18} />, title: "Full Docs", desc: "README + Deploy guide" },
];

interface PendingJob {
  prompt: string;
  stack: StackType;
  imageBase64?: string;
  additionalInstructions?: string;
}

export default function HomePage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPatchLoading, setIsPatchLoading] = useState(false);
  const [pendingJob, setPendingJob] = useState<PendingJob | null>(null);
  const [output, setOutput] = useState<ProjectOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patchStatus, setPatchStatus] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [currentQueryResponse, setCurrentQueryResponse] = useState("");

  const handleGenerate = useCallback(
    (opts: { prompt: string; stack: StackType; imageBase64?: string; additionalInstructions?: string }) => {
      setOutput(null);
      setError(null);
      setPatchStatus(null);
      setPendingJob(opts);
      setIsGenerating(true);
    },
    []
  );

  // Lightweight patch — only sends changed files back
  const handlePatch = useCallback(
    async (opts: { prompt: string; stack: StackType }) => {
      if (!output) return;
      setIsPatchLoading(true);
      setPatchStatus("Applying changes with Nova Pro...");
      setError(null);

      try {
        const res = await fetch("/api/patch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            changes: opts.prompt,
            existingFiles: output.files,
            stack: opts.stack,
          }),
        });

        if (!res.ok || !res.body) throw new Error("Patch request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.event === "patch_start") setPatchStatus(parsed.message);
              if (parsed.event === "patch_complete") {
                setOutput((prev) => prev ? { ...prev, files: parsed.files as GeneratedFile[] } : prev);
                setPatchStatus(`✓ ${parsed.message}`);
                setTimeout(() => setPatchStatus(null), 3000);
              }
              if (parsed.event === "error") {
                setError(parsed.message);
                setPatchStatus(null);
              }
            } catch { }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Patch failed");
        setPatchStatus(null);
      } finally {
        setIsPatchLoading(false);
      }
    },
    [output]
  );

  const handleApplyFix = useCallback(async (fix: { action: string; package?: string; description?: string }) => {
    console.log("handleApplyFix called with:", fix);
    let patchPrompt = "";
    if (fix.action === "install_library") {
      patchPrompt = `Add the library "${fix.package}" to the project. Update package.json to include it in dependencies and ensure any necessary imports or basic configurations are added to the relevant files.`;
    } else if (fix.action === "patch_code") {
      patchPrompt = fix.description || "Fix the identified code issue.";
    }

    console.log("Derived patchPrompt:", patchPrompt);

    if (patchPrompt && output) {
      console.log("Triggering handlePatch...");
      handlePatch({ prompt: patchPrompt, stack: output.stack });
    } else {
      console.warn("handleApplyFix ignored - patchPrompt or output missing", { patchPrompt, hasOutput: !!output });
    }
  }, [output, handlePatch]);

  const handleQuery = useCallback(
    async (query: string) => {
      if (!output) return;
      setIsQueryLoading(true);
      setCurrentQueryResponse("");
      
      const newUserMessage = { role: "user" as const, content: query };
      setChatHistory(prev => [...prev, newUserMessage]);

      try {
        const res = await fetch("/api/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query,
            files: output.files,
            stack: output.stack,
            prompt: output.prompt,
          }),
        });

        if (!res.ok || !res.body) throw new Error("Assistant request failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullResponse = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                fullResponse += parsed.text;
                setCurrentQueryResponse(fullResponse);
              }
            } catch { }
          }
        }

        setChatHistory(prev => [...prev, { role: "assistant", content: fullResponse }]);
        setCurrentQueryResponse("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Query failed");
      } finally {
        setIsQueryLoading(false);
      }
    },
    [output]
  );

  const handleComplete = useCallback((data: unknown) => {
    setIsGenerating(false);
    setOutput(data as ProjectOutput);
  }, []);

  const handleError = useCallback((message: string) => {
    setIsGenerating(false);
    setError(message);
  }, []);

  const reset = useCallback(() => {
    setOutput(null);
    setError(null);
    setPendingJob(null);
    setIsGenerating(false);
    setPatchStatus(null);
    setChatHistory([]);
    setCurrentQueryResponse("");
    setIsQueryLoading(false);
  }, []);

  const showOutput = output !== null && !isGenerating;
  const showProgress = isGenerating || error !== null;

  return (
    <main className="min-h-screen">
      {!showOutput && (
        <section className="relative flex flex-col items-center justify-center min-h-screen px-4 pb-20 pt-24 max-w-7xl mx-auto w-full">
          <div className="mb-8 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-brand-500/20 text-sm text-brand-300">
              <Zap size={14} className="text-brand-400" />
              <span>Powered by AWS Amazon Nova Multimodal AI</span>
              <span className="ml-1 px-2 py-0.5 bg-brand-500/20 rounded-full text-xs text-brand-400 font-semibold">LIVE</span>
            </div>
          </div>

          <div className="text-center mb-8 space-y-4 animate-slide-up">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight">
              <span className="text-white">Forge Any App</span>
              <br />
              <span className="gradient-text">In Seconds</span>
            </h1>
            <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
              Type a prompt → get a <span className="text-white font-medium">fully production-ready</span> website or app,
              complete with <span className="text-brand-400">architecture diagrams</span>,{" "}
              <span className="text-nova-400">AWS infrastructure</span>, and downloadable docs.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3 mb-14 animate-fade-in">
            {FEATURES.map((f) => (
              <div key={f.title} className={`flex items-center gap-2 px-4 py-2 rounded-full glass border text-sm ${f.highlight ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/5"}`}>
                <span className={f.highlight ? "text-emerald-400" : "text-brand-400"}>{f.icon}</span>
                <span className="text-slate-300 font-medium">{f.title}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-500">{f.desc}</span>
              </div>
            ))}
          </div>

          {!showProgress && (
            <div className="w-full max-w-3xl">
              <PromptInput onGenerate={handleGenerate} isGenerating={false} />
            </div>
          )}

          {showProgress && pendingJob && (
            <div className="w-full max-w-3xl space-y-6">
              <GenerationProgress
                isGenerating={isGenerating}
                onComplete={handleComplete}
                onError={handleError}
                prompt={pendingJob.prompt}
                stack={pendingJob.stack}
                imageBase64={pendingJob.imageBase64}
                additionalInstructions={pendingJob.additionalInstructions}
              />
              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-center space-y-3">
                  <p className="text-red-400 text-sm">{error}</p>
                  <button onClick={reset} className="btn-secondary text-sm">← Try Again</button>
                </div>
              )}
            </div>
          )}

          {!showProgress && (
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

      {showOutput && output && (
        <section className="flex flex-col min-h-screen px-4 py-6">
          <div className="flex items-center justify-between mb-6 max-w-screen-2xl mx-auto w-full">
            <div className="flex items-center gap-4">
              <button onClick={reset} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors text-sm">
                ← New Project
              </button>
              <div className="h-4 border-l border-white/10" />
              <div>
                <span className="text-slate-300 text-sm font-medium">{output.files.length} files generated</span>
                <span className="text-slate-600 text-xs ml-2">
                  · {output.stack}
                  {(output as unknown as { agentsUsed?: number }).agentsUsed ? ` · ${(output as unknown as { agentsUsed: number }).agentsUsed} agents` : ""}
                  {output.tokensUsed ? ` · ${output.tokensUsed.toLocaleString()} tokens` : ""}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {(output as unknown as { iacTemplate?: string }).iacTemplate && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">AWS CDK Ready</div>
              )}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Production Ready
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-screen-2xl mx-auto w-full" style={{ height: "calc(100vh - 200px)", minHeight: "600px" }}>
            <OutputTabs 
              output={output} 
              onPatch={handlePatch}
              isPatchLoading={isPatchLoading}
              patchStatus={patchStatus}
              patchError={error}
              onQuery={handleQuery}
              chatHistory={chatHistory}
              isQueryLoading={isQueryLoading}
              currentQueryResponse={currentQueryResponse}
              onApplyFix={handleApplyFix}
            />
          </div>


        </section>
      )}

      {!showOutput && !showProgress && (
        <footer className="py-10 border-t border-white/5 text-center">
          <p className="text-slate-700 text-sm">
            Built for AWS Hackathon 2025 · <span className="gradient-text font-semibold">AutoForgeAI</span> · Powered by Amazon Nova · 5-Agent Pipeline
          </p>
        </footer>
      )}
    </main>
  );
}