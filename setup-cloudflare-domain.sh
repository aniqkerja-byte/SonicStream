#!/bin/bash

DOMAIN="music.jomtek.my"
TUNNEL_NAME="music-server"

echo "========================================================="
echo " 🌐 CLOUDFLARE CUSTOM SUBDOMAIN SETUP: $DOMAIN"
echo "========================================================="
echo ""

# 1. Check login cert
if [ ! -f ~/.cloudflared/cert.pem ]; then
  echo "🔑 Step 1: Log masuk ke akaun Cloudflare anda..."
  echo "Jalankan arahan ini di terminal untuk membuat pengesahan:"
  echo ""
  echo "    cloudflared tunnel login"
  echo ""
  echo "Pilih domain 'jomtek.my' pada pelayar web yang terbuka."
  exit 1
fi

echo "✅ Sijil pengesahan Cloudflare ditemui (~/.cloudflared/cert.pem)."

# 2. Create tunnel if not existing
echo ""
echo "🚀 Step 2: Membuat Cloudflare Tunnel bernama '$TUNNEL_NAME'..."
cloudflared tunnel create $TUNNEL_NAME 2>/dev/null || echo "ℹ️ Tunnel '$TUNNEL_NAME' mungkin sudah wujud."

# 3. Route DNS
echo ""
echo "🔗 Step 3: Mengatur DNS Subdomain $DOMAIN -> Tunnel..."
cloudflared tunnel route dns $TUNNEL_NAME $DOMAIN

# 4. Generate config.yml
CONFIG_PATH="/home/lenovo/.gemini/antigravity/scratch/music-stream-app/cloudflared-config.yml"
TUNNEL_ID=$(cloudflared tunnel list | grep $TUNNEL_NAME | awk '{print $1}')

echo ""
echo "📝 Step 4: Menjana fail konfigurasi $CONFIG_PATH (ID: $TUNNEL_ID)..."

cat <<EOF > $CONFIG_PATH
tunnel: $TUNNEL_ID
credentials-file: /home/lenovo/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: $DOMAIN
    service: http://localhost:3000
  - service: http_status:404
EOF

echo ""
echo "========================================================="
echo " 🎉 SETUP SELESAI!"
echo "========================================================="
echo "Untuk menjalankan tunnel pada subdomain $DOMAIN:"
echo ""
echo "    cloudflared tunnel --config $CONFIG_PATH run $TUNNEL_NAME"
echo ""
echo "Atau jalankan via npm:"
echo "    npm run tunnel:domain"
echo "========================================================="
