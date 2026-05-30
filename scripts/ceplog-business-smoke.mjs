import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "AGENTS.md",
  "CEPLOG_BUSINESS_RULES.md",
  "src/lib/business/transactionTypes.ts",
  "src/lib/business/businessRules.ts",
  "src/lib/business/transactionEngine.ts",
  "src/lib/business/ledger.ts",
  "src/lib/business/reconciliation.ts",
  "src/lib/business/audit.ts",
  "src/lib/business/money.ts",
  "src/lib/business/errors.ts",
  "src/lib/business/idempotency.ts",
  "supabase/ceplog_business_ledger_foundation_20260529.sql",
  "supabase/ceplog_business_transaction_rpcs_20260529.sql",
  "supabase/technical_service_transactions_20260529.sql",
];

const requiredRpcNames = [
  "ceplog_apply_sale_transaction",
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
  read("supabase/technical_service_transactions_20260529.sql"),
].join("\n");
const foundationSql = read("supabase/ceplog_business_ledger_foundation_20260529.sql");
const dataService = read("src/services/dataService.js");
const app = read("src/App.jsx");
const cartPanel = read("src/components/sales/CartPanel.jsx");
const transactionEngine = read("src/lib/business/transactionEngine.ts");
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
assert(app.includes("Bu adımda sadece ürün, adet ve satış fiyatı hazırlanır"), "Ürün satırı popup ödeme bilgisinden ayrılmalı.");
assert(app.includes("saleLineQuantity") && app.includes("saleLineSubtotal"), "Ürün satırı popup adet ve satır toplamı hesaplamalı.");
assert(cartPanel.includes("Müşteri / Cari") && cartPanel.includes("Kalan / Cari") && cartPanel.includes("Banka"), "Müşteri/banka/nakit/kart/cari girişleri final ödeme ekranında olmalı.");
assert(cartPanel.includes("Satış işlemini bitir"), "Sepet bitirme butonu istenen metinle görünmeli.");
assert(cartPanel.includes("cart-final-summary"), "Sepet onay ekranı final toplam özetini göstermeli.");
assert(cartPanel.includes("cart-checkout-list"), "Sepet ürünleri final ekranda okunur kart/listede gösterilmeli.");
assert(cartPanel.includes("displayCartProductName"), "Sepette tekrar eden ürün adları UI tarafında sadeleştirilmeli.");
assert(cartPanel.includes("displayCartCategory"), "Sepette kategori/aksesuar etiketi normalize edilmeli.");
assert(cartPanel.includes("Hızlı doldur"), "Tamamı ödeme seçenekleri küçük yardımcı hızlı doldur alanı olmalı.");
assert(cartPanel.includes("Kart Toplamı") && cartPanel.includes("Cari Toplamı") && cartPanel.includes("Sepet Toplam Tutarı"), "Sepet özeti kart/cari/toplam sırasını göstermeli.");
assert(app.includes("cartEffectivePayments"), "Sepet tamamlamada etkin ödeme toplamları kullanılmalı.");
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
