# Development Environment Setup

How to get a machine ready to work on this project. For what we're building and why, see [DESIGN.md](DESIGN.md).

> **Project status:** the app isn't scaffolded yet. There's no `package.json` or `docker-compose.yml`, so there's nothing to install or run yet. This guide covers the tools you need now. Run instructions, environment variables and OAuth setup will be added here as the build steps land (see [DESIGN.md §12](DESIGN.md#12-build-plan)).

## 1. Prerequisites

| Tool | Required version | Why |
|------|------------------|-----|
| Git | any recent | Version control |
| nvm | 0.40+ | Installs and switches to the project's pinned Node version |
| Node.js | **24.21.0** (exactly, pinned in [.nvmrc](.nvmrc)) | Next.js app and workers |
| npm | **11.19.0** (ships with Node 24.21.0) | Package manager. We use npm workspaces, not pnpm or yarn. |
| Docker Desktop (or Docker Engine) | Docker 28+, Compose v2 | Local Postgres and the code-execution sandbox images |

You do **not** need Python, Java, Maven or PostgreSQL installed locally. They run inside Docker images with pinned versions ([DESIGN.md §14](DESIGN.md#14-pinned-versions)).

**Supported OS:** macOS and Linux. On Windows, work inside **WSL2** (Ubuntu) and follow the Linux instructions there. Docker Desktop's WSL2 backend provides Docker.

## 2. Install Node with nvm

1. Install nvm if you don't have it: <https://github.com/nvm-sh/nvm#installing-and-updating>
2. From the repo root:

   ```sh
   nvm install   # reads .nvmrc and installs 24.21.0
   nvm use       # switches this shell to 24.21.0
   ```

3. Check:

   ```sh
   node -v   # v24.21.0
   npm -v    # 11.19.0
   ```

This doesn't change your global default Node version, so other projects keep whatever they use.

### Optional: switch versions automatically on `cd`

Without this, run `nvm use` in each new terminal you open in this repo.

**zsh** (macOS default). Add this to `~/.zshrc` **after** the lines that load nvm, then open a new terminal:

```zsh
autoload -U add-zsh-hook
load-nvmrc() {
  local nvmrc_path
  nvmrc_path="$(nvm_find_nvmrc)"

  if [ -n "$nvmrc_path" ]; then
    local nvmrc_node_version
    nvmrc_node_version=$(nvm version "$(cat "${nvmrc_path}")")

    if [ "$nvmrc_node_version" = "N/A" ]; then
      nvm install
    elif [ "$nvmrc_node_version" != "$(nvm version)" ]; then
      nvm use
    fi
  elif [ -n "$(PWD=$OLDPWD nvm_find_nvmrc)" ] && [ "$(nvm version)" != "$(nvm version default)" ]; then
    echo "Reverting to nvm default version"
    nvm use default
  fi
}
add-zsh-hook chpwd load-nvmrc
load-nvmrc
```

**bash:** see nvm's [Deeper Shell Integration](https://github.com/nvm-sh/nvm#deeper-shell-integration) section for the bash version.

## 3. Docker

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on macOS or Windows, or Docker Engine plus the Compose plugin on Linux.
2. Start it, then check:

   ```sh
   docker --version          # Docker version 28.x or newer
   docker compose version    # v2.x
   docker info               # should print server info, not a connection error
   ```

**CPU architecture:** production runs on an ARM (arm64) VM. Apple Silicon Macs build matching images natively. On x86 machines, images build and run locally for x86. That's fine for development, but production images must be built for `linux/arm64`, and the deploy step (DESIGN.md §12, step 16) will handle this.

## 4. Project npm settings (already in the repo)

These are committed, so you don't need to set anything up:

- [.nvmrc](.nvmrc) pins Node `24.21.0`.
- [.npmrc](.npmrc):
  - `save-exact=true`: `npm install <pkg>` records the exact version (`16.4.0`, not `^16.4.0`). Every dependency in this repo is pinned.
  - `engine-strict=true`: npm refuses to install when your Node or npm doesn't match the `engines` field in `package.json`. That field will be added at scaffold time.

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
| `node -v` shows a different version in this repo | Run `nvm use`, or add the auto-switch hook (§2) and open a new terminal. VS Code terminals opened before you edited `~/.zshrc` need to be reopened. |
| `npm ERR! code EBADENGINE` | Your Node or npm version doesn't match `engines`. Run `nvm use`, then retry. |
| `nvm: command not found` | nvm isn't loaded in your shell profile. Re-run the nvm install script, or check that `~/.zshrc` / `~/.bashrc` sources `$NVM_DIR/nvm.sh`. |
| `Cannot connect to the Docker daemon` | Docker Desktop isn't running. Start it and wait for "Engine running". |
