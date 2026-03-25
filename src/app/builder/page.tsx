"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  htmlContent?: string;
  timestamp: Date;
};

type DeviceMode = "desktop" | "tablet" | "mobile";
type ViewMode = "preview" | "code";

type SavedProject = {
  id: string;
  name: string;
  shareId: string;
  createdAt: string;
  updatedAt: string;
};

const STARTER_PROMPTS = [
  "A SaaS landing page with dark theme, hero section, features grid, and pricing",
  "A personal portfolio for a designer with project gallery and contact form",
  "A restaurant website with menu, reservations, and photo gallery",
  "A blog homepage with featured posts, categories, and newsletter signup",
];

const FUNNY_PHRASES = [
  "Summoning pixels from the digital void...",
  "Teaching Claude the secrets of good design...",
  "Bribing the CSS gods with semicolons...",
  "Asking the color wheel for its blessing...",
  "Converting your vibe into pure HTML...",
  "Making it look like you hired a designer...",
  "Adding gradients nobody asked for (you'll love them)...",
  "Debating serif vs sans-serif at 3am...",
  "Calculating the perfect border-radius...",
  "Manifesting your dream website into existence...",
  "Definitely not copying Dribbble shots...",
  "Running 47 A/B tests simultaneously...",
  "Whispering sweet nothings to the layout engine...",
  "Negotiating with flexbox (it's complicated)...",
  "Making buttons look clickable since 2026...",
  "Consulting the ancient CSS specification...",
];

const DEVICE_SIZES: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

export default function BuilderPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const [projectName, setProjectName] = useState("Untitled site");
  const [editingName, setEditingName] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentShareId, setCurrentShareId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<(SavedProject & { html?: string }) | null>(null);
  const [modalView, setModalView] = useState<"preview" | "code">("preview");
  const [toast, setToast] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  // Cycle funny phrases while generating
  useEffect(() => {
    if (!isGenerating) return;
    const cycle = setInterval(() => {
      setPhraseVisible(false);
      setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % FUNNY_PHRASES.length);
        setPhraseVisible(true);
      }, 400);
    }, 3000);
    return () => clearInterval(cycle);
  }, [isGenerating]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json() as SavedProject[];
    setSavedProjects(data);
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setIsGenerating(true);
    setPhraseIndex(Math.floor(Math.random() * FUNNY_PHRASES.length));
    setPhraseVisible(true);
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.htmlContent ?? m.content,
          })),
        }),
      });

      if (!res.ok || !res.body) {
        const errBody = await res.text();
        throw new Error(`Generation failed (${res.status}): ${errBody}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const HTML_MARKER = "%%SURCODIA_HTML%%";
      let raw = "";
      let isBuildMode: boolean | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        raw += decoder.decode(value, { stream: true });

        // Detect mode once we have enough data
        if (isBuildMode === null && raw.length >= HTML_MARKER.length) {
          isBuildMode = raw.includes(HTML_MARKER);
        }

        // Stream HTML into preview as it arrives
        if (isBuildMode) {
          const html = raw.replace(HTML_MARKER, "").trimStart();
          if (html) setGeneratedHtml(html);
        }
      }

      const isHtml = isBuildMode === true;
      const html = isHtml ? raw.replace(HTML_MARKER, "").trimStart() : "";
      const chatText = isHtml
        ? "Done! Your site is live in the preview. Ask me to tweak anything — layout, colors, content, new sections."
        : raw;

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: chatText,
        htmlContent: isHtml ? html : undefined,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (isHtml) {
        const saveRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: projectName, html, id: currentProjectId ?? undefined }),
        });
        const saved = await saveRes.json() as SavedProject;
        setCurrentProjectId(saved.id);
        setCurrentShareId(saved.shareId);
        void loadProjects();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  function handleStarterPrompt(prompt: string) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  function copyShareLink() {
    if (!currentShareId) return;
    const url = `${window.location.origin}/api/share/${currentShareId}`;
    void navigator.clipboard.writeText(url);
    showToast("Share link copied to clipboard!");
  }

  function loadProjectIntoBuilder(project: SavedProject & { html?: string }) {
    if (!project.html) return;
    setGeneratedHtml(project.html);
    setProjectName(project.name);
    setCurrentProjectId(project.id);
    setCurrentShareId(project.shareId);
    setMessages([]);
    setShowSidebar(false);
    showToast(`Loaded "${project.name}"`);
  }

  async function openProjectModal(project: SavedProject) {
    const res = await fetch(`/api/share/${project.shareId}`);
    const html = await res.text();
    setSelectedProject({ ...project, html });
    setModalView("preview");
  }

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      setCurrentShareId(null);
    }
    void loadProjects();
    showToast("Project deleted");
  }

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f] text-white overflow-hidden">

      {/* Toast */}
      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium backdrop-blur-xl shadow-2xl">
          {toast}
        </div>
      )}

      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0a0f] px-4 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-white/40 transition-colors hover:text-white">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L7 4L11 8L7 12L3 8Z" fill="white" fillOpacity="0.9"/>
              </svg>
            </div>
            {editingName ? (
              <input
                ref={nameInputRef}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                className="rounded bg-white/10 px-2 py-0.5 text-sm font-medium outline-none ring-1 ring-violet-500/50"
              />
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="text-sm font-medium text-white/80 transition-colors hover:text-white"
              >
                {projectName}
              </button>
            )}
          </div>

          {/* Projects chevron */}
          <button
            onClick={() => setShowSidebar((s) => !s)}
            className={`ml-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
              showSidebar
                ? "border-violet-500/40 bg-violet-500/10 text-violet-300"
                : "border-white/5 bg-white/5 text-white/40 hover:border-white/10 hover:text-white/70"
            }`}
          >
            <svg
              width="12" height="12" viewBox="0 0 12 12" fill="none"
              className={`transition-transform duration-300 ${showSidebar ? "rotate-180" : ""}`}
            >
              <path d="M2 4.5L6 7.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Projects
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Device toggles */}
          <div className="flex items-center rounded-lg border border-white/5 bg-white/5 p-1">
            {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setDeviceMode(mode)}
                title={mode}
                className={`rounded-md px-2.5 py-1 text-xs transition-all ${
                  deviceMode === mode ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                }`}
              >
                {mode === "desktop" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
                {mode === "tablet" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>}
                {mode === "mobile" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>}
              </button>
            ))}
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-white/5 bg-white/5 p-1">
            {(["preview", "code"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
                  viewMode === mode ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10" />

          {currentShareId && (
            <button
              onClick={copyShareLink}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
              </svg>
              Share
            </button>
          )}

          <button className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/25">
            Deploy →
          </button>

          <div className="h-4 w-px bg-white/10" />

          {/* User menu */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white">
              {session?.user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={session.user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                session?.user?.name?.[0]?.toUpperCase() ?? "?"
              )}
            </div>
            <button
              onClick={() => void signOut({ callbackUrl: "/" })}
              className="text-xs text-white/30 transition-colors hover:text-white/70"
              title="Sign out"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Projects Sidebar */}
        {showSidebar && (
          <>
            <div
              className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowSidebar(false)}
            />
            <div className="animate-slide-left absolute left-0 top-0 z-30 flex h-full w-72 flex-col border-r border-white/10 bg-[#0d0d16] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <span className="text-sm font-semibold">Saved projects</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/40">{savedProjects.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {savedProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 text-3xl opacity-30">◎</div>
                    <p className="text-xs text-white/30">No saved projects yet.<br/>Generate a site to get started.</p>
                  </div>
                ) : (
                  savedProjects.map((p) => (
                    <div
                      key={p.id}
                      className={`group relative cursor-pointer rounded-xl border p-3 transition-all hover:border-white/10 hover:bg-white/[0.06] ${
                        currentProjectId === p.id
                          ? "border-violet-500/40 bg-violet-500/10"
                          : "border-white/5 bg-white/[0.03]"
                      }`}
                      onClick={() => void openProjectModal(p)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white/80">{p.name}</p>
                          <p className="mt-0.5 text-[10px] text-white/30">
                            {new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => void deleteProject(p.id, e)}
                          className="opacity-0 group-hover:opacity-100 rounded-md p-1 text-white/30 transition-all hover:bg-red-500/20 hover:text-red-400"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6l-1 14H6L5 6M10 11v6M14 11v6M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}

        {/* Left: Chat panel */}
        <div className="flex w-[380px] shrink-0 flex-col border-r border-white/5">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center animate-fade-in">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.1 4.5 2.9 6L5 21l4.4-1.5C10.5 19.8 11.2 20 12 20c5 0 9-3.6 9-9s-4-8-9-8Z" fill="white" fillOpacity="0.9"/>
                  </svg>
                </div>
                <h2 className="mb-1 text-base font-semibold">What would you like to build?</h2>
                <p className="mb-6 text-sm text-white/40">Describe your website and I&apos;ll generate it instantly.</p>
                <div className="w-full space-y-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleStarterPrompt(prompt)}
                      className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left text-xs text-white/50 transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-white/80"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 animate-slide-up ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    style={{ animationDelay: `${i === messages.length - 1 ? 0 : 0}ms` }}
                  >
                    {msg.role === "assistant" && (
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.1 4.5 2.9 6L5 21l4.4-1.5C10.5 19.8 11.2 20 12 20c5 0 9-3.6 9-9s-4-8-9-8Z" fill="white" fillOpacity="0.9"/>
                        </svg>
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-br-sm bg-violet-600/80 text-white"
                        : "rounded-bl-sm bg-white/5 text-white/80"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}

                {isGenerating && (
                  <div className="flex gap-3 animate-slide-up">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.1 4.5 2.9 6L5 21l4.4-1.5C10.5 19.8 11.2 20 12 20c5 0 9-3.6 9-9s-4-8-9-8Z" fill="white" fillOpacity="0.9"/>
                      </svg>
                    </div>
                    <div className="rounded-2xl rounded-bl-sm bg-white/5 px-4 py-3 max-w-[80%]">
                      <div className="flex items-center gap-1.5 mb-2">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse-dot"
                            style={{ animationDelay: `${i * 0.2}s` }}
                          />
                        ))}
                      </div>
                      <div
                        key={phraseIndex}
                        className={`text-xs text-white/50 transition-opacity duration-400 ${phraseVisible ? "opacity-100" : "opacity-0"}`}
                      >
                        <span className="animate-shimmer font-medium">
                          {FUNNY_PHRASES[phraseIndex]}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-white/5 p-4">
            <div className="relative rounded-2xl border border-white/10 bg-white/5 transition-all focus-within:border-violet-500/50 focus-within:bg-white/[0.07]">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); autoResize(); }}
                onKeyDown={handleKeyDown}
                placeholder={isGenerating ? "Generating..." : "Describe your website or ask for changes..."}
                disabled={isGenerating}
                rows={1}
                className="w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm text-white placeholder-white/30 outline-none disabled:opacity-40"
                style={{ maxHeight: "180px" }}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isGenerating}
                className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-white/20">
              Shift + Enter for new line · Enter to send
            </p>
          </div>
        </div>

        {/* Right: Preview panel */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#0d0d14]">
          {generatedHtml ? (
            <>
              <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 px-4">
                <div className="flex items-center gap-2 text-xs text-white/30">
                  <span className={`h-1.5 w-1.5 rounded-full ${isGenerating ? "animate-pulse bg-yellow-400" : "bg-green-400"}`} />
                  {isGenerating ? "Updating..." : "Live preview"}
                </div>
                {deviceMode !== "desktop" && (
                  <span className="text-xs text-white/30">{DEVICE_SIZES[deviceMode]}</span>
                )}
              </div>
              <div className="flex flex-1 items-start justify-center overflow-auto p-6">
                {viewMode === "preview" ? (
                  <div
                    className="h-full overflow-hidden rounded-xl border border-white/10 bg-white shadow-2xl shadow-black/50 transition-all duration-300"
                    style={{ width: DEVICE_SIZES[deviceMode], minHeight: "100%" }}
                  >
                    <iframe
                      srcDoc={generatedHtml}
                      className="h-full w-full"
                      style={{ minHeight: "600px" }}
                      title="Preview"
                      sandbox="allow-scripts"
                    />
                  </div>
                ) : (
                  <div className="h-full w-full overflow-auto rounded-xl border border-white/5 bg-[#0a0a0f]">
                    <pre className="p-6 text-xs leading-relaxed text-green-400/80 font-mono whitespace-pre-wrap">
                      {generatedHtml}
                    </pre>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/5 blur-[100px]" />
              </div>
              <div
                className="relative rounded-2xl border border-white/5 p-12 animate-fade-in"
                style={{
                  backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
                  backgroundSize: "40px 40px",
                }}
              >
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.4">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9"/>
                  </svg>
                </div>
                <h3 className="mb-2 text-base font-semibold text-white/60">Your site will appear here</h3>
                <p className="text-sm text-white/30">Type a prompt on the left to get started</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Project Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={() => setSelectedProject(null)}
          />
          <div className="animate-slide-up relative flex h-[85vh] w-full max-w-5xl flex-col rounded-2xl border border-white/10 bg-[#0d0d16] shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <h2 className="font-semibold text-white">{selectedProject.name}</h2>
                <p className="text-xs text-white/30 mt-0.5">
                  Last updated {new Date(selectedProject.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* View tabs */}
                <div className="flex rounded-lg border border-white/5 bg-white/5 p-1">
                  {(["preview", "code"] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setModalView(v)}
                      className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
                        modalView === v ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/api/share/${selectedProject.shareId}`;
                    void navigator.clipboard.writeText(url);
                    showToast("Share link copied!");
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                  Copy share link
                </button>
                <button
                  onClick={() => { loadProjectIntoBuilder(selectedProject); setSelectedProject(null); }}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-violet-500"
                >
                  Open in builder
                </button>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-white/40 transition-all hover:text-white"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal content */}
            <div className="flex-1 overflow-hidden">
              {modalView === "preview" ? (
                <iframe
                  srcDoc={selectedProject.html}
                  className="h-full w-full bg-white"
                  title={selectedProject.name}
                  sandbox="allow-scripts"
                />
              ) : (
                <div className="h-full overflow-auto bg-[#0a0a0f]">
                  <pre className="p-6 text-xs leading-relaxed text-green-400/80 font-mono whitespace-pre-wrap">
                    {selectedProject.html}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
