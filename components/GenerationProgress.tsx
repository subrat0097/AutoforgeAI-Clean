"use client";

import { useEffect, useRef, useState } from "react";

interface Agent {
  id: number;
  name: string;
  model: string;
  status: "waiting" | "running" | "done" | "error";
  message?: string;
  output?: string;
  tokensUsed?: number;
}

interface GenerationProgressProps {
  isGenerating: boolean;
  onComplete: (data: unknown) => void;
  onError: (message: string) => void;
  prompt: string;
  stack: string;
  imageBase64?: string;
  additionalInstructions?: string;
}

const AGENTS: Omit<Agent, "status">[] = [
  { id: 1, name: "Spec Clarifier",   model: "Nova Lite" },
  { id: 2, name: "System Architect", model: "Nova Lite" },
  { id: 3, name: "Code Generator",   model: "Nova Pro"  },
  { id: 4, name: "IaC Generator",    model: "Nova Lite" },
  { id: 5, name: "Docs & Security",  model: "Nova Lite" },
];

export default function GenerationProgress({
  isGenerating,
  onComplete,
  onError,
  prompt,
  stack,
  imageBase64,
  additionalInstructions,
}: GenerationProgressProps) {
  const [agents, setAgents] = useState<Agent[]>(
    AGENTS.map((a) => ({ ...a, status: "waiting" }))
  );
  const [codePreview, setCodePreview] = useState("");
  const [totalTokens, setTotalTokens] = useState(0);
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (!isGenerating) return;

    // Reset state
    setAgents(AGENTS.map((a) => ({ ...a, status: "waiting" })));
    setCodePreview("");
    setTotalTokens(0);

    const run = async () => {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, stack, imageBase64, additionalInstructions }),
      });

      if (!res.ok || !res.body) {
        onError("Failed to connect to generation API");
        return;
      }

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
            handleEvent(parsed);
          } catch {}
        }
      }
    };

    run().catch((e) => onError(e.message));
  }, [isGenerating]);

  function handleEvent(parsed: Record<string, unknown>) {
    const event = parsed.event as string;

    if (event === "agent_start") {
      const id = parsed.agent as number;
      setAgents((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, status: "running", message: parsed.message as string }
            : a
        )
      );
    }

    if (event === "agent_done") {
      const id = parsed.agent as number;
      const tokens = (parsed.tokensUsed as number) || 0;
      setTotalTokens((t) => t + tokens);
      setAgents((prev) =>
        prev.map((a) =>
          a.id === id
            ? {
                ...a,
                status: "done",
                output: parsed.output as string,
                tokensUsed: tokens,
              }
            : a
        )
      );
    }

    if (event === "code_chunk") {
      setCodePreview((prev) => {
        const next = prev + (parsed.chunk as string);
        return next.slice(-2000); // keep last 2000 chars for perf
      });
      setTimeout(() => {
        if (codeRef.current) {
          codeRef.current.scrollTop = codeRef.current.scrollHeight;
        }
      }, 10);
    }

    if (event === "complete") {
      onComplete(parsed);
    }

    if (event === "error") {
      onError(parsed.message as string);
      setAgents((prev) =>
        prev.map((a) => (a.status === "running" ? { ...a, status: "error" } : a))
      );
    }
  }

  if (!isGenerating && agents.every((a) => a.status === "waiting")) return null;

  const doneCount = agents.filter((a) => a.status === "done").length;
  const progress = Math.round((doneCount / agents.length) * 100);

  return (
    <div className="w-full rounded-xl border border-white/10 bg-black/40 backdrop-blur p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold text-sm">
            AutoForgeAI — Multi-Agent Pipeline
          </h3>
          <p className="text-white/40 text-xs mt-0.5">
            Powered by Amazon Nova Pro + Nova Lite
          </p>
        </div>
        <div className="text-right">
          <span className="text-white/60 text-xs">{progress}%</span>
          {totalTokens > 0 && (
            <p className="text-white/30 text-xs">{totalTokens.toLocaleString()} tokens</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Agent list */}
      <div className="space-y-2">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`flex items-start gap-3 rounded-lg p-3 transition-all duration-300 ${
              agent.status === "running"
                ? "bg-blue-500/10 border border-blue-500/20"
                : agent.status === "done"
                ? "bg-green-500/5 border border-green-500/10"
                : agent.status === "error"
                ? "bg-red-500/10 border border-red-500/20"
                : "bg-white/3 border border-white/5"
            }`}
          >
            {/* Status icon */}
            <div className="mt-0.5 w-5 h-5 flex-shrink-0 flex items-center justify-center">
              {agent.status === "waiting" && (
                <div className="w-3 h-3 rounded-full border border-white/20" />
              )}
              {agent.status === "running" && (
                <div className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              )}
              {agent.status === "done" && (
                <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {agent.status === "error" && (
                <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>

            {/* Agent info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${
                  agent.status === "running" ? "text-blue-300"
                  : agent.status === "done" ? "text-green-300"
                  : agent.status === "error" ? "text-red-300"
                  : "text-white/40"
                }`}>
                  Agent {agent.id}: {agent.name}
                </span>
                <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/30">
                  {agent.model}
                </span>
              </div>
              {agent.status === "running" && agent.message && (
                <p className="text-xs text-white/50 mt-0.5">{agent.message}</p>
              )}
              {agent.status === "done" && agent.id === 1 && agent.output && (
                <p className="text-xs text-white/40 mt-1 font-mono truncate">
                  {(() => {
                    try {
                      const spec = JSON.parse(agent.output);
                      return `✓ ${spec.appName} · ${spec.estimatedComplexity} complexity · ${spec.coreFeatures?.length ?? 0} features`;
                    } catch {
                      return "Spec extracted";
                    }
                  })()}
                </p>
              )}
              {agent.status === "done" && agent.id === 3 && (
                <p className="text-xs text-white/40 mt-0.5">{agent.output}</p>
              )}
              {agent.status === "done" && agent.tokensUsed && agent.tokensUsed > 0 && (
                <p className="text-xs text-white/25 mt-0.5">{agent.tokensUsed.toLocaleString()} tokens</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Live code stream preview */}
      {codePreview && (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="px-3 py-1.5 bg-white/5 border-b border-white/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white/40">Live code stream · Nova Pro</span>
          </div>
          <pre
            ref={codeRef}
            className="p-3 text-xs text-green-300/70 font-mono overflow-auto max-h-40 leading-relaxed"
          >
            {codePreview}
          </pre>
        </div>
      )}
    </div>
  );
}