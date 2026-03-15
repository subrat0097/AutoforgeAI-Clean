"use client";
import { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, RefreshCw, Download } from "lucide-react";

interface ArchitectureDiagramProps {
  mermaidSource: string;
}

export default function ArchitectureDiagram({ mermaidSource }: ArchitectureDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mermaidSource) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    // AI sometimes generates invalid syntax like unicode arrows or missing 'class' keyword
    const sanitizedSource = mermaidSource
      .replace(/[─—]+→/g, "-->") // Unicode long arrows
      .replace(/──/g, "--")      // Unicode bars
      .replace(/([^.])->(?=[^>])/g, "$1-->") // Standardize single arrows to double
      .split("\n")
      .map(line => {
        const trimmed = line.trim();
        const reserved = /^(graph|classDef|class|click|subgraph|end|style|direction|callback)/i;
        const classAssignment = /^([\w, ]+)\s+([\w]+)$/; // Matches "A,B,C className"
        if (!reserved.test(trimmed)) {
          const match = trimmed.match(classAssignment);
          if (match && match[1].includes(",")) {
            return `    class ${match[1].trim()} ${match[2].trim()}`;
          }
        }
        return line;
      })
      .join("\n");

    async function renderDiagram() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "#6366f1",
            primaryTextColor: "#f1f5f9",
            primaryBorderColor: "#818cf8",
            lineColor: "#475569",
            secondaryColor: "#0d0d16",
            tertiaryColor: "#12121e",
            background: "#0a0a0f",
            mainBkg: "#12121e",
            nodeBorder: "#6366f1",
            clusterBkg: "#0d0d16",
            titleColor: "#f1f5f9",
            edgeLabelBackground: "#12121e",
            fontFamily: "Inter, system-ui, sans-serif",
          },
          flowchart: {
            htmlLabels: true,
            curve: "basis",
            padding: 20,
          },
          securityLevel: "loose",
        });

        const id = `mermaid-${Date.now()}`;
        const { svg: rendered } = await mermaid.render(id, sanitizedSource);

        if (!cancelled) {
          setSvg(rendered);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Mermaid render error:", err);
          setError("Failed to render diagram. The Mermaid syntax may be invalid.");
          setLoading(false);
        }
      }
    }

    renderDiagram();
    return () => { cancelled = true; };
  }, [mermaidSource]);

  const handleDownload = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "architecture.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500">Architecture Diagram</span>
          <span className="ml-2 text-xs text-slate-600">· Powered by Nova Lite</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.4, z - 0.1))}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-slate-500 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors"
            title="Reset zoom"
          >
            <RefreshCw size={14} />
          </button>
          {svg && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs btn-secondary"
            >
              <Download size={12} />
              Download SVG
            </button>
          )}
        </div>
      </div>

      {/* Diagram area */}
      <div
        className="flex-1 overflow-auto p-6 flex items-start justify-center min-h-0"
        ref={containerRef}
      >
        {loading && (
          <div className="flex flex-col items-center gap-3 mt-20">
            <div className="w-10 h-10 border-2 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
            <p className="text-sm text-slate-500">Rendering architecture diagram...</p>
          </div>
        )}
        {error && (
          <div className="max-w-md text-center space-y-3 mt-20">
            <div className="text-4xl">🏗️</div>
            <p className="text-slate-400 text-sm">{error}</p>
            <div className="glass rounded-xl p-4 text-left">
              <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap overflow-auto">
                {mermaidSource}
              </pre>
            </div>
          </div>
        )}
        {!loading && !error && svg && (
          <div
            style={{ transform: `scale(${zoom})`, transformOrigin: "top center", transition: "transform 0.2s ease" }}
            dangerouslySetInnerHTML={{ __html: svg }}
            className="mermaid max-w-full"
          />
        )}
      </div>

      {/* Raw source toggle */}
      {!loading && !error && (
        <details className="border-t border-white/5">
          <summary className="px-4 py-2 text-xs text-slate-600 cursor-pointer hover:text-slate-400 transition-colors select-none">
            View Mermaid Source
          </summary>
          <pre className="px-4 py-3 text-xs font-mono text-slate-500 bg-surface-800/50 overflow-x-auto">
            {mermaidSource}
          </pre>
        </details>
      )}
    </div>
  );
}
