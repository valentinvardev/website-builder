import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-sans">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L7 4L11 8L7 12L3 8Z" fill="white" fillOpacity="0.9"/>
                <path d="M7 4L11 8L13 6L9 2L7 4Z" fill="white" fillOpacity="0.5"/>
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight">Surcodia</span>
          </div>

          <div className="hidden items-center gap-8 md:flex">
            <Link href="#features" className="text-sm text-white/60 transition-colors hover:text-white">Features</Link>
            <Link href="#how-it-works" className="text-sm text-white/60 transition-colors hover:text-white">How it works</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/60 transition-colors hover:text-white">Log in</Link>
            <Link
              href="/signup"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium transition-all hover:bg-violet-500 hover:shadow-lg hover:shadow-violet-500/25"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden pt-16">
        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute left-1/3 top-2/3 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/15 blur-[100px]" />
        </div>

        {/* Grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        <div className="relative mx-auto max-w-5xl px-6 text-center mt-12">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
            <span className="text-xs font-medium text-violet-300">Free to use · Powered by Llama 3.3</span>
          </div>

          <h1 className="mb-6 text-6xl font-bold leading-[1.08] tracking-tight md:text-7xl lg:text-8xl">
            Build websites
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
              with a single prompt
            </span>
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-white/50 leading-relaxed">
            Describe what you want and Surcodia generates a fully functional, editable website in seconds.
            No templates, no drag-and-drop — just write.
          </p>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/builder"
              className="group relative rounded-xl bg-violet-600 px-8 py-4 text-base font-semibold transition-all hover:bg-violet-500 hover:shadow-2xl hover:shadow-violet-500/30"
            >
              Open the builder
              <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="#how-it-works"
              className="rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium text-white/70 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              See how it works
            </Link>
          </div>

          {/* Preview window */}
          <div className="relative mx-auto mt-20 max-w-4xl">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-1 shadow-2xl shadow-black/50 backdrop-blur-sm">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 rounded-t-xl bg-white/5 px-4 py-3">
                <div className="h-3 w-3 rounded-full bg-red-500/60" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                <div className="h-3 w-3 rounded-full bg-green-500/60" />
                <div className="mx-4 flex-1 rounded-md bg-white/5 px-3 py-1 text-left text-xs text-white/30">
                  surcodia.app/builder
                </div>
              </div>
              {/* Builder UI mockup */}
              <div className="flex h-[380px] overflow-hidden rounded-b-xl">
                {/* Sidebar */}
                <div className="w-64 border-r border-white/5 bg-[#0d0d14] p-4">
                  <div className="mb-4 text-xs font-medium uppercase tracking-wider text-white/30">Prompt</div>
                  <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 p-3 text-xs leading-relaxed text-violet-200/80">
                    &ldquo;A minimal portfolio for a photographer with a dark theme and gallery grid...&rdquo;
                  </div>
                  <div className="mt-4 rounded-lg bg-violet-600 px-3 py-2 text-center text-xs font-medium">
                    Generate ✦
                  </div>
                  <div className="mt-6 space-y-2">
                    {["index.html", "styles.css", "gallery/", "about.html"].map((item) => (
                      <div key={item} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2">
                        <span className="text-white/20">{item.endsWith("/") ? "▸" : "·"}</span>
                        <span className="text-xs text-white/50">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Canvas */}
                <div className="flex-1 bg-[#111118] p-6">
                  <div className="h-full rounded-xl border border-white/5 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
                    <div className="mb-4 h-3 w-20 rounded-full bg-violet-500/60" />
                    <div className="mb-2 h-6 w-3/4 rounded-lg bg-white/20" />
                    <div className="mb-1 h-3 w-full rounded-full bg-white/10" />
                    <div className="mb-6 h-3 w-2/3 rounded-full bg-white/10" />
                    <div className="mb-6 flex gap-2">
                      <div className="h-8 w-28 rounded-lg bg-violet-500/70" />
                      <div className="h-8 w-28 rounded-lg border border-white/20 bg-transparent" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="rounded-lg border border-white/5 bg-white/5 p-3">
                          <div className="mb-2 h-4 w-4 rounded-md bg-violet-500/50" />
                          <div className="mb-1 h-2 w-full rounded-full bg-white/20" />
                          <div className="h-2 w-3/4 rounded-full bg-white/10" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Glow under preview */}
            <div className="absolute -bottom-10 left-1/2 h-40 w-3/4 -translate-x-1/2 rounded-full bg-violet-600/20 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <span className="text-xs font-medium text-white/50">Features</span>
            </div>
            <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              Everything in one place
            </h2>
            <p className="mx-auto max-w-xl text-white/50">
              Generate, edit, preview, and organize your website files — all in the browser, all for free.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: "✦",
                title: "AI Generation",
                desc: "Describe your site in plain text. Llama 3.3 generates clean HTML, CSS, and JavaScript instantly.",
              },
              {
                icon: "⚡",
                title: "Live Preview",
                desc: "See your site rendered in real time. Switch between desktop, tablet, and mobile views.",
              },
              {
                icon: "◈",
                title: "Monaco Editor",
                desc: "Full code editor with syntax highlighting. Tweak anything the AI generates — no limits.",
              },
              {
                icon: "⬡",
                title: "Virtual File System",
                desc: "Create files and folders, drag and drop to reorganize. Cross-file links (CSS, JS) work out of the box.",
              },
              {
                icon: "◎",
                title: "Saved Projects",
                desc: "Your projects and chat history are saved automatically. Pick up where you left off anytime.",
              },
              {
                icon: "⊞",
                title: "Shareable Links",
                desc: "Every project gets a public URL. Share a live preview of your site with anyone, instantly.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/5 bg-white/[0.03] p-6 transition-all hover:border-white/10 hover:bg-white/[0.06]"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-lg text-violet-400">
                  {f.icon}
                </div>
                <h3 className="mb-2 font-semibold text-white">{f.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="relative py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute right-0 top-1/2 h-[500px] w-[500px] -translate-y-1/2 rounded-full bg-indigo-600/10 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5">
              <span className="text-xs font-medium text-white/50">How it works</span>
            </div>
            <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
              From idea to live site
              <br />
              <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                in under 60 seconds
              </span>
            </h2>
          </div>

          <div className="grid gap-12 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Describe your website",
                desc: 'Type a prompt like "A minimal portfolio for a photographer with a dark theme and gallery grid".',
              },
              {
                step: "02",
                title: "AI builds it instantly",
                desc: "Llama 3.3 generates your full site — layout, content, colors, and responsive design — in seconds.",
              },
              {
                step: "03",
                title: "Edit and share",
                desc: "Refine with follow-up prompts or edit the code directly. Share a live preview link with one click.",
              },
            ].map((s) => (
              <div key={s.step}>
                <div className="mb-4 text-5xl font-bold text-white/5">{s.step}</div>
                <div className="mb-3 h-px w-12 bg-gradient-to-r from-violet-500 to-transparent" />
                <h3 className="mb-2 text-lg font-semibold">{s.title}</h3>
                <p className="text-sm leading-relaxed text-white/50">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-b from-violet-500/10 to-transparent p-16">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/20 blur-[80px]" />
            </div>
            <div className="relative">
              <h2 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
                Ready to build?
              </h2>
              <p className="mb-8 text-white/50">
                Free to use. No credit card. No limits on what you can create.
              </p>
              <Link
                href="/builder"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-4 text-base font-semibold transition-all hover:bg-violet-500 hover:shadow-2xl hover:shadow-violet-500/30"
              >
                Open the builder <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8L7 4L11 8L7 12L3 8Z" fill="white" fillOpacity="0.9"/>
                  <path d="M7 4L11 8L13 6L9 2L7 4Z" fill="white" fillOpacity="0.5"/>
                </svg>
              </div>
              <span className="text-sm font-semibold">Surcodia</span>
              <span className="text-sm text-white/30">— free AI website builder</span>
            </div>
            <p className="text-xs text-white/20">Built with Next.js, Tailwind, and Groq</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
