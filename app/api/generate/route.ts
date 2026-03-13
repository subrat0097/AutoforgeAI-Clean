import { NextRequest, NextResponse } from "next/server";
import { invokeNovaPro, invokeNovaLite } from "@/lib/bedrock";
import {
  getAppGenerationSystemPrompt,
  buildGenerationPrompt,
  ARCHITECTURE_SYSTEM_PROMPT,
  buildArchitecturePrompt,
  README_SYSTEM_PROMPT,
  buildReadmePrompt,
  DEPLOY_GUIDE_SYSTEM_PROMPT,
  SECURITY_SCAN_SYSTEM_PROMPT,
} from "@/lib/prompts";
import {
  parseGeneratedFiles,
  parseMetadata,
  parseMermaidDiagram,
} from "@/lib/parser";
import type { StackType, ProjectOutput } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120; // 2 minutes for full generation

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: "Please provide a more detailed prompt." },
        { status: 400 }
      );
    }

    // ── Step 1: Generate full app code with Nova Pro ──────────────────────
    const systemPrompt = getAppGenerationSystemPrompt(stack);
    const userPrompt = buildGenerationPrompt(prompt, stack, additionalInstructions);

    console.log(`[AutoForgeAI] Generating ${stack} app with Nova Pro...`);
    const codeResponse = await invokeNovaPro(userPrompt, systemPrompt, imageBase64);

    const files = parseGeneratedFiles(codeResponse.text);
    const metadata = parseMetadata(codeResponse.text);

    if (files.length === 0) {
      return NextResponse.json(
        {
          error: "Generation failed — no files were produced. Please try a more specific prompt.",
          rawResponse: codeResponse.text.slice(0, 500),
        },
        { status: 500 }
      );
    }

    // ── Step 2-5: Generate Docs concurrently with Nova Lite ──────────────
    console.log("[AutoForgeAI] Generating Architecture, README, Deploy Guide, and Security Report in parallel...");

    const [archResponse, readmeResponse, deployResponse, securityResponse] = await Promise.allSettled([
      invokeNovaLite(buildArchitecturePrompt(prompt), ARCHITECTURE_SYSTEM_PROMPT),
      invokeNovaLite(buildReadmePrompt(prompt, stack, metadata?.features || []), README_SYSTEM_PROMPT),
      invokeNovaLite(`Generate deployment guide for: ${prompt} (Stack: ${stack})`, DEPLOY_GUIDE_SYSTEM_PROMPT),
      invokeNovaLite(`Perform threat modeling and security analysis for: ${prompt} (Stack: ${stack})`, SECURITY_SCAN_SYSTEM_PROMPT),
    ]);

    let architecture = `graph TD\n    A[Browser Client] --> B[Application]\n    B --> C[(Database)]`;
    let readme = `# Generated Project\n\n${prompt}\n\n## Setup\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\``;
    let deployGuide = `# Deployment Guide\n\nRun \`npm run build\` then deploy to Vercel or your preferred platform.`;
    let securityReport = `# Security Report\n\nSecurity analysis could not be completed at this time. Always follow AWS security best practices.`;

    if (archResponse.status === "fulfilled") {
      try { architecture = parseMermaidDiagram(archResponse.value.text); } catch (e) { console.error("Error parsing Mermaid diagram", e); }
    } else {
      console.error("[AutoForgeAI] Architecture generation failed:", archResponse.reason);
    }

    if (readmeResponse.status === "fulfilled") {
      readme = readmeResponse.value.text;
    } else {
      console.error("[AutoForgeAI] README generation failed:", readmeResponse.reason);
    }

    if (deployResponse.status === "fulfilled") {
      deployGuide = deployResponse.value.text;
    } else {
      console.error("[AutoForgeAI] Deploy guide generation failed:", deployResponse.reason);
    }

    if (securityResponse.status === "fulfilled") {
      securityReport = securityResponse.value.text;
    } else {
      console.error("[AutoForgeAI] Security report generation failed:", securityResponse.reason);
    }

    // ── Build response ────────────────────────────────────────────────────
    const projectOutput: ProjectOutput = {
      id: `forge_${Date.now()}`,
      prompt,
      stack,
      files,
      architecture,
      readme,
      deployGuide,
      securityReport,
      generatedAt: new Date().toISOString(),
      modelUsed: `Nova Pro (code) + Nova Lite (arch/docs)`,
      tokensUsed: codeResponse.tokensIn + codeResponse.tokensOut,
    };

    console.log(
      `[AutoForgeAI] ✅ Generated ${files.length} files, ${projectOutput.tokensUsed} tokens used`
    );

    return NextResponse.json(projectOutput);
  } catch (error: unknown) {
    console.error("[AutoForgeAI] Generation error:", error);

    const message =
      error instanceof Error ? error.message : "Unknown generation error";

    // Handle specific AWS errors
    if (message.includes("AccessDeniedException")) {
      return NextResponse.json(
        {
          error:
            "AWS access denied. Please check your credentials and ensure Nova models are enabled in Bedrock.",
        },
        { status: 403 }
      );
    }

    if (message.includes("ValidationException")) {
      return NextResponse.json(
        { error: "Invalid request to Nova model. Please try rephrasing your prompt." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: `Generation failed: ${message}` },
      { status: 500 }
    );
  }
}
