#!/usr/bin/env python3
from pathlib import Path

app_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx")
css_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/style.css")

if not app_path.exists():
    raise SystemExit(f"Dosya bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

# Eski menü satırlarını tek tek temizle / düzelt
menu_replacements = {
    '["kasa", "Kasa", Wallet],': '["kasa", "Kasa", Wallet],',
    '["cihaz", "Cihaz/Stok", Smartphone],': '["cihaz", "Cihaz", Smartphone],',
    '["cihaz", "Cihaz", Smartphone],': '["cihaz", "Cihaz", Smartphone],',
    '["aksesuar", "Aksesuar", Headphones],': '["aksesuar", "Aksesuar", Headphones],',
    '["stok", "Stok", Smartphone],': '["stok", "Stok", Smartphone],',
    '["stokKaydi", "Stok Kaydı", Plus],': '',
    '["sorgu", "Sorgulama", Search],': '["sorgu", "Sorgula", Search],',
    '["sorgu", "Sorgula", Search],': '["sorgu", "Sorgula", Search],',
    '["tamir", "Tamir", Wrench],': '["tamir", "Tamir", Wrench],',
    '["vole", "Vole", TrendingUp],': '["vole", "Vole", TrendingUp],',
}

for old, new in menu_replacements.items():
    text = text.replace(old, new)

# Menü array'ini tam olarak istediğin sıraya sabitle
start_token = '          {['
end_token = '          ].map(([key, label, Icon])'
start = text.find(start_token)
end = text.find(end_token, start)

if start == -1 or end == -1:
    raise SystemExit("Ana menü array bölümü bulunamadı. App.jsx yapısı beklenenden farklı.")

new_menu = '''          {[
            ["kasa", "Kasa", Wallet],
            ["cihaz", "Cihaz", Smartphone],
            ["aksesuar", "Aksesuar", Headphones],
            ["stok", "Stok", Smartphone],
            ["sorgu", "Sorgula", Search],
            ["tamir", "Tamir", Wrench],
            ["vole", "Vole", TrendingUp],
'''

text = text[:start] + new_menu + text[end:]

# Stok Kaydı aktif ekranı kaldıysa kaldır
stok_kaydi_start = text.find('        {active === "stokKaydi" && (')
if stok_kaydi_start != -1:
    possible_next = []
    for marker in [
        '        {active === "stok" && (',
        '        {active === "alacak" && (',
        '        {active === "borc" && (',
        '        {active === "sorgu" && (',
        '        {active === "vole" && (',
        '        {editingSale &&',
    ]:
        pos = text.find(marker, stok_kaydi_start + 1)
        if pos != -1:
            possible_next.append(pos)
    if possible_next:
        stok_kaydi_end = min(possible_next)
        text = text[:stok_kaydi_start] + text[stok_kaydi_end:]

app_path.write_text(text, encoding="utf-8")

# CSS nav grid 7 kolon
if css_path.exists():
    css = css_path.read_text(encoding="utf-8")
    css = css.replace("grid-template-columns: repeat(8, 1fr);", "grid-template-columns: repeat(7, 1fr);")
    css = css.replace("grid-template-columns: repeat(6, 1fr);", "grid-template-columns: repeat(7, 1fr);")
    css_path.write_text(css, encoding="utf-8")

print("Ana menü düzeltildi: 1 Kasa, 2 Cihaz, 3 Aksesuar, 4 Stok, 5 Sorgula, 6 Tamir, 7 Vole.")
