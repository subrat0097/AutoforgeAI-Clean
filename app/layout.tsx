import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoForgeAI — Build Production Apps with Nova AI",
  description:
    "Type a prompt and AutoForgeAI instantly generates a fully production-ready website or app, complete with architecture diagrams and downloadable documentation — powered by AWS Amazon Nova.",
  keywords: ["AI app builder", "AWS Nova", "code generator", "production ready", "AutoForgeAI"],
  openGraph: {
    title: "AutoForgeAI",
    description: "Generate full-stack production apps from a single prompt using AWS Nova AI",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="font-sans antialiased" style={{ background: "#0a0a0f" }}>
        {/* Animated background grid */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(99,102,241,0.8) 1px, transparent 1px),
                linear-gradient(90deg, rgba(99,102,241,0.8) 1px, transparent 1px)
              `,
              backgroundSize: "60px 60px",
            }}
          />
          {/* Glow orbs */}
          <div
            className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full opacity-20"
            style={{
              background: "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          <div
            className="absolute top-[30%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-15"
            style={{
              background: "radial-gradient(circle, rgba(217,70,239,0.4) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
          <div
            className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] rounded-full opacity-10"
            style={{
              background: "radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%)",
              filter: "blur(80px)",
            }}
          />
        </div>
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </body>
    </html>
  );
}
