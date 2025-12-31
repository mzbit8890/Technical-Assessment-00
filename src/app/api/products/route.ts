// app/api/products/route.ts
import { NextResponse } from "next/server";
import { shopifyRequest } from "@/lib/shopifyClient";

type ProductsQuery = {
  products: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        variants: {
          edges: Array<{
            node: { id: string; title: string; price: string };
          }>;
        };
      };
    }>;
  };
};

export async function GET() {
  try {
    const query = `
      query Products($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              variants(first: 20) {
                edges {
                  node {
                    id
                    title
                    price
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await shopifyRequest<ProductsQuery>(query, { first: 10 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Unknown error" },
      { status: 500 }
    );
  }
}
