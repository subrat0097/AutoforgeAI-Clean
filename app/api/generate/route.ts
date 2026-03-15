import { NextRequest } from "next/server";
import { invokeNovaPro, invokeNovaLite, invokeNovaProStream } from "@/lib/bedrock";
import {
  getAppGenerationSystemPrompt,
  buildGenerationPrompt,
  ARCHITECTURE_SYSTEM_PROMPT,
  buildArchitecturePrompt,
  README_SYSTEM_PROMPT,
  buildReadmePrompt,
  DEPLOY_GUIDE_SYSTEM_PROMPT,
  SECURITY_SCAN_SYSTEM_PROMPT,
  CLARIFIER_SYSTEM_PROMPT,
  buildClarifierPrompt,
  IaC_SYSTEM_PROMPT,
  buildIaCPrompt,
} from "@/lib/prompts";
import {
  parseGeneratedFiles,
  parseMetadata,
  parseMermaidDiagram,
} from "@/lib/parser";
import type { StackType } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 180;

// Helper to emit SSE events
function emit(
  controller: ReadableStreamDefaultController,
  event: string,
  data: unknown
) {
  const encoder = new TextEncoder();
  controller.enqueue(
    encoder.encode(`data: ${JSON.stringify({ event, ...(typeof data === "object" ? data : { message: data }) })}\n\n`)
  );
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    prompt,
    stack = "nextjs",
    imageBase64,
    additionalInstructions,
  }: {
    prompt: string;
    stack?: StackType;
    imageBase64?: string;
    additionalInstructions?: string;
  } = body;

  if (!prompt || prompt.trim().length < 5) {
    return new Response(JSON.stringify({ error: "Please provide a more detailed prompt." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Return a streaming SSE response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // ── AGENT 1: Clarifier (Nova Lite) ──────────────────────────────
        emit(controller, "agent_start", {
          agent: 1,
          name: "Spec Clarifier",
          model: "Nova Lite",
          message: "Analyzing your idea and extracting requirements...",
        });

        const clarifierResponse = await invokeNovaLite(
          buildClarifierPrompt(prompt, stack),
          CLARIFIER_SYSTEM_PROMPT
        );

        emit(controller, "agent_done", {
          agent: 1,
          name: "Spec Clarifier",
          output: clarifierResponse.text,
          tokensUsed: clarifierResponse.tokensIn + clarifierResponse.tokensOut,
        });

        // ── AGENT 2: Architect (Nova Lite) ──────────────────────────────
        emit(controller, "agent_start", {
          agent: 2,
          name: "System Architect",
          model: "Nova Lite",
          message: "Designing system architecture and tech stack...",
        });

        const archResponse = await invokeNovaLite(
          buildArchitecturePrompt(prompt),
          ARCHITECTURE_SYSTEM_PROMPT
        );

        let architecture = `graph TD\n    A[Browser Client] --> B[Application]\n    B --> C[(Database)]`;
        try {
          architecture = parseMermaidDiagram(archResponse.text);
        } catch (e) {
          console.error("Mermaid parse error", e);
        }

        emit(controller, "agent_done", {
          agent: 2,
          name: "System Architect",
          output: architecture,
          tokensUsed: archResponse.tokensIn + archResponse.tokensOut,
        });

        // ── AGENT 3: Code Generator (Nova Pro — streaming) ──────────────
        emit(controller, "agent_start", {
          agent: 3,
          name: "Code Generator",
          model: "Nova Pro",
          message: "Generating production-ready application code...",
        });

        const systemPrompt = getAppGenerationSystemPrompt(stack);
        const userPrompt = buildGenerationPrompt(prompt, stack, additionalInstructions);

        let fullCode = "";
        for await (const chunk of invokeNovaProStream(userPrompt, systemPrompt, imageBase64)) {
          fullCode += chunk;
          emit(controller, "code_chunk", { chunk });
        }

        const files = parseGeneratedFiles(fullCode);
        const metadata = parseMetadata(fullCode);

        if (files.length === 0) {
          emit(controller, "error", { message: "Code generation produced no files. Please try a more specific prompt." });
          controller.close();
          return;
        }

        emit(controller, "agent_done", {
          agent: 3,
          name: "Code Generator",
          filesGenerated: files.length,
          output: `Generated ${files.length} files`,
        });

        // ── AGENT 4: IaC Generator (Nova Lite) ─────────────────────────
        emit(controller, "agent_start", {
          agent: 4,
          name: "IaC Generator",
          model: "Nova Lite",
          message: "Creating AWS infrastructure-as-code (CDK/SAM)...",
        });

        const iacResponse = await invokeNovaLite(
          buildIaCPrompt(prompt, stack, metadata?.features || []),
          IaC_SYSTEM_PROMPT
        );

        emit(controller, "agent_done", {
          agent: 4,
          name: "IaC Generator",
          output: iacResponse.text,
          tokensUsed: iacResponse.tokensIn + iacResponse.tokensOut,
        });

        // ── AGENT 5: Docs + Security (Nova Lite — parallel) ────────────
        emit(controller, "agent_start", {
          agent: 5,
          name: "Docs & Security",
          model: "Nova Lite",
          message: "Writing README, deployment guide, and security report...",
        });

        const [readmeRes, deployRes, securityRes] = await Promise.allSettled([
          invokeNovaLite(buildReadmePrompt(prompt, stack, metadata?.features || []), README_SYSTEM_PROMPT),
          invokeNovaLite(`Generate deployment guide for: ${prompt} (Stack: ${stack})`, DEPLOY_GUIDE_SYSTEM_PROMPT),
          invokeNovaLite(`Generate security best practices for: ${prompt} (Stack: ${stack})`, SECURITY_SCAN_SYSTEM_PROMPT),
        ]);

        const readme = readmeRes.status === "fulfilled" ? readmeRes.value.text : `# ${prompt}\n\nGenerated project.`;
        const deployGuide = deployRes.status === "fulfilled" ? deployRes.value.text : "Deploy using `npm run build`.";
        const securityReport = securityRes.status === "fulfilled" ? securityRes.value.text : "Follow AWS security best practices.";

        emit(controller, "agent_done", {
          agent: 5,
          name: "Docs & Security",
          output: "Docs and security report complete",
        });

        // ── Final output ────────────────────────────────────────────────
        emit(controller, "complete", {
          id: `forge_${Date.now()}`,
          prompt,
          stack,
          files,
          architecture,
          readme,
          deployGuide,
          securityReport,
          iacTemplate: iacResponse.text,
          clarifierOutput: clarifierResponse.text,
          generatedAt: new Date().toISOString(),
          modelUsed: "Nova Pro (code) + Nova Lite (arch / IaC / docs)",
          agentsUsed: 5,
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