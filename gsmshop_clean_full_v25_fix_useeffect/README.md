GSMSHOP V25 HIZLI DÜZELTME

Düzeltilen hata:
- Uncaught ReferenceError: useEffect is not defined

Sebep:
- App.jsx içinde useEffect kullanılmış ama React import satırına eklenmemişti.

Kurulum:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v25_fix_useeffect
python3 apply_clean_full_v25_fix_useeffect.py

Sonra:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev
