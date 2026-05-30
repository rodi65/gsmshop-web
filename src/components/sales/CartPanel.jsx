import React from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

function normalizeDisplayText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeProductTypeLabel(value) {
  const text = normalizeDisplayText(value);
  const lower = text.toLocaleLowerCase("tr-TR");
  if (["accessory", "aksesuar", "aksesauar"].includes(lower)) return "Aksesuar";
  if (["phone", "telefon", "cihaz"].includes(lower)) return "Telefon";
  if (["service", "program / hizmet", "hizmet"].includes(lower)) return "Hizmet";
  return text;
}

function compactProductName(value, fallback = "Ürün") {
  const text = normalizeDisplayText(value);
  if (!text) return fallback;
  const parts = text
    .split(" / ")
    .map((part) => normalizeDisplayText(part))
    .filter(Boolean);
  if (parts.length <= 1) return text;

  const half = parts.length / 2;
  if (Number.isInteger(half)) {
    const left = parts.slice(0, half).join(" / ").toLocaleLowerCase("tr-TR");
    const right = parts.slice(half).join(" / ").toLocaleLowerCase("tr-TR");
    if (left === right) return parts.slice(0, half).join(" / ");
  }

  return parts.filter((part, index) => {
    const normalized = part.toLocaleLowerCase("tr-TR");
    return parts.findIndex((candidate) => candidate.toLocaleLowerCase("tr-TR") === normalized) === index;
  }).join(" / ");
}

export function CartItemRow({ item, index, money, onUpdate, onRemove }) {
  const cashAmount = Number(item.cashAmountAtAdd || 0);
  const cardAmount = Number(item.cardAmountAtAdd || 0);
  const cariAmount = Number(item.cariAmountAtAdd || 0);
  const maxQuantity = Number.isFinite(Number(item.stockAvailable)) ? Number(item.stockAvailable) : 999999;
  const canDecrease = Number(item.quantity || 0) > 1;
  const canIncrease = item.productType === "service" || Number(item.quantity || 0) < maxQuantity;
  const displayName = compactProductName(item.productName);
  const typeLabel = normalizeProductTypeLabel(item.productTypeLabel);
  const details = [typeLabel, item.imei ? `IMEI: ${item.imei}` : item.barcode ? `Barkod: ${item.barcode}` : ""].filter(Boolean).join(" • ");

  return (
    <article className="cart-checkout-item-card">
      <div className="cart-checkout-item-main">
        <div className="cart-product-title-line">
          <span className="cart-product-index">{index + 1}</span>
          <strong title={item.productName}>{displayName}</strong>
        </div>
        {details && <small>{details}</small>}
      </div>

      <div className="cart-checkout-item-side">
        <div className="cart-table-amount">
          <span>Satış fiyatı</span>
          <b>{money(item.lineTotal)}</b>
        </div>
        <div className="cart-row-controls">
          <div className="cart-qty-control" aria-label="Adet">
            <button type="button" className="cart-icon-btn" disabled={!canDecrease} onClick={() => onUpdate(item.cartItemId, { quantity: Math.max(Number(item.quantity || 1) - 1, 1) })}>
              <Minus size={16} />
            </button>
            <input
              type="number"
              min="1"
              max={item.productType === "service" ? undefined : maxQuantity}
              value={item.quantity}
              onChange={(event) => onUpdate(item.cartItemId, { quantity: Number(event.target.value || 1) })}
            />
            <button type="button" className="cart-icon-btn" disabled={!canIncrease} onClick={() => onUpdate(item.cartItemId, { quantity: Number(item.quantity || 1) + 1 })}>
              <Plus size={16} />
            </button>
          </div>
          <button type="button" className="cart-icon-btn danger" onClick={() => onRemove(item.cartItemId)} aria-label="Sepetten sil">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function CartSummary({ summary, money }) {
  return (
    <div className="cart-summary-box">
      <div><span>Ara Toplam</span><b>{money(summary.grossTotal)}</b></div>
      <div><span>İndirim</span><b>{money(summary.totalDiscount)}</b></div>
      <div><span>Net Toplam</span><b>{money(summary.netTotal)}</b></div>
      <div className={Number(summary.totalProfit || 0) < 0 ? "loss" : "profit"}><span>Kar</span><b>{money(summary.totalProfit)}</b></div>
    </div>
  );
}

export function CartPaymentBox({
  payments,
  customer,
  bankName,
  bankOptions,
  paymentGap,
  money,
  onPaymentChange,
  onCustomerChange,
  onBankChange,
  onSetFullPayment,
}) {
  const paymentNumber = (value) => Number(String(value || "0").replace(/\./g, "").replace(/,/g, "").replace(/TL/g, "").replace(/₺/g, "").replace(/\s/g, "")) || 0;
  const hasCardPayment = paymentNumber(payments.cardAmount) + paymentNumber(payments.bankAmount) > 0;
  const gapTone = paymentGap > 0 ? "remaining" : "overpaid";

  return (
    <div className="cart-payment-box cart-final-payment-box">
      <div className="cart-payment-heading">
        <strong>Ödeme bilgileri</strong>
        <span>Parçalı ödeme girebilirsin; kalan tutarı cariye aktar.</span>
      </div>
      <div className="payment-box cart-final-payment-grid">
        <label className="cart-payment-customer-field">
          <span>Müşteri / Cari</span>
          <input list="cart-customer-list" value={customer.customerName || ""} onChange={(event) => onCustomerChange(event.target.value)} placeholder="Müşteri adı veya cari kişi" />
        </label>
        <label className="cart-payment-cash-field">
          <span>Nakit</span>
          <input inputMode="numeric" value={payments.cashAmount} onChange={(event) => onPaymentChange("cashAmount", event.target.value)} placeholder="0" />
        </label>
        <label className="cart-payment-card-field">
          <span>Kart / POS</span>
          <input inputMode="numeric" value={payments.cardAmount} onChange={(event) => onPaymentChange("cardAmount", event.target.value)} placeholder="0" />
        </label>
        <label className="cart-payment-bank-field">
          <span>Banka</span>
          <select value={bankName || ""} disabled={!hasCardPayment} onChange={(event) => onBankChange(event.target.value)}>
            <option value="">{hasCardPayment ? "Banka seç" : "Kart yok"}</option>
            {bankOptions.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
            <option value="__add_bank__">+ Banka Ekle</option>
          </select>
        </label>
        <label className="cart-payment-cari-field">
          <span>Kalan / Cari</span>
          <input inputMode="numeric" value={payments.cariAmount} onChange={(event) => onPaymentChange("cariAmount", event.target.value)} placeholder="0" />
        </label>
      </div>

      <div className="cart-payment-actions cart-payment-quick-actions" aria-label="Hızlı ödeme doldur">
        <span>Hızlı doldur</span>
        <button type="button" onClick={() => onSetFullPayment("cash")}>Hepsi nakit</button>
        <button type="button" onClick={() => onSetFullPayment("card")}>Hepsi kart</button>
        <button type="button" onClick={() => onSetFullPayment("cari")}>Hepsi cari</button>
      </div>

      {paymentGap !== 0 && (
        <div className={`cart-payment-gap ${gapTone}`}>
          <span>{paymentGap > 0 ? "Eksik / cariye aktarılacak kalan" : "Fazla ödeme"}</span>
          <b>{money(Math.abs(paymentGap))}</b>
          {paymentGap > 0 ? (
            <button type="button" onClick={() => onPaymentChange("cariAmount", String(paymentNumber(payments.cariAmount) + paymentGap))}>
              Kalanı cariye yaz
            </button>
          ) : (
            <button type="button" onClick={() => onPaymentChange("cariAmount", String(Math.max(paymentNumber(payments.cariAmount) - Math.abs(paymentGap), 0)))}>
              Fazlayı düzelt
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CartPanel({
  items,
  summary,
  payments,
  customer,
  note,
  bankName,
  bankOptions,
  processing,
  money,
  paymentGap,
  onUpdateItem,
  onRemoveItem,
  onClear,
  onPaymentChange,
  onCustomerChange,
  onBankChange,
  onNoteChange,
  onSetFullPayment,
  onCheckout,
}) {
  const paymentNumber = (value) => Number(String(value || "0").replace(/\./g, "").replace(/,/g, "").replace(/TL/g, "").replace(/₺/g, "").replace(/\s/g, "")) || 0;
  const cardTotal = paymentNumber(payments.cardAmount) + paymentNumber(payments.bankAmount);
  const cariTotal = paymentNumber(payments.cariAmount);
  const cashTotal = paymentNumber(payments.cashAmount);

  return (
    <aside className="card pad kasa-cart cart-panel">
      <div className="top-line cart-top-line">
        <h2>Satış Sepeti</h2>
        <button type="button" className="cart-clear-btn" disabled={!items.length || processing} onClick={onClear}>Temizle</button>
      </div>

      <div className="cart-section-label"><strong>Sepetteki ürünler</strong><span>{items.length} kalem</span></div>
      <div className="cart-checkout-list" aria-label="Sepetteki ürünler">
        {items.length ? items.map((item, index) => (
          <CartItemRow
            key={item.cartItemId}
            item={item}
            index={index}
            money={money}
            onUpdate={onUpdateItem}
            onRemove={onRemoveItem}
          />
        )) : (
          <div className="cart-empty-state">
            <ShoppingCart size={26} />
            <strong>Sepet boş.</strong>
            <span>Ürün ara veya hızlı satıştan ekle.</span>
          </div>
        )}
      </div>

      <div className="cart-section-label totals"><strong>Toplamlar</strong><span>Ödeme dağılımı</span></div>
      <div className="cart-final-summary" aria-label="Sepet toplam özeti">
        <div className="cart-final-summary-row compact"><span>Nakit Toplamı</span><b>{money(cashTotal)}</b></div>
        <div className="cart-final-summary-row"><span>Kart Toplamı</span><b>{money(cardTotal)}</b></div>
        <div className="cart-final-summary-row"><span>Cari Toplamı</span><b>{money(cariTotal)}</b></div>
        <div className="cart-final-summary-row total"><span>Sepet Toplam Tutarı</span><b>{money(summary.netTotal)}</b></div>
      </div>

      <CartPaymentBox
        payments={payments}
        customer={customer}
        bankName={bankName}
        bankOptions={bankOptions}
        paymentGap={paymentGap}
        money={money}
        onPaymentChange={onPaymentChange}
        onCustomerChange={onCustomerChange}
        onBankChange={onBankChange}
        onSetFullPayment={onSetFullPayment}
      />

      <textarea className="cart-note" placeholder="Satış notu" value={note} onChange={(event) => onNoteChange(event.target.value)} />

      <div className="cart-footer-actions">
        <div className="cart-checkout-helper">Müşteri/cari, banka ve parçalı ödeme kontrolünden sonra işlemi bitir.</div>
        <button type="button" className="primary cart-checkout-btn" disabled={!items.length || processing} onClick={onCheckout}>
          {processing ? "İşleniyor..." : "Satış işlemini bitir"}
        </button>
      </div>
    </aside>
  );
}
