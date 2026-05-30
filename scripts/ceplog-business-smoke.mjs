import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "AGENTS.md",
  "CEPLOG_BUSINESS_RULES.md",
  "src/lib/business/transactionTypes.ts",
  "src/lib/business/businessRules.ts",
  "src/lib/business/transactionEngine.ts",
  "src/lib/business/cartSaleEngine.ts",
  "src/lib/business/ledger.ts",
  "src/lib/business/reconciliation.ts",
  "src/lib/business/audit.ts",
  "src/lib/business/money.ts",
  "src/lib/business/errors.ts",
  "src/lib/business/idempotency.ts",
  "supabase/ceplog_business_ledger_foundation_20260529.sql",
  "supabase/ceplog_business_transaction_rpcs_20260529.sql",
  "supabase/cart_sale_transaction_rpc_20260529.sql",
  "supabase/migrations/202605300001_cart_sale_transaction_rpc.sql",
  "supabase/technical_service_transactions_20260529.sql",
];

const requiredRpcNames = [
  "ceplog_apply_sale_transaction",
  "ceplog_apply_cart_sale_transaction",
  "ceplog_record_collection_transaction",
  "ceplog_record_expense_transaction",
  "ceplog_cancel_sale_transaction",
  "ceplog_return_sale_transaction",
  "ceplog_cancel_stock_purchase_transaction",
  "ceplog_record_stock_purchase_transaction",
  "ceplog_record_manual_stock_adjustment",
  "ceplog_record_cash_movement_transaction",
  "ceplog_record_technical_service_transaction",
  "ceplog_record_technical_service_finance_transaction",
];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const file of requiredFiles) {
  assert(fs.existsSync(path.join(root, file)), `Eksik dosya: ${file}`);
}

const rpcSql = [
  read("supabase/ceplog_business_transaction_rpcs_20260529.sql"),
  read("supabase/cart_sale_transaction_rpc_20260529.sql"),
  read("supabase/migrations/202605300001_cart_sale_transaction_rpc.sql"),
  read("supabase/technical_service_transactions_20260529.sql"),
].join("\n");
const foundationSql = read("supabase/ceplog_business_ledger_foundation_20260529.sql");
const dataService = read("src/services/dataService.js");
const app = read("src/App.jsx");
const cartPanel = read("src/components/sales/CartPanel.jsx");
const style = read("src/style.css");
const transactionEngine = read("src/lib/business/transactionEngine.ts");
const cartSaleEngine = read("src/lib/business/cartSaleEngine.ts");
const reconciliation = read("src/lib/business/reconciliation.ts");

for (const rpcName of requiredRpcNames) {
  assert(rpcSql.includes(rpcName), `RPC SQL içinde eksik: ${rpcName}`);
  assert(dataService.includes(rpcName) || transactionEngine.includes(rpcName), `Kod bağlantısında eksik: ${rpcName}`);
}

const forbiddenSql = [
  /\bdrop\s+table\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
];

for (const pattern of forbiddenSql) {
  assert(!pattern.test(rpcSql), `RPC SQL tehlikeli ifade içeriyor: ${pattern}`);
  assert(!pattern.test(foundationSql), `Foundation SQL tehlikeli ifade içeriyor: ${pattern}`);
}

assert(reconciliation.includes("runReadOnlyReconciliation"), "Read-only reconciliation export eksik.");
assert(dataService.includes("callBusinessTransactionRpc"), "dataService merkezi RPC çağrı helper'ı eksik.");

assert(/customerText\s*=\s*String\([\s\S]*customerName[\s\S]*cariPerson/.test(read("src/lib/business/businessRules.ts")), "Cari satış müşteri doğrulaması isim/cari fallback kabul etmeli.");
assert(app.includes("customerId: cartCustomerId || cartCustomerName || null"), "Sepet cari tamamlamada müşteri adı customerId fallback olarak iletilmeli.");
assert(app.includes("customerName: cartCustomerName"), "Sepet satış payload müşteri adını camelCase taşımalı.");
assert(app.includes("cariPerson: cartCustomerName"), "Sepet satış payload cari kişiyi camelCase taşımalı.");
assert(app.includes("Ürün Satırını Tamamla"), "SOR SAT sonrası ürün satırı tamamlama penceresi bulunmalı.");
assert(app.includes("sale-line-primary-actions"), "Ürün satırı birincil aksiyonları yan yana ayrılmalı.");
assert(app.includes("SOR SAT’a Geri Dön"), "Ürün satırı modalında SOR SAT’a geri dönüş aksiyonu bulunmalı.");
assert(app.includes("Bu adımda sadece ürün, adet ve satış fiyatı hazırlanır"), "Ürün satırı popup ödeme bilgisinden ayrılmalı.");
assert(app.includes("saleLineQuantity") && app.includes("saleLineSubtotal"), "Ürün satırı popup adet ve satır toplamı hesaplamalı.");
assert(cartPanel.includes("Müşteri / Cari") && cartPanel.includes("Kalan / Cari") && cartPanel.includes("Banka"), "Müşteri/banka/nakit/kart/cari girişleri final ödeme ekranında olmalı.");
assert(cartPanel.includes("Satış işlemini bitir"), "Sepet bitirme butonu istenen metinle görünmeli.");
assert(cartPanel.includes("cart-final-summary"), "Sepet onay ekranı final toplam özetini göstermeli.");
assert(cartPanel.includes("cart-checkout-list"), "Sepet ürünleri final ekranda okunur kart/listede gösterilmeli.");
assert(cartPanel.includes("compactProductName") && cartPanel.includes("normalizeProductTypeLabel"), "Sepet ürün adları ve kategori etiketleri temizlenmeli.");
assert(cartPanel.includes("cart-payment-quick-actions"), "Tamamı ödeme kısayolları ikincil kompakt alanda kalmalı.");
assert(!cartPanel.includes("Ödeme Bilgileri") && cartPanel.includes("Ödeme dengede"), "Final ödeme alanı gereksiz Ödeme Bilgileri başlığını göstermemeli.");
assert(cartPanel.includes("cart-top-subtitle") && !cartPanel.includes("Adet ve fiyatı sağdan düzenle") && !cartPanel.includes("Hızlı doldur"), "Sepet paneli gereksiz ürün ve hızlı doldur başlıklarını göstermemeli.");
assert(cartPanel.includes("Kart Toplamı") && cartPanel.includes("Cari Toplamı") && cartPanel.includes("Sepet Toplam Tutarı"), "Sepet özeti kart/cari/toplam sırasını göstermeli.");
assert(style.includes("Payment visibility fix") && style.includes("visibility: visible !important") && style.includes(".cart-note") && style.includes("display: none !important"), "Sepet ödeme inputları küçük popup içinde görünür kalmalı.");
assert(cartPanel.includes("cart-header-actions") && cartPanel.includes("cart-close-btn"), "Sepet başlığı temizle ve kapat aksiyonlarını tek satırda taşımalı.");
assert(style.includes("Cart popup header/flow pass") && style.includes(".cart-header-actions") && style.includes(".cart-close-btn"), "Sepet popup başlık ve ödeme akışı kompakt final stile sahip olmalı.");
assert(style.includes("Cart list gap fix") && style.includes("grid-template-rows: auto auto auto auto auto") && style.includes(":has(.cart-checkout-item-card:nth-of-type(2))"), "Sepet ürün listesi altında gereksiz boşluk bırakmamalı.");
assert(style.includes("Zero cart section gap") && style.includes("row-gap: 0 !important") && style.includes("transform: translateY(-1px)"), "Sepet ürün listesi ve toplamlar arasındaki boşluk sıfırlanmalı.");
assert(style.includes("Cart gap only fix") && style.includes(".cart-summary-label") && style.includes("height: 0 !important"), "Sepet ürün listesi ile toplamlar arasındaki yardımcı satır boşluğu gizlenmeli.");
assert(cartPanel.includes("cart-payment-status-only") && style.includes("Merge cart sections") && style.includes("cart-payment-status-only"), "Sepet ödeme başlığı kaldırılıp durum rozeti kompakt kalmalı.");
assert(style.includes("width: min(620px") && style.includes(".cart-final-payment-grid label:first-child"), "Sepet popup dar ve ödeme alanları iki satırlı okunur düzene alınmalı.");
assert(!app.includes("Düzeni Düzenle") && !app.includes("ceplog_dashboard_layout_v1"), "Dashboard düzenleme modu kaldırılmış olmalı.");
assert(app.includes("quick-action-cart-btn") && style.includes("quick-action-cart-btn"), "Sepeti Aç butonu KASA KAPATMA ile aynı hızlı işlem satırına taşınmalı.");
assert(style.includes("Kasa dashboard final yerleşim") && style.includes("Kasa özet kartları görünürlük düzeltmesi") && style.includes("Kasa yatay butonlar ve uzun Kart/Cari kartı") && style.includes("grid-template-rows: 188px minmax(330px, auto)") && style.includes("flex-wrap: nowrap"), "Ana Kasa dashboard butonları yatay okunur ve Kart/Cari kartı uzun görünür kalmalı.");
assert(app.includes("cartEffectivePayments"), "Sepet tamamlamada etkin ödeme toplamları kullanılmalı.");
assert(app.includes("total_amount: cartTotalAmount") && app.includes("line_total: Number(item.lineTotal || 0)"), "Sepet satış payload'u RPC uyumlu snake_case toplam ve satır tutarı taşımalı.");
assert(app.includes("cash_amount: cartCashAmount") && app.includes("card_amount: cartCardAmount") && app.includes("cari_amount: cartCariAmount"), "Sepet ödeme payload'u RPC uyumlu snake_case ödeme alanları taşımalı.");
assert(app.includes("cart_sale_transaction_rpc_20260529.sql migration") || app.includes("Sepet satış motoru veritabanında kurulu görünmüyor"), "Eksik sepet RPC hatası kullanıcıya migration sebebiyle açıklanmalı.");
assert(cartSaleEngine.includes("normalizeCartSalePayload") && cartSaleEngine.includes("validateCartSale"), "Kasa Beyni cart sale normalize/validate motoru bulunmalı.");
assert(cartSaleEngine.includes("saleTotal") && cartSaleEngine.includes("paymentTotal") && cartSaleEngine.includes("INVALID_ITEM_PRICE"), "Cart sale motoru toplam ve fiyat validasyonlarını içermeli.");
assert(cartSaleEngine.includes("MISSING_BANK") && cartSaleEngine.includes("MissingCustomerError") && cartSaleEngine.includes("INVALID_PAYMENT_AMOUNT"), "Cart sale motoru banka/cari/negatif ödeme kontrollerini içermeli.");
assert(transactionEngine.includes("normalizeCartSalePayload") && transactionEngine.includes("validateCartSale"), "Transaction engine cart sale motorundan geçmeli.");
assert(transactionEngine.includes("totalQuantity") && transactionEngine.includes("totalQuantity > 1"), "Tek satırda adetli sepet satışları da cart transaction yoluna girmeli.");
assert(app.includes("createCartSalePayload") && app.includes('console.debug("CEPLOG cartSalePayload"'), "UI standart cartSalePayload oluşturup debug bilgisini sadece console'a yazmalı.");
assert(app.includes("completeCartSaleWithSingleRpcFallback") && app.includes("cart_rpc_single_sale_fallback"), "Eksik cart RPC durumunda çoklu sepet, tekli satış RPC fallback akışıyla bloklanmamalı.");
assert(dataService.includes("ceplog_apply_sale_transaction"), "Satış transaction RPC bağlantısı eksik.");
assert(dataService.includes("ceplog_record_stock_purchase_transaction"), "Alış transaction RPC bağlantısı eksik.");
assert(dataService.includes("ceplog_record_expense_transaction"), "Gider transaction RPC bağlantısı eksik.");
assert(dataService.includes("ceplog_record_collection_transaction"), "Tahsilat transaction RPC bağlantısı eksik.");
assert(dataService.includes("ceplog_record_cash_movement_transaction"), "Kasa hareketi transaction RPC bağlantısı eksik.");
assert(dataService.includes("Banka hareketi doğrudan yazılamaz"), "Direkt banka hareketi yazımı kapalı olmalı.");
assert(dataService.includes("Otomatik stok finans onarımı kapalıdır"), "Otomatik stok finans onarımı kapalı olmalı.");
assert(dataService.includes("doğrudan silinemez"), "Genel soft delete kritik kayıtlarda kapalı olmalı.");
assert(!app.includes("<StockEditModal"), "Stok ekranında düzenleme modalı görünür durumda kalmamalı.");
assert(!app.includes("repairStockSideEffects(data.stock"), "Veri yükleme sırasında otomatik finansal onarım çalışmamalı.");

console.log("CEPLOG business smoke test passed.");
