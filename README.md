# Coffee Shop Management

A full-stack coffee shop ordering and staff management application. The customer interface is built with React and the Fetch API; an Express REST API stores menu items and orders as JSON values in Redis.

## Features

- Browse an availability-aware coffee, tea, pastry and food menu.
- Build a cart, submit an order and receive its unique order number.
- Look up an order's current status using its order number.
- Staff sign-in using a server-configured bearer token.
- Staff menu CRUD, order status processing and daily sales/order summaries.
- Redis-backed records survive API restarts; the API does not silently fall back to in-memory storage.
- Request validation, consistent JSON errors, CORS configuration and API health check.

## Requirements

- Node.js 20 or newer
- npm 10 or newer
- Redis 6 or newer (local or hosted, with persistence enabled for production)

## Run locally

1. Copy `server/.env.example` to `server/.env`.
2. Set `REDIS_URL` to a running Redis instance and set a long random `STAFF_API_TOKEN`.
3. From this directory, run:

   ```sh
   npm install
   npm run dev
   ```

4. Open <http://localhost:5173>. The API listens on <http://localhost:3001>.

The sample menu is inserted into an empty Redis database at API startup. To initialize hosted Redis, start the API once after configuring its connection.

## API

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | API and Redis health |
| GET | `/api/menu` | Public | List menu items |
| GET | `/api/menu/:id` | Public | Read one menu item |
| POST | `/api/menu` | Staff token | Add a menu item |
| PUT | `/api/menu/:id` | Staff token | Update a menu item |
| DELETE | `/api/menu/:id` | Staff token | Delete a menu item |
| POST | `/api/orders` | Public | Place an order |
| GET | `/api/orders` | Staff token | List orders |
| GET | `/api/orders/summary/daily` | Staff token | Today's order and sales summary |
| GET | `/api/orders/:id` | Public | Read status for an order ID |
| PATCH | `/api/orders/:id/status` | Staff token | Update order status |

Send staff requests with `Authorization: Bearer <STAFF_API_TOKEN>`. Public order lookups only return the order number, status, timestamps and total—not customer details.

## Deploy

### Backend (Render)

1. Create a persistent Redis instance and copy its private connection URL.
2. Create a Render Web Service from this repository. Set the root directory to `server`, build command to `npm install`, and start command to `npm start`.
3. Configure `REDIS_URL`, `STAFF_API_TOKEN` (a long random secret) and `CORS_ORIGIN` (the deployed frontend origin) as Render environment variables. Do not commit credentials.
4. Verify `https://<your-api-host>/api/health` reports `"status":"ok"`.

### Frontend (Netlify or Vercel)

1. Set the base directory to `client`, build command to `npm run build`, and publish/output directory to `dist`.
2. Set `VITE_API_URL` to the backend origin, for example `https://<your-api-host>` (no trailing slash).
3. Redeploy after setting the variable. Configure the same deployed frontend origin in the backend's `CORS_ORIGIN`.

`VITE_API_URL` is public configuration. Never put the staff token or Redis credentials in frontend environment variables.

## Tests

Run API unit tests with `npm test`. Build the frontend with `npm run build`.

## Contributions

Record each group's work in [CONTRIBUTIONS.md](./CONTRIBUTIONS.md), including the member, contribution and date. Use feature branches and review changes before merging.
