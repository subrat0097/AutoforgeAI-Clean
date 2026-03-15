"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Code2, Eye, EyeOff, GitBranch, BookOpen, Copy, Check, ShieldCheck, Maximize2, Minimize2, Cloud, Terminal, ExternalLink, Sparkles, Wand2 } from "lucide-react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ProjectOutput, GeneratedFile, StackType } from "@/lib/types";
import { buildFileTree } from "@/lib/parser";
import FileExplorer from "./FileExplorer";
import DownloadButton from "./DownloadButton";
import PromptInput from "./PromptInput";

const ArchitectureDiagram = dynamic(() => import("./ArchitectureDiagram"), { ssr: false });

type TabId = "preview" | "code" | "architecture" | "docs" | "security" | "iac" | "edit" | "ask";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "code", label: "Code", icon: <Code2 size={15} /> },
  { id: "preview", label: "Preview", icon: <Eye size={15} /> },
  { id: "architecture", label: "Architecture", icon: <GitBranch size={15} /> },
  { id: "edit", label: "Edit App", icon: <Sparkles size={15} /> },
  { id: "ask", label: "Ask AI", icon: <Sparkles size={15} className="text-emerald-400" /> },
  { id: "iac", label: "AWS IaC", icon: <Cloud size={15} /> },
  { id: "security", label: "Security", icon: <ShieldCheck size={15} /> },
  { id: "docs", label: "Docs", icon: <BookOpen size={15} /> },
];

// ─── CodeViewer ──────────────────────────────────────────────────────────────

function CodeViewer({ file, onChange }: { file: GeneratedFile; onChange: (path: string, content: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(file.content);

  useEffect(() => {
    setEditContent(file.content);
    setIsEditing(false);
  }, [file.path, file.content]);

  const handleSave = () => {
    onChange(file.path, editContent);
    setIsEditing(false);
  };

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(editContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [editContent]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-surface-800/50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs text-slate-400 font-mono ml-2">{file.path}</span>
          <span className="text-xs text-slate-600 bg-surface-600 px-1.5 py-0.5 rounded">{file.language}</span>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <button onClick={handleSave} className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors px-3 py-1 bg-brand-500/10 rounded border border-brand-500/20">
              <Check size={12} /><span>Save & Update</span>
            </button>
          ) : (
            <button onClick={() => setIsEditing(true)} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1 rounded bg-white/5 hover:bg-white/10">
              <Code2 size={12} /><span>Edit Code</span>
            </button>
          )}
          <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-white/5">
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto min-h-0 bg-[#0d0d16]">
        {isEditing ? (
          <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className="w-full h-full p-4 font-mono text-[0.8rem] bg-transparent text-slate-200 resize-none outline-none custom-scrollbar leading-relaxed" spellCheck="false" />
        ) : (
          <div className="h-full syntax-highlight">
            <SyntaxHighlighter language={file.language} style={vscDarkPlus} showLineNumbers wrapLines customStyle={{ margin: 0, padding: "1rem", background: "#0d0d16", minHeight: "100%", fontSize: "0.8rem", fontFamily: "JetBrains Mono, Fira Code, monospace" }} lineNumberStyle={{ color: "#2d3748", fontSize: "0.75rem" }}>
              {editContent}
            </SyntaxHighlighter>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PreviewTab ───────────────────────────────────────────────────────────────
function PreviewTab({ files, onTroubleshoot }: { files: GeneratedFile[]; onTroubleshoot: () => void }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLocal, setShowLocal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");

  // Get package.json dev command
  const packageJson = files.find((f) => f.name === "package.json");
  let devCommand = "npm run dev";
  try {
    if (packageJson) {
      const pkg = JSON.parse(packageJson.content);
      devCommand = pkg.scripts?.dev ? "npm run dev" : pkg.scripts?.start ? "npm start" : "npm run dev";
    }
  } catch { }

  const localSteps = `npm install\n${devCommand}`;

  const copySteps = async () => {
    await navigator.clipboard.writeText(localSteps);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Find index.html
  const htmlFile = files.find((f) =>
    f.path.toLowerCase().endsWith("index.html") ||
    f.name.toLowerCase() === "index.html"
  );

  // Create blob URL so Tailwind CDN loads correctly
  useEffect(() => {
    if (!htmlFile?.content) return;
    fetch("/api/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: htmlFile.content }),
    })
      .then(r => r.json())
      .then(({ id }) => setPreviewUrl(`/api/preview?id=${id}`));
  }, [htmlFile?.content]);

  return (
    <div className={`flex flex-col w-full ${isFullscreen ? "fixed inset-0 z-50 bg-black" : "h-full flex-1"}`}>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-surface-800/50 text-xs text-slate-500 shrink-0 gap-3 flex-wrap">
        <div className="flex gap-1.5 items-center">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-2 font-medium">Live Preview</span>
          {!htmlFile && <span className="ml-1 text-yellow-500/70">· Server-side project</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLocal(!showLocal)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors text-xs ${showLocal ? "bg-blue-500/20 text-blue-400 border border-blue-500/20" : "bg-white/5 hover:bg-white/10 hover:text-white"}`}
          >
            <Terminal size={11} />
            Run locally
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 hover:text-white transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10"
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
      </div>

      {/* Local run panel */}
      {showLocal && (
        <div className="shrink-0 border-b border-white/5 bg-[#0d0d16] p-4 space-y-3">
          <p className="text-xs text-slate-400">
            Run at <span className="text-blue-400 font-mono">http://localhost:3000</span>
          </p>
          <div className="relative rounded-lg border border-white/10 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <button onClick={copySteps} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
                {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-3 text-xs font-mono text-green-400 leading-relaxed">
              <span className="text-slate-500">$ </span>npm install{"\n"}
              <span className="text-slate-500">$ </span>{devCommand}
            </pre>
          </div>
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink size={11} />
            Open localhost:3000
          </a>
        </div>
      )}

      {/* Preview area */}
      <div className="flex flex-col flex-1 w-full min-h-0 relative">
        {htmlFile ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <div className="text-5xl">⚡</div>
            <h3 className="text-white font-semibold text-lg">Preview Ready</h3>
            <p className="text-slate-500 text-sm">Click below to open your app in a new tab</p>
            <button
              onClick={() => {
                const blob = new Blob([htmlFile.content], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                window.open(url, "_blank");
              }}
              className="px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-500 transition-colors flex items-center gap-2"
            >
              <ExternalLink size={16} />
              Open Preview in New Tab
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
            <Terminal size={32} className="text-slate-600" />
            <h3 className="text-white font-semibold">Server-side project</h3>
            <p className="text-slate-500 text-sm max-w-sm">Download the ZIP and run locally to preview</p>
            <button onClick={copySteps} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-sm hover:text-white transition-colors">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? "Copied!" : "Copy run commands"}
            </button>
          </div>
        )}
      </div>
    </div>

  );
}

// ─── IaCTab ───────────────────────────────────────────────────────────────────

function IaCTab({ iacTemplate }: { iacTemplate?: string }) {
  const [copied, setCopied] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);

  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(iacTemplate || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [iacTemplate]);

  if (!iacTemplate) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
        <Cloud size={40} className="text-slate-600" />
        <p className="text-slate-500 text-sm max-w-sm">No IaC template was generated. Re-generate your project to get an AWS CDK stack.</p>
      </div>
    );
  }

  const fileBlocks: { path: string; content: string; lang: string }[] = [];
  const fileRegex = /<FILE path="([^"]+)">([\s\S]*?)<\/FILE>/g;
  let match;
  while ((match = fileRegex.exec(iacTemplate)) !== null) {
    const path = match[1];
    const content = match[2].trim();
    const ext = path.split(".").pop() || "ts";
    const langMap: Record<string, string> = { ts: "typescript", js: "javascript", json: "json", yaml: "yaml", yml: "yaml" };
    fileBlocks.push({ path, content, lang: langMap[ext] || "typescript" });
  }
  if (fileBlocks.length === 0) {
    fileBlocks.push({ path: "infra/lib/app-stack.ts", content: iacTemplate, lang: "typescript" });
  }

  const selected = fileBlocks[selectedIdx];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-surface-800/50 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
            <Cloud size={12} className="text-orange-400" />
            <span className="text-xs text-orange-400 font-medium">AWS CDK v2 · TypeScript</span>
          </div>
          <span className="text-xs text-slate-500">Generated by Agent 4 · Nova Lite</span>
        </div>
        <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded bg-white/5 hover:bg-white/10 transition-colors">
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          <span>{copied ? "Copied!" : "Copy all"}</span>
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-orange-500/5 shrink-0 flex-wrap">
        <span className="text-xs text-slate-500">Includes:</span>
        {["Lambda", "API Gateway", "S3", "DynamoDB", "CloudFront", "Cognito", "IAM"].map((svc) => (
          <span key={svc} className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/15 text-orange-300">{svc}</span>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
        {fileBlocks.length > 1 && (
          <div className="w-56 border-r border-white/5 bg-surface-800/30 overflow-y-auto shrink-0">
            <div className="px-3 py-2 text-xs text-slate-600 uppercase tracking-wider border-b border-white/5">CDK Files</div>
            {fileBlocks.map((f, i) => (
              <button key={f.path} onClick={() => setSelectedIdx(i)} className={`w-full text-left px-3 py-2.5 text-xs font-mono transition-colors border-b border-white/5 ${i === selectedIdx ? "bg-orange-500/10 text-orange-300 border-l-2 border-l-orange-500" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}`}>
                {f.path.replace("infra/", "")}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 overflow-auto min-h-0 bg-[#0d0d16]">
          <div className="px-4 py-2 border-b border-white/5 bg-surface-800/30 flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
            </div>
            <span className="text-xs font-mono text-slate-400">{selected.path}</span>
          </div>
          <SyntaxHighlighter language={selected.lang} style={vscDarkPlus} showLineNumbers wrapLines customStyle={{ margin: 0, padding: "1rem", background: "#0d0d16", minHeight: "100%", fontSize: "0.8rem", fontFamily: "JetBrains Mono, Fira Code, monospace" }} lineNumberStyle={{ color: "#2d3748", fontSize: "0.75rem" }}>
            {selected.content}
          </SyntaxHighlighter>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-white/5 bg-surface-800/50 shrink-0">
        <span className="text-xs text-slate-500">Deploy with:</span>
        <code className="text-xs font-mono text-orange-300 bg-orange-500/10 px-3 py-1 rounded border border-orange-500/15">
          cd infra && npm install && cdk deploy
        </code>
      </div>
    </div>
  );
}

// ─── DocsTab ──────────────────────────────────────────────────────────────────

function DocsTab({ output }: { output: ProjectOutput }) {
  const [activeDoc, setActiveDoc] = useState<"readme" | "deploy">("readme");
  const content = activeDoc === "readme" ? output.readme : output.deployGuide;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-3 border-b border-white/5 bg-surface-800/50 shrink-0">
        <button onClick={() => setActiveDoc("readme")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeDoc === "readme" ? "bg-brand-500/15 text-brand-400 border border-brand-500/20" : "text-slate-500 hover:text-slate-300"}`}>
          README.md
        </button>
        <button onClick={() => setActiveDoc("deploy")} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeDoc === "deploy" ? "bg-brand-500/15 text-brand-400 border border-brand-500/20" : "text-slate-500 hover:text-slate-300"}`}>
          Deployment Guide
        </button>
      </div>
      <div className="flex-1 overflow-auto min-h-0 p-6">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            return !match
              ? <code className="bg-surface-600 px-1.5 py-0.5 rounded text-xs font-mono text-brand-300" {...props}>{children}</code>
              : <SyntaxHighlighter language={match[1]} style={vscDarkPlus} customStyle={{ borderRadius: "0.5rem", fontSize: "0.78rem" }}>{String(children).replace(/\n$/, "")}</SyntaxHighlighter>;
          },
          table({ children }) { return <div className="overflow-x-auto my-4"><table className="w-full text-sm border-collapse">{children}</table></div>; },
          th({ children }) { return <th className="px-3 py-2 text-left text-xs font-semibold text-slate-300 bg-surface-600 border border-white/10">{children}</th>; },
          td({ children }) { return <td className="px-3 py-2 text-xs text-slate-400 border border-white/5">{children}</td>; },
          h1({ children }) { return <h1 className="text-2xl font-bold gradient-text mb-4 mt-6">{children}</h1>; },
          h2({ children }) { return <h2 className="text-xl font-semibold text-slate-200 mb-3 mt-6 pb-2 border-b border-white/10">{children}</h2>; },
          h3({ children }) { return <h3 className="text-base font-semibold text-slate-300 mb-2 mt-4">{children}</h3>; },
          p({ children }) { return <p className="text-slate-400 text-sm leading-relaxed mb-3">{children}</p>; },
          ul({ children }) { return <ul className="list-disc list-inside space-y-1 mb-3 text-slate-400 text-sm">{children}</ul>; },
          li({ children }) { return <li className="text-slate-400 text-sm">{children}</li>; },
          a({ children, href }) { return <a href={href} className="text-brand-400 hover:text-brand-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>; },
          blockquote({ children }) { return <blockquote className="border-l-4 border-brand-500/40 pl-4 my-3 text-slate-500 italic">{children}</blockquote>; },
        }} className="prose prose-invert max-w-none">
          {content || "_No documentation generated._"}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// ─── EditTab ──────────────────────────────────────────────────────────────────

function EditTab({
  stack,
  onPatch,
  isPatchLoading,
  patchStatus,
  error
}: {
  stack: StackType;
  onPatch: (opts: { prompt: string; stack: StackType }) => void;
  isPatchLoading: boolean;
  patchStatus: string | null;
  error: string | null;
}) {
  return (
    <div className="flex flex-col h-full bg-surface-900/20">
      <div className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-3xl space-y-8">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium">
              <Sparkles size={12} />
              Iterative Refinement
            </div>
            <h2 className="text-2xl font-bold text-white">Refine Your Project</h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto leading-relaxed">
              Describe changes like "Add a contact form", "Use a deep purple theme", or "Add a user profile page".
              Nova Pro will update only the necessary files.
            </p>
          </div>

          <div className="space-y-4">
            <PromptInput onGenerate={onPatch} isGenerating={isPatchLoading} isEditMode />

            {(patchStatus || error) && (
              <div className={`text-center text-xs px-4 py-3 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-300 ${error
                ? "text-red-400 bg-red-500/5 border-red-500/20"
                : "text-purple-400 bg-purple-500/5 border-purple-500/20"
                }`}>
                <div className="flex items-center justify-center gap-2">
                  {!error && !patchStatus?.startsWith("✓") && (
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  )}
                  {error || patchStatus}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">How it works</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Nova Pro analyzes your existing files and smartly patches them instead of rebuilding the whole project.
              </p>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Best Practices</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Be specific with your requests. Mention component names or specific features you want to modify.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

function SmartFixCard({ fix, onApplyFix, isPatchLoading }: { fix: any; onApplyFix: any; isPatchLoading: boolean }) {
  return (
    <div
      className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3 animate-in fade-in zoom-in-95 duration-500 relative z-[9999]"
      onClick={() => console.log("FIX CARD CONTAINER CLICKED")}
    >
      <div className="flex items-center gap-2 text-emerald-400">
        <ShieldCheck size={16} />
        <span className="text-xs font-bold uppercase tracking-wider">Smart Fix Identified</span>
      </div>
      <div className="text-xs text-slate-300">
        {fix.action === "install_library" ? (
          <>Suggested library: <code className="text-emerald-400 mx-1 px-1 bg-white/5 rounded">{fix.package}</code></>
        ) : (
          <>{fix.description}</>
        )}
      </div>
      {fix.reason && <div className="text-[10px] text-slate-500 italic">{fix.reason}</div>}
      <button
        type="button"
        onClick={(e) => {
          console.error("DEBUG: BUTTON CLICKED");
          e.preventDefault();
          e.stopPropagation();
          onApplyFix(fix);
        }}
        disabled={isPatchLoading}
        className="w-full h-10 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        style={{
          position: 'relative',
          zIndex: 99999,
          pointerEvents: 'auto',
          margin: '0',
          cursor: 'pointer'
        }}
      >
        {isPatchLoading ? "Applying..." : "Apply Fix Now"}
      </button>
    </div>
  );
}

function AskAITab({
  onQuery,
  chatHistory,
  isQueryLoading,
  currentResponse,
  error,
  isTroubleshootMode,
  onToggleTroubleshoot,
  onApplyFix,
  isPatchLoading
}: {
  onQuery: (q: string) => void;
  chatHistory: Message[];
  isQueryLoading: boolean;
  currentResponse: string;
  error: string | null;
  isTroubleshootMode: boolean;
  onToggleTroubleshoot: (v: boolean) => void;
  onApplyFix: (fix: { action: string; package?: string; description?: string }) => void;
  isPatchLoading: boolean;
}) {
  const [query, setQuery] = useState("");
  const [pastedError, setPastedError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, currentResponse, error, isPatchLoading]);

  useEffect(() => {
    const tracker = (e: MouseEvent) => {
      console.log("CLICK TARGET:", e.target);
    };
    window.addEventListener("click", tracker);
    return () => window.removeEventListener("click", tracker);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isTroubleshootMode) {
      if (!pastedError.trim() || isQueryLoading) return;
      onQuery(`I am getting the following error while running my project locally. Please help me fix it:\n\n\`\`\`\n${pastedError}\n\`\`\``);
      setPastedError("");
      onToggleTroubleshoot(false);
    } else {
      if (!query.trim() || isQueryLoading) return;
      onQuery(query);
      setQuery("");
    }
  };

  const parseFixTag = (text: string) => {
    // Robust parser that handles attributes in any order, single/double quotes, and newlines
    const tagMatch = text.match(/<FIX\s+([\s\S]+?)\/>/);
    if (!tagMatch) return null;

    const attrsString = tagMatch[1];
    const getAttr = (name: string) => {
      const match = attrsString.match(new RegExp(`${name}=["']([^"']*)["']`));
      return match ? match[1] : undefined;
    };

    const action = getAttr("action");
    if (!action) return null;

    const fix = {
      action,
      package: getAttr("package"),
      reason: getAttr("reason"),
      description: getAttr("description")
    };
    console.log("Detected FIX tag:", fix);
    return fix;
  };

  const renderMessageContent = (content: string) => {
    const fix = parseFixTag(content);
    const cleanContent = content.replace(/<FIX\s+[\s\S]*?\/>/g, "").trim();

    console.log("Rendering message card, fix detected:", !!fix);

    return (
      <div className="space-y-3">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
          code({ node, className, children, ...props }: any) {
            return <code className="bg-black/30 px-1 rounded text-xs font-mono text-emerald-400" {...props}>{children}</code>;
          },
          p({ children }) { return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>; },
          ul({ children }) { return <ul className="list-disc list-inside space-y-1 mb-2 last:mb-0">{children}</ul>; },
        }}>
          {cleanContent}
        </ReactMarkdown>

        {fix && (
          <SmartFixCard fix={fix} onApplyFix={onApplyFix} isPatchLoading={isPatchLoading} />
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-surface-900/40">
      <div className="flex-1 overflow-auto p-4 space-y-4" ref={scrollRef}>
        {chatHistory.length === 0 && !currentResponse && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-md mx-auto">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Sparkles size={32} className="text-emerald-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">Project Assistant</h3>
              <p className="text-slate-400 text-sm">
                Ask me anything about your project's architecture, dependencies, deployment, or how specific features work.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full">
              {[
                "How do I deploy this to AWS?",
                "What's the project structure?",
                "How do I add a new page?",
                "What styling libraries are used?"
              ].map((q) => (
                <button
                  key={q}
                  onClick={() => onQuery(q)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 hover:border-white/20 transition-all text-left"
                >
                  {q}
                </button>
              ))}
              <button
                onClick={() => onToggleTroubleshoot(true)}
                className="px-4 py-2.5 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all text-left flex items-center gap-2"
              >
                <ShieldCheck size={14} />
                I have a build/runtime error
              </button>
            </div>
          </div>
        )}

        {chatHistory.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user"
              ? "bg-brand-500/20 border border-brand-500/30 text-white"
              : "bg-surface-700/50 border border-white/5 text-slate-200"
              }`}>
              {renderMessageContent(msg.content)}
            </div>
          </div>
        ))}

        {currentResponse && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-surface-700/50 border border-white/5 text-slate-200">
              {renderMessageContent(currentResponse)}
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center mt-4">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-xs text-red-400 animate-in fade-in slide-in-from-top-1 duration-300">
              <span className="font-semibold mr-2">Error:</span>
              {error}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-white/5 bg-surface-800/50">
        <form onSubmit={handleSubmit} className="relative max-w-4xl mx-auto space-y-3">
          {isTroubleshootMode ? (
            <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <ShieldCheck size={14} />
                  Troubleshoot Build Error
                </span>
                <button
                  type="button"
                  onClick={() => onToggleTroubleshoot(false)}
                  className="text-[10px] text-slate-500 hover:text-slate-300 uppercase underline underline-offset-2"
                >
                  Cancel
                </button>
              </div>
              <textarea
                value={pastedError}
                onChange={(e) => setPastedError(e.target.value)}
                placeholder="Paste your terminal error or build log here..."
                className="w-full bg-red-500/5 border border-red-500/10 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-red-500/30 transition-all min-h-[120px] font-mono leading-relaxed"
                disabled={isQueryLoading}
              />
              <button
                type="submit"
                disabled={!pastedError.trim() || isQueryLoading}
                className="w-full py-2.5 rounded-lg bg-red-500 text-white text-xs font-semibold disabled:opacity-30 transition-all hover:bg-red-400 active:scale-[0.98] shadow-lg shadow-red-500/20"
              >
                {isQueryLoading ? "Analyzing Error..." : "Analyze & Fix Error"}
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask about deployment, libraries, architecture..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/40 transition-all shadow-inner"
                disabled={isQueryLoading}
              />
              <button
                type="submit"
                disabled={!query.trim() || isQueryLoading}
                className="absolute right-2 top-1.5 bottom-1.5 px-3 rounded-lg bg-emerald-500 text-white disabled:opacity-30 disabled:grayscale transition-all hover:bg-emerald-400 active:scale-95 flex items-center justify-center shadow-lg shadow-emerald-500/20"
              >
                {isQueryLoading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ─── OutputTabs (main export) ─────────────────────────────────────────────────

interface OutputTabsProps {
  output: ProjectOutput;
  onPatch: (opts: { prompt: string; stack: StackType }) => void;
  isPatchLoading: boolean;
  patchStatus: string | null;
  patchError: string | null;
  onQuery: (q: string) => void;
  chatHistory: Message[];
  isQueryLoading: boolean;
  currentQueryResponse: string;
  onApplyFix: (fix: { action: string; package?: string; description?: string }) => void;
}

export default function OutputTabs({
  output,
  onPatch,
  isPatchLoading,
  patchStatus,
  patchError,
  onQuery,
  chatHistory,
  isQueryLoading,
  currentQueryResponse,
  onApplyFix
}: OutputTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("code");
  const [isTroubleshootMode, setIsTroubleshootMode] = useState(false);
  const [localFiles, setLocalFiles] = useState<GeneratedFile[]>(output.files);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);

  useEffect(() => {
    setLocalFiles(output.files);
    if (output.files.length > 0) setSelectedFile(output.files[0]);
  }, [output.files]);

  const handleFileChange = useCallback((path: string, newContent: string) => {
    setLocalFiles((prev) => prev.map((f) => (f.path === path ? { ...f, content: newContent } : f)));
    setSelectedFile((prev) => (prev?.path === path ? { ...prev, content: newContent } : prev));
  }, []);

  const fileTree = useMemo(() => buildFileTree(localFiles), [localFiles]);
  const projectName = output.prompt.split(" ").slice(0, 4).join("-").toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-");
  const extOutput = output as ProjectOutput & { iacTemplate?: string };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 glass-strong rounded-t-2xl shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              id={`tab-${tab.id}`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${activeTab === tab.id
                ? tab.id === "iac"
                  ? "bg-orange-500/15 text-orange-400 border border-orange-500/20"
                  : tab.id === "edit"
                    ? "bg-purple-500/15 text-purple-400 border border-purple-500/20"
                    : tab.id === "ask"
                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                      : "bg-brand-500/15 text-brand-400 border border-brand-500/20"
                : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "iac" && extOutput.iacTemplate && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-orange-400" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              {localFiles.length} files
            </span>
            <span>{output.modelUsed}</span>
            {output.tokensUsed && <span>{output.tokensUsed.toLocaleString()} tokens</span>}
          </div>
          <DownloadButton files={localFiles} projectName={projectName || "my-project"} readme={output.readme} architecture={output.architecture} />
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 glass rounded-b-2xl overflow-hidden relative">
        {activeTab === "code" && (
          <div className="flex flex-1 min-h-0 h-full w-full">
            <div className="w-64 border-r border-white/5 flex flex-col shrink-0 bg-surface-800/30 overflow-hidden">
              <FileExplorer tree={fileTree} files={localFiles} selectedPath={selectedFile?.path || ""} onSelectFile={setSelectedFile} />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              {selectedFile
                ? <CodeViewer file={selectedFile} onChange={handleFileChange} />
                : <div className="flex items-center justify-center h-full text-slate-500 text-sm">Select a file to view</div>
              }
            </div>
          </div>
        )}
        {activeTab === "preview" && (
          <PreviewTab
            files={localFiles}
            onTroubleshoot={() => {
              setActiveTab("ask");
              setIsTroubleshootMode(true);
            }}
          />
        )}
        {activeTab === "architecture" && <ArchitectureDiagram mermaidSource={output.architecture} />}
        {activeTab === "iac" && <IaCTab iacTemplate={extOutput.iacTemplate} />}
        {activeTab === "security" && (
          <div className="flex flex-col h-full border-l-[3px] border-emerald-500/50">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-surface-800/50">
              <ShieldCheck className="text-emerald-400" size={18} />
              <span className="text-sm font-semibold text-slate-200">Nova Threat & Security Analysis</span>
            </div>
            <div className="flex-1 overflow-auto min-h-0 p-6 bg-surface-900/30">
              <ReactMarkdown remarkPlugins={[remarkGfm]} className="prose prose-invert max-w-3xl prose-h1:text-emerald-400 prose-h2:text-emerald-300/90 prose-h2:border-b-emerald-500/20 prose-strong:text-slate-200">
                {output.securityReport || "No security report generated."}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {activeTab === "docs" && <DocsTab output={output} />}
        {activeTab === "edit" && (
          <EditTab
            stack={output.stack}
            onPatch={onPatch}
            isPatchLoading={isPatchLoading}
            patchStatus={patchStatus}
            error={patchError}
          />
        )}
        {activeTab === "ask" && (
          <AskAITab
            onQuery={onQuery}
            chatHistory={chatHistory}
            isQueryLoading={isQueryLoading}
            currentResponse={currentQueryResponse}
            error={patchError}
            isTroubleshootMode={isTroubleshootMode}
            onToggleTroubleshoot={setIsTroubleshootMode}
            onApplyFix={onApplyFix}
            isPatchLoading={isPatchLoading}
          />
        )}
      </div>
    </div>
  );
}