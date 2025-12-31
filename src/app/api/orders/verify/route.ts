// app/api/orders/verify/route.ts
import { NextResponse } from "next/server";
import { shopifyRequest } from "@/lib/shopifyClient";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const query = `
    query($id: ID!) {
      order(id: $id) {
        id
        name
        totalDiscountsSet { shopMoney { amount currencyCode } }
        currentTotalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 20) {
          edges {
            node {
              id
              title
              quantity
              discountedTotalSet { shopMoney { amount currencyCode } }
              originalTotalSet { shopMoney { amount currencyCode } }
            }
          }
        }
      }
    }
  `;

  const data = await shopifyRequest<{ order: any }>(query, { id });
  return NextResponse.json(data);
}
