"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

// ─── Types ────────────────────────────────────────────────────────────────────

type SerializedMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  htmlContent?: string;
};

type Message = SerializedMessage & { timestamp: Date };

type DeviceMode = "desktop" | "tablet" | "mobile";
type PanelMode = "preview" | "editor";

type FSFile = { type: "file"; path: string; content: string };
type FSFolder = { type: "folder"; path: string; open: boolean };
type FSEntry = FSFile | FSFolder;

type SavedProject = {
  id: string;
  name: string;
  shareId: string;
  createdAt: string;
  updatedAt: string;
  files?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STARTER_PROMPTS = [
  "A SaaS landing page with dark theme, hero section, features grid, and pricing",
  "A personal portfolio for a designer with project gallery and contact form",
  "A restaurant website with menu, reservations, and photo gallery",
  "A blog homepage with featured posts, categories, and newsletter signup",
];

const FUNNY_PHRASES = [
  "Summoning pixels from the digital void...",
  "Teaching the AI secrets of good design...",
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
];

const DEVICE_SIZES: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
};

// ─── File helpers ─────────────────────────────────────────────────────────────

function getFileContent(html: string, fileName: string): string {
  if (fileName === "index.html") return html;
  if (fileName === "styles.css") {
    const m = /<style[^>]*>([\s\S]*?)<\/style>/i.exec(html);
    return m?.[1]?.trim() ?? "";
  }
  if (fileName === "app.js") {
    const scripts: string[] = [];
    const re = /<script(?![^>]*\bsrc\b)[^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      if (m[1]?.trim()) scripts.push(m[1].trim());
    }
    return scripts.join("\n\n");
  }
  return "";
}

function applyFileContent(html: string, fileName: string, content: string): string {
  if (fileName === "index.html") return content;
  if (fileName === "styles.css") {
    if (/<style[^>]*>/i.test(html))
      return html.replace(/<style[^>]*>[\s\S]*?<\/style>/i, `<style>\n${content}\n</style>`);
    return html.replace("</head>", `<style>\n${content}\n</style>\n</head>`);
  }
  if (fileName === "app.js") {
    const hasInline = /<script(?![^>]*\bsrc\b)[^>]*>[\s\S]*?<\/script>/i.test(html);
    if (hasInline) {
      let first = true;
      return html.replace(/<script(?![^>]*\bsrc\b)[^>]*>[\s\S]*?<\/script>/gi, (m) => {
        if (first) { first = false; return `<script>\n${content}\n</script>`; }
        return "";
      });
    }
    return html.replace("</body>", `<script>\n${content}\n</script>\n</body>`);
  }
  return html;
}

function getBaseFiles(html: string) {
  if (!html) return [];
  const files: { path: string; language: "html" | "css" | "javascript" }[] = [
    { path: "index.html", language: "html" },
  ];
  if (getFileContent(html, "styles.css").length > 0)
    files.push({ path: "styles.css", language: "css" });
  if (getFileContent(html, "app.js").length > 0)
    files.push({ path: "app.js", language: "javascript" });
  return files;
}

function getPathLanguage(path: string): "html" | "css" | "javascript" {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "ts") return "javascript";
  return "html";
}

function getPathIcon(path: string): "html" | "css" | "js" {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "css") return "css";
  if (ext === "js" || ext === "ts") return "js";
  return "html";
}

function getDefaultContent(path: string): string {
  const name = path.split("/").pop() ?? path;
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "html")
    return `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <title>${name}</title>\n</head>\n<body>\n\n</body>\n</html>`;
  if (ext === "css") return `/* ${name} */\n`;
  return `// ${name}\n`;
}

const BASE_PATHS = ["index.html", "styles.css", "app.js"];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BuilderPage() {
  const { data: session } = useSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedHtml, setGeneratedHtml] = useState("");
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop");
  const [panelMode, setPanelMode] = useState<PanelMode>("preview");
  const [projectName, setProjectName] = useState("Untitled site");
  const [editingName, setEditingName] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentShareId, setCurrentShareId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<(SavedProject & { html?: string; messages?: string }) | null>(null);
  const [modalView, setModalView] = useState<"preview" | "code">("preview");
  const [toast, setToast] = useState<string | null>(null);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);

  // Editor
  const [selectedFile, setSelectedFile] = useState<string>("index.html");
  const [editorContent, setEditorContent] = useState<string>("");
  const [cursorInfo, setCursorInfo] = useState("Ln 1, Col 1");

  // File system
  const [fileSystem, setFileSystem] = useState<FSEntry[]>([]);
  const [previewPage, setPreviewPage] = useState<string>("index.html");
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [addingType, setAddingType] = useState<"file" | "folder">("file");
  const [addingName, setAddingName] = useState("");
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const draggedPathRef = useRef<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ─── Derived ─────────────────────────────────────────────────────────────────

  const baseFiles = useMemo(() => getBaseFiles(generatedHtml), [generatedHtml]);

  const htmlPages = useMemo(() => {
    const pages = ["index.html"];
    for (const e of fileSystem)
      if (e.type === "file" && e.path.endsWith(".html")) pages.push(e.path);
    return pages;
  }, [fileSystem]);

  const previewHtml = useMemo(() => {
    if (previewPage === "index.html") return generatedHtml;
    const e = fileSystem.find((x) => x.type === "file" && x.path === previewPage);
    return e?.type === "file" ? e.content : "";
  }, [previewPage, generatedHtml, fileSystem]);

  // ─── Effects ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (BASE_PATHS.includes(selectedFile)) {
      setEditorContent(getFileContent(generatedHtml, selectedFile));
    } else {
      const e = fileSystem.find((x) => x.type === "file" && x.path === selectedFile);
      setEditorContent(e?.type === "file" ? e.content : "");
    }
  }, [selectedFile, generatedHtml, fileSystem]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

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

  useEffect(() => { void loadProjects(); }, [loadProjects]);

  // ─── File system ops ──────────────────────────────────────────────────────────

  function pathExists(path: string, fs?: FSEntry[]): boolean {
    const entries = fs ?? fileSystem;
    return BASE_PATHS.includes(path) || entries.some((e) => e.path === path);
  }

  function fsAddEntry(parentPath: string, name: string, type: "file" | "folder") {
    const safeName = type === "file" && !name.includes(".") ? `${name}.html` : name;
    const fullPath = parentPath ? `${parentPath}/${safeName}` : safeName;
    if (pathExists(fullPath)) { showToast(`"${safeName}" already exists`); return; }
    const entry: FSEntry =
      type === "folder"
        ? { type: "folder", path: fullPath, open: true }
        : { type: "file", path: fullPath, content: getDefaultContent(fullPath) };
    const newFs = [...fileSystem, entry];
    setFileSystem(newFs);
    if (type === "file") setSelectedFile(fullPath);
    void saveProjectFiles(newFs);
  }

  function fsDeleteEntry(path: string) {
    const newFs = fileSystem.filter((e) => e.path !== path && !e.path.startsWith(path + "/"));
    setFileSystem(newFs);
    if (selectedFile === path || selectedFile.startsWith(path + "/")) setSelectedFile("index.html");
    void saveProjectFiles(newFs);
  }

  function fsToggleFolder(path: string) {
    setFileSystem((prev) =>
      prev.map((e) => (e.type === "folder" && e.path === path ? { ...e, open: !e.open } : e))
    );
  }

  function fsMoveEntry(fromPath: string, toFolder: string) {
    const name = fromPath.split("/").pop()!;
    const newPath = toFolder ? `${toFolder}/${name}` : name;
    if (newPath === fromPath) return;
    if (pathExists(newPath)) { showToast(`"${name}" already exists there`); return; }
    const newFs = fileSystem.map((e) => {
      if (e.path === fromPath) return { ...e, path: newPath };
      if (e.path.startsWith(fromPath + "/"))
        return { ...e, path: newPath + e.path.slice(fromPath.length) };
      return e;
    });
    setFileSystem(newFs);
    if (selectedFile === fromPath) setSelectedFile(newPath);
    void saveProjectFiles(newFs);
  }

  async function saveProjectFiles(fs: FSEntry[]) {
    if (!currentProjectId || !generatedHtml) return;
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: currentProjectId,
        name: projectName,
        html: generatedHtml,
        files: JSON.stringify(fs),
      }),
    });
  }

  async function saveCurrentProject() {
    if (!currentProjectId || !generatedHtml) { showToast("Generate a site first!"); return; }
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: currentProjectId,
        name: projectName,
        html: generatedHtml,
        files: JSON.stringify(fileSystem),
      }),
    });
    showToast("Saved!");
  }

  // ─── Editor ───────────────────────────────────────────────────────────────────

  function handleEditorChange(value: string | undefined) {
    if (value === undefined) return;
    setEditorContent(value);
    if (BASE_PATHS.includes(selectedFile)) {
      setGeneratedHtml(applyFileContent(generatedHtml, selectedFile, value));
    } else {
      setFileSystem((prev) =>
        prev.map((e) => (e.type === "file" && e.path === selectedFile ? { ...e, content: value } : e))
      );
    }
  }

  // ─── AI generation ───────────────────────────────────────────────────────────

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
          messages: nextMessages.map((m) => ({ role: m.role, content: m.htmlContent ?? m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Generation failed (${res.status}): ${await res.text()}`);
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
        if (isBuildMode === null && raw.length >= HTML_MARKER.length)
          isBuildMode = raw.includes(HTML_MARKER);
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

      const finalMessages = [...nextMessages, assistantMsg];
      setMessages(finalMessages);

      if (isHtml) {
        const serialized: SerializedMessage[] = finalMessages.map((m) => ({
          id: m.id, role: m.role, content: m.content, htmlContent: m.htmlContent,
        }));

        const saveRes = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: projectName,
            html,
            messages: JSON.stringify({ messages: serialized }),
            files: JSON.stringify(fileSystem),
            id: currentProjectId ?? undefined,
          }),
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void handleSend(); }
  }

  function handleStarterPrompt(prompt: string) {
    setInput(prompt);
    textareaRef.current?.focus();
  }

  function copyShareLink(shareId?: string) {
    const id = shareId ?? currentShareId;
    if (!id) return;
    void navigator.clipboard.writeText(`${window.location.origin}/api/share/${id}`);
    showToast("Share link copied to clipboard!");
  }

  async function openProjectDirect(project: SavedProject) {
    const res = await fetch(`/api/projects/${project.id}`);
    const full = await res.json() as SavedProject & { html: string; messages?: string; files?: string };
    loadProjectIntoBuilder(full);
  }

  async function openProjectModal(project: SavedProject) {
    const res = await fetch(`/api/projects/${project.id}`);
    const full = await res.json() as SavedProject & { html: string; messages?: string };
    setSelectedProject(full);
    setModalView("preview");
  }

  function loadProjectIntoBuilder(project: SavedProject & { html?: string; messages?: string; files?: string }) {
    if (!project.html) return;
    setGeneratedHtml(project.html);
    setProjectName(project.name);
    setCurrentProjectId(project.id);
    setCurrentShareId(project.shareId);
    setSelectedFile("index.html");

    // Messages (backwards-compat)
    if (project.messages) {
      try {
        const raw = JSON.parse(project.messages) as
          | SerializedMessage[]
          | { messages: SerializedMessage[]; extraFiles?: Record<string, string> };
        if (Array.isArray(raw)) {
          setMessages(raw.map((m) => ({ ...m, timestamp: new Date() })));
        } else {
          setMessages(raw.messages.map((m) => ({ ...m, timestamp: new Date() })));
        }
      } catch { setMessages([]); }
    } else { setMessages([]); }

    // File system — prefer dedicated `files` field, fall back to legacy extraFiles in messages
    if (project.files) {
      try { setFileSystem(JSON.parse(project.files) as FSEntry[]); } catch { setFileSystem([]); }
    } else {
      // Migrate legacy extraFiles
      try {
        const raw = project.messages ? JSON.parse(project.messages) as { extraFiles?: Record<string, string> } : null;
        if (raw && !Array.isArray(raw) && raw.extraFiles) {
          setFileSystem(
            Object.entries(raw.extraFiles).map(([path, content]) => ({ type: "file", path, content }))
          );
        } else { setFileSystem([]); }
      } catch { setFileSystem([]); }
    }

    setPreviewPage("index.html");
    setShowSidebar(false);
    setSelectedProject(null);
    showToast(`Loaded "${project.name}"`);
  }

  async function deleteProject(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch("/api/projects", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (currentProjectId === id) { setCurrentProjectId(null); setCurrentShareId(null); }
    void loadProjects();
    showToast("Project deleted");
  }

  // ─── Sub-components ───────────────────────────────────────────────────────────

  function FileIcon({ path }: { path: string }) {
    const icon = getPathIcon(path);
    if (icon === "html") return <span className="shrink-0 text-[10px] font-bold text-orange-400">H</span>;
    if (icon === "css") return <span className="shrink-0 text-[10px] font-bold text-blue-400">C</span>;
    return <span className="shrink-0 text-[10px] font-bold text-yellow-400">J</span>;
  }

  function AddInput({ depth, inPath }: { depth: number; inPath: string }) {
    return (
      <div
        className="mt-0.5 flex items-center gap-1.5 rounded-md bg-white/5 px-2 py-1 ring-1 ring-violet-500/30"
        style={{ marginLeft: `${8 + depth * 16}px` }}
      >
        {addingType === "folder" ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-yellow-400/70">
            <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-white/30">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        )}
        <input
          autoFocus
          value={addingName}
          onChange={(e) => setAddingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const n = addingName.trim();
              if (n) fsAddEntry(inPath, n, addingType);
              setAddingIn(null);
              setAddingName("");
            }
            if (e.key === "Escape") { setAddingIn(null); setAddingName(""); }
          }}
          onBlur={() => { if (!addingName.trim()) { setAddingIn(null); setAddingName(""); } }}
          placeholder={addingType === "folder" ? "folder-name" : "filename.html"}
          className="w-full bg-transparent text-xs text-white/70 outline-none placeholder-white/20"
        />
      </div>
    );
  }

  function renderTree(parentPath: string, depth: number): React.ReactNode {
    const prefix = parentPath ? parentPath + "/" : "";
    const children = fileSystem
      .filter((e) => {
        if (!e.path.startsWith(prefix)) return false;
        const rest = e.path.slice(prefix.length);
        return rest.length > 0 && !rest.includes("/");
      })
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.path.localeCompare(b.path);
      });

    return (
      <>
        {children.map((entry) => {
          const name = entry.path.split("/").pop()!;
          const indent = 8 + depth * 16;

          if (entry.type === "folder") {
            return (
              <div key={entry.path}>
                <div
                  draggable
                  onDragStart={(e) => { e.stopPropagation(); draggedPathRef.current = entry.path; }}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverPath(entry.path); }}
                  onDragLeave={(e) => { e.stopPropagation(); setDragOverPath(null); }}
                  onDrop={(e) => {
                    e.preventDefault(); e.stopPropagation(); setDragOverPath(null);
                    if (draggedPathRef.current && draggedPathRef.current !== entry.path)
                      fsMoveEntry(draggedPathRef.current, entry.path);
                    draggedPathRef.current = null;
                  }}
                  onClick={() => fsToggleFolder(entry.path)}
                  className={`group flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-white/50 transition-all hover:bg-white/5 hover:text-white/80 ${dragOverPath === entry.path ? "bg-violet-500/20 text-white ring-1 ring-violet-500/40" : ""}`}
                  style={{ paddingLeft: `${indent}px` }}
                >
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`shrink-0 transition-transform duration-150 ${entry.open ? "rotate-90" : ""}`}>
                    <path d="M2 1l4 3-4 3V1z"/>
                  </svg>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-yellow-400/70">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                  </svg>
                  <span className="flex-1 truncate text-xs">{name}</span>
                  <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddingIn(entry.path); setAddingType("file"); setAddingName(""); }}
                      title="New file" className="rounded p-0.5 hover:bg-white/10 hover:text-white"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                        <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAddingIn(entry.path); setAddingType("folder"); setAddingName(""); }}
                      title="New folder" className="rounded p-0.5 hover:bg-white/10 hover:text-white"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                        <line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); fsDeleteEntry(entry.path); }}
                      title="Delete" className="rounded p-0.5 hover:bg-red-500/20 hover:text-red-400"
                    >
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6l-1 14H6L5 6"/>
                      </svg>
                    </button>
                  </div>
                </div>
                {entry.open && (
                  <>
                    {renderTree(entry.path, depth + 1)}
                    {addingIn === entry.path && <AddInput depth={depth + 1} inPath={entry.path} />}
                  </>
                )}
              </div>
            );
          }

          return (
            <div
              key={entry.path}
              draggable
              onDragStart={(e) => { e.stopPropagation(); draggedPathRef.current = entry.path; }}
              onClick={() => setSelectedFile(entry.path)}
              className={`group flex cursor-pointer items-center gap-2 rounded-md py-1.5 pr-2 transition-all ${selectedFile === entry.path ? "bg-violet-500/20 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"}`}
              style={{ paddingLeft: `${indent + 12}px` }}
            >
              <FileIcon path={entry.path} />
              <span className="flex-1 truncate text-xs">{name}</span>
              <button
                onClick={(e) => { e.stopPropagation(); fsDeleteEntry(entry.path); }}
                className="rounded p-0.5 text-white/20 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                title="Delete"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          );
        })}
        {addingIn === parentPath && <AddInput depth={depth} inPath={parentPath} />}
      </>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-[#0a0a0f] text-white"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        if (draggedPathRef.current) {
          fsMoveEntry(draggedPathRef.current, "");
          draggedPathRef.current = null;
          setDragOverPath(null);
        }
      }}
    >

      {/* Toast */}
      {toast && (
        <div className="animate-slide-up fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-medium shadow-2xl backdrop-blur-xl">
          {toast}
        </div>
      )}

      {/* Top bar */}
      <header className="z-40 flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-[#0a0a0f] px-4">
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
              <button onClick={() => setEditingName(true)} className="text-sm font-medium text-white/80 transition-colors hover:text-white">
                {projectName}
              </button>
            )}
          </div>
          <button
            onClick={() => setShowSidebar((s) => !s)}
            className={`ml-2 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
              showSidebar ? "border-violet-500/40 bg-violet-500/10 text-violet-300" : "border-white/5 bg-white/5 text-white/40 hover:border-white/10 hover:text-white/70"
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={`transition-transform duration-300 ${showSidebar ? "rotate-180" : ""}`}>
              <path d="M2 4.5L6 7.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Projects
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Device toggles — fade on preview/editor switch */}
          <div className={`overflow-hidden transition-all duration-200 ${panelMode === "preview" ? "max-w-[160px] opacity-100" : "pointer-events-none max-w-0 opacity-0"}`}>
            <div className="flex items-center rounded-lg border border-white/5 bg-white/5 p-1">
              {(["desktop", "tablet", "mobile"] as DeviceMode[]).map((mode) => (
                <button key={mode} onClick={() => setDeviceMode(mode)} title={mode}
                  className={`rounded-md px-2.5 py-1 transition-all ${deviceMode === mode ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
                  {mode === "desktop" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>}
                  {mode === "tablet" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>}
                  {mode === "mobile" && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>}
                </button>
              ))}
            </div>
          </div>

          {/* Panel mode toggle */}
          <div className="flex items-center rounded-lg border border-white/5 bg-white/5 p-1">
            {([["preview", "Preview"], ["editor", "Editor"]] as [PanelMode, string][]).map(([mode, label]) => (
              <button key={mode} onClick={() => setPanelMode(mode)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${panelMode === mode ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-white/10" />

          {/* Deploy */}
          <button
            onClick={() => currentShareId ? copyShareLink() : showToast("Generate a site first!")}
            className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/25"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
            </svg>
            Deploy
          </button>

          <div className="h-4 w-px bg-white/10" />

          {/* User */}
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-semibold text-white">
              {session?.user?.image
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={session.user.image} alt="" className="h-full w-full object-cover" />
                : session?.user?.name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <button onClick={() => void signOut({ callbackUrl: "/" })} title="Sign out"
              className="text-white/30 transition-colors hover:text-white/70">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="relative flex flex-1 overflow-hidden">

        {/* Projects sidebar */}
        {showSidebar && (
          <>
            <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-sm" onClick={() => setShowSidebar(false)} />
            <div className="animate-slide-left absolute left-0 top-0 z-30 flex h-full w-72 flex-col border-r border-white/10 bg-[#0d0d16] shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                <span className="text-sm font-semibold">Saved projects</span>
                <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-white/40">{savedProjects.length}</span>
              </div>
              <div className="px-3 pt-3 pb-2">
                <button
                  onClick={() => {
                    setMessages([]); setGeneratedHtml(""); setProjectName("Untitled site");
                    setCurrentProjectId(null); setCurrentShareId(null);
                    setFileSystem([]); setPreviewPage("index.html");
                    setShowSidebar(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-3 py-2.5 text-xs text-white/40 transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-violet-300"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  New project
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 px-3 pb-3">
                {savedProjects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-3 text-3xl opacity-30">◎</div>
                    <p className="text-xs text-white/30">No saved projects yet.</p>
                  </div>
                ) : (
                  savedProjects.map((p) => (
                    <div key={p.id}
                      className={`group relative cursor-pointer rounded-xl border p-3 transition-all hover:border-white/10 hover:bg-white/[0.06] ${currentProjectId === p.id ? "border-violet-500/40 bg-violet-500/10" : "border-white/5 bg-white/[0.03]"}`}
                      onClick={() => void openProjectDirect(p)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white/80">{p.name}</p>
                          <p className="mt-0.5 text-[10px] text-white/30">
                            {new Date(p.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <button onClick={(e) => void deleteProject(p.id, e)}
                          className="rounded-md p-1 text-white/30 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400">
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

        {/* Chat panel */}
        <div className="flex w-[380px] shrink-0 flex-col border-r border-white/5">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="animate-fade-in flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.1 4.5 2.9 6L5 21l4.4-1.5C10.5 19.8 11.2 20 12 20c5 0 9-3.6 9-9s-4-8-9-8Z" fill="white" fillOpacity="0.9"/>
                  </svg>
                </div>
                <h2 className="mb-1 text-base font-semibold">What would you like to build?</h2>
                <p className="mb-6 text-sm text-white/40">Describe your website and I&apos;ll generate it instantly.</p>
                <div className="w-full space-y-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button key={prompt} onClick={() => handleStarterPrompt(prompt)}
                      className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3 text-left text-xs text-white/50 transition-all hover:border-violet-500/30 hover:bg-violet-500/5 hover:text-white/80">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div key={msg.id} className={`animate-slide-up flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.1 4.5 2.9 6L5 21l4.4-1.5C10.5 19.8 11.2 20 12 20c5 0 9-3.6 9-9s-4-8-9-8Z" fill="white" fillOpacity="0.9"/>
                        </svg>
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user" ? "rounded-br-sm bg-violet-600/80 text-white" : "rounded-bl-sm bg-white/5 text-white/80"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isGenerating && (
                  <div className="animate-slide-up flex gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                        <path d="M12 3C7 3 3 6.6 3 11c0 2.4 1.1 4.5 2.9 6L5 21l4.4-1.5C10.5 19.8 11.2 20 12 20c5 0 9-3.6 9-9s-4-8-9-8Z" fill="white" fillOpacity="0.9"/>
                      </svg>
                    </div>
                    <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white/5 px-4 py-3">
                      <div className="mb-2 flex items-center gap-1.5">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-violet-400" style={{ animationDelay: `${i * 0.2}s` }} />
                        ))}
                      </div>
                      <div className={`text-xs text-white/50 transition-opacity duration-400 ${phraseVisible ? "opacity-100" : "opacity-0"}`}>
                        <span className="animate-shimmer font-medium">{FUNNY_PHRASES[phraseIndex]}</span>
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
              <button onClick={() => void handleSend()} disabled={!input.trim() || isGenerating}
                className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 transition-all hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-30">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <path d="M12 19V5M5 12l7-7 7 7"/>
                </svg>
              </button>
            </div>
            <p className="mt-2 text-center text-[10px] text-white/20">Shift + Enter for new line · Enter to send</p>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#0d0d14]">
          {generatedHtml ? (
            panelMode === "preview" ? (
              /* ── Preview ── */
              <>
                <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/5 px-4">
                  <div className="flex items-center gap-2 text-xs text-white/30">
                    <span className={`h-1.5 w-1.5 rounded-full ${isGenerating ? "animate-pulse bg-yellow-400" : "bg-green-400"}`} />
                    {isGenerating ? "Updating..." : "Live preview"}
                  </div>
                  {deviceMode !== "desktop" && <span className="text-xs text-white/30">{DEVICE_SIZES[deviceMode]}</span>}
                </div>
                <div className="flex flex-1 overflow-hidden">
                  <div className="flex flex-1 items-start justify-center overflow-auto p-6">
                    <div
                      className="h-full overflow-hidden rounded-xl border border-white/10 bg-white shadow-2xl shadow-black/50 transition-all duration-300"
                      style={{ width: DEVICE_SIZES[deviceMode], minHeight: "100%" }}
                    >
                      <iframe srcDoc={previewHtml} className="h-full w-full" style={{ minHeight: "600px" }} title="Preview" sandbox="allow-scripts" />
                    </div>
                  </div>

                  {/* Pages panel — only when multiple HTML pages */}
                  {htmlPages.length > 1 && (
                    <div className="flex w-44 shrink-0 flex-col border-l border-white/5 bg-[#0c0c14]">
                      <div className="flex items-center gap-2 border-b border-white/5 px-3 py-2.5">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                        </svg>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Pages</span>
                      </div>
                      <div className="flex-1 space-y-1 overflow-y-auto p-2">
                        {htmlPages.map((page) => (
                          <button
                            key={page}
                            onClick={() => setPreviewPage(page)}
                            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-all ${
                              previewPage === page ? "bg-violet-500/20 text-white" : "text-white/40 hover:bg-white/5 hover:text-white/70"
                            }`}
                          >
                            <span className="shrink-0 text-[10px] font-bold text-orange-400">H</span>
                            <span className="truncate text-xs">{page}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ── Editor ── */
              <div className="flex flex-1 overflow-hidden">
                {/* File explorer */}
                <div
                  className={`flex w-52 shrink-0 flex-col overflow-hidden border-r border-white/5 bg-[#0c0c14] ${dragOverPath === "__root__" ? "ring-1 ring-inset ring-violet-500/30" : ""}`}
                  onDragOver={(e) => { e.preventDefault(); if (!draggedPathRef.current) return; setDragOverPath("__root__"); }}
                  onDragLeave={() => setDragOverPath(null)}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOverPath(null);
                    if (draggedPathRef.current) { fsMoveEntry(draggedPathRef.current, ""); draggedPathRef.current = null; }
                  }}
                >
                  {/* Header */}
                  <div className="flex shrink-0 items-center justify-between border-b border-white/5 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                      </svg>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">Explorer</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setAddingIn(""); setAddingType("file"); setAddingName(""); }}
                        title="New file"
                        className="rounded-md p-1 text-white/30 transition-all hover:bg-white/10 hover:text-white/70"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                          <polyline points="14 2 14 8 20 8"/>
                          <line x1="12" y1="18" x2="12" y2="12"/>
                          <line x1="9" y1="15" x2="15" y2="15"/>
                        </svg>
                      </button>
                      <button
                        onClick={() => { setAddingIn(""); setAddingType("folder"); setAddingName(""); }}
                        title="New folder"
                        className="rounded-md p-1 text-white/30 transition-all hover:bg-white/10 hover:text-white/70"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                          <line x1="12" y1="11" x2="12" y2="17"/>
                          <line x1="9" y1="14" x2="15" y2="14"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Tree */}
                  <div className="flex-1 select-none overflow-y-auto py-2">
                    <div className="mb-1 flex items-center gap-1.5 px-3 py-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="shrink-0 text-yellow-400/70">
                        <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                      </svg>
                      <span className="truncate text-xs text-white/40">{projectName}</span>
                    </div>

                    <div className="ml-2 space-y-0.5 border-l border-white/5 pl-2">
                      {/* Base (AI-generated) files */}
                      {baseFiles.map((f) => (
                        <button key={f.path} onClick={() => setSelectedFile(f.path)}
                          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-all ${
                            selectedFile === f.path ? "bg-violet-500/20 text-white" : "text-white/50 hover:bg-white/5 hover:text-white/80"
                          }`}
                        >
                          <FileIcon path={f.path} />
                          <span className="truncate text-xs">{f.path}</span>
                        </button>
                      ))}

                      {/* User file system */}
                      {renderTree("", 0)}
                    </div>
                  </div>
                </div>

                {/* Monaco */}
                <div className="flex flex-1 flex-col overflow-hidden">
                  {/* Tab */}
                  <div className="flex h-9 shrink-0 items-center border-b border-white/5 bg-[#0c0c14]">
                    <div className={`flex h-full items-center gap-2 border-r border-white/5 px-4 text-xs ${selectedFile ? "bg-[#0d0d14] text-white/80" : "text-white/30"}`}>
                      <FileIcon path={selectedFile} />
                      <span>{selectedFile.split("/").pop()}</span>
                      <span className="ml-1 h-1.5 w-1.5 rounded-full bg-orange-400" title="Ctrl+S to save" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <MonacoEditor
                      height="100%"
                      language={getPathLanguage(selectedFile)}
                      theme="vs-dark"
                      value={editorContent}
                      onChange={handleEditorChange}
                      onMount={(editor, monaco) => {
                        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                          void saveCurrentProject();
                        });
                        editor.onDidChangeCursorPosition((e) => {
                          setCursorInfo(`Ln ${e.position.lineNumber}, Col ${e.position.column}`);
                        });
                      }}
                      options={{
                        fontSize: 13,
                        fontFamily: "var(--font-geist-sans), 'Cascadia Code', 'Fira Code', monospace",
                        minimap: { enabled: true },
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        lineNumbers: "on",
                        renderLineHighlight: "all",
                        bracketPairColorization: { enabled: true },
                        formatOnPaste: true,
                        tabSize: 2,
                        padding: { top: 12 },
                        scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
                      }}
                      loading={
                        <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
                          <div className="text-xs text-white/30">Loading editor...</div>
                        </div>
                      }
                    />
                  </div>

                  {/* Status bar */}
                  <div className="flex h-6 shrink-0 items-center justify-between border-t border-white/5 bg-violet-700/80 px-3">
                    <div className="flex items-center gap-3 text-[10px] text-white/70">
                      <span>Surcodia Editor</span>
                      <span>·</span>
                      <span>{getPathLanguage(selectedFile).toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-white/70">
                      <span>{cursorInfo}</span>
                      <span>UTF-8</span>
                      <span>Spaces: 2</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            /* Empty state */
            <div className="relative flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/5 blur-[100px]" />
              </div>
              <div
                className="animate-fade-in relative rounded-2xl border border-white/5 p-12"
                style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`, backgroundSize: "40px 40px" }}
              >
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.4">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
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
          <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedProject(null)} />
          <div className="animate-slide-up relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d16] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
              <div>
                <h2 className="font-semibold text-white">{selectedProject.name}</h2>
                <p className="mt-0.5 text-xs text-white/30">
                  {selectedProject.messages
                    ? (() => {
                        try {
                          const d = JSON.parse(selectedProject.messages) as { messages?: SerializedMessage[] } | SerializedMessage[];
                          const msgs = Array.isArray(d) ? d : (d.messages ?? []);
                          return `${msgs.filter((m) => m.role === "user").length} prompts`;
                        } catch { return "No conversation"; }
                      })()
                    : "No conversation"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-lg border border-white/5 bg-white/5 p-1">
                  {(["preview", "code"] as const).map((v) => (
                    <button key={v} onClick={() => setModalView(v)}
                      className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${modalView === v ? "bg-white/10 text-white" : "text-white/30 hover:text-white/60"}`}>
                      {v}
                    </button>
                  ))}
                </div>
                <button onClick={() => copyShareLink(selectedProject.shareId)}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                  </svg>
                  Copy share link
                </button>
                <button onClick={() => loadProjectIntoBuilder(selectedProject)}
                  className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold transition-all hover:bg-violet-500">
                  Open in builder
                </button>
                <button onClick={() => setSelectedProject(null)}
                  className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-white/40 transition-all hover:text-white">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {modalView === "preview"
                ? <iframe srcDoc={selectedProject.html} className="h-full w-full bg-white" title={selectedProject.name} sandbox="allow-scripts" />
                : <div className="h-full overflow-auto bg-[#0a0a0f]">
                    <pre className="p-6 font-mono text-xs leading-relaxed text-green-400/80 whitespace-pre-wrap">{selectedProject.html}</pre>
                  </div>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
