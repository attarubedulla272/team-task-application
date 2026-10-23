import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import Folder from './models/Folder.js';
import Todo from './models/Todo.js';

const app = express();
const port = Number(process.env.PORT) || 5000;
const mongoUri = process.env.MONGODB_URI;
const frontendDistPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist'
);
function getFileBucket() {
  if (!mongoose.connection.db) {
    throw new Error('MongoDB is not connected.');
  }
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'taskFiles' });
}

app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.get('/api/todos', async (_request, response) => {
  const todos = await Todo.find().populate('folderId', 'name').sort({ createdAt: 1 });
  response.json(todos);
});

app.get('/api/folders', async (_request, response) => {
  const folders = await Folder.find().sort({ name: 1 });
  response.json(folders);
});

app.post('/api/folders', async (request, response) => {
  const name = request.body?.name;
  if (typeof name !== 'string' || !name.trim()) {
    return response.status(400).json({ error: 'Folder name is required.' });
  }
  if (name.trim().length > 60) {
    return response.status(400).json({ error: 'Folder name must be 60 characters or fewer.' });
  }

  const folder = await Folder.create({ name: name.trim() });
  response.status(201).json(folder);
});

app.delete('/api/folders/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid folder ID.' });
  }
  const taskCount = await Todo.countDocuments({ folderId: request.params.id });
  if (taskCount > 0) {
    return response.status(409).json({ error: 'Move or delete tasks in this folder before deleting it.' });
  }

  const folder = await Folder.findByIdAndDelete(request.params.id);
  if (!folder) return response.status(404).json({ error: 'Folder not found.' });
  response.json({ message: 'Folder deleted.' });
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
  const notes = request.body?.notes;
  if (typeof notes !== 'string' || !notes.trim()) {
    return response.status(400).json({ error: 'Task notes are required.' });
  }
  if (notes.trim().length > 5000) {
    return response.status(400).json({ error: 'Notes must be 5000 characters or fewer.' });
  }
  const { fromDate, toDate, folderId = null } = request.body;
  if (!isCalendarDate(fromDate) || !isCalendarDate(toDate)) {
    return response.status(400).json({ error: 'Provide valid From and To dates.' });
  }
  if (toDate < fromDate) {
    return response.status(400).json({ error: 'To date must be the same as or later than From date.' });
  }
  if (folderId !== null && !mongoose.isValidObjectId(folderId)) {
    return response.status(400).json({ error: 'Invalid folder ID.' });
  }
  if (folderId && !(await Folder.exists({ _id: folderId }))) {
    return response.status(404).json({ error: 'Folder not found.' });
  }
  const todo = await Todo.create({
    task: task.trim(),
    person: person.trim(),
    notes: notes.trim(),
    folderId,
    fromDate,
    toDate,
  });
  await todo.populate('folderId', 'name');
  response.status(201).json(todo);
});

app.get('/api/todos/:id/files/:fileId', async (request, response, next) => {
  if (!mongoose.isValidObjectId(request.params.id) || !mongoose.isValidObjectId(request.params.fileId)) {
    return response.status(400).json({ error: 'Invalid task or file ID.' });
  }

  try {
    const todo = await Todo.findById(request.params.id);
    const file = todo?.attachments.find((attachment) => attachment.fileId.toString() === request.params.fileId);
    if (!file) return response.status(404).json({ error: 'Task file not found.' });

    response.type(file.contentType);
    response.set('X-Content-Type-Options', 'nosniff');
    response.attachment(file.filename);
    await pipeline(getFileBucket().openDownloadStream(file.fileId), response);
  } catch (error) {
    if (response.headersSent) return response.destroy(error);
    next(error);
  }
});

app.delete('/api/todos/:id/files/:fileId', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id) || !mongoose.isValidObjectId(request.params.fileId)) {
    return response.status(400).json({ error: 'Invalid task or file ID.' });
  }

  const todo = await Todo.findById(request.params.id);
  const file = todo?.attachments.find((attachment) => attachment.fileId.toString() === request.params.fileId);
  if (!todo || !file) return response.status(404).json({ error: 'Task file not found.' });

  await getFileBucket().delete(file.fileId);
  todo.attachments.pull({ fileId: file.fileId });
  await todo.save();
  response.json({ message: 'File deleted.' });
});

app.put('/api/todos/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid task ID.' });
  }

  const {
    task,
    person,
    notes,
    folderId = null,
    fromDate,
    toDate,
  } = request.body || {};
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
  if (typeof notes !== 'string' || !notes.trim()) {
    return response.status(400).json({ error: 'Task notes are required.' });
  }
  if (notes.trim().length > 5000) {
    return response.status(400).json({ error: 'Notes must be 5000 characters or fewer.' });
  }
  if (!isCalendarDate(fromDate) || !isCalendarDate(toDate)) {
    return response.status(400).json({ error: 'Provide valid From and To dates.' });
  }
  if (toDate < fromDate) {
    return response.status(400).json({ error: 'To date must be the same as or later than From date.' });
  }
  if (folderId !== null && !mongoose.isValidObjectId(folderId)) {
    return response.status(400).json({ error: 'Invalid folder ID.' });
  }
  if (folderId && !(await Folder.exists({ _id: folderId }))) {
    return response.status(404).json({ error: 'Folder not found.' });
  }
  const existingTodo = await Todo.findById(request.params.id);
  if (!existingTodo) return response.status(404).json({ error: 'Task not found.' });
  const todo = await Todo.findByIdAndUpdate(
    request.params.id,
    {
      task: task.trim(),
      person: person.trim(),
      notes: notes.trim(),
      folderId,
      fromDate,
      toDate,
    },
    { new: true, runValidators: true }
  ).populate('folderId', 'name');
  if (!todo) return response.status(404).json({ error: 'Task not found.' });
  response.json(todo);
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
  ).populate('folderId', 'name');
  if (!todo) return response.status(404).json({ error: 'Task not found.' });
  response.json(todo);
});

app.delete('/api/todos/:id', async (request, response) => {
  if (!mongoose.isValidObjectId(request.params.id)) {
    return response.status(400).json({ error: 'Invalid task ID.' });
  }

  const todo = await Todo.findById(request.params.id);
  if (!todo) return response.status(404).json({ error: 'Task not found.' });
  if (todo.attachments?.length) {
    const bucket = getFileBucket();
    await Promise.all(todo.attachments.map(({ fileId }) => bucket.delete(fileId)));
  }
  await todo.deleteOne();
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
  if (error?.code === 11000) {
    return response.status(409).json({ error: 'A folder with that name already exists.' });
  }
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
