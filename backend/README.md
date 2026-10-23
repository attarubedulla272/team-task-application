# Todo API

Express API with MongoDB persistence using Mongoose.

## Setup

1. Install MongoDB locally or create a MongoDB Atlas database.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string.
4. From the project root, run `npm run dev`. This waits for MongoDB and the API, then starts Vite.

Keep that terminal open while using the app. Vite forwards `/api` requests to the backend in development. To run only the API while debugging, use `npm run dev` from this `backend` folder.

## Endpoints

- `GET /api/health` — backend and database status
- `GET /api/todos` — list todos
- `POST /api/todos` — create a todo using `{ "task": "...", "person": "...", "fromDate": "2026-10-24", "toDate": "2026-10-26" }`
- `PATCH /api/todos/:id` — update completion using `{ "done": true }`
- `DELETE /api/todos/:id` — delete a todo

New todos require a person name and valid `fromDate` and `toDate` values in `YYYY-MM-DD` format. The To date cannot be earlier than the From date. The frontend calculates the range duration inclusively in calendar days.
