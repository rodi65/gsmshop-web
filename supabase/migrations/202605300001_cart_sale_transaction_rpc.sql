-- CEPLOG cart sale RPC.
-- Safe migration: creates a new function only; no data delete/update is executed here.

create or replace function public.ceplog_apply_cart_sale_transaction(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace text := coalesce(nullif(payload->>'workspace_id', ''), nullif(payload->>'workspaceId', ''));
  v_key text := coalesce(nullif(payload->>'idempotency_key', ''), nullif(payload->>'idempotencyKey', ''));
  v_existing public.business_transactions%rowtype;
  v_tx uuid;
  v_sale public.sales%rowtype;
  v_item jsonb;
  v_stock public.stock_items%rowtype;
  v_stock_id uuid;
  v_product_type text;
  v_product_id text;
  v_product_name text;
  v_imei text;
  v_qty numeric;
  v_unit_cost numeric;
  v_unit_price numeric;
  v_discount numeric;
  v_line_total numeric;
  v_line_profit numeric;
  v_total numeric := 0;
  v_cost_total numeric := 0;
  v_profit_total numeric := 0;
  v_cash numeric := public.ceplog_money_from_text(coalesce(payload #>> '{payments,cash_amount}', payload #>> '{payments,cashAmount}', '0'));
  v_card numeric := public.ceplog_money_from_text(coalesce(payload #>> '{payments,card_amount}', payload #>> '{payments,cardAmount}', '0'));
  v_bank numeric := public.ceplog_money_from_text(coalesce(payload #>> '{payments,bank_amount}', payload #>> '{payments,bankAmount}', '0'));
  v_cari numeric := public.ceplog_money_from_text(coalesce(payload #>> '{payments,cari_amount}', payload #>> '{payments,cariAmount}', '0'));
  v_bank_total numeric;
  v_item_count integer := jsonb_array_length(coalesce(payload->'items', '[]'::jsonb));
begin
  if v_workspace is null then raise exception 'workspace_id zorunludur'; end if;
  if v_key is null then raise exception 'idempotency_key zorunludur'; end if;
  if v_item_count <= 0 then raise exception 'Sepet satisi icin en az bir kalem zorunludur'; end if;

  select * into v_existing from public.business_transactions where workspace_id = v_workspace and idempotency_key = v_key;
  if found then
    return jsonb_build_object('transaction_id', v_existing.id, 'reference_id', v_existing.reference_id, 'status', v_existing.status, 'duplicate', true);
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) as items(value)
  loop
    v_qty := greatest(public.ceplog_money_from_text(coalesce(v_item->>'quantity', '1')), 1);
    v_unit_cost := public.ceplog_money_from_text(coalesce(v_item->>'unit_cost_at_sale', v_item->>'unitCostAtSale', '0'));
    v_unit_price := public.ceplog_money_from_text(coalesce(v_item->>'unit_price_at_sale', v_item->>'unitPriceAtSale', '0'));
    v_discount := public.ceplog_money_from_text(coalesce(v_item->>'discount_amount', v_item->>'discountAmount', '0'));
    v_line_total := public.ceplog_money_from_text(coalesce(v_item->>'line_total', v_item->>'lineTotal', (v_unit_price * v_qty - v_discount)::text));
    v_line_profit := public.ceplog_money_from_text(coalesce(v_item->>'line_profit', v_item->>'lineProfit', (v_line_total - (v_unit_cost * v_qty))::text));

    if v_qty <= 0 then raise exception 'Sepet kalem miktari 0’dan buyuk olmalidir'; end if;
    if v_unit_price < 0 or v_unit_cost < 0 or v_discount < 0 or v_line_total < 0 then raise exception 'Sepet kalem tutarlari negatif olamaz'; end if;

    v_total := v_total + v_line_total;
    v_cost_total := v_cost_total + (v_unit_cost * v_qty);
    v_profit_total := v_profit_total + v_line_profit;
  end loop;

  v_bank_total := v_card + v_bank;

  if v_total <= 0 then raise exception 'Satış tutarı 0’dan büyük olmalıdır'; end if;
  if v_cash + v_bank_total + v_cari <> v_total then raise exception 'Sepet ödeme dağılımı satış toplamına eşit olmalıdır'; end if;
  if v_bank_total > 0 and nullif(trim(coalesce(payload->>'bank_name', '')), '') is null then raise exception 'Kart/Banka satışında banka adı zorunludur'; end if;

  insert into public.business_transactions (workspace_id, transaction_type, idempotency_key, note, metadata, created_by)
  values (v_workspace, 'SALE_MIXED_PAYMENT', v_key, payload->>'note', payload, payload->>'actor_id')
  returning id into v_tx;

  v_product_name := coalesce(nullif(payload->>'product_name', ''), 'Sepet Satışı (' || v_item_count::text || ' kalem)');

  v_sale := public.create_sale_with_effects(
    v_workspace,
    coalesce(nullif(payload->>'sale_group', ''), 'Sepet'),
    coalesce(nullif(payload->>'sale_type', ''), 'Sepet Satışı'),
    null,
    v_product_name,
    coalesce(payload->>'customer_name', ''),
    coalesce(payload->>'customer_phone', ''),
    coalesce(payload->>'cari_person', payload->>'customer_name', ''),
    v_total,
    v_cash,
    v_bank_total,
    v_cari,
    v_cost_total,
    v_profit_total,
    coalesce(payload->>'bank_name', '')
  );

  update public.sales
     set business_transaction_id = v_tx, idempotency_key = v_key
   where id = v_sale.id;

  for v_item in select value from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb)) as items(value)
  loop
    v_product_type := coalesce(nullif(v_item->>'product_type', ''), nullif(v_item->>'productType', ''), 'sale');
    v_product_id := coalesce(nullif(v_item->>'product_id', ''), nullif(v_item->>'productId', ''), '');
    v_product_name := coalesce(nullif(v_item->>'product_name', ''), nullif(v_item->>'productName', ''), 'Ürün');
    v_imei := nullif(coalesce(v_item->>'imei', ''), '');
    v_stock_id := public.ceplog_uuid_or_null(v_product_id);
    v_qty := greatest(public.ceplog_money_from_text(coalesce(v_item->>'quantity', '1')), 1);
    v_unit_cost := public.ceplog_money_from_text(coalesce(v_item->>'unit_cost_at_sale', v_item->>'unitCostAtSale', '0'));
    v_unit_price := public.ceplog_money_from_text(coalesce(v_item->>'unit_price_at_sale', v_item->>'unitPriceAtSale', '0'));
    v_discount := public.ceplog_money_from_text(coalesce(v_item->>'discount_amount', v_item->>'discountAmount', '0'));
    v_line_total := public.ceplog_money_from_text(coalesce(v_item->>'line_total', v_item->>'lineTotal', (v_unit_price * v_qty - v_discount)::text));
    v_line_profit := public.ceplog_money_from_text(coalesce(v_item->>'line_profit', v_item->>'lineProfit', (v_line_total - (v_unit_cost * v_qty))::text));

    insert into public.sale_items (
      workspace_id, business_transaction_id, sale_id, product_type, product_id, imei,
      quantity, unit_cost_at_sale, unit_price_at_sale, discount_amount, line_total, line_profit, metadata
    )
    values (
      v_workspace, v_tx, v_sale.id::text, v_product_type, coalesce(nullif(v_product_id, ''), v_sale.id::text), v_imei,
      v_qty, v_unit_cost, v_unit_price, v_discount, v_line_total, v_line_profit, v_item
    );

    if v_product_type <> 'service' then
      if v_stock_id is null then raise exception 'Stoklu sepet kalemi için geçerli stock id zorunludur'; end if;

      select * into v_stock
        from public.stock_items
       where id = v_stock_id
         and workspace_id = v_workspace
         and coalesce(status, 'active') not in ('deleted', 'cancelled', 'iptal')
       for update;

      if not found then raise exception 'Sepet stok kaydı bulunamadı veya workspace erişimi yok'; end if;
      if coalesce(v_stock.quantity, 0) < v_qty then raise exception 'Stok yetersiz: %', v_product_name; end if;

      update public.stock_items
         set quantity = coalesce(quantity, 0) - v_qty,
             updated_by = auth.uid(),
             updated_at = now()
       where id = v_stock_id
         and workspace_id = v_workspace;

      insert into public.stock_movements (
        workspace_id, business_transaction_id, product_type, product_id, imei,
        quantity_delta, unit_cost, reason, reference_type, reference_id, note, created_by
      )
      values (
        v_workspace, v_tx, v_product_type, v_stock_id::text, v_imei,
        -v_qty, v_unit_cost, 'SALE_OUT', 'sales', v_sale.id::text, v_product_name, payload->>'actor_id'
      );
    end if;
  end loop;

  update public.cash_movements
     set business_transaction_id = v_tx, idempotency_key = v_key
   where workspace_id = v_workspace and related_table = 'sales' and related_id = v_sale.id::text;

  update public.bank_movements
     set business_transaction_id = v_tx, idempotency_key = v_key
   where workspace_id = v_workspace
     and (related_sale_id = v_sale.id or (related_table = 'sales' and related_id = v_sale.id::text));

  if v_cash > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'CASH', 'DEBIT', v_cash, 'sales', v_sale.id::text, 'Sepet nakit satış');
  end if;
  if v_bank_total > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'BANK', 'DEBIT', v_bank_total, 'sales', v_sale.id::text, 'Sepet kart/banka satış');
  end if;
  if v_cari > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values (v_workspace, v_tx, 'CUSTOMER_RECEIVABLE', 'DEBIT', v_cari, 'sales', v_sale.id::text, 'Sepet cari satış');
  end if;
  insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
  values (v_workspace, v_tx, 'SALES_REVENUE', 'CREDIT', v_total, 'sales', v_sale.id::text, 'Sepet satış geliri');
  if v_cost_total > 0 then
    insert into public.ledger_entries (workspace_id, business_transaction_id, account_type, direction, amount, entity_type, entity_id, description)
    values
      (v_workspace, v_tx, 'COST_OF_GOODS_SOLD', 'DEBIT', v_cost_total, 'sales', v_sale.id::text, 'Sepet satılan mal maliyeti'),
      (v_workspace, v_tx, 'INVENTORY_ASSET', 'CREDIT', v_cost_total, 'sales', v_sale.id::text, 'Sepet stok çıkışı');
  end if;

  perform public.ceplog_assert_ledger_balanced(v_tx);

  update public.business_transactions
     set reference_type = 'sales', reference_id = v_sale.id::text
   where id = v_tx;

  perform public.ceplog_write_audit_safe(v_workspace, 'sales', v_sale.id::text, 'INSERT', 'cart_sale_created', null, to_jsonb(v_sale), payload->>'reason', v_tx, v_key);

  return jsonb_build_object(
    'transaction_id', v_tx,
    'reference_id', v_sale.id,
    'status', 'POSTED',
    'summary', jsonb_build_object('totalAmount', v_total, 'cashAmount', v_cash, 'cardAmount', v_bank_total, 'cariAmount', v_cari, 'profit', v_profit_total, 'itemCount', v_item_count)
  );
end;
$$;

grant execute on function public.ceplog_apply_cart_sale_transaction(jsonb) to authenticated;

notify pgrst, 'reload schema';
