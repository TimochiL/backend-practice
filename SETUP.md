# Development Environment Setup

How to get a machine ready to work on this project. For what we're building and why, see [DESIGN.md](DESIGN.md).

> **Project status:** the app isn't scaffolded yet. There's no `package.json` or `docker-compose.yml`, so there's nothing to install or run yet. This guide covers the tools you need now. Run instructions, environment variables and OAuth setup will be added here as the build steps land (see [DESIGN.md §12](DESIGN.md#12-build-plan)).

## 1. Prerequisites

| Tool | Required version | Why |
|------|------------------|-----|
| Git | any recent | Version control |
| fnm | 1.39+ | Cross-platform Node version manager. It reads [.nvmrc](.nvmrc) and switches automatically on `cd`. |
| Node.js | **24.21.0** (exactly, pinned in [.nvmrc](.nvmrc)) | Next.js app and workers |
| npm | **11.19.0** (ships with Node 24.21.0) | Package manager. We use npm workspaces, not pnpm or yarn. |
| Docker Desktop (or Docker Engine) | Docker 28+, Compose v2 | Local Postgres and the code-execution sandbox images |

You do **not** need Python, Java, Maven or PostgreSQL installed locally. They run inside Docker images with pinned versions ([DESIGN.md §14](DESIGN.md#14-pinned-versions)).

**Supported OS:** macOS, Windows (native, with PowerShell) and Linux. The same tools work on all three.

## 2. Install Node with fnm

We use [fnm](https://github.com/Schniz/fnm) because it runs natively on macOS, Windows and Linux, needs no admin rights, and only affects the current terminal. Already using **nvm** on macOS or Linux? That works too, since it reads the same `.nvmrc`. Run `nvm install && nvm use` in the repo and skip to step 4 below. Don't run both managers' auto-switch hooks in the same shell.

### Step 1: install fnm

| OS | Command |
|----|---------|
| macOS | `brew install fnm` |
| Windows | `winget install Schniz.fnm` (or `scoop install fnm` / `choco install fnm`) |
| Linux | `curl -fsSL https://fnm.vercel.app/install \| bash`, or your distro's package |

### Step 2: hook fnm into your shell

This turns on auto-switching. Add the line for your shell, then **open a new terminal**.

| Shell | File | Line to add |
|-------|------|-------------|
| zsh (macOS default) | `~/.zshrc` | `eval "$(fnm env --use-on-cd --shell zsh)"` |
| bash / Git Bash | `~/.bashrc` | `eval "$(fnm env --use-on-cd --shell bash)"` |
| PowerShell | `$PROFILE` (open with `notepad $PROFILE`) | `fnm env --use-on-cd --shell powershell \| Out-String \| Invoke-Expression` |
| Windows cmd | see the [fnm README](https://github.com/Schniz/fnm#windows-command-prompt-aka-batch-aka-wincmd) | |

If you also have nvm loaded in the same profile, put the fnm line **after** it so fnm's Node comes first on your PATH.

### Step 3: install the project's Node

From the repo root:

```sh
fnm install    # reads .nvmrc and installs 24.21.0
```

### Step 4: check

```sh
cd .      # or reopen the terminal in the repo
node -v   # v24.21.0
npm -v    # 11.19.0
```

**How switching behaves:**
- Entering this repo switches the current terminal to 24.21.0.
- fnm does **not** switch back when you leave. The terminal stays on 24.21.0 until you `cd` into another folder with a version file, or open a new terminal.
- New terminals start on your fnm default, which you set with `fnm default <version>`.

## 3. Docker

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on macOS or Windows, or Docker Engine plus the Compose plugin on Linux.
2. Start it, then check:

   ```sh
   docker --version          # Docker version 28.x or newer
   docker compose version    # v2.x
   docker info               # should print server info, not a connection error
   ```

**CPU architecture:** production runs on an ARM (arm64) VM. Apple Silicon Macs build matching images natively. On x86 machines, images build and run locally for x86. That's fine for development, but production images must be built for `linux/arm64`, and the deploy step (DESIGN.md §12, step 16) will handle this.

## 4. Project settings (already in the repo)

These are committed, so you don't need to set anything up:

- [.nvmrc](.nvmrc) pins Node `24.21.0`.
- [.npmrc](.npmrc):
  - `save-exact=true`: `npm install <pkg>` records the exact version (`16.4.0`, not `^16.4.0`). Every dependency in this repo is pinned.
  - `engine-strict=true`: npm refuses to install when your Node or npm doesn't match the `engines` field in `package.json`. That field will be added at scaffold time.
- [.gitattributes](.gitattributes) forces **LF line endings** for every text file on every OS, overriding your personal `core.autocrlf`. Windows CRLF line endings break shell scripts inside the Linux sandbox images and change file hashes in the blob store. The exceptions are `.bat`/`.cmd`, which keep CRLF, and binary files, which are never converted.
- [.editorconfig](.editorconfig) sets shared editor defaults: UTF-8, LF, a final newline, trimmed trailing whitespace, and 2-space indents (4 for Python and Java).
  - **VS Code users:** install the [EditorConfig for VS Code](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) extension. Without it, VS Code ignores the file.
  - JetBrains IDEs support it natively.

**Rules for adding dependencies**
- Use the exact versions in [DESIGN.md §14](DESIGN.md#14-pinned-versions).
- If you need a new package or a version bump, update §14 in the same change, with a one-line reason.
- Don't commit a lockfile produced by pnpm or yarn. Only `package-lock.json`.

## 5. Secrets

- Never commit `.env` files, OAuth client secrets, `BETTER_AUTH_SECRET` or API keys.
- When the app is scaffolded, `.env.example` will list every variable name, without values. You'll copy it to `.env` and fill it in locally. The variables are listed in [DESIGN.md §10](DESIGN.md#10-authentication).

## 6. Quick check

Run from the repo root. Every line should match.

```sh
node -v                  # v24.21.0
npm -v                   # 11.19.0
docker compose version   # Docker Compose version v2.x
docker info > /dev/null && echo "docker: running"
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `node -v` shows a different version in this repo | Run `fnm use` (or `nvm use`). If it keeps happening, check the fnm line from §2 is in your shell profile, then open a new terminal. VS Code terminals opened before you edited the profile need to be reopened. |
| `npm ERR! code EBADENGINE` | Your Node or npm version doesn't match `engines`. Run `fnm use` (or `nvm use`), then retry. |
| `fnm: command not found` / `fnm` not recognized | Open a new terminal after installing. On Windows, check that winget's install folder is on your PATH. |
| PowerShell: "running scripts is disabled on this system" when loading `$PROFILE` | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once, then reopen PowerShell. |
| Node keeps changing between two versions | Both the fnm and nvm auto-switch hooks are active. Keep only one in your shell profile. |
| `/bin/sh^M: bad interpreter` or `exec format error` from a script in a container | The file has CRLF line endings, usually because the clone predates `.gitattributes`. Run `git rm --cached -r . && git reset --hard`. This discards uncommitted changes, so commit or stash first. |
| `Cannot connect to the Docker daemon` | Docker Desktop isn't running. Start it and wait for "Engine running". |
