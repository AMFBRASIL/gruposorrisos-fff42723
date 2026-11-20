#!/bin/bash
# Atualiza o ERP no VPS: git pull, deps, build, PM2 (API + web) e checagem rápida.
set -euo pipefail

NODE_BIN=/www/server/nodejs/v20.19.6/bin
APP_DIR=/www/wwwroot/gruposorrisos-fff42723
API_NAME=gruposorrisnode
WEB_NAME=gruposorrisos-web
START_WEB="$APP_DIR/scripts/start-web.sh"

export PATH="$NODE_BIN:$PATH"

echo "==> Node: $(node -v) | npm: $(npm -v)"
echo "==> Diretório: $APP_DIR"
cd "$APP_DIR"

if [[ ! -f package.json ]] || [[ ! -d backend ]]; then
  echo "ERRO: pasta do projeto inválida em $APP_DIR" >&2
  exit 1
fi

echo "==> git pull"
git fetch origin
git pull --ff-only origin main

echo "==> Dependências do backend"
cd "$APP_DIR/backend"
npm install --legacy-peer-deps

echo "==> Dependências do frontend"
cd "$APP_DIR"
npm install --legacy-peer-deps

echo "==> Build do frontend"
npm run build

if [[ ! -f .output/server/index.mjs ]]; then
  echo "ERRO: build não gerou .output/server/index.mjs" >&2
  exit 1
fi

chmod +x "$START_WEB" "$APP_DIR/scripts/deploy-vps.sh"

echo "==> Reiniciando API ($API_NAME)"
pm2 restart "$API_NAME" --update-env

echo "==> Reiniciando web ($WEB_NAME)"
pm2 delete "$WEB_NAME" >/dev/null 2>&1 || true
pm2 start "$START_WEB" --name "$WEB_NAME" --interpreter bash
pm2 save

sleep 2

echo "==> Checagens"
API_HEALTH="$(curl -fsS --max-time 8 http://127.0.0.1:3333/api/health || true)"
WEB_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 http://127.0.0.1:3010/login || true)"

echo "API health: ${API_HEALTH:-falhou}"
echo "Web /login: HTTP ${WEB_CODE:-000}"
pm2 status | grep -E "$API_NAME|$WEB_NAME" || true

if [[ "$API_HEALTH" != *'"status":"ok"'* ]]; then
  echo "ERRO: API não respondeu ok em :3333" >&2
  pm2 logs "$API_NAME" --lines 40 --nostream || true
  exit 1
fi

if [[ "$WEB_CODE" != "200" && "$WEB_CODE" != "302" && "$WEB_CODE" != "304" ]]; then
  echo "ERRO: web não respondeu em :3010" >&2
  pm2 logs "$WEB_NAME" --lines 40 --nostream || true
  exit 1
fi

echo "==> Deploy concluído."
echo "Site: https://api.gruposorrisos.com.br"
