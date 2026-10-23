# Todo API

Express API with MongoDB persistence using Mongoose. Previously uploaded task attachments remain stored in MongoDB GridFS and can still be downloaded or deleted; new uploads are disabled.

## Setup

1. Install MongoDB locally or create a MongoDB Atlas database.
2. In this folder, run `npm install`.
3. Copy `.env.example` to `.env` and set `MONGODB_URI` to your MongoDB connection string.
4. From the project root, run `npm run dev`. This waits for MongoDB and the API, then starts Vite.

Keep that terminal open while using the app. Vite forwards `/api` requests to the backend in development. To run only the API while debugging, use `npm run dev` from this `backend` folder.

## Endpoints

- `GET /api/health` — backend and database status
- `GET /api/todos` — list todos with folder and attachment metadata
- `POST /api/todos` — create a todo with `task`, `person`, required `notes`, date range, and optional `folderId`
- `PUT /api/todos/:id` — update task details
- `PATCH /api/todos/:id` — update completion using `{ "done": true }`
- `DELETE /api/todos/:id` — delete a task and its attached files
- `GET /api/todos/:id/files/:fileId` — download a task attachment
- `DELETE /api/todos/:id/files/:fileId` — delete a task attachment
- `GET /api/folders` — list folders
- `POST /api/folders` — create a folder using `{ "name": "Projects" }`
- `DELETE /api/folders/:id` — delete an empty folder; returns `409` if tasks are still assigned

New todos require a person name, non-empty notes, and valid `fromDate` and `toDate` values in `YYYY-MM-DD` format. The To date cannot be earlier than the From date. Folder assignment is optional. The frontend calculates date duration inclusively in calendar days.
