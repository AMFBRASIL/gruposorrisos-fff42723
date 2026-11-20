#!/bin/bash
export PATH=/www/server/nodejs/v20.19.6/bin:$PATH
cd /www/wwwroot/gruposorrisos-fff42723
export NODE_ENV=production
export HOST=0.0.0.0
export PORT=3010
export NITRO_HOST=0.0.0.0
export NITRO_PORT=3010
exec node .output/server/index.mjs
