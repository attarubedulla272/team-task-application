# Todo application

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

This command waits until MongoDB and the API are ready before starting Vite, preventing startup-time proxy errors. Keep the terminal open while using the app. Vite proxies API requests to `http://localhost:5000`. Each new task requires a responsible person's name and a From/To date range; its duration is calculated inclusively in calendar days and saved with the task.
