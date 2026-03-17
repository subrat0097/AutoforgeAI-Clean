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

/**
 * Strips markdown code fences from the start and end of a string.
 * Handles patterns like:
 *   ```json\n...\n```
 *   ```tsx\n...\n```
 *   ```\n...\n```
 *   ` ``` `  (with no language tag)
 */
export function stripMarkdownFences(content: string): string {
  // Trim surrounding whitespace first
  let result = content.trim();

  // Match an opening fence: ``` optionally followed by a language tag (letters, digits, dots, dashes)
  // then a newline, then content, then a closing ``` at the end (with optional trailing whitespace)
  const fenceRegex = /^```[\w.\-]*\r?\n([\s\S]*?)\r?\n```$/;
  const match = fenceRegex.exec(result);

  if (match) {
    result = match[1].trim();
  } else {
    // Edge case: opening fence but no closing fence (malformed output)
    // Strip just the opening line if it looks like a fence
    const openOnlyRegex = /^```[\w.\-]*\r?\n/;
    result = result.replace(openOnlyRegex, "").trim();

    // And strip a dangling closing fence at the end
    const closeOnlyRegex = /\r?\n```$/;
    result = result.replace(closeOnlyRegex, "").trim();
  }

  return result;
}

// Parse Nova's XML-like file output format
export function parseGeneratedFiles(rawOutput: string): GeneratedFile[] {
  const files: GeneratedFile[] = [];

  // Match <FILE path="...">...</FILE> blocks
  const fileRegex = /<FILE\s+path="([^"]+)">([\s\S]*?)<\/FILE>/g;
  let match;

  while ((match = fileRegex.exec(rawOutput)) !== null) {
    const filePath = match[1].trim();
    // ✅ Strip any markdown fences Nova may have wrapped around the content
    const content = stripMarkdownFences(match[2].trim());
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
      // ✅ Also strip fences in fallback path just in case of double-wrapping
      const content = stripMarkdownFences(match[3].trim());
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
    return trimmed.replace(/(class\s+[^ \n,]+(?:,[^ \n,]+)*\s+)classDef\s+/g, "$1");
  }

  // Try ```mermaid or just ``` fenced block
  const fencedRegex = /```(?:mermaid)?\s*\n?([\s\S]*?)```/i;
  const fenced = fencedRegex.exec(rawOutput);
  if (fenced) {
    const content = fenced[1].trim();
    if (
      content.startsWith("graph") ||
      content.startsWith("pie") ||
      content.startsWith("sequenceDiagram") ||
      content.startsWith("classDiagram") ||
      content.startsWith("stateDiagram") ||
      content.startsWith("gantt") ||
      content.startsWith("journey") ||
      content.startsWith("gitGraph") ||
      content.startsWith("erDiagram")
    ) {
      return content.replace(/(class\s+[^ \n,]+(?:,[^ \n,]+)*\s+)classDef\s+/g, "$1");
    }
  }

  // Fallback: try to find graph TD / graph LR pattern and strip any backticks
  const graphRegex = /(graph\s+(?:TD|LR|BT|RL)[\s\S]*)/i;
  const graph = graphRegex.exec(rawOutput);
  let result = "";

  if (graph) {
    result = graph[1].replace(/```/g, "").trim();
  } else {
    result = rawOutput.replace(/```/g, "").trim();
  }

  // Cleanup: LLM often hallucinations 'class J,K classDef db' instead of 'class J,K db'
  return result.replace(/(class\s+[^ \n,]+(?:,[^ \n,]+)*\s+)classDef\s+/g, "$1");
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
      root.push({
        name: file.name,
        path: file.path,
        type: "file",
        language: file.language,
        content: file.content,
      });
    } else {
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