// src/lib/shopifyClient.ts
type ShopifyGraphQLResponse<T> = {
  data?: T;
  errors?: any[];
};

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function shopifyRequest<T>(
  query: string,
  variables?: Record<string, any>
): Promise<T> {
  const storeUrl = requiredEnv("Shopify_Development_Store_URL").replace(/\/$/, "");
  const token = requiredEnv("Shopify_Admin_GraphQL_API_Access_Token");
  const version = process.env.SHOPIFY_API_VERSION || "2024-10";

  const endpoint = `${storeUrl}/admin/api/${version}/graphql.json`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  const json: ShopifyGraphQLResponse<T> = await res.json();

  if (!res.ok) {
    throw new Error(`Shopify HTTP error ${res.status}: ${JSON.stringify(json)}`);
  }
  if (json.errors?.length) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
  }
  if (!json.data) {
    throw new Error("Shopify: missing data in response");
  }

  return json.data;
}
