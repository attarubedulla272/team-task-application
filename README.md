# Arayracs Task Planner

The frontend is a React/Vite app. The Express and MongoDB API is maintained separately in [`backend/`](./backend/README.md).

## Run locally

1. Install and start MongoDB locally, or create a MongoDB Atlas database.
2. Configure the backend:

   ```sh
   cd backend
   npm install
   cp .env.example .env
   ```

   Set `MONGODB_URI` in `backend/.env` to your MongoDB connection string.
3. In the `backend` folder, start the API:

   ```sh
   npm run dev
   ```

4. From the project root, start the backend and frontend together:

   ```sh
   npm run dev
   ```

This command waits until MongoDB and the API are ready before starting Vite, preventing startup-time proxy errors. Keep the terminal open while using the app. Vite proxies API requests to `http://localhost:5000`. Tasks require an assignee, notes, and a From/To date range; duration is calculated inclusively in calendar days. Create folders separately and assign tasks to them if desired. New file uploads are disabled. Any files attached previously remain in MongoDB and can still be downloaded or deleted from their task.

## Deploy to Render

This repository includes [`render.yaml`](./render.yaml) for a single Render Web Service. Express serves the production-built React app and the `/api` endpoints from the same service.

1. Push this repository to GitHub.
2. In Render, choose **New > Blueprint**, connect the `team-task-application` GitHub repository, and deploy the detected Blueprint.
3. When prompted, set `MONGODB_URI` to your MongoDB Atlas connection string. Keep this value in Render's environment settings; do not commit it to GitHub.
4. Configure MongoDB Atlas Network Access so the Render service can reach the cluster.
5. After deployment, open the Render service URL. Check `/api/health` if the app reports that it cannot reach the database.

Render will run `npm ci && npm --prefix backend ci && npm run build`, then start the Express server. The web service binds to Render's `PORT` environment variable.
