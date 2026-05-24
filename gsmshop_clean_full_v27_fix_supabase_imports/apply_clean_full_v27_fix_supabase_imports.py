#!/usr/bin/env python3
from pathlib import Path
import re

project = Path("/Users/ahmetshen/Documents/gsmshop-web")
app_path = project / "src" / "App.jsx"

if not app_path.exists():
    raise FileNotFoundError(f"App.jsx bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

# 1) React import satırını kesin düzelt
text = re.sub(
    r'import\s+React\s*,\s*\{[^}]*\}\s+from\s+["\']react["\'];',
    'import React, { useEffect, useMemo, useState } from "react";',
    text,
    count=1
)

text = re.sub(
    r'import\s*\{[^}]*\}\s+from\s+["\']react["\'];',
    'import React, { useEffect, useMemo, useState } from "react";',
    text,
    count=1
)

if 'import React, { useEffect, useMemo, useState } from "react";' not in text:
    text = 'import React, { useEffect, useMemo, useState } from "react";\n' + text

# 2) Eksik component importlarını temizle ve yeniden ekle
text = re.sub(r'import\s+Login\s+from\s+["\']\.\/components\/Login["\'];\n?', '', text)
text = re.sub(r'import\s+CashClosingPanel\s+from\s+["\']\.\/components\/CashClosingPanel["\'];\n?', '', text)

# 3) Eksik dataService importlarını temizle ve yeniden ekle
text = re.sub(
    r'import\s*\{[\s\S]*?\}\s*from\s+["\']\.\/services\/dataService["\'];\n?',
    '',
    text,
    count=1
)

needed_imports = """
import Login from "./components/Login";
import CashClosingPanel from "./components/CashClosingPanel";
import {
  getCurrentUser,
  signOut,
  loadDashboardData,
  createStockItem,
  createSale,
  createExpense,
  createBankWithdrawal,
  softDelete,
} from "./services/dataService";
"""

# 4) style importundan sonra ekle; yoksa React importundan sonra ekle
if 'import "./style.css";' in text:
    text = text.replace('import "./style.css";', 'import "./style.css";' + needed_imports, 1)
else:
    text = text.replace('import React, { useEffect, useMemo, useState } from "react";',
                        'import React, { useEffect, useMemo, useState } from "react";' + needed_imports,
                        1)

app_path.write_text(text, encoding="utf-8")

print("GSMSHOP V27 Supabase import düzeltmesi tamamlandı.")
print("Düzeltildi:")
print("- getCurrentUser is not defined")
print("- Login is not defined")
print("- CashClosingPanel ve dataService importları")
print("")
print("Şimdi terminalde:")
print("cd /Users/ahmetshen/Documents/gsmshop-web")
print("npm run dev")
