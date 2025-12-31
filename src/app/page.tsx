// src/app/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Variant = { id: string; title: string; price: string };
type Product = { id: string; title: string; variants: Variant[] };

type CartItem = {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  price: string;
  quantity: number;
};

// type OrderRow = {
//   id: string;
//   name: string;
//   createdAt: string;
//   displayFinancialStatus: string;
//   tags: string[];
//   totalAmount?: string;
//   currencyCode?: string;
//   lineItems: Array<{ id: string; title: string; quantity: number }>;
// };


type OrderRow = {
  id: string;
  name: string;
  createdAt: string;
  displayFinancialStatus: string;
  tags: string[];
  totalAmount?: string;
  totalDiscountAmount?: string;
  currentTotalAmount?: string;
  currencyCode?: string;
  lineItems: Array<{
    id: string;
    title: string;
    quantity: number;
    originalTotal?: string;
    discountedTotal?: string;
    currencyCode?: string;
  }>;
};


export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [productsError, setProductsError] = useState<string>("");

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [qty, setQty] = useState<number>(1);

  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);
  const [createError, setCreateError] = useState<string>("");

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);

  const [ordersError, setOrdersError] = useState<string>("");
  const [discountTarget, setDiscountTarget] = useState<Record<string, string>>({});

  const [selectedProductId, setSelectedProductId] = useState("");
const [addQty, setAddQty] = useState(1);

const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
const [isCreatingAndLoading, setIsCreatingAndLoading] = useState(false);


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function refreshUntilOrderVisible(orderId: string) {
  // try a few times because Shopify order search can lag
  const attempts = 8;
  const baseDelay = 700;

  for (let i = 0; i < attempts; i++) {
    const rows = await fetchOrders(); // uses your existing logic
    const found = rows.some((o) => o.id === orderId);
    if (found) return true;

    // progressive delay: 700ms, 1000ms, 1300ms...
    await sleep(baseDelay + i * 300);
  }

  return false;
}


  // -------- helpers
  const variantIndex = useMemo(() => {
    const map = new Map<string, { product: Product; variant: Variant }>();
    for (const p of products) {
      for (const v of p.variants) map.set(v.id, { product: p, variant: v });
    }
    return map;
  }, [products]);

  function addToCart() {
    setCreateError("");
    setCreateResult(null);

    const found = variantIndex.get(selectedVariantId);
    if (!found) {
      setCreateError("Please select a variant first.");
      return;
    }
    const safeQty = Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 1;

    setCart((prev) => {
      const existing = prev.find((x) => x.variantId === selectedVariantId);
      if (existing) {
        return prev.map((x) =>
          x.variantId === selectedVariantId
            ? { ...x, quantity: x.quantity + safeQty }
            : x
        );
      }
      return [
        ...prev,
        {
          variantId: selectedVariantId,
          productTitle: found.product.title,
          variantTitle: found.variant.title,
          price: found.variant.price,
          quantity: safeQty,
        },
      ];
    });
  }

  function removeFromCart(variantId: string) {
    setCart((prev) => prev.filter((x) => x.variantId !== variantId));
  }

  function updateCartQty(variantId: string, newQty: number) {
    const safeQty = Number.isFinite(newQty) && newQty > 0 ? Math.floor(newQty) : 1;
    setCart((prev) =>
      prev.map((x) => (x.variantId === variantId ? { ...x, quantity: safeQty } : x))
    );
  }

  async function fetchProducts() {
    setProductsError("");
    try {
      const res = await fetch("/api/products");
      const json = await res.json();

      if (!res.ok) {
        setProductsError(json?.error || "Failed to load products");
        return;
      }

      const normalized: Product[] = json.products.edges.map((p: any) => ({
        id: p.node.id,
        title: p.node.title,
        variants: p.node.variants.edges.map((v: any) => v.node),
      }));

      setProducts(normalized);

      // Auto-select first variant (optional convenience)
      const firstVariant = normalized?.[0]?.variants?.[0]?.id;
      if (firstVariant) setSelectedVariantId(firstVariant);
    } catch (e: any) {
      setProductsError(e?.message || "Unknown error");
    }
  }

  // async function fetchOrders() {
  //   setOrdersError("");
  //   setOrdersLoading(true);
  //   try {
  //     const res = await fetch("/api/orders");
  //     const json = await res.json();

  //     if (!res.ok) {
  //       setOrdersError(json?.error || "Failed to load orders");
  //       return;
  //     }

  //     const rows: OrderRow[] = json.orders.edges.map((e: any) => ({
  //       id: e.node.id,
  //       name: e.node.name,
  //       createdAt: e.node.createdAt,
  //       displayFinancialStatus: e.node.displayFinancialStatus,
  //       tags: e.node.tags,
  //       totalAmount: e.node.totalPriceSet?.shopMoney?.amount,
  //       currencyCode: e.node.totalPriceSet?.shopMoney?.currencyCode,
  //       lineItems: e.node.lineItems.edges.map((li: any) => li.node),
  //     }));

  //     setOrders(rows);
  //   } catch (e: any) {
  //     setOrdersError(e?.message || "Unknown error");
  //   } finally {
  //     setOrdersLoading(false);
  //   }
  // }


//   async function fetchOrders() {
//   setOrdersError("");
//   setOrdersLoading(true);

//   try {
//     // no-store helps make sure you see latest values after modify
//     const res = await fetch("/api/orders", { cache: "no-store" });
//     const json = await res.json();

//     if (!res.ok) {
//       setOrdersError(json?.error || "Failed to load orders");
//       return;
//     }

//     const edges = json?.orders?.edges ?? [];

//     const rows: OrderRow[] = edges.map((e: any) => ({
//       id: e.node.id,
//       name: e.node.name,
//       createdAt: e.node.createdAt,
//       displayFinancialStatus: e.node.displayFinancialStatus,
//       tags: e.node.tags,

//       totalAmount: e.node.totalPriceSet?.shopMoney?.amount,
//       totalDiscountAmount: e.node.totalDiscountsSet?.shopMoney?.amount,
//       currentTotalAmount: e.node.currentTotalPriceSet?.shopMoney?.amount,

//       currencyCode:
//         e.node.currentTotalPriceSet?.shopMoney?.currencyCode ??
//         e.node.totalPriceSet?.shopMoney?.currencyCode,

//       lineItems: (e.node.lineItems?.edges ?? []).map((li: any) => ({
//         id: li.node.id,
//         title: li.node.title,
//         quantity: li.node.quantity,
//         originalTotal: li.node.originalTotalSet?.shopMoney?.amount,
//         discountedTotal: li.node.discountedTotalSet?.shopMoney?.amount,
//         currencyCode:
//           li.node.discountedTotalSet?.shopMoney?.currencyCode ??
//           li.node.originalTotalSet?.shopMoney?.currencyCode,
//       })),
      
//     }));

//     setOrders(rows);
//   } catch (e: any) {
//     setOrdersError(e?.message || "Unknown error");
//   } finally {
//     setOrdersLoading(false);
//   }
// }


//   async function fetchOrders() {
//   setOrdersError("");
//   setOrdersLoading(true);

//   try {
//     // no-store helps make sure you see latest values after modify
//     const res = await fetch("/api/orders", { cache: "no-store" });
//     const json = await res.json();

//     if (!res.ok) {
//       setOrdersError(json?.error || "Failed to load orders");
//       return;
//     }

//     const edges = json?.orders?.edges ?? [];

//     const rows: OrderRow[] = edges.map((e: any) => ({
//       id: e.node.id,
//       name: e.node.name,
//       createdAt: e.node.createdAt,
//       displayFinancialStatus: e.node.displayFinancialStatus,
//       tags: e.node.tags,

//       totalAmount: e.node.totalPriceSet?.shopMoney?.amount,
//       totalDiscountAmount: e.node.totalDiscountsSet?.shopMoney?.amount,
//       currentTotalAmount: e.node.currentTotalPriceSet?.shopMoney?.amount,

//       currencyCode:
//         e.node.currentTotalPriceSet?.shopMoney?.currencyCode ??
//         e.node.totalPriceSet?.shopMoney?.currencyCode,

//       lineItems: (e.node.lineItems?.edges ?? []).map((li: any) => ({
//         id: li.node.id,
//         title: li.node.title,
//         quantity: li.node.quantity,
//         originalTotal: li.node.originalTotalSet?.shopMoney?.amount,
//         discountedTotal: li.node.discountedTotalSet?.shopMoney?.amount,
//         currencyCode:
//           li.node.discountedTotalSet?.shopMoney?.currencyCode ??
//           li.node.originalTotalSet?.shopMoney?.currencyCode,
//       }))
//           // ✅ hide removed items if Shopify returns qty=0
//     .filter((li: any) => (li.quantity ?? 0) > 0),
//     }));

//   //   setOrders(rows);
//   // } catch (e: any) {
//   //   setOrdersError(e?.message || "Unknown error");
//   // } finally {
//   //   setOrdersLoading(false);
//   // }
//   // ✅ hide orders with no remaining items
// // setOrders(rows.filter((o) => o.lineItems.length > 0));
// // ✅ hide orders that have no remaining items OR total = 0
// // setOrders(
// //   rows.filter((o) => {
// //     const hasItems = o.lineItems.some((li) => (li.quantity ?? 0) > 0);
// //     const total = parseFloat(o.currentTotalAmount ?? o.totalAmount ?? "0");
// //     return hasItems && total > 0;
// //   })
// // );

// setOrders(
//   rows.filter((o) => {
//     const hasItems = o.lineItems.some((li) => (li.quantity ?? 0) > 0);
//     const total = parseFloat(o.currentTotalAmount ?? o.totalAmount ?? "0");
//     const isHidden = hiddenOrderIds.has(o.id);

//     if (!showHiddenOrders && isHidden) return false;
//     return hasItems && total > 0;
//   })
// );

//   } catch (e: any) {
//     setOrdersError(e?.message || "Unknown error");
//   } finally {
//     setOrdersLoading(false);
//   }
// }


async function fetchOrders(): Promise<OrderRow[]> {
  setOrdersError("");
  setOrdersLoading(true);

  try {
    // no-store helps make sure you see latest values after create/modify
    setCreatingOrder(true); // show loader

    const res = await fetch("/api/orders", 
      { cache: "no-store" });
    const json = await res.json();

    if (!res.ok) {
      setOrdersError(json?.error || "Failed to load orders");
      return [];
    }

    const edges = json?.orders?.edges ?? [];

    const rows: OrderRow[] = edges.map((e: any) => ({
      id: e.node.id,
      name: e.node.name,
      createdAt: e.node.createdAt,
      displayFinancialStatus: e.node.displayFinancialStatus,
      tags: e.node.tags,

      totalAmount: e.node.totalPriceSet?.shopMoney?.amount,
      totalDiscountAmount: e.node.totalDiscountsSet?.shopMoney?.amount,
      currentTotalAmount: e.node.currentTotalPriceSet?.shopMoney?.amount,

      currencyCode:
        e.node.currentTotalPriceSet?.shopMoney?.currencyCode ??
        e.node.totalPriceSet?.shopMoney?.currencyCode,

      lineItems: (e.node.lineItems?.edges ?? [])
        .map((li: any) => ({
          id: li.node.id,
          title: li.node.title,
          quantity: li.node.quantity,
          originalTotal: li.node.originalTotalSet?.shopMoney?.amount,
          discountedTotal: li.node.discountedTotalSet?.shopMoney?.amount,
          currencyCode:
            li.node.discountedTotalSet?.shopMoney?.currencyCode ??
            li.node.originalTotalSet?.shopMoney?.currencyCode,
        }))
        // ✅ hide removed items if Shopify returns qty=0
        .filter((li: any) => (li.quantity ?? 0) > 0),
    }));

    // ✅ hide orders that have no remaining items OR total = 0
    const filtered = rows.filter((o) => {
      const hasItems = o.lineItems.some((li) => (li.quantity ?? 0) > 0);
      const total = parseFloat(o.currentTotalAmount ?? o.totalAmount ?? "0");
      const isHidden = hiddenOrderIds.has(o.id);

      if (!showHiddenOrders && isHidden) return false;
      return hasItems && total > 0;
    });

    setOrders(filtered);
    return filtered;
  } catch (e: any) {
    setOrdersError(e?.message || "Unknown error");
    return [];
  } finally {
    setOrdersLoading(false);
  }
}

  async function createOrder() {
    setCreateError("");
    setCreateResult(null);

    if (cart.length === 0) {
      setCreateError("Cart is empty. Add at least 1 item before creating an order.");
      return;
    }

    setCreateLoading(true);
      setIsCreatingAndLoading(true); // 👈 show loader while creating

    try {
      const res = await 
      fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((c) => ({
            variantId: c.variantId,
            quantity: c.quantity,
          })),
          
          // optional: tie Klaviyo profile to your email if you added it server-side
          // email: "sanatahir587@gmail.com",
        }),

      });

      const json = await res.json();

      if (!res.ok) {
        setCreateError(
          typeof json?.error === "string" ? json.error : JSON.stringify(json.error)
        );
        return;
      }

      setCreateResult(json);
      console.log("[UI] Create Order response:", json);
      setCart([]);
          // ⏳ Wait until Shopify returns the new order in GET /api/orders
    const orderVisible = await refreshUntilOrderVisible(json.orderId);

    if (!orderVisible) {
      console.warn("Order not visible yet after multiple retries.");
    }
      await fetchOrders();
    } catch (e: any) {
      setCreateError(e?.message || "Unknown error");
    } finally {
      setCreateLoading(false);
          setIsCreatingAndLoading(false); // 👈 hide loader after order appears

    }
  }



  useEffect(() => {
  const hidden = loadHiddenOrderIds();
  setHiddenOrderIds(hidden);

  fetchProducts();
  // Wait one tick so state is applied, then fetch
  setTimeout(() => fetchOrders(), 0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

//   // -------- initial load
//   useEffect(() => {
//     fetchProducts();
//     fetchOrders();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);


//   useEffect(() => {
//   setHiddenOrderIds(loadHiddenOrderIds());
// }, []);


// async function modifyOrder(orderId: string, action: "discount" | "remove" | "add", payload?: any) {
//   console.log("[UI] Sending modifyOrder", { orderId, action, payload });

//   const res = await fetch("/api/orders/modify", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ orderId, action, ...payload }),
//   });

//   const json = await res.json();
//   console.log("[UI] Modify Order Response", json);

//   if (!res.ok) {
//     alert("❌ Failed: " + (typeof json.error === "string" ? json.error : JSON.stringify(json.error)));
//     return;
//   }

//   alert("✅ " + json.message);
//   await fetchOrders();
// }

// async function modifyOrder(
//   orderId: string,
//   action: "discount" | "remove" | "add",
//   payload?: any
// ) {
//   console.log("[UI] Sending modifyOrder", { orderId, action, payload });

//   if (action === "remove") {
//     const ok = window.confirm("Remove this item from the order?");
//     if (!ok) return;
//   }

//   const res = await fetch("/api/orders/modify", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ orderId, action, ...payload }),
//   });

//   const json = await res.json();
//   console.log("[UI] Modify Order Response", json);

//   if (!res.ok) {
//     alert(
//       "❌ Failed: " +
//         (typeof json.error === "string" ? json.error : JSON.stringify(json.error))
//     );
//     return;
//   }

//   // ✅ Immediately update UI for "remove"
//   if (action === "remove" && payload?.lineItemId) {
//     const removedId: string = payload.lineItemId;

//     setOrders((prev) =>
//       prev
//         .map((o) =>
//           o.id !== orderId
//             ? o
//             : { ...o, lineItems: o.lineItems.filter((li) => li.id !== removedId) }
//         )
//         // if it was the last item, remove the whole order card
//         .filter((o) => (o.id !== orderId ? true : o.lineItems.length > 0))
//     );

//     // keep dropdown selection valid (optional but prevents stale selected id)
//     setDiscountTarget((prev) => {
//       if (prev[orderId] !== removedId) return prev;

//       const next = { ...prev };
//       const current = orders.find((o) => o.id === orderId);
//       const remaining = current?.lineItems.filter((li) => li.id !== removedId) ?? [];
//       if (remaining[0]?.id) next[orderId] = remaining[0].id;
//       else delete next[orderId];
//       return next;
//     });
//   }

//   alert("✅ " + json.message);

//   // still sync from Shopify (keeps totals/discounts correct)
//   await fetchOrders();
// }



async function modifyOrder(
  orderId: string,
  action: "discount" | "remove" | "add",
  payload?: any
) {
  console.log("[UI] Sending modifyOrder", { orderId, action, payload });

  if (action === "remove") {
    const ok = window.confirm("Remove this item from the order?");
    if (!ok) return;
  }

  const res = await fetch("/api/orders/modify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId, action, ...payload }),
  });

  const json = await res.json();
  console.log("[UI] Modify Order Response", json);

  const errText =
    typeof json?.error === "string" ? json.error : JSON.stringify(json?.error);

  // ✅ IMPORTANT: if the line item is already removed, your UI is stale.
  // Refresh orders and clear the selected lineItemId so you don't keep sending a removed ID.
  if (!res.ok) {
    if (
      action === "remove" &&
      errText?.includes("cannot be edited because it is removed")
    ) {
      setDiscountTarget((prev: any) => {
        const next = { ...prev };
        delete next[orderId]; // clear stale selection
        return next;
      });

      await fetchOrders(); // resync UI with Shopify
      alert("ℹ️ That item was already removed. Orders refreshed.");
      return;
    }

    alert("❌ Failed: " + errText);
    return;
  }

  // ✅ Immediately update UI for "remove"
  if (action === "remove" && payload?.lineItemId) {
    const removedId: string = payload.lineItemId;

    setOrders((prev: any) =>
      prev
        .map((o: any) =>
          o.id !== orderId
            ? o
            : { ...o, lineItems: o.lineItems.filter((li: any) => li.id !== removedId) }
        )
        // if it was the last item, remove the whole order card
        .filter((o: any) => (o.id !== orderId ? true : o.lineItems.length > 0))
    );

    // ✅ keep dropdown selection valid WITHOUT using stale "orders.find(...)"
    setDiscountTarget((prev: any) => {
      const next = { ...prev };
      if (next[orderId] === removedId) delete next[orderId];
      return next;
    });
  }

  alert("✅ " + json.message);

  // still sync from Shopify (keeps totals/discounts correct)
  await fetchOrders();
}


const HIDDEN_KEY = "hiddenOrderIds_v1";

function loadHiddenOrderIds(): Set<string> {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveHiddenOrderIds(set: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}


function hideOrderPermanently(orderId: string) {
  setHiddenOrderIds((prev) => {
    const next = new Set(prev);
    next.add(orderId);
    saveHiddenOrderIds(next);
    return next;
  });

  // instant UI remove
  setOrders((prev) => prev.filter((o) => o.id !== orderId));
}

const [hiddenOrderIds, setHiddenOrderIds] = useState<Set<string>>(new Set());
const [showHiddenOrders, setShowHiddenOrders] = useState(false);

// async function modifyOrder(orderId: string, action: "discount" | "remove" | "add", payload?: any) {
//   console.log("[UI] Sending modifyOrder", { orderId, action, payload });

//   // Confirm before deleting any item/order
//   if (action === "remove") {
//     const confirmed = window.confirm("Are you sure you want to remove this item/order?");
//     if (!confirmed) return;
//   }

//   const res = await fetch("/api/orders/modify", {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify({ orderId, action, ...payload }),
//   });

//   const json = await res.json();
//   console.log("[UI] Modify Order Response", json);

//   if (!res.ok) {
//     alert("❌ Failed: " + (typeof json.error === "string" ? json.error : JSON.stringify(json.error)));
//     return;
//   }

//   alert("✅ " + json.message);

//   // If user deleted an item and that deletion removed the whole order, update UI instantly
//   if (action === "remove" && json.orderDeleted) {
//     setOrders((prev) => prev.filter((o) => o.id !== orderId));
//   } else {
//     await fetchOrders(); // fallback: refresh orders if modification didn’t remove the whole order
//   }
// }


  return (
    <div className="bg-indigo-950 pt-8 pb-8 ">
          {/* 🔄 Loader overlay */}
    {isCreatingAndLoading && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="rounded-xl bg-white px-6 py-4 text-gray-800 shadow-lg">
          <p className="font-semibold text-lg">Creating your order…</p>
          <p className="text-sm text-gray-500 mt-1">Please wait a moment</p>
          <div className="mt-3 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          </div>
        </div>
      </div>
    )}
    <main style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }} className="bg-white rounded-2xl">
      <h1 className="font-bold text-[28px] text-gray-800">
        Shopify Order Manager (Assessment)
      </h1>
      <p className="text-[15px] mb-4 text-gray-800">
        Flow: Products → Cart → Create Order → My Orders (filtered by username tag)
      </p>

      {/* PRODUCTS */}
      {/* <section style={{ border: "1px solid #ddd", padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0 }}>1) Products</h2>

        {productsError && (
          <div style={{ background: "#ffe5e5", padding: 12, marginBottom: 12 }}>
            <strong>Error:</strong> {productsError}
          </div>
        )}

        {!productsError && products.length === 0 && <p>Loading products...</p>}

        {products.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <label style={{ fontWeight: 700 }}>Select Variant:</label>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                style={{ padding: 8, minWidth: 420 }}
              >
                {products.map((p) => (
                  <optgroup key={p.id} label={p.title}>
                    {p.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.title} — ${v.price}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <label style={{ fontWeight: 700 }}>Qty:</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                style={{ width: 80, padding: 8 }}
              />

              <button
                onClick={addToCart}
                style={{ padding: "8px 12px", border: "1px solid #000" }}
              >
                Add to Cart
              </button>
          
            </div>



            <div style={{ marginTop: 14 }}>
              <details>
                <summary style={{ cursor: "pointer" }}>Show raw products list</summary>
                {products.map((p) => (
                  <div key={p.id} style={{ marginTop: 10 }}>
                    <div style={{ fontWeight: 700 }}>{p.title}</div>
                    <ul>
                      {p.variants.map((v) => (
                        <li key={v.id}>
                          {v.title} — ${v.price}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </details>
            </div>
          </>
        )}
      </section> */}


{/* PRODUCTS */}
{/* <section className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-5 shadow-sm">
  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-lg font-extrabold text-gray-900">1) Products</h2>
      <p className="text-sm text-gray-600">
        Pick a variant, choose quantity, then add it to cart.
      </p>
    </div>

    <span className="inline-flex w-fit items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
      Shopify Admin GraphQL
    </span>
  </div>

  {productsError && (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <span className="font-bold">Error:</span> {productsError}
    </div>
  )}

  {!productsError && products.length === 0 && (
    <div className="mt-4 rounded-xl see border border-gray-200 bg-white p-4 text-sm text-gray-700">
      Loading products…
    </div>
  )}

  {products.length > 0 && (
    <>
      <div className="mt-4 grid gap-3 md:grid-cols-[1fr_140px_180px] md:items-end">
        <div>
          <label className="text-sm font-semibold text-gray-800">
            Select Variant
          </label>

          <select
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          >
            {products.map((p) => (
              <optgroup key={p.id} label={p.title}>
                {p.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} — ${v.price}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {variantIndex.get(selectedVariantId) && (
            <p className="mt-1 text-xs text-gray-500">
              Selected:{" "}
              <span className="font-semibold text-gray-700">
                {variantIndex.get(selectedVariantId)!.product.title}
              </span>{" "}
              • {variantIndex.get(selectedVariantId)!.variant.title} • $
              {variantIndex.get(selectedVariantId)!.variant.price}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-800">Qty</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
        </div>

        <button
          onClick={addToCart}
          className="h-[46px] rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[0.99]"
        >
          Add to Cart
        </button>
      </div>

      <details className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold text-gray-800">
          Show raw products list
        </summary>

        <div className="mt-4 grid gap-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 p-4">
              <div className="font-bold text-gray-900">{p.title}</div>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {p.variants.map((v) => (
                  <li key={v.id} className="flex items-center justify-between">
                    <span>{v.title}</span>
                    <span className="font-semibold">${v.price}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </>
  )}
</section> */}


{/* PRODUCTS */}
<section className="mb-6 rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-5 shadow-sm">
  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-lg font-extrabold text-gray-900">1) Products</h2>
      <p className="text-sm text-gray-600">
        Pick a variant, choose quantity, then add it to cart.
      </p>
    </div>

    <span className="inline-flex w-fit items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
      Shopify Admin GraphQL
    </span>
  </div>

  {productsError && (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <span className="font-bold">Error:</span> {productsError}
    </div>
  )}

  {!productsError && products.length === 0 && (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-700">
      Loading products…
    </div>
  )}

  {products.length > 0 && (
    <>
      {/* Controls row: Variant + Qty + Button on SAME LINE (sm and above) */}
      <div className="mt-4 grid grid-cols-[1fr_120px_auto] items-center gap-3">
        {/* Variant */}
        <div className="min-w-0">
          <label className="text-sm font-semibold text-gray-800">
            Select Variant
          </label>
  <div className="relative mt-1">

          <select
            value={selectedVariantId}
            onChange={(e) => setSelectedVariantId(e.target.value)}
            className="mt-1 w-full appearance-none rounded-xl border border-gray-300 bg-white px-3 py-3 pr-10 text-sm text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          >
            {products.map((p) => (
              <optgroup key={p.id} label={p.title}>
                {p.variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} — ${v.price}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

            {/* dropdown arrow icon */}
      {/* ✅ dropdown arrow icon */}
    <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
          clipRule="evenodd"
        />
      </svg>
    </div>
    </div>


          {variantIndex.get(selectedVariantId) && (
            <p className="mt-1 text-xs text-gray-500">
              Selected:{" "}
              <span className="font-semibold text-gray-700">
                {variantIndex.get(selectedVariantId)!.product.title}
              </span>{" "}
              • {variantIndex.get(selectedVariantId)!.variant.title} • $
              {variantIndex.get(selectedVariantId)!.variant.price}
            </p>
          )}
        </div>

        {/* Qty */}
        <div>
          <label className="text-sm font-semibold text-gray-800">Qty</label>
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
            className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
          />
          <p className="mt-1 text-[11px] text-gray-500">
            Minimum 1 item
          </p>
        </div>

        {/* Add to cart */}
        <button
          onClick={addToCart}
          disabled={!selectedVariantId || !Number.isFinite(qty) || qty < 1}
          title={
            !selectedVariantId
              ? "Select a variant first"
              : qty < 1
              ? "Quantity must be at least 1"
              : "Add selected variant to cart"
          }
          className={`mt-[9px] h-[48px] rounded-xl px-6 text-sm font-semibold shadow-sm transition active:scale-[0.99] 
            ${
              !selectedVariantId || !Number.isFinite(qty) || qty < 1
                ? "cursor-not-allowed bg-gray-300 text-gray-600"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
        >
          Add to Cart
        </button>
      </div>

      {/* Raw list */}
      <details className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold text-gray-800">
          Show raw products list
        </summary>

        <div className="mt-4 grid gap-3">
          {products.map((p) => (
            <div key={p.id} className="rounded-xl border border-gray-200 p-4">
              <div className="font-bold text-gray-900">{p.title}</div>
              <ul className="mt-2 space-y-1 text-sm text-gray-700">
                {p.variants.map((v) => (
                  <li key={v.id} className="flex items-center justify-between">
                    <span className="min-w-0 truncate">{v.title}</span>
                    <span className="ml-3 shrink-0 font-semibold">${v.price}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </>
  )}
</section>


      {/* CART + CREATE */}
      {/* <section style={{ border: "1px solid #ddd", padding: 16, marginBottom: 16 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0 }}>
          2) Cart & Create Order
        </h2>

        {createError && (
          <div style={{ background: "#ffe5e5", padding: 12, marginBottom: 12 }}>
            <strong>Error:</strong> {createError}
          </div>
        )}

        {createResult && (
          <div style={{ background: "#e7ffe7", padding: 12, marginBottom: 12 }}>
            <strong>Order created!</strong>
            <pre style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>
              {JSON.stringify(createResult, null, 2)}
            </pre>
          </div>
        )}

        {cart.length === 0 ? (
          <p>Cart is empty. Add items from the Products section.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ borderBottom: "1px solid #ccc", padding: 8 }}>Item</th>
                <th style={{ borderBottom: "1px solid #ccc", padding: 8 }}>Price</th>
                <th style={{ borderBottom: "1px solid #ccc", padding: 8 }}>Qty</th>
                <th style={{ borderBottom: "1px solid #ccc", padding: 8 }} />
              </tr>
            </thead>
            <tbody>
              {cart.map((c) => (
                <tr key={c.variantId}>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <div style={{ fontWeight: 700 }}>{c.productTitle}</div>
                    <div style={{ fontSize: 13 }}>{c.variantTitle}</div>
                    <div style={{ fontSize: 12, color: "#555" }}>{c.variantId}</div>
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    ${c.price}
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <input
                      type="number"
                      min={1}
                      value={c.quantity}
                      onChange={(e) =>
                        updateCartQty(c.variantId, Number(e.target.value))
                      }
                      style={{ width: 80, padding: 6 }}
                    />
                  </td>
                  <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                    <button
                      onClick={() => removeFromCart(c.variantId)}
                      style={{ padding: "6px 10px", border: "1px solid #000" }}
                    >
                      Remove
                    </button>
                    
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button
            onClick={createOrder}
            disabled={createLoading || cart.length === 0}
            style={{
              padding: "10px 12px",
              border: "1px solid #000",
              opacity: createLoading || cart.length === 0 ? 0.6 : 1,
            }}
          >
            {createLoading ? "Creating..." : "Create Order (Shopify + Klaviyo)"}
          </button>

          <button
            onClick={() => {
              setCart([]);
              setCreateError("");
              setCreateResult(null);
            }}
            style={{ padding: "10px 12px", border: "1px solid #000" }}
          >
            Clear
          </button>
        </div>
      </section> */}

      {/* CART + CREATE */}
<section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
  <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h2 className="text-lg font-extrabold text-gray-900">2) Cart &amp; Create Order</h2>
      <p className="text-sm text-gray-600">
        Review items, adjust quantity, then create an order (Shopify + Klaviyo).
      </p>
    </div>

    <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
      Checkout: Test Order
    </span>
  </div>

  {createError && (
    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <span className="font-bold">Error:</span> {createError}
    </div>
  )}

  {createResult && (
    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
      <div className="font-bold">Order created!</div>
      {/* <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-emerald-200 bg-white p-3 text-xs text-gray-800">
        {JSON.stringify(createResult, null, 2)}
      </pre> */}
    </div>
  )}

  {cart.length === 0 ? (
    <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
      Cart is empty. Add items from the <span className="font-semibold">Products</span> section.
    </div>
  ) : (
    <>
      {/* Desktop / Tablet Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="grid grid-cols-[1fr_140px_140px_120px] gap-0 border-b border-gray-200 bg-gray-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-gray-600">
          <div>Item</div>
          <div className="text-right">Price</div>
          <div className="text-right">Qty</div>
          <div className="text-right">Action</div>
        </div>

        <div className="divide-y divide-gray-200">
          {cart.map((c) => (
            <div
              key={c.variantId}
              className="grid grid-cols-[1fr_140px_140px_120px] items-center gap-0 px-4 py-4"
            >
              <div className="min-w-0">
                <div className="truncate font-semibold text-gray-900">{c.productTitle}</div>
                <div className="truncate text-sm text-gray-600">{c.variantTitle}</div>
                <div className="truncate text-xs text-gray-400">{c.variantId}</div>
              </div>

              <div className="text-right font-semibold text-gray-900">${c.price}</div>

              <div className="flex justify-end">
                <input
                  type="number"
                  min={1}
                  value={c.quantity}
                  onChange={(e) => updateCartQty(c.variantId, Number(e.target.value))}
                  className="w-24 rounded-xl border border-gray-300 bg-white px-3 py-2 text-right text-sm text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => removeFromCart(c.variantId)}
                  className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Summary row */}
        <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-gray-700">
            <span className="font-semibold">{cart.length}</span> item(s) in cart
          </div>
          <div className="text-gray-900">
            Subtotal:{" "}
            <span className="font-extrabold">
              $
              {cart
                .reduce((sum, c) => sum + (Number(c.price) || 0) * c.quantity, 0)
                .toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </>
  )}

  {/* Actions */}
  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
    <button
      onClick={createOrder}
      disabled={createLoading || cart.length === 0}
      className={`rounded-xl px-4 py-3 text-sm font-semibold shadow-sm transition active:scale-[0.99]
        ${
          createLoading || cart.length === 0
            ? "cursor-not-allowed bg-gray-300 text-gray-600"
            : "bg-indigo-600 text-white hover:bg-indigo-700"
        }`}
    >
      {createLoading ? "Creating..." : "Create Order (Shopify + Klaviyo)"}
    </button>

    <button
      onClick={() => {
        setCart([]);
        setCreateError("");
        setCreateResult(null);
      }}
      className="rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 active:scale-[0.99]"
    >
      Clear
    </button>
  </div>
</section>


      {/* MY ORDERS */}
      {/* <section style={{ border: "1px solid #ddd", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 0 }}>
            3) My Orders (Filtered by Username Tag)
          </h2>
          <button
            onClick={fetchOrders}
            disabled={ordersLoading}
            style={{
              padding: "8px 12px",
              border: "1px solid #000",
              opacity: ordersLoading ? 0.6 : 1,
              height: 38,
            }}
          >
            {ordersLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {ordersError && (
          <div style={{ background: "#ffe5e5", padding: 12, marginBottom: 12 }}>
            <strong>Error:</strong> {ordersError}
          </div>
        )}

        {!ordersError && ordersLoading && <p>Loading orders...</p>}

        {!ordersLoading && orders.length === 0 && (
          <p>No orders found yet (try creating one above).</p>
        )}

        {!ordersLoading && orders.length > 0 && (
          <div style={{ display: "grid", gap: 12 }}>
            {orders.map((o) => (
              <div key={o.id} style={{ border: "1px solid #eee", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 800 }}>{o.name}</div>
                  <div style={{ fontSize: 13 }}>
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                </div>

                <div style={{ marginTop: 6, fontSize: 14 }}>
                  <div>
                    <strong>Status:</strong> {o.displayFinancialStatus}
                  </div>
                 
                  <div>
  <strong>Total (Before):</strong>{" "}
  {o.totalAmount ? `${o.totalAmount} ${o.currencyCode}` : "—"}
</div>

<div>
  <strong>Discount:</strong>{" "}
  {o.totalDiscountAmount ? `${o.totalDiscountAmount} ${o.currencyCode}` : "—"}
</div>

<div>
  <strong>Total (After):</strong>{" "}
  {o.currentTotalAmount ? `${o.currentTotalAmount} ${o.currencyCode}` : "—"}
</div>

                  <div>

                    <strong>Tags:</strong> {o.tags.join(", ")}
                  </div>
                </div>

                <div style={{ marginTop: 8 }}>
                  <strong>Line Items:</strong>
                  <ul>
                    {o.lineItems.map((li) => (
                  
                      <li key={li.id}>
  {li.title} × {li.quantity}
  {li.originalTotal && li.discountedTotal && (
    <div style={{ fontSize: 12, color: "#555" }}>
      Before: {li.originalTotal} {li.currencyCode} → After: {li.discountedTotal}{" "}
      {li.currencyCode}
    </div>
  )}
</li>

                    ))}

  

                  </ul>
                </div>

    
<div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
  <label style={{ fontSize: 13, fontWeight: 700 }}>Discount item:</label>

  <select
    value={discountTarget[o.id] ?? o.lineItems?.[0]?.id ?? ""}
    onChange={(e) =>
      setDiscountTarget((prev) => ({ ...prev, [o.id]: e.target.value }))
    }
    style={{ padding: 8, minWidth: 260 }}
    disabled={!o.lineItems?.length}
  >
    {o.lineItems.map((li) => (
      <option key={li.id} value={li.id}>
        {li.title} × {li.quantity}
      </option>
    ))}
  </select>

  <button
    type="button"
    onClick={() =>
      modifyOrder(o.id, "discount", {
        discountPercent: 10,
        lineItemId: discountTarget[o.id] ?? o.lineItems?.[0]?.id,
      })
    }
    disabled={!o.lineItems?.[0]?.id}
    className="border border-black p-2 bg-blue-800 text-white"
  >
    Apply 10% Discount
  </button>

  <button
    type="button"
    onClick={() =>
      modifyOrder(o.id, "remove", {
        lineItemId: discountTarget[o.id] ?? o.lineItems?.[0]?.id,
      })
    }
    disabled={!o.lineItems?.length}
    className="border border-black p-2 bg-red-600 text-white"
  >
    Remove Selected Item
  </button>

     <button
                onClick={() =>
                  modifyOrder(o.id, "add", {
                    variantId: selectedVariantId,
                    quantity: addQty,
                  })
                }
                disabled={!selectedVariantId || addQty < 1}
                className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
              >
                Add Selected Item
              </button>

</div>


                    {selectedVariantId && (
              <p className="text-sm text-gray-500 mt-1">
                Adding:{" "}
                {
                  products
                    .flatMap((p) => p.variants)
                    .find((v) => v.id === selectedVariantId)?.title
                }{" "}
                × {addQty}
              </p>
            )}
              </div>
            ))}
          </div>
        )}
      </section> */}

      {/* MY ORDERS */}
<section className="rounded-2xl border border-gray-200 bg-gradient-to-b from-white to-gray-50 p-6 shadow-sm">
  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
    <h2 className="text-lg font-extrabold text-gray-900">
      3) My Orders (Filtered by Username Tag)
    </h2>
    <button
      onClick={fetchOrders}
      disabled={ordersLoading}
      className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition active:scale-[0.99] ${
        ordersLoading
          ? "cursor-not-allowed bg-gray-300 text-gray-600"
          : "bg-indigo-600 text-white hover:bg-indigo-700"
      }`}
    >
      {ordersLoading ? "Refreshing..." : "Refresh"}
    </button>
  </div>

  {ordersError && (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <span className="font-bold">Error:</span> {ordersError}
    </div>
  )}

  {!ordersError && ordersLoading && (
    <p className="text-sm text-gray-600">Loading orders...</p>
  )}

  {!ordersLoading && orders.length === 0 && (
    <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
      No orders found yet. Try creating one above.
    </div>
  )}

  {!ordersLoading && orders.length > 0 && (
    <div className="mt-4 grid gap-5">

     

      
      {orders.map((o) => (
        
        <div
          key={o.id}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition"
        >
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-gray-900 text-lg">{o.name}</h3>
              <p className="text-xs text-gray-500">
                {new Date(o.createdAt).toLocaleString()}
              </p>
            </div>
            <span
              className={`mt-2 sm:mt-0 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                o.displayFinancialStatus === "PAID"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-yellow-200 bg-yellow-50 text-yellow-700"
              }`}
            >
              {o.displayFinancialStatus}
            </span>
          </div>

          {/* Totals */}
          <div className="mt-3 text-sm text-gray-700 grid gap-1 sm:grid-cols-3">
            <div>
              <span className="font-semibold text-gray-800">Before Discount: </span>
              {o.totalAmount ? `$${o.totalAmount} ${o.currencyCode}` : "—"}
            </div>
            <div>
              <span className="font-semibold text-gray-800">Discount Applied: </span>
              {o.totalDiscountAmount ? (
                <span className="text-rose-600 font-semibold">
                  -${o.totalDiscountAmount} {o.currencyCode}
                </span>
              ) : (
                "—"
              )}
            </div>
            <div>
              <span className="font-semibold text-gray-800">After Discount: </span>
              {o.currentTotalAmount ? (
                <span className="text-green-700 font-semibold">
                  ${o.currentTotalAmount} {o.currencyCode}
                </span>
              ) : (
                "—"
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="mt-4 border-t border-gray-200 pt-3">
            <strong className="text-sm text-gray-800">Line Items:</strong>
            <ul className="mt-2 space-y-2">
              {o.lineItems.map((li) => (
                <li
                  key={li.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-50 rounded-lg p-3"
                >
                  <div>
                    <div className="font-semibold text-gray-900">{li.title}</div>
                    <div className="text-xs text-gray-600">Qty: {li.quantity}</div>
                  </div>
                  <div className="text-right">
                    {li.originalTotal && li.discountedTotal ? (
                      <div>
                        <span className="line-through text-gray-500 text-sm">
                          ${li.originalTotal}
                        </span>{" "}
                        <span className="text-green-700 font-semibold">
                          ${li.discountedTotal}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-800">
                        ${li.originalTotal ?? li.discountedTotal ?? "—"}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="mt-4 flex flex-wrap gap-3 items-center">
            <label className="text-sm font-semibold text-gray-800">
              Discount item:
            </label>

            <select
              value={discountTarget[o.id] ?? o.lineItems?.[0]?.id ?? ""}
              onChange={(e) =>
                setDiscountTarget((prev) => ({ ...prev, [o.id]: e.target.value }))
              }
              disabled={!o.lineItems?.length}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100"
            >
              {o.lineItems.map((li) => (
                <option key={li.id} value={li.id}>
                  {li.title} × {li.quantity}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                modifyOrder(o.id, "discount", {
                  discountPercent: 10,
                  lineItemId: discountTarget[o.id] ?? o.lineItems?.[0]?.id,
                })
              }
              disabled={!o.lineItems?.length}
              className="rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.99]"
            >
              Apply 10% Discount
            </button>

            <button
              type="button"
              onClick={() =>
                modifyOrder(o.id, "remove", {
                  lineItemId: discountTarget[o.id] ?? o.lineItems?.[0]?.id,
                })
              }
              disabled={!o.lineItems?.length}
              className="rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.99]"
            >
              Remove Selected Item
            </button>

            <button
              onClick={() =>
                modifyOrder(o.id, "add", {
                  variantId: selectedVariantId,
                  quantity: addQty,
                })
              }
              disabled={!selectedVariantId || addQty < 1}
              className="rounded-xl bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 active:scale-[0.99]"
            >
              Add Selected Item
            </button>
          </div>
        </div>
      ))}
    </div>
  )}
</section>

    </main>
    </div>
  );
}














