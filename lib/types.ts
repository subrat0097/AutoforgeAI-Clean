// Shared TypeScript types for AutoForgeAI

export interface GeneratedFile {
  name: string;         // e.g. "components/Button.tsx"
  path: string;         // full relative path
  content: string;      // raw file content
  language: string;     // e.g. "typescript", "css"
  size?: number;        // bytes
}

export interface ProjectOutput {
  id: string;
  prompt: string;
  stack: StackType;
  files: GeneratedFile[];
  architecture: string;    // Mermaid diagram source
  readme: string;          // README.md content
  deployGuide: string;     // Deployment guide markdown
  securityReport: string;  // Security and Vulnerability Analysis markdown
  apiDocs?: string;        // API documentation markdown
  generatedAt: string;
  modelUsed: string;
  tokensUsed?: number;
}

export type StackType =
  | "nextjs"
  | "react"
  | "html"
  | "vue"
  | "express"
  | "fullstack";

export interface StackOption {
  id: StackType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

export type GenerationStep =
  | "idle"
  | "planning"
  | "scaffolding"
  | "generating"
  | "architecture"
  | "documenting"
  | "security"
  | "ready"
  | "error";

export interface GenerationState {
  step: GenerationStep;
  message: string;
  progress: number;          // 0–100
  streamedTokens?: string;   // live streamed output
  error?: string;
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "folder";
  language?: string;
  children?: FileTreeNode[];
  content?: string;
}

export interface NovaRequestBody {
  prompt: string;
  imageBase64?: string;
  stack?: StackType;
  additionalInstructions?: string;
}

export interface NovaMessage {
  role: "user" | "assistant";
  content: Array<{
    type: "text" | "image";
    text?: string;
    source?: {
      type: "base64";
      media_type: string;
      data: string;
    };
  }>;
}
