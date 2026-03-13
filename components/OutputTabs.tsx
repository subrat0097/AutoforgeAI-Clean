"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { Code2, Eye, GitBranch, BookOpen, Copy, Check, ShieldCheck, Maximize2, Minimize2 } from "lucide-react";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { ProjectOutput, GeneratedFile } from "@/lib/types";
import { buildFileTree } from "@/lib/parser";
import FileExplorer from "./FileExplorer";
import DownloadButton from "./DownloadButton";

const ArchitectureDiagram = dynamic(() => import("./ArchitectureDiagram"), { ssr: false });

type TabId = "preview" | "code" | "architecture" | "docs" | "security";

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "code", label: "Code", icon: <Code2 size={15} /> },
  { id: "preview", label: "Preview", icon: <Eye size={15} /> },
  { id: "architecture", label: "Architecture", icon: <GitBranch size={15} /> },
  { id: "security", label: "Security", icon: <ShieldCheck size={15} /> },
  { id: "docs", label: "Docs", icon: <BookOpen size={15} /> },
];

function CodeViewer({ file, onChange }: { file: GeneratedFile; onChange: (path: string, content: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(file.content);

  // Reset edit state when viewing a different file
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
      {/* File header */}
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
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium transition-colors px-3 py-1 bg-brand-500/10 rounded border border-brand-500/20"
            >
              <Check size={12} />
              <span>Save & Update</span>
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-3 py-1 rounded bg-white/5 hover:bg-white/10"
            >
              <Code2 size={12} />
              <span>Edit Code</span>
            </button>
          )}
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1 rounded hover:bg-white/5"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>
        </div>
      </div>
      {/* Code */}
      <div className="flex-1 overflow-auto min-h-0 bg-[#0d0d16]">
        {isEditing ? (
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full p-4 font-mono text-[0.8rem] bg-transparent text-slate-200 resize-none outline-none custom-scrollbar leading-relaxed"
            spellCheck="false"
          />
        ) : (
          <div className="h-full syntax-highlight">
            <SyntaxHighlighter
          language={file.language}
          style={vscDarkPlus}
          showLineNumbers
          wrapLines
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "#0d0d16",
            minHeight: "100%",
            fontSize: "0.8rem",
            fontFamily: "JetBrains Mono, Fira Code, monospace",
          }}
            lineNumberStyle={{ color: "#2d3748", fontSize: "0.75rem" }}
          >
            {editContent}
          </SyntaxHighlighter>
        </div>
        )}
      </div>
    </div>
  );
}


function PreviewTab({ files }: { files: GeneratedFile[] }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const previewHtml = useMemo(() => {
    // ─── 1. HTML projects: inject CSS/JS directly ────────────────────
    const htmlFile = files.find((f) => f.name === "index.html") || files.find((f) => f.path.endsWith(".html"));
    if (htmlFile) {
      let html = htmlFile.content;
      const cssFiles = files.filter((f) => f.name.endsWith(".css"));
      const allCss = cssFiles.map((f) => f.content).join("\n");
      if (allCss && !html.includes("<style")) {
        html = html.replace("</head>", `<style>\n${allCss}\n</style>\n</head>`);
      }
      const jsFile = files.find((f) => (f.name.endsWith(".js")) && !f.name.includes("config"));
      if (jsFile && !html.includes("<script")) {
        html = html.replace("</body>", `<script>\n${jsFile.content}\n</script>\n</body>`);
      }
      return html;
    }

    // ─── 2. React / Next.js projects ─────────────────────────────────
    const cssFiles = files.filter((f) => f.name.endsWith(".css"));
    const allCss = cssFiles
      .map((f) => f.content)
      .join("\n\n")
      .replace(/@tailwind\s+[^;]+;/g, "")
      .replace(/@import\s+url\([^)]+\)\s*;/g, "")
      .replace(/@import\s+['"][^'"]+['"]\s*;/g, "")
      .replace(/@apply\s+[^;]+;/g, "/* removed */");

    const componentFiles = files.filter((f) =>
      (f.name.endsWith(".tsx") || f.name.endsWith(".jsx") || f.name.endsWith(".ts") || f.name.endsWith(".js")) &&
      !f.name.endsWith(".d.ts") &&
      !f.name.includes("config") &&
      !f.name.includes("tailwind") &&
      !f.name.includes("postcss") &&
      !f.name.includes("middleware") &&
      !f.path.includes("api/") &&
      !f.path.includes("lib/") &&
      !f.path.includes("utils/") &&
      !f.path.includes("types")
    );

    const utilFiles = files.filter((f) =>
      (f.name.endsWith(".ts") || f.name.endsWith(".js")) &&
      (f.path.includes("lib/") || f.path.includes("utils/")) &&
      !f.name.endsWith(".d.ts") &&
      !f.name.includes("config")
    );

    const mainFile = files.find((f) => f.name === "page.tsx" || f.name === "page.jsx")
      || files.find((f) => f.name === "App.tsx" || f.name === "App.jsx")
      || files.find((f) => f.name === "index.tsx" || f.name === "index.jsx");

    function extractImportedNames(code: string): string[] {
      const names: string[] = [];
      const lines = code.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("import")) continue;
        if (trimmed.startsWith("import type")) continue;
        const namedMatch = trimmed.match(/\{([^}]+)\}/);
        if (namedMatch) {
          namedMatch[1].split(",").forEach((n) => {
            const parts = n.trim().split(/\s+as\s+/);
            const name = (parts[1] || parts[0]).trim();
            if (name && name !== "React" && name !== "ReactDOM") names.push(name);
          });
        }
        const defaultMatch = trimmed.match(/^import\s+(\w+)\s+from/);
        if (defaultMatch && defaultMatch[1] !== "React" && defaultMatch[1] !== "ReactDOM" && defaultMatch[1] !== "type") {
          names.push(defaultMatch[1]);
        }
      }
      return [...new Set(names)];
    }

    // New: Extract all names DEFINED in the files to avoid redeclaration errors
    function extractDefinedNames(code: string): string[] {
      const names: string[] = [];
      // function Name
      const funcMatches = code.matchAll(/function\s+([A-Z]\w*)/g);
      for (const m of funcMatches) names.push(m[1]);
      // const Name =
      const constMatches = code.matchAll(/(?:const|let|var)\s+([A-Z]\w*)\s*[=:]/g);
      for (const m of constMatches) names.push(m[1]);
      // class Name
      const classMatches = code.matchAll(/class\s+([A-Z]\w*)/g);
      for (const m of classMatches) names.push(m[1]);
      return [...new Set(names)];
    }

    function stripForBrowser(code: string): string {
      return code
        .replace(/^["']use (?:client|server)["'];?\s*$/gm, "")
        // Improved multi-line import removal
        .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, "")
        // Also remove simple side-effect imports like import "./style.css"
        .replace(/import\s+['"][^'"]+['"];?/gm, "")
        .replace(/export\s+default\s+function\s+/g, "function ")
        .replace(/export\s+default\s+(?=const|let|var)/g, "")
        .replace(/^export\s+default\s+(\w+);?\s*$/gm, "")
        .replace(/^export\s+(const|let|var|function|class)\s+/gm, "$1 ")
        .replace(/^export\s*\{[^}]*\};?\s*$/gm, "")
        .replace(/^interface\s+\w+[^{]*\{[\s\S]*?\n\}/gm, "")
        .replace(/^type\s+\w+\s*=[\s\S]*?;\s*$/gm, "");
    }

    let mainComponentName = "App";
    if (mainFile) {
      const funcMatch = mainFile.content.match(/(?:export\s+default\s+)?function\s+([A-Z]\w*)/);
      if (funcMatch) mainComponentName = funcMatch[1];
      const arrowMatch = mainFile.content.match(/(?:export\s+default\s+)?(?:const|let)\s+([A-Z]\w*)\s*[=:]/);
      if (!funcMatch && arrowMatch) mainComponentName = arrowMatch[1];
    }

    const allImportedNames = new Set<string>();
    const allDefinedNames = new Set<string>();
    const allFilesToProcess = [...utilFiles, ...componentFiles];
    for (const f of allFilesToProcess) {
      extractImportedNames(f.content).forEach((n) => allImportedNames.add(n));
      extractDefinedNames(f.content).forEach((n) => allDefinedNames.add(n));
    }

    const reactHooks = new Set([
      "useState", "useEffect", "useRef", "useCallback", "useMemo",
      "useContext", "useReducer", "useLayoutEffect", "useId",
      "createContext", "forwardRef", "memo", "lazy", "Suspense",
      "Fragment", "Children", "cloneElement", "createElement",
      "isValidElement", "createPortal", "flushSync",
    ]);

    const stubLines: string[] = [];
    Array.from(allImportedNames).forEach((name) => {
      if (reactHooks.has(name) || allDefinedNames.has(name)) return;
      
      if (name[0] === name[0].toUpperCase()) {
        // Improved stub: try to render as a Lucide icon if it sounds like one
        stubLines.push(
          `if (typeof ${name} === 'undefined') { 
            var ${name} = function ${name}(props) { 
              return React.createElement('span', { 
                className: 'inline-flex items-center justify-center ' + (props.className || ''),
                style: { width: props.size || '1.2em', height: props.size || '1.2em' }
              }, React.createElement('svg', { 
                viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', 
                strokeLinecap: 'round', strokeLinejoin: 'round', style: { width: '100%', height: '100%' }
              }, React.createElement('circle', { cx: '12', cy: '12', r: '10' }), React.createElement('path', { d: 'M12 8v8M8 12h8' }))); 
            }; 
          }`
        );
      } else {
        stubLines.push(`if (typeof ${name} === 'undefined') { var ${name} = function() { return null; }; }`);
      }
    });

    const nonMainComponents = componentFiles.filter((f) => f !== mainFile);
    const orderedFiles = [...utilFiles, ...nonMainComponents];
    if (mainFile) orderedFiles.push(mainFile);

    const processedCode = orderedFiles
      .map((f) => `// ── ${f.path} ──\n${stripForBrowser(f.content)}`)
      .join("\n\n");

    const fallbackHtml = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:2rem;text-align:center;gap:1rem;">
      <div style="font-size:3rem">🚀</div>
      <h2 style="font-size:1.5rem;font-weight:700;background:linear-gradient(135deg,#6366f1,#d946ef);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Preview Ready</h2>
      <p style="color:#94a3b8;max-width:400px;line-height:1.6;">
        Build complete for <strong style="color:#a5b4fc;">${files.length} files</strong>.
      </p>
      <div style="background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:12px;padding:1rem 1.5rem;margin-top:0.5rem;">
        <code style="color:#a5b4fc;font-size:0.85rem;font-family:monospace;">npm install && npm run dev</code>
      </div>
    </div>`;

    return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"><\/script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone@7/babel.min.js"><\/script>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style id="preview-styles">
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', system-ui, sans-serif; background: #0a0a0f; color: #f1f5f9; min-height: 100vh; overflow-x: hidden; }
    ${allCss?.replace(/<\/style>/gi, "<\\/style>")}
    /* Simple scrollbar */
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: #0a0a0f; }
    ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
    ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="typescript,react">
    // ── React globals ───────────────────────────────────
    const { useState, useEffect, useRef, useCallback, useMemo, useContext,
            useReducer, useLayoutEffect, useId, createContext, forwardRef,
            memo, lazy, Suspense, Fragment, Children, cloneElement,
            createElement, isValidElement } = React;
    const { createPortal, flushSync } = ReactDOM;

    // ── Next.js stubs ───────────────────────────────────
    function Link({ children, href, className, ...props }) {
      return React.createElement('a', { href: href || '#', className, ...props }, children);
    }
    function Image({ src, alt, width, height, className, fill, style: propStyle, ...props }) {
      const style = fill ? { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', ...propStyle } : { maxWidth: '100%', height: 'auto', ...propStyle };
      // Fallback image if src is relative or missing
      const finalSrc = (src && (src.startsWith('http') || src.startsWith('data:'))) ? src : "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80";
      return React.createElement('img', { src: finalSrc, alt: alt || 'Product', width, height, className, style, ...props });
    }
    const useRouter = () => ({ push: (p) => console.log('Navigate to:', p), back: () => {}, replace: () => {}, pathname: '/', query: {} });
    const usePathname = () => '/';
    const useSearchParams = () => new URLSearchParams();
    const useParams = () => ({});
    const notFound = () => {};
    const redirect = (p) => { console.log('Redirect to:', p); };

    // ── Utility stubs ───────────────────────────────────
    const cn = (...args) => args.filter(Boolean).join(' ');
    const clsx = cn;

    // ── Import stubs ───────────────────────────────
    ${stubLines.join("\n    ")}

    // ── Generated code ──────────────────────────────────
    try {
      ${processedCode}

      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(${mainComponentName}));
    } catch(err) {
      console.error('Preview render error:', err);
      document.getElementById('root').innerHTML = \`${fallbackHtml.replace(/`/g, "\\`")}<div style="color:#ef4444;font-size:0.85rem;margin-top:1rem;padding:1rem;background:rgba(239,68,68,0.1);border-radius:8px;border:1px solid rgba(239,68,68,0.2);font-family:monospace;white-space:pre-wrap;text-align:left;">Error: \${err.message}\\n\${err.stack?.split('\\n').slice(0,3).join('\\n')}</div>\`;
    }
  <\/script>
</body>
</html>`;
  }, [files]);

  return (
    <div className={`flex flex-col w-full ${isFullscreen ? "fixed inset-0 z-50 bg-black" : "h-full flex-1"}`}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-surface-800/50 text-xs text-slate-500 shrink-0">
        <div className="flex gap-1.5 items-center">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
          <span className="ml-2 font-medium">Live Preview · Experimental</span>
        </div>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="flex items-center gap-1.5 hover:text-white transition-colors px-2 py-1 rounded bg-white/5 hover:bg-white/10"
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          <span>{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
        </button>
      </div>
      <div className="flex flex-col flex-1 w-full min-h-0 relative">
        <iframe
          id="preview-iframe"
          srcDoc={previewHtml}
          className="w-full h-full bg-white absolute inset-0 border-none"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
          title="App Preview"
        />
      </div>
    </div>
  );
}






function DocsTab({ output }: { output: ProjectOutput }) {
  const [activeDoc, setActiveDoc] = useState<"readme" | "deploy">("readme");

  const content = activeDoc === "readme" ? output.readme : output.deployGuide;

  return (
    <div className="flex flex-col h-full">
      {/* Doc selector */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-white/5 bg-surface-800/50 shrink-0">
        <button
          onClick={() => setActiveDoc("readme")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeDoc === "readme" ? "bg-brand-500/15 text-brand-400 border border-brand-500/20" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          README.md
        </button>
        <button
          onClick={() => setActiveDoc("deploy")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeDoc === "deploy" ? "bg-brand-500/15 text-brand-400 border border-brand-500/20" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          Deployment Guide
        </button>
      </div>

      {/* Markdown content */}
      <div className="flex-1 overflow-auto min-h-0 p-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "");
              const isInline = !match;
              return isInline ? (
                <code className="bg-surface-600 px-1.5 py-0.5 rounded text-xs font-mono text-brand-300" {...props}>
                  {children}
                </code>
              ) : (
                <SyntaxHighlighter
                  language={match[1]}
                  style={vscDarkPlus}
                  customStyle={{ borderRadius: "0.5rem", fontSize: "0.78rem" }}
                >
                  {String(children).replace(/\n$/, "")}
                </SyntaxHighlighter>
              );
            },
            table({ children }) {
              return (
                <div className="overflow-x-auto my-4">
                  <table className="w-full text-sm border-collapse">{children}</table>
                </div>
              );
            },
            th({ children }) {
              return <th className="px-3 py-2 text-left text-xs font-semibold text-slate-300 bg-surface-600 border border-white/10">{children}</th>;
            },
            td({ children }) {
              return <td className="px-3 py-2 text-xs text-slate-400 border border-white/5">{children}</td>;
            },
            h1({ children }) { return <h1 className="text-2xl font-bold gradient-text mb-4 mt-6">{children}</h1>; },
            h2({ children }) { return <h2 className="text-xl font-semibold text-slate-200 mb-3 mt-6 pb-2 border-b border-white/10">{children}</h2>; },
            h3({ children }) { return <h3 className="text-base font-semibold text-slate-300 mb-2 mt-4">{children}</h3>; },
            p({ children }) { return <p className="text-slate-400 text-sm leading-relaxed mb-3">{children}</p>; },
            ul({ children }) { return <ul className="list-disc list-inside space-y-1 mb-3 text-slate-400 text-sm">{children}</ul>; },
            li({ children }) { return <li className="text-slate-400 text-sm">{children}</li>; },
            a({ children, href }) { return <a href={href} className="text-brand-400 hover:text-brand-300 underline" target="_blank" rel="noopener noreferrer">{children}</a>; },
            blockquote({ children }) { return <blockquote className="border-l-4 border-brand-500/40 pl-4 my-3 text-slate-500 italic">{children}</blockquote>; },
          }}
          className="prose prose-invert max-w-none"
        >
          {content || "_No documentation generated._"}
        </ReactMarkdown>
      </div>
    </div>
  );
}

interface OutputTabsProps {
  output: ProjectOutput;
}

export default function OutputTabs({ output }: OutputTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("code");
  const [localFiles, setLocalFiles] = useState<GeneratedFile[]>(output.files);
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null);

  // Initialize strictly when output mounts
  useEffect(() => {
    setLocalFiles(output.files);
    if (output.files.length > 0) {
      setSelectedFile(output.files[0]);
    }
  }, [output.files]);

  const handleFileChange = useCallback((path: string, newContent: string) => {
    setLocalFiles((prev) =>
      prev.map((f) => (f.path === path ? { ...f, content: newContent } : f))
    );
    setSelectedFile((prev) => (prev?.path === path ? { ...prev, content: newContent } : prev));
  }, []);

  const fileTree = useMemo(() => buildFileTree(localFiles), [localFiles]);

  const projectName = output.prompt
    .split(" ")
    .slice(0, 4)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-");

  return (
    <div className="flex flex-col h-full">
      {/* Header with tabs and download */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 glass-strong rounded-t-2xl shrink-0 gap-4 flex-wrap">
        {/* Tabs */}
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              id={`tab-${tab.id}`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-brand-500/15 text-brand-400 border border-brand-500/20"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Stats + Download */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-slate-600">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              {localFiles.length} files
            </span>
            <span>{output.modelUsed}</span>
            {output.tokensUsed && (
              <span>{output.tokensUsed.toLocaleString()} tokens</span>
            )}
          </div>
          <DownloadButton
            files={localFiles}
            projectName={projectName || "my-project"}
            readme={output.readme}
            architecture={output.architecture}
          />
        </div>
      </div>

      {/* Tab content */}
      <div className="flex flex-col flex-1 min-h-0 glass rounded-b-2xl overflow-hidden relative">
        {activeTab === "code" && (
          <div className="flex flex-1 min-h-0 h-full w-full">
            {/* File tree sidebar */}
            <div className="w-64 border-r border-white/5 flex flex-col shrink-0 bg-surface-800/30 overflow-hidden">
              <FileExplorer
                tree={fileTree}
                files={localFiles}
                selectedPath={selectedFile?.path || ""}
                onSelectFile={setSelectedFile}
              />
            </div>
            {/* Code viewer */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {selectedFile ? (
                <CodeViewer file={selectedFile} onChange={handleFileChange} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  Select a file to view
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "preview" && <PreviewTab files={localFiles} />}
        {activeTab === "architecture" && <ArchitectureDiagram mermaidSource={output.architecture} />}
        {activeTab === "security" && (
          <div className="flex flex-col h-full border-l-[3px] border-emerald-500/50">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-surface-800/50">
              <ShieldCheck className="text-emerald-400" size={18} />
              <span className="text-sm font-semibold text-slate-200">Nova Threat & Security Analysis</span>
            </div>
            <div className="flex-1 overflow-auto min-h-0 p-6 bg-surface-900/30">
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                className="prose prose-invert max-w-3xl prose-h1:text-emerald-400 prose-h2:text-emerald-300/90 prose-h2:border-b-emerald-500/20 prose-strong:text-slate-200"
              >
                {output.securityReport || "No security report generated."}
              </ReactMarkdown>
            </div>
          </div>
        )}
        {activeTab === "docs" && <DocsTab output={output} />}
      </div>
    </div>
  );
}
