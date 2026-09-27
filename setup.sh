#!/usr/bin/env bash
# Law Guardian — one-command setup.
#
#   ./setup.sh
#
# Checks for Node.js and Docker, copies .env.example to .env on first run,
# installs dependencies, starts PostgreSQL, and applies the database schema.
# Safe to re-run: it skips steps that are already done.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

bold() { printf '\033[1m%s\033[0m\n' "$1"; }
die() { printf '\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

bold "Law Guardian setup"

command -v node >/dev/null || die "Node.js 20+ is required: https://nodejs.org"
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]')
[ "$NODE_MAJOR" -ge 20 ] || die "Node.js 20+ is required (found $(node -v))"
echo "✓ Node.js $(node -v)"

command -v docker >/dev/null || die "Docker is required: https://docs.docker.com/get-docker/"
docker info >/dev/null 2>&1 || die "Docker is installed but not running — start Docker and try again"
echo "✓ Docker"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "✓ Created .env from .env.example — add your DEEPSEEK_API_KEY before continuing"
  NEEDS_KEY=1
else
  echo "✓ .env already exists"
fi

if grep -q '^DEEPSEEK_API_KEY=$' .env 2>/dev/null; then
  NEEDS_KEY=1
fi

echo
bold "Installing dependencies"
(cd bot && npm install)

echo
bold "Starting PostgreSQL"
docker compose up -d

echo -n "Waiting for the database"
for _ in $(seq 1 30); do
  docker exec lexhack-postgres pg_isready -U lexhack >/dev/null 2>&1 && break
  echo -n "."
  sleep 1
done
echo

echo
bold "Applying database schema"
(cd bot && npm run db:migrate)

echo
if [ "${NEEDS_KEY:-0}" = "1" ]; then
  bold "One more step: open .env and set DEEPSEEK_API_KEY"
  echo "Get a key at https://platform.deepseek.com, then run:"
  echo "  cd bot && npm run dev"
else
  bold "Setup complete"
  echo "Start the app with:"
  echo "  cd bot && npm run dev"
fi
echo "The web app opens at http://localhost:3100"
