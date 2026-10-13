# Development Environment Setup

How to get a machine ready to work on this project. For what we're building and why, see [DESIGN.md](DESIGN.md).

All development happens inside a **dev container**: a pre-built Docker image with the exact tools the project needs. It's the same on macOS, Windows and Linux. You don't install Node, npm or a version manager on your machine.

> **Project status:** the app isn't scaffolded yet. There's no `package.json` or `docker-compose.yml`, so there's nothing to install or run yet. This guide covers the environment. Run instructions, environment variables and OAuth setup will be added here as the build steps land (see [DESIGN.md §12](DESIGN.md#12-build-plan)).

## 1. Prerequisites

| Tool | Notes |
|------|-------|
| Git | Any recent version, to clone the repo |
| Docker Desktop (macOS, Windows) or Docker Engine + Compose plugin (Linux) | Must be **running** whenever you work on the project |
| An editor that supports dev containers | **VS Code** with the [Dev Containers](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) extension (recommended). JetBrains IDEs and GitHub Codespaces also work. |

You do **not** need Node.js, npm, Python, Java, Maven or PostgreSQL installed locally. Node and npm are in the dev container, and the rest run in their own pinned Docker images ([DESIGN.md §14](DESIGN.md#14-pinned-versions)).

## 2. Open the project in the dev container

### macOS and Linux

1. Clone the repo and open the folder in VS Code.
2. Run **Dev Containers: Reopen in Container** from the Command Palette (`Cmd/Ctrl+Shift+P`). VS Code may also offer it in a pop-up.
3. If asked to choose a configuration, pick **backend-practice**.

### Windows

Use **Dev Containers: Clone Repository in Container Volume…** from the Command Palette, and paste the repo URL. This keeps the code on a Linux volume inside Docker, which is much faster than opening a folder that lives on the Windows filesystem. You don't need to clone it on Windows first.

### What happens on first open

VS Code pulls `ghcr.io/timochil/backend-practice-dev:1`, starts the container and reconnects the window into it. The first time takes a few minutes, and after that it opens in seconds. From then on, **every terminal you open in VS Code runs inside the container.**

**What's inside**

| Tool | Version |
|------|---------|
| Node.js / npm | 24.21.0 / 11.19.0 |
| Git | Debian 13 package |
| Docker CLI + Compose | 29.9.0 + Compose plugin, connected to your machine's Docker |

The EditorConfig extension is installed automatically, and port 3000 (the web app) is forwarded to your machine.

**Git inside the container:** VS Code shares your Git identity, credential helper and SSH agent with the container, so `git pull` and `git push` work as they do on your machine.

### The two configurations

| Name | Use it when |
|------|-------------|
| **backend-practice** | Always, for normal work. It pulls the published image. |
| **backend-practice (build image locally)** | Only when you're changing the dev image itself (see §7). It builds from `.devcontainer/image/` on your machine. |

### ⚠ The container controls your machine's Docker

The container talks to your machine's Docker, so it can start sibling containers, which is how Postgres and the code sandboxes will run. This also means anything running inside the dev container can see, stop or delete **any** container on your machine, including those from other projects. That's fine for this repo's own code. Be careful with scripts or packages you don't trust.

### CPU architecture

The image is published for both `linux/amd64` (most Windows and Linux PCs) and `linux/arm64` (Apple Silicon), and Docker picks the right one. Production runs on an arm64 VM, and the deploy step (DESIGN.md §12, step 16) builds for it.

## 3. Project settings (already in the repo)

These are committed, so you don't need to set anything up:

- [.devcontainer/](.devcontainer/) defines the dev environment. The Node version is pinned in [.devcontainer/image/Dockerfile](.devcontainer/image/Dockerfile), and will also be in `package.json` `engines` once that file exists.
- [.npmrc](.npmrc):
  - `save-exact=true`: `npm install <pkg>` records the exact version (`16.4.0`, not `^16.4.0`). Every dependency in this repo is pinned.
  - `engine-strict=true`: npm refuses to install when Node or npm doesn't match the `engines` field in `package.json`. That field will be added at scaffold time.
- [.gitattributes](.gitattributes) forces **LF line endings** for every text file on every OS, overriding your personal `core.autocrlf`. Windows CRLF line endings break shell scripts inside the Linux sandbox images and change file hashes in the blob store. The exceptions are `.bat`/`.cmd`, which keep CRLF, and binary files, which are never converted.
- [.editorconfig](.editorconfig) sets shared editor defaults: UTF-8, LF, a final newline, trimmed trailing whitespace, and 2-space indents (4 for Python and Java). The dev container installs the VS Code extension for it automatically.

**Rules for adding dependencies**
- Use the exact versions in [DESIGN.md §14](DESIGN.md#14-pinned-versions).
- If you need a new package or a version bump, update §14 in the same change, with a one-line reason.
- Don't commit a lockfile produced by pnpm or yarn. Only `package-lock.json`.

## 4. Secrets

- Never commit `.env` files, OAuth client secrets, `BETTER_AUTH_SECRET` or API keys.
- When the app is scaffolded, `.env.example` will list every variable name, without values. You'll copy it to `.env` and fill it in locally. The variables are listed in [DESIGN.md §10](DESIGN.md#10-authentication).

## 5. Quick check

Run in a VS Code terminal **inside the container**. Every line should match.

```sh
whoami                   # node
node -v                  # v24.21.0
npm -v                   # 11.19.0
docker ps > /dev/null && echo "docker: reachable"
```

## 6. Working without the dev container

This isn't supported, but it's possible. Install Node 24.21.0 yourself, using any version manager. Once `package.json` exists, `engine-strict` blocks installs on the wrong Node or npm version. You're on your own for anything else that differs from the container.

## 7. Maintainers: changing the dev image

Published image tags are **immutable**. CI refuses to overwrite a tag that already exists, so everyone on a given tag has an identical environment.

1. Edit files in [.devcontainer/image/](.devcontainer/image/).
2. Test locally: **Dev Containers: Rebuild and Reopen in Container**, and pick **backend-practice (build image locally)**.
3. In the **same commit**, bump the tag in [.devcontainer/devcontainer.json](.devcontainer/devcontainer.json), e.g. `:1` → `:2`. Keep that file free of comments, because CI reads it with `jq`.
4. Push to `main`. The [Dev container image](.github/workflows/devcontainer-image.yml) workflow builds amd64 + arm64, pushes the new tag, and checks that both platforms were published.
5. Everyone else gets the new image on their next pull. VS Code offers to rebuild the container, or they can run **Dev Containers: Rebuild Container** themselves.

If you forget step 3, the workflow fails with "already published … bump the tag". Fix the tag and push again.

**Manual runs** (Actions → Dev container image → Run workflow) build only if the tag isn't published yet. Use one when a push didn't trigger a build, for example because you changed only the workflow file.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Cannot connect to the Docker daemon` / the container won't start | Docker Desktop isn't running. Start it and wait for "Engine running". |
| Pulling the image fails with `denied` or `not found` | Check the tag in `.devcontainer/devcontainer.json` exists under the repo's **Packages**. A freshly bumped tag only exists once CI finishes. |
| `permission denied … docker.sock` inside the container | Run **Dev Containers: Rebuild Container**. If it persists, restart Docker Desktop. |
| Very slow file access or `npm install` on Windows | The repo is on the Windows filesystem. Re-open it with **Clone Repository in Container Volume…** (§2). |
| `npm ERR! code EBADENGINE` inside the container | Your local image is older than the repo's tag. Run **Dev Containers: Rebuild Container**, which pulls the current tag. |
| `/bin/sh^M: bad interpreter` or `exec format error` from a script in a container | The file has CRLF line endings, usually because the clone predates `.gitattributes`. Run `git rm --cached -r . && git reset --hard`. This discards uncommitted changes, so commit or stash first. |
