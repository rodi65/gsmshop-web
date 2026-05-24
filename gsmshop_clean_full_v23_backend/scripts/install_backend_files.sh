#!/usr/bin/env bash
set -e

cd /Users/ahmetshen/Documents/gsmshop-web

npm install @supabase/supabase-js

mkdir -p src/lib src/services src/components

cp gsmshop_clean_full_v23_backend/src/lib/supabase.js src/lib/supabase.js
cp gsmshop_clean_full_v23_backend/src/services/dataService.js src/services/dataService.js
cp gsmshop_clean_full_v23_backend/src/components/Login.jsx src/components/Login.jsx
cp gsmshop_clean_full_v23_backend/src/components/CashClosingPanel.jsx src/components/CashClosingPanel.jsx

if [ ! -f .env ]; then
  cp gsmshop_clean_full_v23_backend/.env.example .env
  echo ".env dosyası oluşturuldu. Supabase URL ve anon key değerlerini içine yaz."
else
  echo ".env dosyası zaten var. Supabase bilgilerini kontrol et."
fi

echo "V23 backend dosyaları projeye kopyalandı."
echo "Şimdi Supabase SQL Editor'da supabase/schema.sql dosyasını çalıştır."
echo "Sonra .env dosyasına Supabase bilgilerini yaz."
