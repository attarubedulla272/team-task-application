import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Todo from './models/Todo.js';

const app = express();
const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI;
const frontendDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist'
);

app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('/api/todos', async (_request, response) => {
  const todos = await Todo.find().sort({ createdAt: 1 });
  response.json(todos);
});

function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsedDate = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

app.post('/api/todos', async (request, response) => {
  const task = request.body?.task;
  const person = request.body?.person;
  if (typeof task !== 'string' || !task.trim()) {
    return response.status(400).json({ error: 'Task must be a non-empty string.' });
  }
  if (task.trim().length > 200) {
    return response.status(400).json({ error: 'Task must be 200 characters or fewer.' });
  }
  if (typeof person !== 'string' || !person.trim()) {
    return response.status(400).json({ error: 'Person responsible is required.' });
  }
  if (person.trim().length > 100) {
    return response.status(400).json({ error: 'Person name must be 100 characters or fewer.' });
  }
  const { fromDate, toDate } = request.body;
  if (!isCalendarDate(fromDate) || !isCalendarDate(toDate)) {
    return response.status(400).json({ error: 'Provide valid From and To dates.' });
  }
  if (toDate < fromDate) {
    return response.status(400).json({ error: 'To date must be the same as or later than From date.' });
  }

  const todo = await Todo.create({ task: task.trim(), person: person.trim(), fromDate, toDate });
  response.status(201).json(todo);
});

app.patch('/api/todos/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid task ID.' });
  }
  if (typeof request.body?.done !== 'boolean') {
    return response.status(400).json({ error: 'Done must be true or false.' });
  }

  const todo = await Todo.findByIdAndUpdate(
    request.params.id,
    { done: request.body.done },
    { new: true, runValidators: true }
  );
  if (!todo) return response.status(404).json({ error: 'Task not found.' });
  response.json(todo);
});

app.delete('/api/todos/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid task ID.' });
  }

  const todo = await Todo.findByIdAndDelete(request.params.id);
  if (!todo) return response.status(404).json({ error: 'Task not found.' });
  response.json({ message: 'Task deleted.' });
});

app.use('/api', (_request, response) => {
  response.status(404).json({ error: 'API route not found.' });
});

app.use(express.static(frontendDistPath));
app.get('/{*path}', (_request, response, next) => {
  response.sendFile(path.join(frontendDistPath, 'index.html'), (error) => {
    if (error) next(error);
  });
});

app.use((error, _request, response, next) => {
  if (response.headersSent) return next(error);
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Invalid JSON request body.' });
  }

  console.error(error);
  response.status(500).json({ error: 'An unexpected server error occurred.' });
});

async function startServer() {
  if (!mongoUri) {
    throw new Error('MONGODB_URI is missing. Copy backend/.env.example to backend/.env and set it.');
  }

  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    console.log(`Todo API listening on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error('Could not start the Todo API:', error.message);
  process.exitCode = 1;
});
