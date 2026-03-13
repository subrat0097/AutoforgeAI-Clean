import type { GeneratedFile, FileTreeNode } from "./types";

// Language detection from file extension
function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    md: "markdown",
    yml: "yaml",
    yaml: "yaml",
    py: "python",
    sh: "bash",
    env: "bash",
    prisma: "prisma",
    sql: "sql",
    graphql: "graphql",
    gql: "graphql",
    dockerfile: "dockerfile",
  };
  return langMap[ext] || "text";
}

// Parse Nova's XML-like file output format
export function parseGeneratedFiles(rawOutput: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Match <FILE path="...">...</FILE> blocks
  const fileRegex = /<FILE\s+path="([^"]+)">([\s\S]*?)<\/FILE>/g;
  let match;

  while ((match = fileRegex.exec(rawOutput)) !== null) {
    const filePath = match[1].trim();
    const content = match[2].trim();
    const name = filePath.split("/").pop() || filePath;

    files.push({
      name,
      path: filePath,
      content,
      language: detectLanguage(name),
      size: new Blob([content]).size,
    });
  }

  // Fallback: try markdown code blocks with filenames
  if (files.length === 0) {
    const mdBlockRegex = /```(\w+)?\s*\n(?:\/\/ (.+\.(?:tsx?|jsx?|css|html|json|md|yml|yaml))\n)?([\s\S]*?)```/g;
    while ((match = mdBlockRegex.exec(rawOutput)) !== null) {
      const lang = match[1] || "text";
      const fileName = match[2];
      const content = match[3].trim();
      if (fileName) {
        files.push({
          name: fileName.split("/").pop() || fileName,
          path: fileName,
          content,
          language: lang,
          size: new Blob([content]).size,
        });
      }
    }
  }

  return files;
}

// Extract <METADATA>...</METADATA> block
export function parseMetadata(rawOutput: string): {
  stack?: string;
  mainFile?: string;
  setupCommand?: string;
  devCommand?: string;
  buildCommand?: string;
  features?: string[];
} | null {
  const metaRegex = /<METADATA>([\s\S]*?)<\/METADATA>/;
  const match = metaRegex.exec(rawOutput);
  if (!match) return null;

  try {
    return JSON.parse(match[1].trim());
  } catch (e) {
    console.warn("Failed to parse metadata JSON:", e);
    return null;
  }
}

// Extract Mermaid diagram from text
export function parseMermaidDiagram(rawOutput: string): string {
  // First check if the output itself is a valid mermaid graph
  const trimmed = rawOutput.trim();
  if (trimmed.startsWith("graph")) {
    return trimmed;
  }

  // Try ```mermaid or just ``` fenced block
  const fencedRegex = /```(?:mermaid)?\s*\n?([\s\S]*?)```/i;
  const fenced = fencedRegex.exec(rawOutput);
  if (fenced) {
    const content = fenced[1].trim();
    if (content.startsWith("graph") || content.startsWith("pie") || content.startsWith("sequenceDiagram") || content.startsWith("classDiagram") || content.startsWith("stateDiagram") || content.startsWith("gantt") || content.startsWith("journey") || content.startsWith("gitGraph") || content.startsWith("erDiagram")) return content;
  }

  // Fallback: try to find graph TD / graph LR pattern and strip any backticks
  const graphRegex = /(graph\s+(?:TD|LR|BT|RL)[\s\S]*)/i;
  const graph = graphRegex.exec(rawOutput);
  if (graph) {
    return graph[1].replace(/```/g, "").trim();
  }

  return rawOutput.replace(/```/g, "").trim();
}

// Build a tree structure from flat file list
export function buildFileTree(files: GeneratedFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];
  const folderMap = new Map<string, FileTreeNode>();

  // Sort files so folders come first
  const sorted = [...files].sort((a, b) => {
    const aDepth = a.path.split("/").length;
    const bDepth = b.path.split("/").length;
    return aDepth - bDepth;
  });

  for (const file of sorted) {
    const parts = file.path.split("/");

    if (parts.length === 1) {
      // Top-level file
      root.push({
        name: file.name,
        path: file.path,
        type: "file",
        language: file.language,
        content: file.content,
      });
    } else {
      // Nested file — ensure folders exist
      let currentPath = "";
      let currentLevel = root;

      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i];

        if (!folderMap.has(currentPath)) {
          const folder: FileTreeNode = {
            name: parts[i],
            path: currentPath,
            type: "folder",
            children: [],
          };
          folderMap.set(currentPath, folder);
          currentLevel.push(folder);
        }

        const folder = folderMap.get(currentPath)!;
        currentLevel = folder.children!;
      }

      // Add the file to the deepest folder
      currentLevel.push({
        name: file.name,
        path: file.path,
        type: "file",
        language: file.language,
        content: file.content,
      });
    }
  }

  return root;
}

// Estimate total project size
export function calcProjectSize(files: GeneratedFile[]): string {
  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  if (totalBytes < 1024) return `${totalBytes} B`;
  if (totalBytes < 1024 * 1024) return `${(totalBytes / 1024).toFixed(1)} KB`;
  return `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`;
}
