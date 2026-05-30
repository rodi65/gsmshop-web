import React from "react";
import { ShoppingCart, Trash2 } from "lucide-react";

export function CartItemRow({ item, money, onRemove }) {
  const cashAmount = Number(item.cashAmountAtAdd || 0);
  const cardAmount = Number(item.cardAmountAtAdd || 0);
  const cariAmount = Number(item.cariAmountAtAdd || 0);

  return (
    <tr className="cart-item-row">
      <td>
        <div className="cart-table-product">
          <div className="cart-product-head">
            <strong>{item.productName}</strong>
            <button type="button" className="cart-icon-btn danger" onClick={() => onRemove(item.cartItemId)} aria-label="Sepetten sil">
              <Trash2 size={18} />
            </button>
          </div>
          <div className="cart-product-meta">
            <span>{item.productTypeLabel}</span>
            {item.imei ? <span>IMEI: {item.imei}</span> : null}
            <span>Adet: {item.quantity}</span>
          </div>
          <div className="cart-line-payment-split" aria-label="Satır ödeme dağılımı">
            <span>Nakit <b>{money(cashAmount)}</b></span>
            <span>Kart <b>{money(cardAmount)}</b></span>
            <span>Cari <b>{money(cariAmount)}</b></span>
          </div>
        </div>
      </td>
      <td>
        <div className="cart-table-amount">
          <span>Satış fiyatı</span>
          <b>{money(item.lineTotal)}</b>
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

      <div className="cart-final-summary" aria-label="Sepet toplam özeti">
        <div className="cart-final-summary-row muted"><span>Nakit Toplamı</span><b>{money(cashTotal)}</b></div>
        <div className="cart-final-summary-row"><span>Kart Toplamı</span><b>{money(cardTotal)}</b></div>
        <div className="cart-final-summary-row"><span>Cari Toplamı</span><b>{money(cariTotal)}</b></div>
        <div className="cart-final-summary-row total"><span>Sepet Toplam Tutarı</span><b>{money(summary.netTotal)}</b></div>
      </div>

      <div className="cart-session-total-grid" aria-label="Sepet müşteri ve banka özeti">
        <div><span>Aktif Müşteri</span><b>{customer.customerName || "-"}</b></div>
        <div><span>Aktif Banka</span><b>{bankName || "-"}</b></div>
      </div>

      {note ? <div className="cart-final-note"><span>Not</span><b>{note}</b></div> : null}

      <div className="cart-footer-actions">
        <button type="button" className="primary cart-checkout-btn" disabled={!items.length || processing} onClick={onCheckout}>
          {processing ? "İşleniyor..." : "ÖDE • Satış işlemini bitir"}
        </button>
      </div>
    </aside>
  );
}
