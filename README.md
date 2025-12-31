# Shopify + Klaviyo Order Management (Technical Assessment)

This project implements an **Order Management Interface** integrating with the **Shopify Admin GraphQL API** and the **Klaviyo Events API**.

It covers the assessment requirements end-to-end:
- Fetch products + variants
- Create orders (tagged by username) + mark as paid + send **Order Created** event
- Modify orders (discount / remove item / add item) + send **Order Modified** event
- List only **my** orders (strict data isolation via username tag)

---

## Timeline / Estimated time to complete (actual)
**Completed within 1 day**

- **Started:** Tomorrow at **10:00 PM**
- **Completed:** Today at **11:00 PM**
- Includes regular routine breaks (sleep + food breaks).

> In active working time, this was roughly a “one-day sprint” focused on correctness, data isolation, and clean integration.

---

## Architecture & technology choices

### Frontend
- **React (Next.js App Router) + TypeScript**
- UI is intentionally simple (as requested). Functionality and correctness were prioritized.
- Client state manages:
  - selected variant + quantity
  - cart
  - create order status (loader + errors)
  - orders list + modification actions

### Backend
- Implemented as **Next.js Route Handlers** (API routes) inside the same repository.
- Reason: it keeps secrets (Shopify token + Klaviyo private key) on the server and makes local setup easy.

### API usage compliance
- ✅ Uses **Shopify Admin GraphQL API**
- ❌ Does **not** use Shopify REST API
- ❌ Does **not** use Shopify Storefront API

### Integrations
- **Shopify Admin GraphQL API**
  - Products/Variants
  - Order Create
  - Tags Add
  - Mark as Paid
  - Order Edit for modifications
- **Klaviyo Events API**
  - Sends events from server to avoid exposing private keys in the browser.

---

## Identity requirement & data isolation (important)

Username is derived from email:

**Username = email prefix before `@`**  
Example: `jane.smith@domain.com` → `jane.smith`

This username is used in two places:
1. **Shopify order tag**
   - Every order created is tagged with `ASSESSMENT_USERNAME`.
2. **Klaviyo event property**
   - Every event includes `username` in the payload.

### Data isolation strategy (strict)
- Order listing uses Shopify order search filtered by tag:
  - `query: "tag:<username>"`
- The UI only displays results returned from this filtered query.
- Modify actions are designed to operate only on orders that are part of this filtered set.

This ensures:
- I do **not** view others’ orders
- I do **not** modify others’ orders
- Only orders created under my username are shown and managed

---

## Data flow (Frontend → Backend → Shopify/Klaviyo)

### 1) Product Display
1. React UI calls: `GET /api/products`
2. API route calls Shopify Admin GraphQL:
   - fetch products and variants
3. UI renders products/variants and allows selection + quantity input.

### 2) Create Order
1. React UI sends: `POST /api/orders` with items `{ variantId, quantity }`
2. Backend calls Shopify Admin GraphQL:
   - `orderCreate`
   - `tagsAdd` (adds username tag)
   - `orderMarkAsPaid`
3. Backend sends a Klaviyo event:
   - **Event name:** `Order Created`
   - **Payload includes:** `shopifyOrderId`, `username`
4. UI refreshes orders list and keeps a loader visible until the new order appears.

### 3) Modify Order
1. React UI calls: `POST /api/orders/modify` with `{ orderId, action, payload }`
2. Backend validates ownership (username tag) before editing.
3. Backend uses Shopify Admin GraphQL order edit flow:
   - begin edit → apply change (discount/remove/add) → commit edit
4. Backend sends Klaviyo event:
   - **Event name:** `Order Modified`
   - **Payload includes:** `shopifyOrderId`, `username`, `action` (and relevant details)
5. UI refreshes orders list after modification.

### 4) Order Listing
1. React UI calls: `GET /api/orders`
2. Backend calls Shopify Admin GraphQL using:
   - `query: "tag:<username>"`
3. UI displays only the returned orders (already filtered + isolated).

---

## Assumptions made
- Shopify token has required permissions for:
  - Products read
  - Order create/edit/tag
  - Mark as paid
- This is a development store and test orders are acceptable.
- Shopify order search may lag slightly after creation (eventual consistency), so UI includes a loader/poll until the order is visible.
- Klaviyo profile email is available through env or request body.

---

## How this could scale in production
If this were production-grade (multi-user, high traffic), I would evolve it like this:

**Security**
- Add authentication (sessions/JWT) and derive username from the logged-in user, not env.
- Enforce server-side authorization on every order action.

**Reliability**
- Add retry/backoff for Shopify + Klaviyo calls.
- Use a background queue for Klaviyo events (SQS/BullMQ/Redis) so Shopify actions remain fast and resilient.

**Performance**
- Pagination and infinite scroll for orders/products.
- Short TTL caching for product catalog.
- Use Shopify webhooks for real-time order updates rather than polling.

**Observability**
- Structured logs, request tracing, error monitoring (e.g., Sentry).
- Store Klaviyo delivery status for auditing and retries.

---

## Running locally

2) Create .env.local at project root:
Create a file named .env.local in the project root and add the following variables:Shopify_Development_Store_URL=""

Shopify_Admin_GraphQL_API_Access_Token=""
Klaviyo_Public_API_Key="RN7x7i"
Klaviyo_Private_API_Key=""
ASSESSMENT_USERNAME=""
SHOPIFY_API_VERSION="2024-10"
KLAVIYO_PROFILE_EMAIL=""


### Prerequisites
- Node.js **18+** (recommended 20+)
- npm (or pnpm/yarn)

### 1) Install dependencies
```bash
npm install

Open:
http://localhost:3000

