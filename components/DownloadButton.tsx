"use client";
import { useState } from "react";
import { Download, Archive, FileDown, CheckCircle, Loader2 } from "lucide-react";
import JSZip from "jszip";
import type { GeneratedFile } from "@/lib/types";

interface DownloadButtonProps {
  files: GeneratedFile[];
  projectName?: string;
  readme?: string;
  architecture?: string;
}

export default function DownloadButton({
  files,
  projectName = "autoforgeai-project",
  readme,
  architecture,
}: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    setDone(false);

    try {
      // Add README and architecture source to the download if not already in files
      const allFiles: GeneratedFile[] = [...files];
      if (readme && !files.find((f) => f.name === "README.md")) {
        allFiles.push({ name: "README.md", path: "README.md", content: readme, language: "markdown" });
      }
      if (architecture && !files.find((f) => f.name === "ARCHITECTURE.md")) {
        allFiles.push({
          name: "ARCHITECTURE.md",
          path: "ARCHITECTURE.md",
          content: `# Architecture Diagram\n\n\`\`\`mermaid\n${architecture}\n\`\`\`\n`,
          language: "markdown",
        });
      }

      const zip = new JSZip();
      const folder = zip.folder(projectName);
      if (!folder) throw new Error("Failed to create ZIP folder");

      console.log("Packing ZIP for project:", projectName);
      allFiles.forEach((file) => {
        console.log(`- Adding file: ${file.path} (${file.content.length} bytes)`);
        folder.file(file.path, file.content);
      });

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipBlob);
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDone(true);
      setTimeout(() => setDone(false), 3000);
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Main ZIP download */}
      <button
        onClick={handleDownload}
        disabled={downloading}
        id="download-zip-btn"
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-300 ${
          done
            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
            : "btn-primary"
        }`}
      >
        {downloading ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Packing ZIP...</span>
          </>
        ) : done ? (
          <>
            <CheckCircle size={16} />
            <span>Downloaded!</span>
          </>
        ) : (
          <>
            <Archive size={16} />
            <span>Download ZIP</span>
          </>
        )}
      </button>

      {/* File count badge */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-600/50 border border-white/5 text-xs text-slate-500">
        <FileDown size={13} />
        <span>{files.length} files</span>
        <span className="text-slate-700">·</span>
        <span>{(files.reduce((s, f) => s + (f.size || 0), 0) / 1024).toFixed(1)} KB</span>
      </div>
    </div>
  );
}
