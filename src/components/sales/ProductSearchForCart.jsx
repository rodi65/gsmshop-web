import React from "react";
import { Plus, Search } from "lucide-react";

export function QuickAddProductButton({ product, money, productTitle, getLastSixBarcode, onAddProduct }) {
  return (
    <button type="button" className="cart-product-result" onClick={() => onAddProduct(product)}>
      <span>
        <strong>{productTitle(product)}</strong>
        <small>{product.module || "-"} • Stok: {product.qty || product.quantity || 0} • {getLastSixBarcode(product)}</small>
      </span>
      <b>{money(product.sell || product.sellPrice || product.sell_price || 0)}</b>
      <Plus size={15} />
    </button>
  );
}

export default function ProductSearchForCart({
  query,
  products,
  money,
  productTitle,
  getLastSixBarcode,
  onQueryChange,
  onAddProduct,
}) {
  return (
    <div className="cart-product-search">
      <label className="cart-search-field">
        <Search size={17} />
        <input
          placeholder="Ürün, barkod veya IMEI ara"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
      </label>

      <div className="cart-product-results">
        {products.length ? products.map((product) => (
          <QuickAddProductButton
            key={product.id}
            product={product}
            money={money}
            productTitle={productTitle}
            getLastSixBarcode={getLastSixBarcode}
            onAddProduct={onAddProduct}
          />
        )) : (
          <div className="cart-product-empty">Arama yapınca stok ürünleri burada görünür.</div>
        )}
      </div>
    </div>
  );
}
