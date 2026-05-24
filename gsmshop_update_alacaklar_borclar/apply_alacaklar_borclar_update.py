#!/usr/bin/env python3
from pathlib import Path

app_path = Path('/Users/ahmetshen/Documents/gsmshop-web/src/App.jsx')
if not app_path.exists():
    raise SystemExit(f'Dosya bulunamadı: {app_path}')
text = app_path.read_text(encoding='utf-8')

replacements = [
    ("{ id: 'current', label: 'Cari özeti', icon: Building2 },", "{ id: 'current', label: 'ALACAKLARIM', icon: Building2 },"),
    ('<PanelHeader title="Müşteri cari özeti" text="Cihaz satışlarında eksik tahsilat oluşursa burada takip edilir." />', '<PanelHeader title="Alacaklarım" text="Cihaz satışlarında eksik tahsilat oluşursa burada takip edilir." />'),
    ("headers={['Müşteri', 'Telefon', 'İşlem', 'Kalan']}", "headers={['İşlem', 'Adı Soyad', 'Alınan Mal', 'Kalan']}"),
    ("item.customerName,\n            item.customerPhone || '-',\n            item.count,\n            formatMoney(item.balance),", "item.count,\n            item.customerName,\n            item.lastProduct || '-',\n            formatMoney(item.balance),"),
    ('<PanelHeader title="Cari özeti"', '<PanelHeader title="Alacaklarım"'),
    ('Cari özeti', 'ALACAKLARIM'),
    ('Müşteri cari özeti', 'Alacaklarım'),
]
for old, new in replacements:
    text = text.replace(old, new)

old_tabs = """    { id: 'current', label: 'ALACAKLARIM', icon: Building2 },
  ];"""
new_tabs = """    { id: 'current', label: 'ALACAKLARIM', icon: Building2 },
    { id: 'debt', label: 'Borçlarım', icon: Building2 },
  ];"""
if old_tabs in text and "{ id: 'debt', label: 'Borçlarım'" not in text:
    text = text.replace(old_tabs, new_tabs)

old_render = """      {activeTab === 'current' && <CurrentSummary data={data} />}
    </div>"""
new_render = """      {activeTab === 'current' && <CurrentSummary data={data} />}
      {activeTab === 'debt' && <DebtSummary data={data} />}
    </div>"""
if old_render in text and "activeTab === 'debt'" not in text:
    text = text.replace(old_render, new_render)

old_customer_func = """function buildCustomerCurrents(sales) {
  const map = new Map();

  sales.forEach((sale) => {
    if (!sale.creditAmount || sale.creditAmount <= 0 || !sale.customerName) return;

    const current = map.get(sale.customerName) ?? {
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      count: 0,
      balance: 0,
    };

    current.count += 1;
    current.balance += sale.creditAmount;
    map.set(sale.customerName, current);
  });

  return Array.from(map.values());
}"""
new_customer_func = """function buildCustomerCurrents(sales) {
  const map = new Map();

  sales.forEach((sale) => {
    if (!sale.creditAmount || sale.creditAmount <= 0 || !sale.customerName) return;

    const current = map.get(sale.customerName) ?? {
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      lastProduct: sale.productName,
      count: 0,
      balance: 0,
    };

    current.count += 1;
    current.lastProduct = sale.productName;
    current.balance += sale.creditAmount;
    map.set(sale.customerName, current);
  });

  return Array.from(map.values());
}"""
if old_customer_func in text:
    text = text.replace(old_customer_func, new_customer_func)

text = text.replace("headers={['Müşteri', 'Telefon', 'İşlem', 'Kalan']}", "headers={['İşlem', 'Adı Soyad', 'Alınan Mal', 'Kalan']}")
text = text.replace("item.customerPhone || '-'", "item.lastProduct || '-'")

if 'function DebtSummary(' not in text:
    insert_before = 'function DeviceModule('
    debt_component = '''
function DebtSummary({ data }) {
  const firmSummaries = buildFirmSummaries(data);

  return (
    <section className="panel">
      <PanelHeader title="Borçlarım" text="Satıcı firmalara olan alış kaynaklı borçların özetidir." />
      <ResponsiveTable
        emptyText="Borç kaydı yok."
        headers={['Firma', 'Son alınan mal', 'Son ödeme', 'Kalan']}
        rows={firmSummaries.map((item) => [
          item.name,
          item.lastProduct || '-',
          formatMoney(item.lastPayment || 0),
          formatMoney(item.balance || item.remaining || 0),
        ])}
      />
    </section>
  );
}

'''
    if insert_before in text:
        text = text.replace(insert_before, debt_component + insert_before)
    else:
        raise SystemExit('DeviceModule bulunamadı; DebtSummary eklenemedi.')

app_path.write_text(text, encoding='utf-8')
print('GSMSHOP güncellendi: Cari özeti ALACAKLARIM oldu, Borçlarım sekmesi eklendi, Alacaklarım kolonları düzenlendi.')