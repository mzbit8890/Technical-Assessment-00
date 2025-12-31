// src/app/api/orders/route.ts
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { shopifyRequest } from "@/lib/shopifyClient";
import { sendKlaviyoEvent } from "@/lib/klaviyoClient";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function username() {
  // Use ASSESSMENT_USERNAME to avoid OS "USERNAME" collisions.
  return requiredEnv("ASSESSMENT_USERNAME");
}

type MoneyV2 = { amount: string; currencyCode: string };
type MoneyBag = { shopMoney: MoneyV2 };

// type OrdersQuery = {
//   orders: {
//     edges: Array<{
//       node: {
//         id: string;
//         name: string;
//         createdAt: string;
//         displayFinancialStatus: string;
//         tags: string[];
//         totalPriceSet?: { shopMoney: { amount: string; currencyCode: string } };
//         lineItems: {
//           edges: Array<{
//             node: { id: string; title: string; quantity: number };
//           }>;
//         };
//       };
//     }>;
//   };
// };


type OrdersQuery = {
  orders: {
    edges: Array<{
      node: {
        id: string;
        name: string;
        createdAt: string;
        displayFinancialStatus: string;
        tags: string[];

        totalPriceSet?: MoneyBag | null;
        totalDiscountsSet?: MoneyBag | null;
        currentTotalPriceSet?: MoneyBag | null;

        lineItems: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              quantity: number;
              originalTotalSet?: MoneyBag | null;
              discountedTotalSet?: MoneyBag | null;
            };
          }>;
        };
      };
    }>;
  };
};

export async function GET() {
  try {
    const u = username();

    // const query = `
    //   query MyOrders($first: Int!, $q: String!) {
    //     orders(first: $first, query: $q, reverse: true) {
    //       edges {
    //         node {
    //           id
    //           name
    //           createdAt
    //           displayFinancialStatus
    //           tags
    //           totalPriceSet { shopMoney { amount currencyCode } }
    //           lineItems(first: 20) {
    //             edges { node { id title quantity } }
    //           }
    //         }
    //       }
    //     }
    //   }
    // `;


        const query = `
      query MyOrders($first: Int!, $q: String!) {
        orders(first: $first, query: $q, reverse: true) {
          edges {
            node {
              id
              name
              createdAt
              displayFinancialStatus
              tags

              totalPriceSet { shopMoney { amount currencyCode } }
              totalDiscountsSet { shopMoney { amount currencyCode } }
              currentTotalPriceSet { shopMoney { amount currencyCode } }

              lineItems(first: 20) {
                edges {
                  node {
                    id
                    title
                    quantity
                    originalTotalSet { shopMoney { amount currencyCode } }
                    discountedTotalSet { shopMoney { amount currencyCode } }
                  }
                }
              }
            }
          }
        }
      }
    `;

    // Shopify order search supports tag filters via the query string.
    const data = await shopifyRequest<OrdersQuery>(query, {
      first: 25,
      q: `tag:${u}`,
    });
// ✅ Manually hide specific order names
const hiddenOrders = ["#1087", "#1067", "#1036", "#1016", "#1015", "#1006", "#1004", "#1003"];

// ✅ Filter out unwanted orders
data.orders.edges = data.orders.edges.filter((edge) => {
  const order = edge.node;
  const total =
    parseFloat(
      order.currentTotalPriceSet?.shopMoney?.amount ||
        order.totalPriceSet?.shopMoney?.amount ||
        "0"
    ) || 0;

  const hasItems = order.lineItems.edges.some((li) => (li.node.quantity ?? 0) > 0);

  // ✅ Exclude deleted / empty / manually hidden orders
  return hasItems && total > 0 && !hiddenOrders.includes(order.name);
});
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

type CreateOrderBody = {
  items: Array<{ variantId: string; quantity: number }>;
  email?: string;
};

type OrderCreateMutation = {
  orderCreate: {
    userErrors: Array<{ field: string[] | null; message: string }>;
    order: { id: string; name: string };
  };
};

type TagsAddMutation = {
  tagsAdd: {
    userErrors: Array<{ field: string[] | null; message: string }>;
    node: { id: string } | null;
  };
};

type MarkPaidMutation = {
  orderMarkAsPaid: {
    userErrors: Array<{ field: string[] | null; message: string }>;
    order: { id: string; displayFinancialStatus: string } | null;
  };
};

export async function POST(req: Request) {
  try {
    const u = username();
    const body = (await req.json()) as CreateOrderBody;

    if (!body?.items?.length) {
      return NextResponse.json(
        { error: "items[] is required" },
        { status: 400 }
      );
    }

    // const email =
    //   body.email || process.env.KLAVIYO_PROFILE_EMAIL || "test@example.com";

    const email = body.email || process.env.KLAVIYO_PROFILE_EMAIL;
if (!email) {
  return NextResponse.json(
    { error: "Missing KLAVIYO_PROFILE_EMAIL (set it in .env.local) or pass email in request body." },
    { status: 400 }
  );
}


    // 1) Create order
    const createMutation = `
      mutation CreateOrder($order: OrderCreateOrderInput!) {
        orderCreate(order: $order) {
          userErrors { field message }
          order { id name }
        }
      }
    `;

    const created = await shopifyRequest<OrderCreateMutation>(createMutation, {
      order: {
        lineItems: body.items.map((it) => ({
          variantId: it.variantId,
          quantity: it.quantity,
        })),
        email,
        test: true, // optional, keeps it clearly test data
      },
    });

    const createErrors = created.orderCreate.userErrors;
    if (createErrors?.length) {
      return NextResponse.json({ error: createErrors }, { status: 400 });
    }

    const orderId = created.orderCreate.order.id;

    // 2) Add username tag (data isolation requirement)
    const tagMutation = `
      mutation AddTag($id: ID!, $tags: [String!]!) {
        tagsAdd(id: $id, tags: $tags) {
          userErrors { field message }
          node { id }
        }
      }
    `;

    const tagged = await shopifyRequest<TagsAddMutation>(tagMutation, {
      id: orderId,
      tags: [u],
    });

    const tagErrors = tagged.tagsAdd.userErrors;
    if (tagErrors?.length) {
      return NextResponse.json({ error: tagErrors }, { status: 400 });
    }

    // 3) Mark as paid
    const paidMutation = `
      mutation MarkPaid($input: OrderMarkAsPaidInput!) {
        orderMarkAsPaid(input: $input) {
          userErrors { field message }
          order { id displayFinancialStatus }
        }
      }
    `;

    const paid = await shopifyRequest<MarkPaidMutation>(paidMutation, {
      input: { id: orderId },
    });

    const paidErrors = paid.orderMarkAsPaid.userErrors;
    if (paidErrors?.length) {
      return NextResponse.json({ error: paidErrors }, { status: 400 });
    }

    // 4) Klaviyo event: Order Created (must include orderId + username)
    // await sendKlaviyoEvent({
    //   metricName: "Order Created",
    //   properties: {
    //     shopifyOrderId: orderId,
    //     username: u,
    //   },
    //   profileEmail: email,
    // });
//     await sendKlaviyoEvent({
//   metricName: "Order Created",
//   properties: {
//     shopifyOrderId: orderId,
//     username: u,
//   },
//   profileEmail: email,
//   uniqueId: orderId, // ✅ prevents duplicates for same order
// });

const klaviyoRes: any = await sendKlaviyoEvent({
  metricName: "Order Created",
  properties: {
    shopifyOrderId: orderId,
    username: u,
  },
  profileEmail: email,
  uniqueId: orderId, // ✅ prevents duplicates
});

// ✅ Server console (terminal running next dev)
console.log("[Klaviyo] Order Created sent", {
  orderId,
  username: u,
  email,
  klaviyoStatus: klaviyoRes?.status ?? null,
  klaviyoEventId: klaviyoRes?.body?.data?.id ?? null,
});

console.log("[Klaviyo raw response]", klaviyoRes);


    return NextResponse.json({
      orderId,
      name: created.orderCreate.order.name,
      financialStatus: paid.orderMarkAsPaid.order?.displayFinancialStatus,
      klaviyoEventId: klaviyoRes?.body?.data?.id ?? null,
      klaviyoStatus: klaviyoRes?.status ?? null,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}



