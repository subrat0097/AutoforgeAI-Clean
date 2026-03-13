"use client";
import { useState, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  FileCode2,
  FileJson,
  FileText,
  FileImage,
  Globe,
} from "lucide-react";
import type { FileTreeNode, GeneratedFile } from "@/lib/types";

function getFileIcon(language?: string, name?: string) {
  const ext = name?.split(".").pop()?.toLowerCase() || "";
  const iconClass = "w-4 h-4 flex-shrink-0";

  if (["tsx", "ts"].includes(ext)) return <FileCode2 className={iconClass} style={{ color: "#3178c6" }} />;
  if (["jsx", "js"].includes(ext)) return <FileCode2 className={iconClass} style={{ color: "#f7df1e" }} />;
  if (ext === "json") return <FileJson className={iconClass} style={{ color: "#f59e0b" }} />;
  if (["css", "scss"].includes(ext)) return <FileCode2 className={iconClass} style={{ color: "#38bdf8" }} />;
  if (ext === "html") return <Globe className={iconClass} style={{ color: "#e44d26" }} />;
  if (ext === "md") return <FileText className={iconClass} style={{ color: "#94a3b8" }} />;
  if (["png", "jpg", "svg", "gif", "webp"].includes(ext)) return <FileImage className={iconClass} style={{ color: "#a78bfa" }} />;
  return <File className={iconClass} style={{ color: "#64748b" }} />;
}

function TreeNode({
  node,
  depth = 0,
  selectedPath,
  onSelect,
}: {
  node: FileTreeNode;
  depth?: number;
  selectedPath: string;
  onSelect: (file: FileTreeNode) => void;
}) {
  const [open, setOpen] = useState(depth < 2);

  if (node.type === "folder") {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className="file-tree-item w-full"
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {open ? (
            <ChevronDown size={12} className="text-slate-600 flex-shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-slate-600 flex-shrink-0" />
          )}
          {open ? (
            <FolderOpen size={14} style={{ color: "#fbbf24" }} className="flex-shrink-0" />
          ) : (
            <Folder size={14} style={{ color: "#fbbf24" }} className="flex-shrink-0" />
          )}
          <span className="truncate">{node.name}</span>
        </button>
        {open && node.children?.map((child) => (
          <TreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node)}
      className={`file-tree-item w-full ${selectedPath === node.path ? "active" : ""}`}
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      {getFileIcon(node.language, node.name)}
      <span className="truncate">{node.name}</span>
    </button>
  );
}

interface FileExplorerProps {
  tree: FileTreeNode[];
  files: GeneratedFile[];
  selectedPath: string;
  onSelectFile: (file: GeneratedFile) => void;
}

export default function FileExplorer({ tree, files, selectedPath, onSelectFile }: FileExplorerProps) {
  const [search, setSearch] = useState("");

  const handleSelect = useCallback(
    (node: FileTreeNode) => {
      const file = files.find((f) => f.path === node.path);
      if (file) onSelectFile(file);
    },
    [files, onSelectFile]
  );

  const filteredFiles = search
    ? files.filter((f) => f.name.toLowerCase().includes(search.toLowerCase()) || f.path.toLowerCase().includes(search.toLowerCase()))
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-white/5">
        <input
          type="text"
          placeholder="Search files..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface-600 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-brand-500/40"
        />
      </div>

      {/* Stats */}
      <div className="px-3 py-2 border-b border-white/5 flex gap-4">
        <span className="text-xs text-slate-600">{files.length} files</span>
        <span className="text-xs text-slate-600">
          {(files.reduce((s, f) => s + (f.size || 0), 0) / 1024).toFixed(1)} KB total
        </span>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-2 min-h-0">
        {filteredFiles ? (
          filteredFiles.length > 0 ? (
            filteredFiles.map((f) => (
              <button
                key={f.path}
                onClick={() => onSelectFile(f)}
                className={`file-tree-item w-full ${selectedPath === f.path ? "active" : ""}`}
              >
                {getFileIcon(f.language, f.name)}
                <div className="text-left min-w-0">
                  <div className="truncate text-xs">{f.name}</div>
                  <div className="text-[10px] text-slate-600 truncate">{f.path}</div>
                </div>
              </button>
            ))
          ) : (
            <p className="text-xs text-slate-600 text-center py-8">No files match &ldquo;{search}&rdquo;</p>
          )
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              selectedPath={selectedPath}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
