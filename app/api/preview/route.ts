import { NextResponse } from "next/server";

const store = new Map<string, string>();

export async function POST(req: Request) {
  const { html } = await req.json();
  const id = Date.now().toString();
  store.set(id, html);
  return NextResponse.json({ id });
}

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") || "";
  const html = store.get(id) || "<h1>Not found</h1>";
  return new NextResponse(html, {
    headers: { "Content-Type": "text/html" },
  });
}