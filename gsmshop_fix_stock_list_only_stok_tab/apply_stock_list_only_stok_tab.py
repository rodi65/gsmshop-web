#!/usr/bin/env python3
from pathlib import Path

app_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx")

if not app_path.exists():
    raise SystemExit(f"Dosya bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

old_block = '''      <div className="card">
        <h2>{title} Listesi</h2>
        <StockTable stock={visible} setEditingStock={setEditingStock} />
      </div>'''

if old_block in text:
    text = text.replace(old_block, "")
else:
    # Eski başlık hâlâ açıklamalıysa onu da kaldır.
    old_block_2 = '''      <div className="card">
        <h2>{title} Listesi <small>Yanlış stok kaydında düzenle</small></h2>
        <StockTable stock={visible} setEditingStock={setEditingStock} />
      </div>'''
    text = text.replace(old_block_2, "")

# Kullanılmayan visible satırı kalırsa kaldır.
text = text.replace('  const visible = stock.filter(p => p.module === only);\n', '')

app_path.write_text(text, encoding="utf-8")
print("Düzeltme tamamlandı: Cihaz/Aksesuar altındaki stok listeleri kaldırıldı. Tüm stok listesi sadece Stok sekmesinde görünecek.")
