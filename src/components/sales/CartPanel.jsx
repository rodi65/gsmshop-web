import React from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";

export function CartItemRow({ item, money, onUpdate, onRemove }) {
  const maxQuantity = Number.isFinite(Number(item.stockAvailable)) ? Number(item.stockAvailable) : 999999;
  const canDecrease = Number(item.quantity || 0) > 1;
  const canIncrease = item.productType === "service" || Number(item.quantity || 0) < maxQuantity;

  return (
    <div className="cart-item-row">
      <div className="cart-item-main">
        <div>
          <strong>{item.productName}</strong>
          <small>{item.productTypeLabel}{item.imei ? ` • IMEI: ${item.imei}` : ""}</small>
        </div>
        <button type="button" className="cart-icon-btn danger" onClick={() => onRemove(item.cartItemId)} aria-label="Sepetten sil">
          <Trash2 size={15} />
        </button>
      </div>

      <div className="cart-item-controls">
        <div className="cart-qty-control">
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

        <input
          className="cart-money-input"
          inputMode="numeric"
          value={item.unitPriceText}
          onChange={(event) => onUpdate(item.cartItemId, { unitPriceText: event.target.value })}
          onBlur={() => onUpdate(item.cartItemId, { formatUnitPrice: true })}
          aria-label="Birim fiyat"
        />
        <input
          className="cart-money-input"
          inputMode="numeric"
          value={item.discountText}
          onChange={(event) => onUpdate(item.cartItemId, { discountText: event.target.value })}
          onBlur={() => onUpdate(item.cartItemId, { formatDiscount: true })}
          aria-label="İndirim"
        />
      </div>

      <div className="cart-item-totals">
        <span>Toplam <b>{money(item.lineTotal)}</b></span>
        <span className={Number(item.lineProfit || 0) < 0 ? "loss" : "profit"}>Kar <b>{money(item.lineProfit)}</b></span>
      </div>
      {item.note && <small className="cart-item-note">{item.note}</small>}
    </div>
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
  return (
    <div className="cart-payment-box">
      <div className="cart-payment-actions">
        <button type="button" onClick={() => onSetFullPayment("cash")}>Tamamı Nakit</button>
        <button type="button" onClick={() => onSetFullPayment("card")}>Tamamı Kart</button>
        <button type="button" onClick={() => onSetFullPayment("cari")}>Tamamı Cari</button>
      </div>

      <div className="cart-payment-grid">
        <input inputMode="numeric" placeholder="Nakit" value={payments.cashAmount} onChange={(event) => onPaymentChange("cashAmount", event.target.value)} />
        <input inputMode="numeric" placeholder="Kart / POS" value={payments.cardAmount} onChange={(event) => onPaymentChange("cardAmount", event.target.value)} />
        <input inputMode="numeric" placeholder="Banka" value={payments.bankAmount} onChange={(event) => onPaymentChange("bankAmount", event.target.value)} />
        <input inputMode="numeric" placeholder="Cari kalan" value={payments.cariAmount} onChange={(event) => onPaymentChange("cariAmount", event.target.value)} />
      </div>

      <select value={bankName} onChange={(event) => onBankChange(event.target.value)}>
        <option value="">Banka / POS seç</option>
        {bankOptions.map((bank) => <option key={bank} value={bank}>{bank}</option>)}
        <option value="__add_bank__">+ Banka Ekle</option>
      </select>

      <input
        list="cart-customer-list"
        placeholder="Müşteri / cari kişi"
        value={customer.customerName}
        onChange={(event) => onCustomerChange(event.target.value)}
      />

      <div className={paymentGap === 0 ? "cart-payment-gap ok" : "cart-payment-gap"}>
        <span>Ödeme farkı</span>
        <b>{money(paymentGap)}</b>
      </div>
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
      <div className="cart-panel-header">
        <div>
          <h2><ShoppingCart size={18} /> SATIŞ SEPETİ</h2>
          <p>{items.length ? `${summary.totalQuantity} ürün / kalem` : "Sepet boş"}</p>
        </div>
        <span className="cart-count-badge">{items.length}</span>
      </div>

      <div className="cart-items-list">
        {items.length ? items.map((item) => (
          <CartItemRow
            key={item.cartItemId}
            item={item}
            money={money}
            onUpdate={onUpdateItem}
            onRemove={onRemoveItem}
          />
        )) : (
          <div className="cart-empty-state">
            <ShoppingCart size={30} />
            <strong>Sepet boş.</strong>
            <span>Ürün ara, barkod/IMEI seç veya hızlı satıştan sepete ekle.</span>
          </div>
        )}
      </div>

      <CartSummary summary={summary} money={money} />

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

      <textarea
        className="cart-note"
        placeholder="Satış notu"
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
      />

      <div className="cart-footer-actions">
        <button type="button" className="choice" disabled={!items.length || processing} onClick={onClear}>Sepeti Temizle</button>
        <button type="button" className="primary cart-checkout-btn" disabled={!items.length || processing} onClick={onCheckout}>
          {processing ? "İşleniyor..." : "Satışı Tamamla"}
        </button>
      </div>
    </aside>
  );
}
