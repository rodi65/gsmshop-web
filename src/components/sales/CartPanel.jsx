import React from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

export function CartItemRow({ item, money, onUpdate, onRemove }) {
  const cashAmount = Number(item.cashAmountAtAdd || 0);
  const cardAmount = Number(item.cardAmountAtAdd || 0);
  const cariAmount = Number(item.cariAmountAtAdd || 0);
  const maxQuantity = Number.isFinite(Number(item.stockAvailable)) ? Number(item.stockAvailable) : 999999;
  const canDecrease = Number(item.quantity || 0) > 1;
  const canIncrease = item.productType === "service" || Number(item.quantity || 0) < maxQuantity;

  return (
    <tr className="cart-item-row">
      <td>
        <div className="cart-table-product">
          <div className="cart-product-head">
            <strong>{item.productName}</strong>
            <div className="cart-row-controls">
              <div className="cart-qty-control" aria-label="Adet">
                <button type="button" className="cart-icon-btn" disabled={!canDecrease} onClick={() => onUpdate(item.cartItemId, { quantity: Math.max(Number(item.quantity || 1) - 1, 1) })}>
                  <Minus size={14} />
                </button>
                <input
                  type="number"
                  min="1"
                  max={item.productType === "service" ? undefined : maxQuantity}
                  value={item.quantity}
                  onChange={(event) => onUpdate(item.cartItemId, { quantity: Number(event.target.value || 1) })}
                />
                <button type="button" className="cart-icon-btn" disabled={!canIncrease} onClick={() => onUpdate(item.cartItemId, { quantity: Number(item.quantity || 1) + 1 })}>
                  <Plus size={14} />
                </button>
              </div>
              <button type="button" className="cart-icon-btn danger" onClick={() => onRemove(item.cartItemId)} aria-label="Sepetten sil">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <small>{item.productTypeLabel}{item.imei ? ` • IMEI: ${item.imei}` : ""}</small>
          <div className="cart-line-payment-split" aria-label="Satır ödeme dağılımı">
            <span>Nakit <b>{money(cashAmount)}</b></span>
            <span>Kart <b>{money(cardAmount)}</b></span>
            <span>Cari <b>{money(cariAmount)}</b></span>
          </div>
        </div>
      </td>
      <td>
        <div className="cart-table-amount">
          <b>{money(item.lineTotal)}</b>
          <span className={Number(item.lineProfit || 0) < 0 ? "loss" : "profit"}>{money(item.lineProfit)}</span>
        </div>
      </td>
    </tr>
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
  const hasCashPayment = paymentNumber(payments.cashAmount) > 0;
  const hasCardPayment = paymentNumber(payments.cardAmount) + paymentNumber(payments.bankAmount) > 0;
  const hasCariPayment = paymentNumber(payments.cariAmount) > 0;
  const hasSessionPayment = hasCashPayment || hasCardPayment || hasCariPayment;
  const gapTone = paymentGap > 0 ? "remaining" : "overpaid";

  return (
    <div className="cart-payment-box">
      {hasSessionPayment ? (
        <div className="cart-payment-session-note" role="status">
          <strong>Ödeme oturumu aktif</strong>
          <span>Nakit, kart, cari ve banka dağılımı ilk satıştan gelen sepet oturumuna göre korunur.</span>
        </div>
      ) : (
        <div className="cart-payment-actions">
          <button type="button" onClick={() => onSetFullPayment("cash")}>Nakit</button>
          <button type="button" onClick={() => onSetFullPayment("card")}>Kart</button>
          <button type="button" onClick={() => onSetFullPayment("cari")}>Cari</button>
        </div>
      )}

      <div className="payment-box">
        <label className={hasSessionPayment ? "session-locked-field" : ""}>
          <span>{hasSessionPayment ? "Toplam Nakit • oturum" : "Nakit"}</span>
          <input inputMode="numeric" value={payments.cashAmount} readOnly={hasSessionPayment} aria-readonly={hasSessionPayment} onChange={(event) => { if (!hasSessionPayment) onPaymentChange("cashAmount", event.target.value); }} />
        </label>
        <label className={hasSessionPayment ? "session-locked-field" : ""}>
          <span>{hasSessionPayment ? "Toplam Kart • oturum" : "Kart"}</span>
          <input inputMode="numeric" value={payments.cardAmount} readOnly={hasSessionPayment} aria-readonly={hasSessionPayment} onChange={(event) => { if (!hasSessionPayment) onPaymentChange("cardAmount", event.target.value); }} />
        </label>
        <label className={hasSessionPayment ? "session-locked-field" : ""}>
          <span>{hasSessionPayment ? "Toplam Cari • oturum" : "Cari"}</span>
          <input inputMode="numeric" value={payments.cariAmount} readOnly={hasSessionPayment} aria-readonly={hasSessionPayment} onChange={(event) => { if (!hasSessionPayment) onPaymentChange("cariAmount", event.target.value); }} />
        </label>
      </div>

      {hasCardPayment && (
        <div className="cart-session-readonly">
          <span>Aktif banka</span>
          <b>{bankName || "Banka / POS seçilmedi"}</b>
        </div>
      )}

      {hasCariPayment && (
        <div className="cart-session-readonly">
          <span>Aktif cari</span>
          <b>{customer.customerName || "Müşteri / cari kişi seçilmedi"}</b>
        </div>
      )}

      {paymentGap !== 0 && (
        <div className={`cart-payment-gap ${gapTone}`}>
          <span>{paymentGap > 0 ? "Cariye aktarılacak kalan" : "Fazla ödeme"}</span>
          <b>{money(Math.abs(paymentGap))}</b>
          {!hasSessionPayment && (paymentGap > 0 ? (
            <button type="button" onClick={() => onPaymentChange("cariAmount", String(paymentNumber(payments.cariAmount) + paymentGap))}>
              Kalanı cariye yaz
            </button>
          ) : (
            <button type="button" onClick={() => onPaymentChange("cariAmount", String(Math.max(paymentNumber(payments.cariAmount) - Math.abs(paymentGap), 0)))}>
              Fazlayı düzelt
            </button>
          ))}
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
  return (
    <aside className="card pad kasa-cart cart-panel">
      <div className="top-line cart-top-line">
        <h2>Satış Sepeti</h2>
        <button type="button" className="cart-clear-btn" disabled={!items.length || processing} onClick={onClear}>Temizle</button>
      </div>

      <div className="cart-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ürün</th>
              <th>Tutar</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? items.map((item) => (
              <CartItemRow
                key={item.cartItemId}
                item={item}
                money={money}
                onUpdate={onUpdateItem}
                onRemove={onRemoveItem}
              />
            )) : (
              <tr>
                <td colSpan="2">
                  <div className="cart-empty-state">
                    <ShoppingCart size={26} />
                    <strong>Sepet boş.</strong>
                    <span>Ürün ara veya hızlı satıştan ekle.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="cart-total">
        <span>Genel Toplam</span>
        <b>{money(summary.netTotal)}</b>
      </div>

      <div className="cart-session-total-grid" aria-label="Sepet ödeme toplamları">
        <div><span>Toplam Nakit</span><b>{money(payments.cashAmount)}</b></div>
        <div><span>Toplam Kart</span><b>{money(payments.cardAmount)}</b></div>
        <div><span>Toplam Cari</span><b>{money(payments.cariAmount)}</b></div>
        <div><span>Aktif Müşteri</span><b>{customer.customerName || "-"}</b></div>
        <div><span>Aktif Banka</span><b>{bankName || "-"}</b></div>
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
        <button type="button" className="primary cart-checkout-btn" disabled={!items.length || processing} onClick={onCheckout}>
          {processing ? "İşleniyor..." : "Satışı Tamamla"}
        </button>
      </div>
    </aside>
  );
}
