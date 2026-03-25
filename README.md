# Surcodia — AI Website Builder

An AI-powered website builder where you describe what you want and get a fully generated, live-preview HTML site in seconds. Built with the T3 Stack.

![Next.js](https://img.shields.io/badge/Next.js_15-black?style=flat&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_v4-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)

---

## Features

- **AI generation** — describe your website in plain text and Surcodia builds it instantly using Groq (Llama 3.3 70B)
- **Live preview** — see the result in a sandboxed iframe with desktop / tablet / mobile responsive views
- **Monaco editor** — edit the generated HTML, CSS, and JS directly with syntax highlighting
- **Virtual file system** — create files and folders, drag & drop to reorganize, cross-file links (CSS/JS) resolved automatically in preview
- **Project persistence** — projects (HTML, chat history, file system) saved to Supabase via Prisma
- **Shareable links** — every project gets a public share URL
- **Auth** — email/password sign-up and optional Discord OAuth via NextAuth v5

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 15](https://nextjs.org) (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Auth | [NextAuth v5](https://authjs.dev) + bcryptjs |
| ORM | [Prisma](https://prisma.io) |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| AI | [Groq](https://groq.com) — Llama 3.3 70B Versatile |
| Editor | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| Deployment | [Vercel](https://vercel.com) |

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/valentinvardev/website-builder.git
cd website-builder
npm install
```

### 2. Set up environment variables

Create a `.env` file at the root:

```env
# Database — Supabase (Transaction pooler URL for runtime, direct for migrations)
DATABASE_URL="postgresql://..."     # port 6543, ?pgbouncer=true
DIRECT_URL="postgresql://..."       # port 5432

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://<project>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
SUPABASE_SERVICE_ROLE_KEY="..."

# AI
GROQ_API_KEY="gsk_..."

# Auth
AUTH_SECRET="..."                   # generate with: openssl rand -base64 32
AUTH_DISCORD_ID="..."               # optional — Discord OAuth
AUTH_DISCORD_SECRET="..."           # optional — Discord OAuth
```

### 3. Push the database schema

```bash
npm run db:push
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── login/page.tsx        # Sign in
│   ├── signup/page.tsx       # Sign up
│   ├── builder/page.tsx      # Main builder UI
│   └── api/
│       ├── generate/         # Groq streaming endpoint
│       ├── projects/         # CRUD for saved projects
│       └── share/[shareId]/  # Public share page
├── server/
│   └── auth/
│       ├── index.ts          # Full NextAuth config (Prisma adapter + bcrypt)
│       └── edge-config.ts    # Lightweight JWT-only config for Edge middleware
├── styles/
│   └── globals.css
└── middleware.ts             # Auth guard for /builder routes
prisma/
└── schema.prisma
```

---

## Deployment

### Vercel (recommended)

1. Push to GitHub and import the repo in Vercel
2. Add all environment variables from the `.env` section above
3. Vercel will run `prisma generate` automatically via the `postinstall` script

> **Note:** The middleware uses a lightweight Edge-compatible auth config (`edge-config.ts`) to stay within Vercel's 1 MB Edge Function size limit.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with Turbopack |
| `npm run build` | Production build |
| `npm run db:push` | Sync schema to database without migrations |
| `npm run db:generate` | Create a new migration |
| `npm run db:studio` | Open Prisma Studio |
| `npm run typecheck` | Run TypeScript type checker |
