"use client";
import { useState, useRef, useCallback } from "react";
import { Sparkles, Upload, X, ChevronDown, Wand2, ImagePlus } from "lucide-react";
import type { StackType, StackOption } from "@/lib/types";

const STACK_OPTIONS: StackOption[] = [
  { id: "nextjs", label: "Next.js", description: "Full-stack React framework", icon: "▲", color: "#6366f1" },
  { id: "react", label: "React + Vite", description: "SPAs with React & Tailwind", icon: "⚛", color: "#06b6d4" },
  { id: "html", label: "HTML/CSS/JS", description: "Pure vanilla web", icon: "🌐", color: "#f59e0b" },
  { id: "vue", label: "Vue 3", description: "Progressive framework", icon: "🟢", color: "#10b981" },
  { id: "express", label: "Express API", description: "Node.js REST API", icon: "🚂", color: "#d946ef" },
  { id: "fullstack", label: "Full Stack", description: "Next.js + Prisma + DB", icon: "🔥", color: "#ef4444" },
];

const EXAMPLE_PROMPTS = [
  "Build a beautiful SaaS landing page with pricing cards, testimonials, and CTA sections using Next.js and Tailwind CSS",
  "Create a full-stack todo app with user authentication, dark mode, drag-and-drop, and real-time updates",
  "Build an AI-powered personal portfolio website with animated hero, project showcase, skills radar chart, and contact form",
  "Create a real-time chat application with rooms, user presence indicators, and message reactions",
  "Build an e-commerce product page with image gallery, size selector, cart functionality, and checkout flow",
];

interface PromptInputProps {
  onGenerate: (opts: {
    prompt: string;
    stack: StackType;
    imageBase64?: string;
    additionalInstructions?: string;
  }) => void;
  isGenerating: boolean;
  isEditMode?: boolean;
}

export default function PromptInput({ onGenerate, isGenerating, isEditMode }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const [stack, setStack] = useState<StackType>("nextjs");
  const [showStackPicker, setShowStackPicker] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const [showExamples, setShowExamples] = useState(false);
  const [additionalInstructions, setAdditionalInstructions] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedStack = STACK_OPTIONS.find((s) => s.id === stack)!;

  const handleImage = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = (ev.target?.result as string).split(",")[1];
      setImageBase64(base64);
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!prompt.trim() || isGenerating) return;
    onGenerate({ prompt: prompt.trim(), stack, imageBase64, additionalInstructions: additionalInstructions || undefined });
  }, [prompt, stack, imageBase64, additionalInstructions, isGenerating, onGenerate]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Main input card */}
      <div className="gradient-border rounded-2xl w-full pointer-events-none">
        <div className="glass-strong rounded-2xl p-1 w-full pointer-events-auto">
          {/* Image preview */}
          {imagePreview && (
            <div className="relative mx-3 mt-3 inline-block">
              <img
                src={imagePreview}
                alt="Uploaded wireframe"
                className="h-20 rounded-lg object-cover border border-brand-500/20"
              />
              <button
                onClick={() => { setImageBase64(undefined); setImagePreview(undefined); }}
                className="absolute -top-2 -right-2 bg-surface-600 border border-white/10 rounded-full p-0.5 text-slate-400 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Textarea */}
          <textarea
            id="prompt-input"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isEditMode ? "What changes would you like to make? (e.g. 'Add a login page', 'Make it dark mode', 'Add a search bar'...)" : "Describe the app you want to build... (e.g. 'Create a full-stack e-commerce site with product listings, cart, user auth, and Stripe payments using Next.js')"}
            rows={5}
            disabled={isGenerating}
            className="w-full bg-transparent px-4 pt-4 pb-2 text-slate-100 placeholder-slate-500 resize-none focus:outline-none text-base leading-relaxed"
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-4 pb-3 pt-1 gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Stack picker */}
              <div className="relative">
                <button
                  onClick={() => setShowStackPicker(!showStackPicker)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
                  style={{
                    background: `${selectedStack.color}15`,
                    border: `1px solid ${selectedStack.color}40`,
                    color: selectedStack.color,
                  }}
                >
                  <span>{selectedStack.icon}</span>
                  <span>{selectedStack.label}</span>
                  <ChevronDown size={12} className={`transition-transform ${showStackPicker ? "rotate-180" : ""}`} />
                </button>
                {showStackPicker && (
                  <div className="absolute bottom-full left-0 mb-2 glass-strong rounded-xl p-2 w-64 z-50 shadow-2xl">
                    {STACK_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => { setStack(opt.id); setShowStackPicker(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors text-left"
                      >
                        <span className="text-lg">{opt.icon}</span>
                        <div>
                          <div className="text-sm font-medium text-slate-200">{opt.label}</div>
                          <div className="text-xs text-slate-500">{opt.description}</div>
                        </div>
                        {stack === opt.id && <span className="ml-auto text-brand-400 text-xs">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Image upload */}
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors border border-white/10 hover:border-white/20"
              >
                <ImagePlus size={13} />
                <span>Wireframe</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImage} />

              {/* Examples */}
              <button
                onClick={() => setShowExamples(!showExamples)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors border border-white/10 hover:border-white/20"
              >
                <Sparkles size={13} />
                <span>Examples</span>
              </button>

              {/* Advanced toggle */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-slate-500 hover:text-slate-400 transition-colors px-2 py-1"
              >
                {showAdvanced ? "− Advanced" : "+ Advanced"}
              </button>
            </div>

            {/* Generate button */}
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isGenerating}
              id="generate-btn"
              className="btn-primary text-sm px-5 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
            >
              {isGenerating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Forging...</span>
                </>
              ) : (
                <>
                  <Wand2 size={16} />
                  <span>{isEditMode ? "Forge Changes" : "Forge App"}</span>
                  <span className="text-xs opacity-60 ml-1">⌘↵</span>
                </>
              )}
            </button>
          </div>

          {/* Advanced options */}
          {showAdvanced && (
            <div className="mx-4 mb-3 pt-3 border-t border-white/5">
              <label className="block text-xs text-slate-500 mb-1.5">Additional instructions (optional)</label>
              <textarea
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="e.g. 'Use PostgreSQL, add internationalization, include unit tests, follow SOLID principles...'"
                rows={2}
                className="w-full bg-white/3 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-brand-500/40 resize-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Example prompts */}
      {showExamples && (
        <div className="glass rounded-xl p-4 space-y-2 animate-slide-up">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mb-3">✨ Try these prompts</p>
          {EXAMPLE_PROMPTS.map((ex, i) => (
            <button
              key={i}
              onClick={() => { setPrompt(ex); setShowExamples(false); }}
              className="w-full text-left text-sm text-slate-400 hover:text-slate-200 py-2 px-3 rounded-lg hover:bg-white/5 transition-all duration-150 border border-transparent hover:border-white/10"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Hint */}
      <p className="text-center text-xs text-slate-600">
        Powered by{" "}
        <span className="text-brand-400 font-medium">AWS Amazon Nova Pro</span>
        {" "}+{" "}
        <span className="text-nova-400 font-medium">Nova Lite</span>
        {" "}· Press ⌘↵ to generate
      </p>
    </div>
  );
}
