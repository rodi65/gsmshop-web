#!/usr/bin/env python3
from pathlib import Path

app_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx")

if not app_path.exists():
    raise SystemExit(f"Dosya bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

text = text.replace(
    '<p>Alacaklarım = eksik ödeyen müşteriler. Borçlarım = mal aldığım tedarikçiler.</p>',
    '<p>Web kasa, stok, alacak ve borç takip sistemi.</p>'
)

text = text.replace('            ["alacak", "ALACAKLARIM", Wallet],\n', '')
text = text.replace('            ["borc", "Borçlarım", Wallet],\n', '')

old_kasa_start = '''        {active === "kasa" && (
          <section className="section">
            <div className="stats five">'''
new_kasa_start = '''        {active === "kasa" && (
          <section className="section">
            <div className="kasa-subtabs">
              <button className="choice active" type="button">Yeni Satış</button>
              <button className="choice" type="button" onClick={() => setActive("alacak")}>ALACAKLARIM</button>
              <button className="choice" type="button" onClick={() => setActive("borc")}>Borçlarım</button>
            </div>
            <div className="stats five">'''

if old_kasa_start not in text:
    raise SystemExit("Kasa bölümü beklenen yapıda bulunamadı. Güncelleme uygulanmadı.")

text = text.replace(old_kasa_start, new_kasa_start)

text = text.replace(
    '<h2>Satış Listesi <small>Yanlış satışta düzenle</small></h2>',
    '<h2>Satış Listesi</h2>'
)

text = text.replace(
    '<h2>{title} Listesi <small>Yanlış stok kaydında düzenle</small></h2>',
    '<h2>{title} Listesi</h2>'
)

app_path.write_text(text, encoding="utf-8")
print("Düzeltme tamamlandı: Ana menü sadeleşti, ALACAKLARIM ve Borçlarım Kasa içine alındı, açıklama yazıları kaldırıldı.")
