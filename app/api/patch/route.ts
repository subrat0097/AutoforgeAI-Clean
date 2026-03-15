import { NextRequest } from "next/server";
import { invokeNovaProStream } from "@/lib/bedrock";
import { parseGeneratedFiles } from "@/lib/parser";
import type { StackType, GeneratedFile } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

function emit(controller: ReadableStreamDefaultController, event: string, data: unknown) {
  const encoder = new TextEncoder();
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ event, ...(typeof data === "object" ? data : { message: data }) })}\n\n`)
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    changes,
    existingFiles,
    stack = "nextjs",
  }: {
    changes: string;
    existingFiles: GeneratedFile[];
    stack?: StackType;
  } = body;

  if (!changes || changes.trim().length < 3) {
    return new Response(JSON.stringify({ error: "Please describe the changes you want." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        emit(controller, "patch_start", {
          message: `Applying changes with Nova Pro: "${changes}"`,
        });

        // Build a compact file summary (just paths + first 20 lines each)
        const fileSummary = existingFiles
          .slice(0, 12) // cap to avoid token overflow
          .map((f) => `### ${f.path}\n${f.content.split("\n").slice(0, 20).join("\n")}${f.content.split("\n").length > 20 ? "\n// ... (truncated)" : ""}`)
          .join("\n\n");

        const systemPrompt = `You are AutoForgeAI, a senior engineer. You are given an existing codebase and a change request.

Your job is to output ONLY the files that need to be modified or created — not the entire project.

Rules:
1. Output ONLY changed/new files using: <FILE path="...">content</FILE>
2. Output complete file contents — never partial diffs
3. Preserve all existing logic not related to the change
4. If only one file changes, output only that one file
5. Keep the same tech stack and patterns as the existing code
6. No explanations outside FILE tags`;

        const userPrompt = `Existing project files (${stack}):

${fileSummary}

Change request: ${changes}

Output only the files that need to change.`;

        let fullResponse = "";
        for await (const chunk of invokeNovaProStream(userPrompt, systemPrompt)) {
          fullResponse += chunk;
          emit(controller, "code_chunk", { chunk });
        }

        const changedFiles = parseGeneratedFiles(fullResponse);

        if (changedFiles.length === 0) {
          emit(controller, "error", { message: "No file changes were produced. Try being more specific." });
          controller.close();
          return;
        }

        // Merge changed files into existing files
        const existingMap = new Map(existingFiles.map((f) => [f.path, f]));
        changedFiles.forEach((f) => existingMap.set(f.path, f));
        const mergedFiles = Array.from(existingMap.values());

        emit(controller, "patch_complete", {
          changedPaths: changedFiles.map((f) => f.path),
          files: mergedFiles,
          message: `Updated ${changedFiles.length} file${changedFiles.length > 1 ? "s" : ""}`,
        });

        controller.close();
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        emit(controller, "error", { message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}