// src/app/api/orders/modify/route.ts
import { NextResponse } from "next/server";
import { shopifyRequest } from "@/lib/shopifyClient";
import { sendKlaviyoEvent } from "@/lib/klaviyoClient";

function requiredEnv(n: string) {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env var: ${n}`);
  return v;
}
const username = () => requiredEnv("ASSESSMENT_USERNAME");

type ModifyBody = {
  orderId: string;
  action: "discount" | "remove" | "add";
  email?: string;
  lineItemId?: string;
  variantId?: string;
  quantity?: number;
  discountPercent?: number;
};

type UserError = { field: string[] | null; message: string };

function toCalculatedLineItemId(id?: string) {
  if (!id) return undefined;
  if (id.includes("/CalculatedLineItem/")) return id;
  if (id.includes("/LineItem/"))
    return id.replace("/LineItem/", "/CalculatedLineItem/");
  return id;
}

export async function POST(req: Request) {
  const u = username();

  try {
    const body = (await req.json()) as ModifyBody;
    console.log("[Modify] Received", body);

    if (!body?.orderId || !body?.action) {
      return NextResponse.json(
        { error: "orderId and action are required" },
        { status: 400 }
      );
    }

    // Validate action
    if (!["discount", "remove", "add"].includes(body.action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const email = body.email || process.env.KLAVIYO_PROFILE_EMAIL;
    if (!email) {
      return NextResponse.json(
        { error: "Missing Klaviyo profile email" },
        { status: 400 }
      );
    }

    // Step 1 — Verify order belongs to this user
    const check = await shopifyRequest<{ order: { id: string; tags: string[] } | null }>(
      `query($id: ID!) { order(id: $id) { id tags } }`,
      { id: body.orderId }
    );

    if (!check.order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!check.order.tags.includes(u))
      return NextResponse.json({ error: "Forbidden: not your order" }, { status: 403 });

    // Step 2 — Begin edit session
    const begin = await shopifyRequest<{
      orderEditBegin: {
        calculatedOrder: {
          id: string;
          lineItems: {
            edges: Array<{ node: { id: string; title: string; quantity: number } }>;
          };
        } | null;
        userErrors: UserError[];
      };
    }>(
      `
      mutation($id: ID!) {
        orderEditBegin(id: $id) {
          calculatedOrder {
            id
            lineItems(first: 50) { edges { node { id title quantity } } }
          }
          userErrors { field message }
        }
      }
      `,
      { id: body.orderId }
    );

    if (begin.orderEditBegin.userErrors?.length) {
      return NextResponse.json(
        { error: begin.orderEditBegin.userErrors },
        { status: 400 }
      );
    }

    const calculatedOrderId = begin.orderEditBegin.calculatedOrder?.id;
    const calcLineItems = begin.orderEditBegin.calculatedOrder?.lineItems.edges ?? [];

    if (!calculatedOrderId)
      return NextResponse.json({ error: "Failed to start edit session" }, { status: 400 });

    const targetLineItemId =
      toCalculatedLineItemId(body.lineItemId) || calcLineItems[0]?.node?.id;

    if ((body.action === "remove" || body.action === "discount") && !targetLineItemId) {
      return NextResponse.json(
        { error: "No line items found for modification" },
        { status: 400 }
      );
    }

    // Step 3 — Execute the requested action
    if (body.action === "discount") {
      const pct = body.discountPercent ?? 10;

      const mutation = `
        mutation($id: ID!, $lineItemId: ID!, $discount: OrderEditAppliedDiscountInput!) {
          orderEditAddLineItemDiscount(id: $id, lineItemId: $lineItemId, discount: $discount) {
            calculatedOrder { id }
            userErrors { field message }
          }
        }
      `;

      const res = await shopifyRequest<{
        orderEditAddLineItemDiscount: { userErrors: UserError[] };
      }>(mutation, {
        id: calculatedOrderId,
        lineItemId: targetLineItemId,
        discount: {
          percentValue: pct,
          description: `${pct}% Discount (manual apply)`,
        },
      });

      if (res.orderEditAddLineItemDiscount.userErrors?.length)
        return NextResponse.json(
          { error: res.orderEditAddLineItemDiscount.userErrors },
          { status: 400 }
        );
    } else if (body.action === "remove") {
      const res = await shopifyRequest<{
        orderEditSetQuantity: { userErrors: UserError[] };
      }>(
        `
        mutation($id: ID!, $lineItemId: ID!, $quantity: Int!) {
          orderEditSetQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity) {
            calculatedOrder { id }
            userErrors { field message }
          }
        }
        `,
        {
          id: calculatedOrderId,
          lineItemId: targetLineItemId,
          quantity: 0,
        }
      );

      if (res.orderEditSetQuantity.userErrors?.length)
        return NextResponse.json(
          { error: res.orderEditSetQuantity.userErrors },
          { status: 400 }
        );
    } else if (body.action === "add") {
      // ✅ Add item to order
      if (!body.variantId)
        return NextResponse.json({ error: "variantId is required for add" }, { status: 400 });

      const qty = body.quantity && body.quantity > 0 ? body.quantity : 1;

      const mutation = `
        mutation($id: ID!, $variantId: ID!, $quantity: Int!) {
          orderEditAddVariant(id: $id, variantId: $variantId, quantity: $quantity) {
            calculatedOrder { id }
            userErrors { field message }
          }
        }
      `;

      const res = await shopifyRequest<{
        orderEditAddVariant: { userErrors: UserError[] };
      }>(mutation, {
        id: calculatedOrderId,
        variantId: body.variantId,
        quantity: qty,
      });

      if (res.orderEditAddVariant.userErrors?.length)
        return NextResponse.json(
          { error: res.orderEditAddVariant.userErrors },
          { status: 400 }
        );
    }

    // Step 4 — Commit change
    const commit = await shopifyRequest<{
      orderEditCommit: {
        userErrors: UserError[];
        order: { id: string; name: string } | null;
      };
    }>(
      `
      mutation($id: ID!) {
        orderEditCommit(id: $id, notifyCustomer: false) {
          order { id name }
          userErrors { field message }
        }
      }
      `,
      { id: calculatedOrderId }
    );

    if (commit.orderEditCommit.userErrors?.length)
      return NextResponse.json(
        { error: commit.orderEditCommit.userErrors },
        { status: 400 }
      );

    // Step 5 — Send Klaviyo event (do NOT break Shopify success if Klaviyo fails)
    let klaviyoStatus: number | null = null;
    let klaviyoEventId: string | null = null;
    let klaviyoError: string | null = null;

    try {
      const klaviyoRes = await sendKlaviyoEvent({
        metricName: "Order Modified",
        properties: {
          shopifyOrderId: body.orderId,
          username: u,
          action: body.action,
          discountPercent:
            body.action === "discount" ? (body.discountPercent ?? 10) : null,
          lineItemId:
            body.action === "remove" || body.action === "discount"
              ? body.lineItemId ?? null
              : null,
          variantId: body.action === "add" ? body.variantId : null,
          quantity: body.action === "add" ? (body.quantity ?? 1) : null,
        },
        profileEmail: email,
        uniqueId: `${body.orderId}-${body.action}-${Date.now()}`,
      });

      klaviyoStatus = klaviyoRes?.status ?? null;
      klaviyoEventId = klaviyoRes?.body?.data?.id ?? null;

      console.log("[Klaviyo] Order Modified event sent:", {
        orderId: body.orderId,
        username: u,
        action: body.action,
        klaviyoStatus,
        klaviyoEventId,
      });
    } catch (err: any) {
      klaviyoError = err?.message || "Unknown Klaviyo error";
      console.error("[Klaviyo] Failed to send Order Modified event:", klaviyoError);
    }



    // // Step 5 — Send Klaviyo event
    // await sendKlaviyoEvent({
    //   metricName: "Order Modified",
    //   properties: {
    //     shopifyOrderId: body.orderId,
    //     username: u,
    //     action: body.action,
    //     discountPercent: body.action === "discount" ? (body.discountPercent ?? 10) : null,
    //     lineItemId:
    //       body.action === "remove" || body.action === "discount"
    //         ? body.lineItemId ?? null
    //         : null,
    //     variantId: body.action === "add" ? body.variantId : null,
    //     quantity: body.action === "add" ? (body.quantity ?? 1) : null,
    //   },
    //   profileEmail: email,
    //   uniqueId: `${body.orderId}-${body.action}-${Date.now()}`,
    // });

    const message =
      body.action === "discount"
        ? "Discount applied"
        : body.action === "remove"
          ? "Item removed"
          : "Item added";

    return NextResponse.json({
      success: true,
      message: klaviyoError ? `${message} (Klaviyo event failed)` : `${message} (Klaviyo event sent)`,
      klaviyoStatus,
      klaviyoEventId,
      klaviyoError,
      orderName: commit.orderEditCommit.order?.name ?? null,
    });
  } catch (err: any) {
    console.error("[ModifyOrder Error]", err);
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }

  //   return NextResponse.json({ success: true, message });
  // } catch (err: any) {
  //   console.error("[ModifyOrder Error]", err);
  //   return NextResponse.json(
  //     { error: err?.message || "Unknown error" },
  //     { status: 500 }
  //   );
  // }
}
