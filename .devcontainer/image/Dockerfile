# Dev container image for backend-practice.
# CI builds this for linux/amd64 + linux/arm64 and pushes it to GHCR
# (.github/workflows/devcontainer-image.yml). When you change this file,
# bump the image tag in ../compose.yml (services.dev.image) in the same commit.
#
# node:24.22.2 bundles npm 11.19.1; the full (non-slim) Debian image already
# ships git, curl and an ssh client. The Docker CLI comes from the
# docker-outside-of-docker feature in ./devcontainer.json.
FROM node:24.22.2-trixie

# Links the GHCR package to the repo (shows on the repo page, inherits access)
LABEL org.opencontainers.image.source="https://github.com/TimochiL/backend-practice"
