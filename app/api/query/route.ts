import { NextRequest, NextResponse } from "next/server";
import { invokeNovaLiteStream } from "@/lib/bedrock";
import { QUERY_SYSTEM_PROMPT } from "@/lib/prompts";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { query, files, stack, prompt } = await req.json();

    // Construct the context for the AI
    const fileContext = files.map((f: any) => `Path: ${f.path}\nContent:\n${f.content}`).join("\n\n---\n\n");
    const fullSystemPrompt = `${QUERY_SYSTEM_PROMPT}\n\nPROJECT STACK: ${stack}\nORIGINAL PROMPT: ${prompt}\n\nCURRENT CODEBASE:\n${fileContext}`;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of invokeNovaLiteStream(query, fullSystemPrompt)) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Query Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
