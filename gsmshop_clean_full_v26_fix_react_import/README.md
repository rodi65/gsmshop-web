GSMSHOP V26 KESİN REACT IMPORT DÜZELTME

Düzeltilen hata:
- Uncaught ReferenceError: useEffect is not defined

Sebep:
- Dosyadaki gerçek import satırı:
  import React, { useMemo, useState } from "react";
- V25 bunu yakalamamıştı.
- V26 bunu doğrudan şu hale getirir:
  import React, { useEffect, useMemo, useState } from "react";

Kurulum:
cd /Users/ahmetshen/Documents/gsmshop-web/gsmshop_clean_full_v26_fix_react_import
python3 apply_clean_full_v26_fix_react_import.py

Sonra:
cd /Users/ahmetshen/Documents/gsmshop-web
npm run dev

Tarayıcıda:
http://localhost:5174/
