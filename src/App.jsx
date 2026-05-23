import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Banknote,
  BarChart3,
  Boxes,
  Building2,
  Cable,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  PackageSearch,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Smartphone,
  Trash2,
  TrendingUp,
  WalletCards,
  Wrench,
} from 'lucide-react';

const STORAGE_KEY = 'gsmshop-web:local-data';

const DEVICE_TYPES = ['Telefon', 'Saat', 'Tablet', 'PC', 'Elektronik'];
const DEVICE_CONDITIONS = ['Sıfır Garantili', 'Sıfır Spot', 'İkinci El'];
const SALE_TYPES = [
  'Telefon Satışı',
  'Saat Satışı',
  'Tablet Satışı',
  'PC Satışı',
  'Elektronik Satışı',
  'Aksesuar Satışı',
];
const PROFIT_GROUPS = [...SALE_TYPES, 'Tamir Geliri'];
const CATEGORY_SEEDS = ['Kılıf', 'Şarj', 'Koruyucu', 'Kulaklık', 'Blutut Kulaklık'];
const BRAND_GROUPS = ['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Realme', 'Huawei', 'Lenovo', 'HP', 'Asus', 'Diğer'];
const BRAND_MODELS = {
  Samsung: [
    'Galaxy S26 Ultra',
    'Galaxy S26+',
    'Galaxy S26',
    'Galaxy S25 Ultra',
    'Galaxy S25+',
    'Galaxy S25',
    'Galaxy Z Fold 7',
    'Galaxy Z Flip 7',
  ],
  Apple: [
    'iPhone 17 Pro Max',
    'iPhone 17 Pro',
    'iPhone Air',
    'iPhone 17',
    'iPhone 16 Pro Max',
    'iPhone 16 Pro',
    'iPhone 16',
    'Apple Watch Ultra 3',
  ],
};
const MEMORY_OPTIONS = ['64 GB', '128 GB', '256 GB', '512 GB', '1 TB', '2 TB', 'Yok'];

const moneyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 0,
});

function createInitialData() {
  const createdAt = new Date().toISOString();
  const categories = CATEGORY_SEEDS.map((name) => ({
    id: slugId('cat', name),
    name,
    archived: false,
    fixed: true,
    createdAt,
  }));

  return {
    categories,
    companies: [
      { id: 'firm-mobiltek', name: 'MOBİLTEK İLETİŞİM', createdAt },
      { id: 'firm-galaksi', name: 'GALAKSİ TEKNOLOJİ', createdAt },
      { id: 'firm-baseus', name: 'BASEUS TÜRKİYE', createdAt },
    ],
    firmPayments: [
      {
        id: 'pay-sample-1',
        companyName: 'MOBİLTEK İLETİŞİM',
        amount: 25000,
        note: 'Başlangıç ödemesi',
        createdAt,
      },
    ],
    devices: [
      {
        id: 'dev-iphone-17-pro-max',
        type: 'Telefon',
        condition: 'Sıfır Garantili',
        brandGroup: 'Apple',
        brand: 'Apple',
        model: 'iPhone 17 Pro Max',
        memory: '256 GB',
        barcode: 'IMEI-170000000001',
        purchasePrice: 76000,
        salePrice: 84500,
        stock: 2,
        initialStock: 2,
        sellerCompany: 'MOBİLTEK İLETİŞİM',
        sellerPerson: '',
        sellerPhone: '',
        note: 'Başlangıç örnek cihazı',
        createdAt,
      },
      {
        id: 'dev-galaxy-s26-ultra',
        type: 'Telefon',
        condition: 'Sıfır Spot',
        brandGroup: 'Samsung',
        brand: 'Samsung',
        model: 'Galaxy S26 Ultra',
        memory: '512 GB',
        barcode: 'IMEI-260000000001',
        purchasePrice: 62000,
        salePrice: 69900,
        stock: 3,
        initialStock: 3,
        sellerCompany: 'GALAKSİ TEKNOLOJİ',
        sellerPerson: '',
        sellerPhone: '',
        note: 'Başlangıç örnek cihazı',
        createdAt,
      },
      {
        id: 'dev-watch-ultra-3',
        type: 'Saat',
        condition: 'Sıfır Garantili',
        brandGroup: 'Apple',
        brand: 'Apple',
        model: 'Apple Watch Ultra 3',
        memory: 'Yok',
        barcode: 'IMEI-WATCH-ULTRA-3',
        purchasePrice: 25000,
        salePrice: 29900,
        stock: 1,
        initialStock: 1,
        sellerCompany: 'MOBİLTEK İLETİŞİM',
        sellerPerson: '',
        sellerPhone: '',
        note: 'Başlangıç örnek cihazı',
        createdAt,
      },
    ],
    accessories: [
      {
        id: 'acc-iphone-17-pro-max-kilif',
        categoryId: 'cat-kilif',
        categoryName: 'Kılıf',
        name: 'iPhone 17 Pro Max Kılıf',
        modelCompatibility: 'iPhone 17 Pro Max',
        barcode: 'ACC-170-PM-KILIF',
        stock: 14,
        initialStock: 14,
        purchasePrice: 180,
        salePrice: 449,
        sellerCompany: 'BASEUS TÜRKİYE',
        createdAt,
      },
      {
        id: 'acc-baseus-bluetooth-kulaklik',
        categoryId: 'cat-blutut-kulaklik',
        categoryName: 'Blutut Kulaklık',
        name: 'Baseus Bluetooth Kulaklık',
        modelCompatibility: 'Evrensel',
        barcode: 'ACC-BASEUS-BT-01',
        stock: 6,
        initialStock: 6,
        purchasePrice: 950,
        salePrice: 1499,
        sellerCompany: 'BASEUS TÜRKİYE',
        createdAt,
      },
    ],
    sales: [],
  };
}

const emptyDeviceForm = {
  type: 'Telefon',
  condition: 'Sıfır Garantili',
  brandGroup: 'Apple',
  brand: 'Apple',
  model: 'iPhone 17 Pro Max',
  memory: '256 GB',
  barcode: '',
  purchasePrice: '',
  salePrice: '',
  stock: 1,
  sellerCompany: '',
  sellerPerson: '',
  sellerPhone: '',
  note: '',
};

const emptyAccessoryForm = {
  categoryId: 'cat-kilif',
  name: '',
  modelCompatibility: '',
  barcode: '',
  stock: 1,
  purchasePrice: '',
  salePrice: '',
  sellerCompany: '',
};

function App() {
  const [data, setData] = useStoredData();
  const [activeModule, setActiveModule] = useState('kasa');

  const modules = [
    { id: 'kasa', label: 'Kasa', icon: WalletCards },
    { id: 'cihaz', label: 'Cihaz', icon: Smartphone },
    { id: 'aksesuar', label: 'Aksesuar', icon: Cable },
    { id: 'sorgulama', label: 'Sorgulama', icon: Search },
    { id: 'vole', label: 'Vole', icon: TrendingUp },
    { id: 'tamir', label: 'Tamir', icon: Wrench, disabled: true, note: 'Yakında aktif olacak' },
  ];

  const activeLabel = modules.find((item) => item.id === activeModule)?.label ?? 'Kasa';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">GS</div>
          <div>
            <h1>GSMSHOP</h1>
            <p>Web kasa ve stok takip</p>
          </div>
        </div>

        <nav className="module-nav" aria-label="Ana modüller">
          {modules.map(({ id, label, icon: Icon, disabled, note }) => (
            <button
              className={`module-button ${activeModule === id ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
              disabled={disabled}
              key={id}
              onClick={() => setActiveModule(id)}
              type="button"
            >
              <Icon size={20} />
              <span>{label}</span>
              {note && <small>{note}</small>}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">GSMSHOP</span>
            <h2>{activeLabel}</h2>
          </div>
          <div className="topbar-metrics">
            <span>{data.devices.length} cihaz</span>
            <span>{data.accessories.length} aksesuar</span>
            <span>{data.sales.length} satış</span>
          </div>
        </header>

        {activeModule === 'kasa' && <KasaModule data={data} setData={setData} />}
        {activeModule === 'cihaz' && <DeviceModule data={data} setData={setData} />}
        {activeModule === 'aksesuar' && <AccessoryModule data={data} setData={setData} />}
        {activeModule === 'sorgulama' && <QueryModule data={data} />}
        {activeModule === 'vole' && <VoleModule sales={data.sales} />}
      </main>
    </div>
  );
}

function KasaModule({ data, setData }) {
  const [activeTab, setActiveTab] = useState('new');
  const tabs = [
    { id: 'daily', label: 'Günlük rapor', icon: BarChart3 },
    { id: 'new', label: 'Yeni satış', icon: Plus },
    { id: 'list', label: 'Satış listesi', icon: ClipboardList },
    { id: 'current', label: 'Cari özeti', icon: Building2 },
  ];

  return (
    <div className="module-stack">
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />
      {activeTab === 'daily' && <DailyReport sales={data.sales} />}
      {activeTab === 'new' && <NewSale data={data} setData={setData} />}
      {activeTab === 'list' && <SalesList sales={data.sales} />}
      {activeTab === 'current' && <CurrentSummary data={data} />}
    </div>
  );
}

function NewSale({ data, setData }) {
  const [saleType, setSaleType] = useState('Telefon Satışı');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(null);

  const isAccessorySale = saleType === 'Aksesuar Satışı';
  const deviceType = saleType.replace(' Satışı', '');
  const productPool = useMemo(() => {
    if (isAccessorySale) {
      return data.accessories.map((item) => ({
        ...item,
        searchableName: item.name,
        title: item.name,
        productKind: 'accessory',
      }));
    }

    return data.devices
      .filter((item) => item.type === deviceType)
      .map((item) => ({
        ...item,
        searchableName: deviceTitle(item),
        title: deviceTitle(item),
        productKind: 'device',
      }));
  }, [data.accessories, data.devices, deviceType, isAccessorySale]);

  const filteredProducts = useMemo(() => {
    const needle = normalize(searchTerm);
    return productPool.filter((product) => {
      if (!needle) return true;
      return [product.searchableName, product.barcode, product.modelCompatibility, product.brand, product.model]
        .some((field) => normalize(field).includes(needle));
    });
  }, [productPool, searchTerm]);

  const selectedProduct = productPool.find((item) => item.id === selectedProductId);
  const saleTotal = toNumber(salePrice);
  const purchaseTotal = selectedProduct ? toNumber(selectedProduct.purchasePrice) : 0;
  const paidTotal = toNumber(cashAmount) + toNumber(cardAmount);
  const creditAmount = isAccessorySale ? 0 : Math.max(0, saleTotal - paidTotal);
  const projectedProfit = saleTotal - purchaseTotal;

  useEffect(() => {
    setSelectedProductId('');
    setSalePrice('');
    setCashAmount('');
    setCardAmount('');
    setMessage('');
    setSuccess(null);
  }, [saleType]);

  useEffect(() => {
    if (!selectedProduct) return;
    const autoPrice = String(selectedProduct.salePrice ?? '');
    setSalePrice(autoPrice);
    setCashAmount(autoPrice);
    setCardAmount('');
  }, [selectedProduct]);

  function handleSubmit(event) {
    event.preventDefault();
    setMessage('');
    setSuccess(null);

    if (!selectedProduct) {
      setMessage('Satış için ürün seçmelisin.');
      return;
    }

    if (toNumber(selectedProduct.stock) < 1) {
      setMessage('Seçilen üründe stok yok.');
      return;
    }

    if (!isAccessorySale && !customerName.trim()) {
      setMessage('Cihaz satışında müşteri adı zorunludur.');
      return;
    }

    if (saleTotal <= 0) {
      setMessage('Satış fiyatı 0’dan büyük olmalı.');
      return;
    }

    const stockBefore = toNumber(selectedProduct.stock);
    const stockAfter = stockBefore - 1;
    const createdAt = new Date().toISOString();
    const sale = {
      id: uid('sale'),
      saleType,
      productKind: isAccessorySale ? 'accessory' : 'device',
      productId: selectedProduct.id,
      productName: selectedProduct.title,
      barcode: selectedProduct.barcode,
      customerName: isAccessorySale ? '' : customerName.trim(),
      customerPhone: isAccessorySale ? '' : customerPhone.trim(),
      sellerCompany: selectedProduct.sellerCompany ?? '',
      sellerPerson: selectedProduct.sellerPerson ?? '',
      quantity: 1,
      purchaseTotal,
      saleTotal,
      cashAmount: toNumber(cashAmount),
      cardAmount: toNumber(cardAmount),
      creditAmount,
      profit: projectedProfit,
      stockBefore,
      stockAfter,
      createdAt,
    };

    setData((current) => ({
      ...current,
      devices: isAccessorySale
        ? current.devices
        : current.devices.map((item) => (
          item.id === selectedProduct.id ? { ...item, stock: Math.max(0, toNumber(item.stock) - 1) } : item
        )),
      accessories: isAccessorySale
        ? current.accessories.map((item) => (
          item.id === selectedProduct.id ? { ...item, stock: Math.max(0, toNumber(item.stock) - 1) } : item
        ))
        : current.accessories,
      sales: [sale, ...current.sales],
    }));

    setSuccess({
      productName: sale.productName,
      stockBefore,
      stockAfter,
      profit: sale.profit,
      creditAmount,
    });
    setSelectedProductId('');
    setSearchTerm('');
    setCustomerName('');
    setCustomerPhone('');
    setSalePrice('');
    setCashAmount('');
    setCardAmount('');
  }

  return (
    <section className="panel">
      <PanelHeader title="Yeni satış" text="Cihaz satışları cari takip açabilir, aksesuar satışları stoktan düşer ve cari oluşturmaz." />

      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Satış türü
          <select value={saleType} onChange={(event) => setSaleType(event.target.value)}>
            {SALE_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>

        <label className="span-2">
          Barkod / IMEI veya ürün adıyla ara
          <input
            placeholder={isAccessorySale ? 'Barkod veya aksesuar adı' : 'Barkod, IMEI, marka veya model'}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <label className="span-2">
          Ürün seç
          <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
            <option value="">Ürün seç</option>
            {filteredProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title} | {product.barcode || 'barkod yok'} | Stok {product.stock}
              </option>
            ))}
          </select>
        </label>

        {!isAccessorySale && (
          <>
            <label>
              Müşteri adı
              <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} required />
            </label>
            <label>
              Müşteri telefonu
              <input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            </label>
          </>
        )}

        <label>
          Satış fiyatı
          <input min="0" type="number" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} />
        </label>
        <label>
          Nakit
          <input min="0" type="number" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} />
        </label>
        <label>
          Kart
          <input min="0" type="number" value={cardAmount} onChange={(event) => setCardAmount(event.target.value)} />
        </label>

        {selectedProduct && (
          <div className="product-preview span-3">
            <div>
              <strong>{selectedProduct.title}</strong>
              <span>{selectedProduct.barcode || 'Barkod / IMEI yok'}</span>
            </div>
            <Metric label="Alış" value={formatMoney(purchaseTotal)} />
            <Metric label="Satış" value={formatMoney(saleTotal)} />
            <Metric label="Stok" value={selectedProduct.stock} />
            <Metric label="Ön kâr" value={formatMoney(projectedProfit)} tone={projectedProfit >= 0 ? 'good' : 'bad'} />
          </div>
        )}

        {!isAccessorySale && creditAmount > 0 && (
          <div className="alert span-3">
            <AlertTriangle size={18} />
            Nakit + kart toplamı satıştan düşük. {formatMoney(creditAmount)} cari kalan oluşacak.
          </div>
        )}

        {isAccessorySale && (
          <div className="soft-note span-3">Aksesuar satışında müşteri bilgisi ve cari kaydı oluşturulmaz.</div>
        )}

        {message && <div className="error-note span-3">{message}</div>}

        <div className="form-actions span-3">
          <button className="primary-button" type="submit">
            <Save size={18} />
            Satışı kaydet
          </button>
        </div>
      </form>

      {success && (
        <div className="success-card">
          <CheckCircle2 size={24} />
          <div>
            <h3>Satış kaydedildi</h3>
            <div className="success-grid">
              <span>Ürün adı</span><strong>{success.productName}</strong>
              <span>Stok önce / sonra</span><strong>{success.stockBefore} / {success.stockAfter}</strong>
              <span>Kâr</span><strong>{formatMoney(success.profit)}</strong>
              <span>Cari kalan</span><strong>{formatMoney(success.creditAmount)}</strong>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function DailyReport({ sales }) {
  const todayKey = localDateKey(new Date().toISOString());
  const dailySales = sales.filter((sale) => localDateKey(sale.createdAt) === todayKey);
  const summary = summarizeSales(dailySales);

  return (
    <section className="panel">
      <PanelHeader title="Günlük rapor" text={`${formatDate(new Date().toISOString())} tarihli satış hareketleri`} />
      <div className="stat-grid">
        <StatCard icon={ClipboardList} label="İşlem adedi" value={dailySales.length} />
        <StatCard icon={Banknote} label="Nakit" value={formatMoney(summary.cash)} />
        <StatCard icon={CreditCard} label="Kart" value={formatMoney(summary.card)} />
        <StatCard icon={TrendingUp} label="Kâr" value={formatMoney(summary.profit)} />
      </div>
      <ResponsiveTable
        emptyText="Bugün satış kaydı yok."
        headers={['Saat', 'Tür', 'Ürün', 'Satış', 'Kâr', 'Cari']}
        rows={dailySales.map((sale) => [
          formatTime(sale.createdAt),
          sale.saleType,
          sale.productName,
          formatMoney(sale.saleTotal),
          formatMoney(sale.profit),
          formatMoney(sale.creditAmount),
        ])}
      />
    </section>
  );
}

function SalesList({ sales }) {
  return (
    <section className="panel">
      <PanelHeader title="Satış listesi" text="Kaydedilen tüm satışlar, ödeme kırılımı ve stok kontrol bilgisiyle listelenir." />
      <ResponsiveTable
        emptyText="Henüz satış kaydı yok."
        headers={['Tarih', 'Tür', 'Ürün', 'Müşteri', 'Nakit', 'Kart', 'Cari', 'Kâr']}
        rows={sales.map((sale) => [
          formatDate(sale.createdAt),
          sale.saleType,
          sale.productName,
          sale.customerName || '-',
          formatMoney(sale.cashAmount),
          formatMoney(sale.cardAmount),
          formatMoney(sale.creditAmount),
          formatMoney(sale.profit),
        ])}
      />
    </section>
  );
}

function CurrentSummary({ data }) {
  const customerCurrents = buildCustomerCurrents(data.sales);
  const firmSummaries = buildFirmSummaries(data);

  return (
    <div className="module-stack">
      <section className="panel">
        <PanelHeader title="Müşteri cari özeti" text="Cihaz satışlarında eksik tahsilat oluşursa burada takip edilir." />
        <ResponsiveTable
          emptyText="Müşteri carisi yok."
          headers={['Müşteri', 'Telefon', 'İşlem', 'Kalan']}
          rows={customerCurrents.map((item) => [
            item.customerName,
            item.customerPhone || '-',
            item.count,
            formatMoney(item.balance),
          ])}
        />
      </section>
      <FirmCurrentCards summaries={firmSummaries} />
    </div>
  );
}

function DeviceModule({ data, setData }) {
  const [form, setForm] = useState(emptyDeviceForm);
  const [notice, setNotice] = useState('');
  const brandModels = BRAND_MODELS[form.brandGroup] ?? [];

  useEffect(() => {
    if (brandModels.length && !brandModels.includes(form.model)) {
      setForm((current) => ({ ...current, model: brandModels[0], brand: current.brand || current.brandGroup }));
    }
  }, [brandModels, form.brandGroup, form.model]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setNotice('');

    const isUsed = form.condition === 'İkinci El';
    if (isUsed && (!form.sellerPerson.trim() || !form.sellerPhone.trim() || !form.barcode.trim())) {
      setNotice('İkinci el cihazda satıcı şahıs, satıcı telefon ve Barkod / IMEI zorunludur.');
      return;
    }

    if (toNumber(form.purchasePrice) <= 0 || toNumber(form.salePrice) <= 0 || toNumber(form.stock) <= 0) {
      setNotice('Alış fiyatı, satış fiyatı ve stok adedi 0’dan büyük olmalı.');
      return;
    }

    const companyName = form.sellerCompany.trim();
    const device = {
      id: uid('dev'),
      ...form,
      purchasePrice: toNumber(form.purchasePrice),
      salePrice: toNumber(form.salePrice),
      stock: toNumber(form.stock),
      initialStock: toNumber(form.stock),
      sellerCompany: companyName,
      createdAt: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      companies: ensureCompany(current.companies, companyName),
      devices: [device, ...current.devices],
    }));
    setForm({ ...emptyDeviceForm, sellerCompany: companyName });
    setNotice('Cihaz stok kaydı eklendi.');
  }

  return (
    <div className="module-stack">
      <section className="panel">
        <PanelHeader title="Cihaz stok kayıt" text="Telefon, saat, tablet, PC ve elektronik cihaz stokları aksesuar alanlarından ayrı tutulur." />
        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            Cihaz türü
            <select value={form.type} onChange={(event) => updateField('type', event.target.value)}>
              {DEVICE_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            Ürün durumu
            <select value={form.condition} onChange={(event) => updateField('condition', event.target.value)}>
              {DEVICE_CONDITIONS.map((condition) => <option key={condition}>{condition}</option>)}
            </select>
          </label>
          <label>
            Marka grubu
            <select value={form.brandGroup} onChange={(event) => updateField('brandGroup', event.target.value)}>
              {BRAND_GROUPS.map((brand) => <option key={brand}>{brand}</option>)}
            </select>
          </label>
          <label>
            Marka
            <input value={form.brand} onChange={(event) => updateField('brand', event.target.value)} />
          </label>
          <label>
            Model
            <input list="device-models" value={form.model} onChange={(event) => updateField('model', event.target.value)} />
            <datalist id="device-models">
              {brandModels.map((model) => <option key={model} value={model} />)}
            </datalist>
          </label>
          <label>
            Hafıza
            <select value={form.memory} onChange={(event) => updateField('memory', event.target.value)}>
              {MEMORY_OPTIONS.map((memory) => <option key={memory}>{memory}</option>)}
            </select>
          </label>
          <label>
            Barkod / IMEI
            <input value={form.barcode} onChange={(event) => updateField('barcode', event.target.value)} />
          </label>
          <label>
            Alış fiyatı
            <input min="0" type="number" value={form.purchasePrice} onChange={(event) => updateField('purchasePrice', event.target.value)} />
          </label>
          <label>
            Satış fiyatı
            <input min="0" type="number" value={form.salePrice} onChange={(event) => updateField('salePrice', event.target.value)} />
          </label>
          <label>
            Stok adedi
            <input min="1" type="number" value={form.stock} onChange={(event) => updateField('stock', event.target.value)} />
          </label>
          <label className="span-2">
            Satıcı firma
            <input list="company-list" value={form.sellerCompany} onChange={(event) => updateField('sellerCompany', event.target.value)} />
            <CompanyDatalist companies={data.companies} />
          </label>
          <label>
            Satıcı şahıs
            <input value={form.sellerPerson} onChange={(event) => updateField('sellerPerson', event.target.value)} />
          </label>
          <label>
            Satıcı telefon
            <input value={form.sellerPhone} onChange={(event) => updateField('sellerPhone', event.target.value)} />
          </label>
          <label className="span-3">
            Not
            <textarea rows="3" value={form.note} onChange={(event) => updateField('note', event.target.value)} />
          </label>
          {form.condition === 'İkinci El' && (
            <div className="soft-note span-3">İkinci el cihazda satıcı şahıs, satıcı telefon ve Barkod / IMEI zorunludur.</div>
          )}
          {notice && <div className={`span-3 ${notice.includes('eklendi') ? 'soft-note' : 'error-note'}`}>{notice}</div>}
          <div className="form-actions span-3">
            <button className="primary-button" type="submit">
              <Save size={18} />
              Cihaz kaydet
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <PanelHeader title="Cihaz stok listesi" text="Bu bölümde aksesuar ürünü bulunmaz." />
        <ResponsiveTable
          emptyText="Cihaz stoku yok."
          headers={['Tür', 'Durum', 'Ürün', 'Barkod / IMEI', 'Stok', 'Alış', 'Satış', 'Satıcı firma']}
          rows={data.devices.map((device) => [
            device.type,
            device.condition,
            deviceTitle(device),
            device.barcode || '-',
            device.stock,
            formatMoney(device.purchasePrice),
            formatMoney(device.salePrice),
            device.sellerCompany || '-',
          ])}
        />
      </section>
    </div>
  );
}

function AccessoryModule({ data, setData }) {
  const [activeTab, setActiveTab] = useState('stock');
  const tabs = [
    { id: 'stock', label: 'Stok kayıt', icon: Plus },
    { id: 'list', label: 'Stok listesi', icon: Boxes },
    { id: 'category', label: 'Kategori', icon: PackageSearch },
    { id: 'firm', label: 'Firma cari', icon: Building2 },
  ];

  return (
    <div className="module-stack">
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />
      {activeTab === 'stock' && <AccessoryStockForm data={data} setData={setData} />}
      {activeTab === 'list' && <AccessoryStockList accessories={data.accessories} />}
      {activeTab === 'category' && <CategoryManager data={data} setData={setData} />}
      {activeTab === 'firm' && <FirmCurrentCards summaries={buildFirmSummaries(data)} />}
    </div>
  );
}

function AccessoryStockForm({ data, setData }) {
  const activeCategories = data.categories.filter((category) => !category.archived);
  const [form, setForm] = useState({
    ...emptyAccessoryForm,
    categoryId: activeCategories[0]?.id ?? '',
  });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!activeCategories.some((category) => category.id === form.categoryId)) {
      setForm((current) => ({ ...current, categoryId: activeCategories[0]?.id ?? '' }));
    }
  }, [activeCategories, form.categoryId]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setNotice('');
    const category = activeCategories.find((item) => item.id === form.categoryId);

    if (!category) {
      setNotice('Aktif kategori seçmelisin.');
      return;
    }

    if (!form.name.trim() || !form.barcode.trim()) {
      setNotice('Ürün adı ve barkod zorunludur.');
      return;
    }

    if (toNumber(form.purchasePrice) <= 0 || toNumber(form.salePrice) <= 0 || toNumber(form.stock) <= 0) {
      setNotice('Alış fiyatı, satış fiyatı ve stok adedi 0’dan büyük olmalı.');
      return;
    }

    const companyName = form.sellerCompany.trim();
    const accessory = {
      id: uid('acc'),
      ...form,
      categoryName: category.name,
      stock: toNumber(form.stock),
      initialStock: toNumber(form.stock),
      purchasePrice: toNumber(form.purchasePrice),
      salePrice: toNumber(form.salePrice),
      sellerCompany: companyName,
      createdAt: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      companies: ensureCompany(current.companies, companyName),
      accessories: [accessory, ...current.accessories],
    }));
    setForm({ ...emptyAccessoryForm, categoryId: activeCategories[0]?.id ?? '', sellerCompany: companyName });
    setNotice('Aksesuar stok kaydı eklendi.');
  }

  return (
    <section className="panel">
      <PanelHeader title="Aksesuar stok kayıt" text="Aksesuar kayıtları cihaz stoklarından ayrı tutulur." />
      <form className="form-grid" onSubmit={handleSubmit}>
        <label>
          Kategori
          <select value={form.categoryId} onChange={(event) => updateField('categoryId', event.target.value)}>
            {activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </label>
        <label className="span-2">
          Ürün adı
          <input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
        </label>
        <label>
          Model uyumu
          <input value={form.modelCompatibility} onChange={(event) => updateField('modelCompatibility', event.target.value)} />
        </label>
        <label>
          Barkod
          <input value={form.barcode} onChange={(event) => updateField('barcode', event.target.value)} />
        </label>
        <label>
          Stok adedi
          <input min="1" type="number" value={form.stock} onChange={(event) => updateField('stock', event.target.value)} />
        </label>
        <label>
          Alış fiyatı
          <input min="0" type="number" value={form.purchasePrice} onChange={(event) => updateField('purchasePrice', event.target.value)} />
        </label>
        <label>
          Satış fiyatı
          <input min="0" type="number" value={form.salePrice} onChange={(event) => updateField('salePrice', event.target.value)} />
        </label>
        <label className="span-2">
          Satıcı firma adı
          <input list="company-list" value={form.sellerCompany} onChange={(event) => updateField('sellerCompany', event.target.value)} />
          <CompanyDatalist companies={data.companies} />
        </label>
        {notice && <div className={`span-3 ${notice.includes('eklendi') ? 'soft-note' : 'error-note'}`}>{notice}</div>}
        <div className="form-actions span-3">
          <button className="primary-button" type="submit">
            <Save size={18} />
            Aksesuar kaydet
          </button>
        </div>
      </form>
    </section>
  );
}

function AccessoryStockList({ accessories }) {
  return (
    <section className="panel">
      <PanelHeader title="Aksesuar stok listesi" text="Kâr ve toplam tahmini kâr stok adedine göre hesaplanır." />
      <ResponsiveTable
        emptyText="Aksesuar stoku yok."
        headers={['Kategori', 'Ürün adı', 'Model uyumu', 'Barkod', 'Stok', 'Alış', 'Satış', 'Kâr', 'Toplam tahmini kâr', 'Satıcı firma adı']}
        rows={accessories.map((item) => {
          const profit = toNumber(item.salePrice) - toNumber(item.purchasePrice);
          return [
            item.categoryName,
            item.name,
            item.modelCompatibility || '-',
            item.barcode || '-',
            item.stock,
            formatMoney(item.purchasePrice),
            formatMoney(item.salePrice),
            formatMoney(profit),
            formatMoney(profit * toNumber(item.stock)),
            item.sellerCompany || '-',
          ];
        })}
      />
    </section>
  );
}

function CategoryManager({ data, setData }) {
  const [categoryName, setCategoryName] = useState('');
  const [editingId, setEditingId] = useState('');
  const [notice, setNotice] = useState('');
  const activeCategories = data.categories.filter((category) => !category.archived);
  const archivedCategories = data.categories.filter((category) => category.archived);
  const editingCategory = data.categories.find((category) => category.id === editingId);

  function saveCategory(event) {
    event.preventDefault();
    setNotice('');
    const name = categoryName.trim();
    if (!name) {
      setNotice('Kategori adı yazmalısın.');
      return;
    }
    if (data.categories.some((category) => normalize(category.name) === normalize(name))) {
      setNotice('Bu kategori zaten kayıtlı.');
      return;
    }
    setData((current) => ({
      ...current,
      categories: [
        ...current.categories,
        { id: uid('cat'), name, archived: false, fixed: false, createdAt: new Date().toISOString() },
      ],
    }));
    setCategoryName('');
    setNotice('Kategori kayıt edildi.');
  }

  function updateCategory() {
    setNotice('');
    const name = categoryName.trim();
    if (!editingCategory) {
      setNotice('Güncellemek için kategori seçmelisin.');
      return;
    }
    if (editingCategory.fixed) {
      setNotice('Sabit kategoriler düzenlenemez.');
      return;
    }
    if (!name) {
      setNotice('Kategori adı boş olamaz.');
      return;
    }
    setData((current) => ({
      ...current,
      categories: current.categories.map((category) => (
        category.id === editingId ? { ...category, name } : category
      )),
      accessories: current.accessories.map((accessory) => (
        accessory.categoryId === editingId ? { ...accessory, categoryName: name } : accessory
      )),
    }));
    setCategoryName('');
    setEditingId('');
    setNotice('Kategori güncellendi.');
  }

  function archiveCategory(categoryId) {
    setData((current) => ({
      ...current,
      categories: current.categories.map((category) => (
        category.id === categoryId ? { ...category, archived: true } : category
      )),
    }));
  }

  function restoreCategory(categoryId) {
    setData((current) => ({
      ...current,
      categories: current.categories.map((category) => (
        category.id === categoryId ? { ...category, archived: false } : category
      )),
    }));
  }

  function deleteArchivedCategory(categoryId) {
    setData((current) => ({
      ...current,
      categories: current.categories.filter((category) => category.id !== categoryId),
    }));
  }

  return (
    <div className="module-stack">
      <section className="panel">
        <PanelHeader title="Kategori kayıt" text="Aktif kategoriler arşivlenebilir; silme işlemi sadece arşiv bölümünde bulunur." />
        <form className="form-grid compact" onSubmit={saveCategory}>
          <label className="span-2">
            Kategori adı
            <input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} />
          </label>
          <div className="button-pair">
            <button className="secondary-button" onClick={updateCategory} type="button" disabled={!editingId}>
              <RefreshCw size={17} />
              Güncelle
            </button>
            <button className="primary-button" type="submit">
              <Plus size={17} />
              Kategori Kayıt
            </button>
          </div>
          {notice && <div className={`span-3 ${notice.includes('edildi') || notice.includes('güncellendi') ? 'soft-note' : 'error-note'}`}>{notice}</div>}
        </form>
      </section>

      <section className="panel">
        <PanelHeader title="Aktif kategoriler" text="Sabit 5 kategoride düzenleme butonu yoktur." />
        <div className="category-list">
          {activeCategories.map((category) => (
            <div className="category-row" key={category.id}>
              <div>
                <strong>{category.name}</strong>
                <span>{category.fixed ? 'Sabit kategori' : 'Özel kategori'}</span>
              </div>
              <div className="row-actions">
                {!category.fixed && (
                  <button
                    className="icon-button"
                    onClick={() => {
                      setEditingId(category.id);
                      setCategoryName(category.name);
                    }}
                    title="Düzenle"
                    type="button"
                  >
                    <Pencil size={17} />
                  </button>
                )}
                <button className="secondary-button" onClick={() => archiveCategory(category.id)} type="button">
                  <Archive size={17} />
                  Arşivle
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelHeader title="Arşiv" text="Arşivlenen kategoriler geri alınabilir veya kalıcı silinebilir." />
        <div className="category-list">
          {archivedCategories.length === 0 && <p className="empty-text">Arşivde kategori yok.</p>}
          {archivedCategories.map((category) => (
            <div className="category-row archived" key={category.id}>
              <div>
                <strong>{category.name}</strong>
                <span>Arşivde</span>
              </div>
              <div className="row-actions">
                <button className="secondary-button" onClick={() => restoreCategory(category.id)} type="button">
                  <RotateCcw size={17} />
                  Geri al
                </button>
                <button className="danger-button" onClick={() => deleteArchivedCategory(category.id)} type="button">
                  <Trash2 size={17} />
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function QueryModule({ data }) {
  const [filters, setFilters] = useState({
    barcode: '',
    productName: '',
    brand: '',
    model: '',
    category: '',
    sellerCompany: '',
    sellerPerson: '',
    customerName: '',
    phone: '',
  });

  const records = useMemo(() => buildQueryRecords(data), [data]);
  const results = useMemo(() => {
    return records.filter((record) => {
      return Object.entries(filters).every(([key, value]) => {
        const needle = normalize(value);
        if (!needle) return true;
        const haystack = normalize(record[key]);
        if (key === 'phone') {
          return [record.phone, record.customerPhone, record.sellerPhone].some((field) => normalize(field).includes(needle));
        }
        return haystack.includes(needle);
      });
    });
  }, [filters, records]);

  function updateFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  return (
    <section className="panel">
      <PanelHeader title="Sorgulama" text="Tek alanla arama yapabilir veya birden fazla alanı birlikte filtreleyebilirsin." />
      <div className="form-grid">
        <label>
          Barkod / IMEI
          <input value={filters.barcode} onChange={(event) => updateFilter('barcode', event.target.value)} />
        </label>
        <label>
          Ürün adı
          <input value={filters.productName} onChange={(event) => updateFilter('productName', event.target.value)} />
        </label>
        <label>
          Marka
          <input value={filters.brand} onChange={(event) => updateFilter('brand', event.target.value)} />
        </label>
        <label>
          Model
          <input value={filters.model} onChange={(event) => updateFilter('model', event.target.value)} />
        </label>
        <label>
          Kategori
          <input value={filters.category} onChange={(event) => updateFilter('category', event.target.value)} />
        </label>
        <label>
          Satıcı firma
          <input value={filters.sellerCompany} onChange={(event) => updateFilter('sellerCompany', event.target.value)} />
        </label>
        <label>
          Satıcı şahıs
          <input value={filters.sellerPerson} onChange={(event) => updateFilter('sellerPerson', event.target.value)} />
        </label>
        <label>
          Müşteri adı
          <input value={filters.customerName} onChange={(event) => updateFilter('customerName', event.target.value)} />
        </label>
        <label>
          Telefon numarası
          <input value={filters.phone} onChange={(event) => updateFilter('phone', event.target.value)} />
        </label>
      </div>

      <div className="result-count">{results.length} kayıt bulundu</div>
      <ResponsiveTable
        emptyText="Filtrelerle eşleşen kayıt yok."
        headers={['Kaynak', 'Ürün', 'Barkod / IMEI', 'Kategori', 'Stok', 'Satış', 'Satıcı / Müşteri']}
        rows={results.map((record) => [
          record.source,
          record.productName,
          record.barcode || '-',
          record.category || '-',
          record.stock ?? '-',
          formatMoney(record.salePrice || record.saleTotal || 0),
          record.customerName || record.sellerCompany || record.sellerPerson || '-',
        ])}
      />
    </section>
  );
}

function VoleModule({ sales }) {
  const today = localDateKey(new Date().toISOString());
  const currentMonth = today.slice(0, 7);
  const [activeTab, setActiveTab] = useState('daily');
  const [month, setMonth] = useState(currentMonth);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const tabs = [
    { id: 'daily', label: 'Günlük', icon: BarChart3 },
    { id: 'monthly', label: 'Aylık', icon: TrendingUp },
    { id: 'range', label: 'Tarih Aralığı', icon: Search },
  ];

  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const key = localDateKey(sale.createdAt);
      if (activeTab === 'daily') return key === today;
      if (activeTab === 'monthly') return key.startsWith(month);
      return (!startDate || key >= startDate) && (!endDate || key <= endDate);
    });
  }, [activeTab, endDate, month, sales, startDate, today]);

  const profitRows = useMemo(() => {
    return PROFIT_GROUPS.map((group) => {
      const groupSales = filteredSales.filter((sale) => sale.saleType === group);
      const totals = summarizeSales(groupSales);
      return {
        group,
        count: groupSales.length,
        saleTotal: totals.sale,
        purchaseTotal: group === 'Tamir Geliri' ? 0 : totals.purchase,
        profit: group === 'Tamir Geliri' ? totals.sale : totals.profit,
      };
    });
  }, [filteredSales]);

  const totalProfit = profitRows.reduce((sum, row) => sum + row.profit, 0);

  return (
    <section className="panel">
      <PanelHeader title="Vole" text="Kâr raporu satış toplamı eksi ürün alış maliyeti hesabıyla hazırlanır." />
      <TabBar activeTab={activeTab} setActiveTab={setActiveTab} tabs={tabs} />

      <div className="date-tools">
        {activeTab === 'monthly' && (
          <label>
            Ay
            <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
          </label>
        )}
        {activeTab === 'range' && (
          <>
            <label>
              Başlangıç
              <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>
            <label>
              Bitiş
              <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>
          </>
        )}
      </div>

      <ResponsiveTable
        emptyText="Seçilen dönemde kâr kaydı yok."
        headers={['Kâr grubu', 'İşlem adedi', 'Satış toplamı', 'Alış toplamı', 'Kâr']}
        rows={profitRows.map((row) => [
          row.group,
          row.count,
          formatMoney(row.saleTotal),
          formatMoney(row.purchaseTotal),
          formatMoney(row.profit),
        ])}
      />

      <div className="total-profit">
        <span>Toplam Kâr</span>
        <strong>{formatMoney(totalProfit)}</strong>
      </div>
    </section>
  );
}

function FirmCurrentCards({ summaries }) {
  return (
    <section className="panel">
      <PanelHeader title="Firma cari kartı" text="Her firma için son mal, son ödeme, toplam alış, toplam ödeme ve kalan takip edilir." />
      <div className="firm-grid">
        {summaries.length === 0 && <p className="empty-text">Firma cari kaydı yok.</p>}
        {summaries.map((firm) => (
          <article className="firm-card" key={firm.name}>
            <h3>{firm.name.toLocaleUpperCase('tr-TR')}</h3>
            <p><span>Son alınan mal</span><strong>{firm.lastProduct || '-'}</strong></p>
            <p><span>Son ödeme</span><strong>{firm.lastPayment ? `${formatMoney(firm.lastPayment.amount)} · ${formatDate(firm.lastPayment.createdAt)}` : '-'}</strong></p>
            <p><span>Toplam alış</span><strong>{formatMoney(firm.totalPurchase)}</strong></p>
            <p><span>Toplam ödeme</span><strong>{formatMoney(firm.totalPayment)}</strong></p>
            <div className="firm-balance">
              <span>KALAN</span>
              <strong>{formatMoney(firm.balance)}</strong>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function TabBar({ tabs, activeTab, setActiveTab }) {
  return (
    <div className="tabbar">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button className={activeTab === id ? 'active' : ''} key={id} onClick={() => setActiveTab(id)} type="button">
          <Icon size={17} />
          {label}
        </button>
      ))}
    </div>
  );
}

function PanelHeader({ title, text }) {
  return (
    <div className="panel-header">
      <div>
        <h3>{title}</h3>
        {text && <p>{text}</p>}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }) {
  return (
    <article className="stat-card">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function Metric({ label, value, tone }) {
  return (
    <div className={`metric ${tone ?? ''}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ResponsiveTable({ headers, rows, emptyText }) {
  if (!rows.length) return <p className="empty-text">{emptyText}</p>;

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.join('-')}-${index}`}>
              {row.map((cell, cellIndex) => (
                <td data-label={headers[cellIndex]} key={`${headers[cellIndex]}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompanyDatalist({ companies }) {
  return (
    <datalist id="company-list">
      {companies.map((company) => <option key={company.id} value={company.name} />)}
    </datalist>
  );
}

function useStoredData() {
  const [data, setData] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) return hydrateData(JSON.parse(stored));
    } catch {
      return createInitialData();
    }
    return createInitialData();
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  return [data, setData];
}

function hydrateData(raw) {
  const initial = createInitialData();
  return {
    ...initial,
    ...raw,
    categories: raw.categories?.length ? raw.categories : initial.categories,
    companies: raw.companies?.length ? raw.companies : initial.companies,
    firmPayments: raw.firmPayments ?? initial.firmPayments,
    devices: raw.devices ?? initial.devices,
    accessories: raw.accessories ?? initial.accessories,
    sales: raw.sales ?? [],
  };
}

function buildFirmSummaries(data) {
  const companyNames = new Set(data.companies.map((company) => company.name));
  [...data.devices, ...data.accessories].forEach((item) => {
    if (item.sellerCompany) companyNames.add(item.sellerCompany);
  });

  return [...companyNames].sort((a, b) => a.localeCompare(b, 'tr')).map((name) => {
    const goods = [
      ...data.devices
        .filter((device) => normalize(device.sellerCompany) === normalize(name))
        .map((device) => ({
          title: deviceTitle(device),
          total: toNumber(device.purchasePrice) * toNumber(device.initialStock ?? device.stock),
          createdAt: device.createdAt,
        })),
      ...data.accessories
        .filter((accessory) => normalize(accessory.sellerCompany) === normalize(name))
        .map((accessory) => ({
          title: accessory.name,
          total: toNumber(accessory.purchasePrice) * toNumber(accessory.initialStock ?? accessory.stock),
          createdAt: accessory.createdAt,
        })),
    ];
    const payments = data.firmPayments.filter((payment) => normalize(payment.companyName) === normalize(name));
    const latestGood = [...goods].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const latestPayment = [...payments].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
    const totalPurchase = goods.reduce((sum, good) => sum + good.total, 0);
    const totalPayment = payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0);

    return {
      name,
      lastProduct: latestGood?.title ?? '',
      lastPayment: latestPayment,
      totalPurchase,
      totalPayment,
      balance: totalPurchase - totalPayment,
    };
  });
}

function buildCustomerCurrents(sales) {
  const map = new Map();
  sales.filter((sale) => sale.creditAmount > 0).forEach((sale) => {
    const key = `${sale.customerName}-${sale.customerPhone}`;
    const current = map.get(key) ?? {
      customerName: sale.customerName,
      customerPhone: sale.customerPhone,
      balance: 0,
      count: 0,
    };
    current.balance += toNumber(sale.creditAmount);
    current.count += 1;
    map.set(key, current);
  });
  return [...map.values()].sort((a, b) => b.balance - a.balance);
}

function buildQueryRecords(data) {
  const deviceRecords = data.devices.map((device) => ({
    source: 'Cihaz Stok',
    barcode: device.barcode,
    productName: deviceTitle(device),
    brand: device.brand,
    model: device.model,
    category: device.type,
    sellerCompany: device.sellerCompany,
    sellerPerson: device.sellerPerson,
    sellerPhone: device.sellerPhone,
    customerName: '',
    customerPhone: '',
    phone: device.sellerPhone,
    stock: device.stock,
    salePrice: device.salePrice,
  }));
  const accessoryRecords = data.accessories.map((accessory) => ({
    source: 'Aksesuar Stok',
    barcode: accessory.barcode,
    productName: accessory.name,
    brand: '',
    model: accessory.modelCompatibility,
    category: accessory.categoryName,
    sellerCompany: accessory.sellerCompany,
    sellerPerson: '',
    sellerPhone: '',
    customerName: '',
    customerPhone: '',
    phone: '',
    stock: accessory.stock,
    salePrice: accessory.salePrice,
  }));
  const saleRecords = data.sales.map((sale) => ({
    source: 'Satış',
    barcode: sale.barcode,
    productName: sale.productName,
    brand: '',
    model: sale.productName,
    category: sale.saleType,
    sellerCompany: sale.sellerCompany,
    sellerPerson: sale.sellerPerson,
    sellerPhone: '',
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    phone: sale.customerPhone,
    stock: '',
    saleTotal: sale.saleTotal,
  }));
  return [...deviceRecords, ...accessoryRecords, ...saleRecords];
}

function summarizeSales(sales) {
  return sales.reduce((total, sale) => ({
    cash: total.cash + toNumber(sale.cashAmount),
    card: total.card + toNumber(sale.cardAmount),
    credit: total.credit + toNumber(sale.creditAmount),
    sale: total.sale + toNumber(sale.saleTotal),
    purchase: total.purchase + toNumber(sale.purchaseTotal),
    profit: total.profit + toNumber(sale.profit),
  }), {
    cash: 0,
    card: 0,
    credit: 0,
    sale: 0,
    purchase: 0,
    profit: 0,
  });
}

function ensureCompany(companies, name) {
  const cleanName = name.trim();
  if (!cleanName) return companies;
  if (companies.some((company) => normalize(company.name) === normalize(cleanName))) return companies;
  return [...companies, { id: uid('firm'), name: cleanName, createdAt: new Date().toISOString() }];
}

function deviceTitle(device) {
  return [device.brand, device.model, device.memory && device.memory !== 'Yok' ? device.memory : '']
    .filter(Boolean)
    .join(' ');
}

function formatMoney(value) {
  return moneyFormatter.format(toNumber(value));
}

function formatDate(value) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat('tr-TR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function localDateKey(value) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
}

function normalize(value) {
  return String(value ?? '').trim().toLocaleLowerCase('tr-TR');
}

function toNumber(value) {
  return Number(value || 0);
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function slugId(prefix, value) {
  return `${prefix}-${normalize(value)
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}

export default App;
