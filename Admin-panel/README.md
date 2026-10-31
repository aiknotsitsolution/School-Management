# School ERP — Admin Panel

The React/Vite frontend connects to the backend API gateway. In local development,
Vite proxies API requests and Socket.IO connections to `http://localhost:5000`.

## Run locally (Windows)

1. Configure and start the backend:

   ```powershell
   cd "<path-to-repository>\Backend-server"
   Copy-Item .env.example .env  # only if .env does not already exist
   ```

   Set a 32-character-or-longer `JWT_SECRET` and the MongoDB URIs in
   `Backend-server\.env`, and make sure MongoDB is running on port `27017`.
   Install the backend dependencies once, then start the services:

   ```powershell
   npm run install:all
   npm run dev:all
   ```

2. In a second terminal, configure and start the frontend:

   ```powershell
   cd "<path-to-repository>\Admin-panel"
   Copy-Item .env.example .env  # only if .env does not already exist
   npm run dev
   ```

   Open the Vite URL shown in the terminal (usually `http://localhost:5173`).
   The sample `.env` connects to AWS. To use a locally running backend instead,
   set `VITE_API_URL=/api` and leave `VITE_SOCKET_URL` empty so API and realtime
   traffic use the local Vite proxy.

If frontend dependencies are not installed yet, run `npm install` in
`Admin-panel`.

Production builds use same-origin `/api` and Socket.IO URLs, so the browser
does not make cross-origin requests. Deploy the frontend and backend behind the
same HTTPS origin, with the frontend Nginx forwarding `/api/`, `/socket.io/`,
and `/health` to the API gateway. This makes
`https://15.135.215.62/health` available through the frontend origin as well.
The Docker image already uses `/api` and proxies these paths to the gateway
container. A separately hosted static frontend needs a same-origin reverse
proxy; otherwise the backend's `CORS_ORIGIN` must include its exact public
frontend URL.

## Run the complete stack with Docker

From `Backend-server`, configure `.env` as described in the backend Docker
instructions, including random MongoDB passwords and a 32-character-or-longer
`JWT_SECRET`. Then build and run the whole stack:

```powershell
docker compose up --build -d
docker compose ps
```

Open `http://localhost:8080`. The frontend container serves the production
build and proxies `/api` and `/socket.io` to the private backend gateway.
MongoDB and backend services are not published to host ports.

To stop the containers without deleting database data:

```powershell
docker compose down
```

For production deployments, put an HTTPS reverse proxy in front of the frontend,
set `CORS_ORIGIN` to the public HTTPS origin, protect the backend `.env` with
host-level access controls or a secrets manager, and regularly back up and test
restores of the MongoDB volume.
