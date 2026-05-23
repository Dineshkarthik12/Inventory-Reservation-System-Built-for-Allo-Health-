# Allo Health - Inventory Reservation System

This is a Next.js application built for Allo Health's inventory and order-fulfillment platform. It elegantly solves the race condition of concurrent checkouts by temporarily reserving stock for a short window, ensuring zero overselling and maintaining an optimal user experience.

## Stack
- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL (hosted on Supabase)
- **ORM:** Prisma
- **Caching & Locks:** Redis (via Upstash)
- **Validation:** Zod
- **Styling:** Tailwind CSS + shadcn/ui

## How to Run Locally

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file and fill in your secrets.
   *Note: You will need a hosted PostgreSQL URL (Supabase/Neon works great) and an Upstash Redis URL/Token.*

3. **Database Setup & Seeding:**
   Push the Prisma schema to your database and run the seed script to populate initial warehouses and products:
   ```bash
   npx prisma db push
   npx tsx prisma/seed.ts
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

## The Expiry Mechanism in Production

To ensure that abandoned reservations don't hold up stock forever, we use a hybrid approach:
1. **Vercel Cron Job:** 
   A Vercel cron job is configured via `vercel.json` to hit the `/api/cron/release-expired` endpoint every 1 minute.
2. **Concurrency Safety:** 
   The cron job loops through all `PENDING` reservations where `expiresAt` is in the past. To prevent race conditions (e.g. a user confirming a payment at the exact millisecond the cron fires), the cron job attempts to acquire the **same Redis lock** (`lock:reservation:{id}`) that the checkout confirmation API uses. 
3. **Atomic Rollback:** 
   Once the lock is acquired, it safely sets the reservation status to `RELEASED` and increments the available inventory back via a Prisma transaction. 

## Idempotency
To prevent double-charging or duplicate reservations upon network retries:
- The client generates a unique `Idempotency-Key` (UUID) for critical endpoints (`POST /api/reservations` and `POST /api/reservations/:id/confirm`).
- The server checks Upstash Redis for the key `idempotency:{key}`. 
- If the key exists, the server immediately skips execution and returns the cached HTTP response and status code.
- If it doesn't exist, the server executes the logic, caches the resulting body and status code in Redis for 24 hours, and then returns the response.

## Trade-offs & Future Improvements (If I had more time)

1. **Optimistic UI vs Polling:** 
   Currently, the product listing page polls `/api/products` every 5 seconds to keep stock levels somewhat live. If I had more time, I would implement **Server-Sent Events (SSE)** or **WebSockets** for true real-time stock decrements without hammering the database.
2. **Database Level Constraints vs Application Locks:** 
   I used Redis distributed locks to serialize add-to-cart requests for a specific SKU. While effective, an alternative (and potentially more robust) approach under massive scale is pure database-level concurrency using Postgres row-level locks (`SELECT ... FOR UPDATE`) or raw SQL decrement queries with `WHERE available_quantity >= requested_quantity`.
3. **Queue-based Background Workers:**
   Instead of a Cron job sweeping the database every 60 seconds (which scales poorly if there are millions of reservations), I would use a message broker like AWS SQS or Upstash QStash. When a reservation is created, we would schedule a delayed message for exactly 10 minutes later. A worker would consume that message and release the specific reservation if it's still pending.
