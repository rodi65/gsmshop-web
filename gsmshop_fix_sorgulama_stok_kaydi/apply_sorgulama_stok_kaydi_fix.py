#!/usr/bin/env python3
from pathlib import Path

app_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx")

if not app_path.exists():
    raise SystemExit(f"Dosya bulunamadı: {app_path}")

text = app_path.read_text(encoding="utf-8")

# 1) Ana menüye Stok Kaydı ekle. Stok liste ekranı ayrı kalsın.
if '["stokKaydi", "Stok Kaydı", Plus],' not in text:
    text = text.replace(
        '["stok", "Stok", Smartphone],',
        '["stok", "Stok", Smartphone],\n            ["stokKaydi", "Stok Kaydı", Plus],'
    )

# 2) Stok Kaydı ana ekranını ekle.
insert_after = '''        {active === "aksesuar" && (
          <StockSection title="Aksesuar Stok" only="Aksesuar" stock={stock} stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} setEditingStock={setEditingStock} />
        )}'''

stock_kaydi_block = '''        {active === "stokKaydi" && (
          <section className="section">
            <div className="card">
              <h2>Stok Kaydı</h2>
              <p>Cihaz ve aksesuar stok girişleri buradan yapılır. Eklenen ürünler Stok bölümünde listelenir.</p>
            </div>
            <StockSection title="Cihaz Stok Kaydı" only="Cihaz" stock={stock} stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} setEditingStock={setEditingStock} />
            <StockSection title="Aksesuar Stok Kaydı" only="Aksesuar" stock={stock} stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} setEditingStock={setEditingStock} />
          </section>
        )}'''

if insert_after in text and 'active === "stokKaydi"' not in text:
    text = text.replace(insert_after, insert_after + "\n\n" + stock_kaydi_block)

# 3) Cihaz ve Aksesuar ana ekranlarında stok kayıt alanı yerine açıklama bırak.
old_cihaz = '''        {active === "cihaz" && (
          <StockSection title="Cihaz" only="Cihaz" stock={stock} stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} setEditingStock={setEditingStock} />
        )}'''
new_cihaz = '''        {active === "cihaz" && (
          <section className="card">
            <h2>Cihaz</h2>
            <p>Cihaz işlemleri için ürünleri Kasa ekranında satabilir, Stok Kaydı ekranında yeni cihaz girebilir, Stok ekranında mevcut cihazları görebilirsin.</p>
          </section>
        )}'''
text = text.replace(old_cihaz, new_cihaz)

old_aksesuar = '''        {active === "aksesuar" && (
          <StockSection title="Aksesuar Stok" only="Aksesuar" stock={stock} stockForm={stockForm} setStockForm={setStockForm} saveStock={saveStock} setEditingStock={setEditingStock} />
        )}'''
new_aksesuar = '''        {active === "aksesuar" && (
          <section className="card">
            <h2>Aksesuar</h2>
            <p>Aksesuar işlemleri için ürünleri Kasa ekranında satabilir, Stok Kaydı ekranında yeni aksesuar girebilir, Stok ekranında mevcut aksesuarları görebilirsin.</p>
          </section>
        )}'''
text = text.replace(old_aksesuar, new_aksesuar)

# Eğer yukarıdaki replace yüzünden Stok Kaydı bloğu kaybolduysa Cihaz bloğundan sonra tekrar ekle.
if 'active === "stokKaydi"' not in text:
    marker = new_aksesuar
    text = text.replace(marker, marker + "\n\n" + stock_kaydi_block)

# 4) Sorgulama ekranını eski detaylı mantığa yaklaştır.
old_sorgu_start = '''        {active === "sorgu" && (
          <section className="card">
            <h2>Sorgulama</h2>
            <input placeholder="Ürün, müşteri, firma, barkod ara" value={query} onChange={e => setQuery(e.target.value)} />
            <h3>Stok Sonuçları</h3>
            <StockTable stock={filteredStock} setEditingStock={setEditingStock} />
            <h3>Satış Sonuçları</h3>
            <Table headers={["Ürün", "Müşteri", "Satış", "Kalan", "Düzelt"]} rows={filteredSales.map(s => [
              s.productName, s.customer || "-", money(s.total), money(s.remaining), <button className="edit-btn" onClick={() => setEditingSale({ ...s })}>Düzenle</button>
            ])} />
          </section>
        )}'''

new_sorgu = '''        {active === "sorgu" && (
          <section className="card">
            <h2>Sorgulama</h2>
            <p>IMEI, barkod, isim soyisim, marka, model, ürün adı veya tedarikçi firma ile arama yap.</p>
            <input
              placeholder="IMEI / Barkod / İsim Soyisim / Marka Model / Ürün / Firma"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />

            <div className="query-hints">
              <span>IMEI/Barkod</span>
              <span>İsim Soyisim</span>
              <span>Marka Model</span>
              <span>Ürün Adı</span>
              <span>Tedarikçi Firma</span>
            </div>

            <h3>Stok Sonuçları</h3>
            <StockTable stock={filteredStock} setEditingStock={setEditingStock} />

            <h3>Satış Sonuçları</h3>
            <Table
              headers={["Ürün", "Müşteri / Cari Kişi", "Satış", "Nakit", "Kart", "Kalan", "Düzelt"]}
              rows={filteredSales.map(s => [
                s.productName,
                s.cariPerson || s.customer || "-",
                money(s.total),
                money(s.cash),
                money(s.card),
                money(s.remaining),
                <button className="edit-btn" onClick={() => setEditingSale({ ...s })}>Düzenle</button>
              ])}
            />
          </section>
        )}'''

if old_sorgu_start in text:
    text = text.replace(old_sorgu_start, new_sorgu)
else:
    # Daha esnek replace
    start = text.find('        {active === "sorgu" && (')
    end = text.find('        {active === "vole" && (', start)
    if start != -1 and end != -1:
        text = text[:start] + new_sorgu + "\n\n" + text[end:]

# 5) Arama mantığını genişlet: müşteri/cari, ürün, firma, barkod, marka/model.
old_filtered_stock = 'const filteredStock = stock.filter(p => !query || has(productTitle(p), query) || has(p.barcode, query) || has(p.supplier, query));'
new_filtered_stock = 'const filteredStock = stock.filter(p => !query || has(productTitle(p), query) || has(p.barcode, query) || has(p.supplier, query) || has(p.brand, query) || has(p.model, query) || has(p.name, query));'
text = text.replace(old_filtered_stock, new_filtered_stock)

old_filtered_sales = 'const filteredSales = sales.filter(s => !query || has(s.productName, query) || has(s.customer, query) || has(s.cariPerson, query));'
new_filtered_sales = 'const filteredSales = sales.filter(s => !query || has(s.productName, query) || has(s.customer, query) || has(s.cariPerson, query) || has(s.productBarcodeImei, query));'
text = text.replace(old_filtered_sales, new_filtered_sales)

app_path.write_text(text, encoding="utf-8")

# CSS küçük ek
css_path = Path("/Users/ahmetshen/Documents/gsmshop-web/src/style.css")
if css_path.exists():
    css = css_path.read_text(encoding="utf-8")
    if ".query-hints" not in css:
        css += '''
.query-hints { display: flex; flex-wrap: wrap; gap: 8px; margin: 10px 0 18px; }
.query-hints span { background: #e2e8f0; color: #334155; border-radius: 999px; padding: 6px 10px; font-size: 13px; font-weight: 800; }
'''
    css_path.write_text(css, encoding="utf-8")

print("Düzeltme tamamlandı: Sorgulama eski detaylı mantığa döndü, ana menüye Stok Kaydı eklendi.")
