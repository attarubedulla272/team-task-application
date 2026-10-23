import { useEffect, useState } from 'react';
import './App.css';

async function requestApi(url, options) {
  let response;

  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('Cannot reach the todo API. Start the backend with "cd backend && npm run dev".');
  }

  const responseText = await response.text();
  let result = null;

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error(
        `The todo API returned an invalid response (HTTP ${response.status}). Check the backend terminal.`
      );
    }
  }

  if (!response.ok) {
    if (response.status === 502) {
      throw new Error('The todo backend is unavailable. Start both services with "npm run dev" from the project root.');
    }
    throw new Error(result?.error || `The todo API request failed (HTTP ${response.status}).`);
  }

  if (response.status !== 204 && result === null) {
    throw new Error(
      `The todo API returned an empty response (HTTP ${response.status}). Check that the backend is running.`
    );
  }

  return result;
}

function formatTaskDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const parsedDate = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return null;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsedDate);
}

function getDurationDays(fromDate, toDate) {
  if (!formatTaskDate(fromDate) || !formatTaskDate(toDate) || toDate < fromDate) return null;

  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
  const from = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const to = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.floor((to - from) / 86_400_000) + 1;
}

function getFolderId(value) {
  if (!value) return '';
  return typeof value === 'object' ? value.id || value._id : value;
}

function App() {
  const [todo, settodo] = useState([]);
  const [folders, setFolders] = useState([]);
  const [newtodo, setnewtodo] = useState("");
  const [personName, setPersonName] = useState('');
  const [notes, setNotes] = useState('');
  const [folderId, setFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [editingTodo, setEditingTodo] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editError, setEditError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTodos() {
      try {
        const [todosResult, foldersResult] = await Promise.all([
          requestApi('/api/todos'),
          requestApi('/api/folders'),
        ]);
        if (!Array.isArray(todosResult) || !Array.isArray(foldersResult)) {
          throw new Error('The API returned invalid task or folder data.');
        }
        settodo(todosResult);
        setFolders(foldersResult);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadTodos();
  }, []);

  const getvalue = (event) => {
    setnewtodo(event.target.value);
  };

  const submithandler = async (event) => {
    event.preventDefault();
    const task = newtodo.trim();
    const person = personName.trim();
    const taskNotes = notes.trim();
    if (!task) return;
    if (!person) {
      setError('Enter the name of the person responsible for this task.');
      return;
    }
    if (!taskNotes) {
      setError('Add notes to describe this task.');
      return;
    }
    if (!fromDate || !toDate) {
      setError('Choose both a From date and a To date.');
      return;
    }
    if (!formatTaskDate(fromDate) || !formatTaskDate(toDate) || toDate < fromDate) {
      setError('The To date must be the same as or later than the From date.');
      return;
    }
    try {
      setError('');
      const result = await requestApi('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          person,
          notes: taskNotes,
          fromDate,
          toDate,
          folderId: folderId || null,
        }),
      });
      settodo((currentTodos) => [...currentTodos, result]);
      setnewtodo('');
      setPersonName('');
      setNotes('');
      setFolderId('');
      setFromDate('');
      setToDate('');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const createFolder = async (event) => {
    event.preventDefault();
    const name = newFolderName.trim();
    if (!name) return;

    try {
      setError('');
      const folder = await requestApi('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setFolders((currentFolders) =>
        [...currentFolders, folder].sort((left, right) => left.name.localeCompare(right.name))
      );
      setFolderId(folder.id);
      setNewFolderName('');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const deleteFolder = async (folder) => {
    try {
      setError('');
      await requestApi(`/api/folders/${folder.id}`, { method: 'DELETE' });
      setFolders((currentFolders) => currentFolders.filter((item) => item.id !== folder.id));
      if (folderId === folder.id) setFolderId('');
      if (selectedFolder === folder.id) setSelectedFolder('all');
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const deleteTaskFile = async (item, file) => {
    try {
      setError('');
      await requestApi(`/api/todos/${item.id}/files/${file.fileId}`, { method: 'DELETE' });
      settodo((currentTodos) =>
        currentTodos.map((currentItem) => currentItem.id === item.id
          ? {
            ...currentItem,
            attachments: (currentItem.attachments || []).filter((attachment) => attachment.fileId !== file.fileId),
          }
          : currentItem)
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const deleteTodo = async (id) => {
    try {
      setError('');
      await requestApi(`/api/todos/${id}`, { method: 'DELETE' });
      settodo((currentTodos) => currentTodos.filter((item) => item.id !== id));
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const startEditingTodo = (item) => {
    setEditingTodo(item);
    setEditForm({
      task: item.task,
      person: item.person || '',
      notes: item.notes || '',
      folderId: getFolderId(item.folderId),
      fromDate: item.fromDate || '',
      toDate: item.toDate || '',
    });
    setEditError('');
  };

  const saveTodoEdits = async (event) => {
    event.preventDefault();
    if (!editingTodo || !editForm) return;
    const changes = {
      ...editForm,
      task: editForm.task.trim(),
      person: editForm.person.trim(),
      notes: editForm.notes.trim(),
      folderId: editForm.folderId || null,
    };
    if (!changes.task || !changes.person || !changes.notes) {
      setEditError('Task, person, and notes are required.');
      return;
    }
    if (!formatTaskDate(changes.fromDate) || !formatTaskDate(changes.toDate) || changes.toDate < changes.fromDate) {
      setEditError('The due date must be the same as or later than the start date.');
      return;
    }

    try {
      setEditError('');
      const updatedTodo = await requestApi(`/api/todos/${editingTodo.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      settodo((currentTodos) =>
        currentTodos.map((item) => item.id === updatedTodo.id ? updatedTodo : item)
      );
      setEditingTodo(null);
      setEditForm(null);
    } catch (requestError) {
      setEditError(requestError.message);
    }
  };

  const toggleTodo = async (item) => {
    try {
      setError('');
      const result = await requestApi(`/api/todos/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !item.done }),
      });
      settodo((currentTodos) =>
        currentTodos.map((currentItem) =>
          currentItem.id === item.id ? result : currentItem
        )
      );
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  const completedCount = todo.filter((item) => item.done).length;
  const activeCount = todo.length - completedCount;
  const completionPercentage = todo.length
    ? Math.round((completedCount / todo.length) * 100)
    : 0;
  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date());
  const filteredTodos = todo.filter((item) => {
    if (selectedFolder === 'all') return true;
    if (selectedFolder === 'unfiled') return !getFolderId(item.folderId);
    return getFolderId(item.folderId) === selectedFolder;
  });
  const folderCounts = folders.map((folder) => ({
    ...folder,
    taskCount: todo.filter((item) => getFolderId(item.folderId) === folder.id).length,
  }));
  const unfiledCount = todo.filter((item) => !getFolderId(item.folderId)).length;

  return (
    <main className="todo-app">
      <header className="app-header">
        <div className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">✓</span>
            <span className="brand-name">arayracs<span>.</span></span>
          </div>
          <span className="workspace-label">ARAYRACS WORKSPACE</span>
          <span className="today-date">{todayLabel}</span>
        </div>
        <div className="welcome">
          <p className="eyebrow">YOUR DAY, IN FOCUS</p>
          <h1>Plan your work. Make progress.</h1>
          <p className="app-description">A little structure goes a long way. What would you like to accomplish?</p>
        </div>
      </header>
      <div className="dashboard-content">
        <section className="overview" aria-label="Task overview">
          <article className="overview-card">
            <span className="overview-icon total-icon" aria-hidden="true">☷</span>
            <div>
              <span className="overview-label">All tasks</span>
              <strong>{todo.length}</strong>
            </div>
          </article>
          <article className="overview-card">
            <span className="overview-icon active-icon" aria-hidden="true">◷</span>
            <div>
              <span className="overview-label">In progress</span>
              <strong>{activeCount}</strong>
            </div>
          </article>
          <article className="overview-card completed-overview">
            <span className="overview-icon completed-icon" aria-hidden="true">✓</span>
            <div>
              <span className="overview-label">Completed</span>
              <strong>{completedCount}</strong>
            </div>
          </article>
          <article className="progress-card">
            <div className="progress-copy">
              <span className="overview-label">Daily progress</span>
              <strong>{completionPercentage}%</strong>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Daily task completion"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={completionPercentage}
            >
              <span style={{ width: `${completionPercentage}%` }} />
            </div>
            <span className="progress-caption">
              {todo.length === 0 ? 'Add a task to get started' : `${completedCount} of ${todo.length} tasks complete`}
            </span>
          </article>
        </section>

        <div className="workspace-grid">
          <section className="composer-panel" aria-labelledby="add-task-heading">
            <div className="section-heading">
              <div>
                <p className="section-label">GET IT OUT OF YOUR HEAD</p>
                <h2 id="add-task-heading">Add a task</h2>
              </div>
              <span className="section-heading-mark" aria-hidden="true">+</span>
            </div>
            <form className="todo-form" onSubmit={submithandler}>
              <label className="task-input-label">
                <span>Task</span>
                <input
                  type="text"
                  aria-label="Add a task"
                  placeholder="e.g. Prepare the project update"
                  required
                  value={newtodo}
                  onChange={getvalue}
                />
              </label>
              <label className="person-input">
                <span>Person responsible</span>
                <input
                  type="text"
                  aria-label="Person responsible for this task"
                  placeholder="Who will take this on?"
                  maxLength={100}
                  required
                  value={personName}
                  onChange={(event) => setPersonName(event.target.value)}
                />
              </label>
              <label className="notes-input">
                <span>Notes</span>
                <textarea
                  aria-label="Task notes"
                  placeholder="Add context, instructions, or details..."
                  maxLength={5000}
                  required
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
                <small>{notes.length}/5000</small>
              </label>
              <label className="folder-select">
                <span>Folder</span>
                <select
                  aria-label="Task folder"
                  value={folderId}
                  onChange={(event) => setFolderId(event.target.value)}
                >
                  <option value="">No folder</option>
                  {folders.map((folder) => (
                    <option value={folder.id} key={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </label>
              <div className="date-range-inputs">
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    aria-label="From date"
                    required
                    value={fromDate}
                    onChange={(event) => setFromDate(event.target.value)}
                  />
                </label>
                <label>
                  <span>Due date</span>
                  <input
                    type="date"
                    aria-label="To date"
                    min={fromDate || undefined}
                    required
                    value={toDate}
                    onChange={(event) => setToDate(event.target.value)}
                  />
                </label>
              </div>
              <div className="form-footer">
                <p className="duration-preview">
                  <span className="duration-dot" aria-hidden="true" />
                  {getDurationDays(fromDate, toDate) === null
                    ? 'Choose dates to see duration'
                    : `${getDurationDays(fromDate, toDate)} ${getDurationDays(fromDate, toDate) === 1 ? 'day' : 'days'} planned`}
                </p>
                <button type="submit"><span aria-hidden="true">+</span> Add task</button>
              </div>
            </form>
            <section className="folder-manager" aria-labelledby="folder-manager-heading">
              <div className="folder-manager-heading">
                <div>
                  <p className="section-label">KEEP THINGS ORGANIZED</p>
                  <h3 id="folder-manager-heading">Manage folders</h3>
                </div>
              </div>
              <form className="folder-create-form" onSubmit={createFolder}>
                <input
                  type="text"
                  aria-label="New folder name"
                  placeholder="e.g. Work, Home, Projects"
                  maxLength={60}
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                />
                <button type="submit" disabled={!newFolderName.trim()}>Create</button>
              </form>
              <ul className="folder-manager-list">
                {folders.map((folder) => (
                  <li key={folder.id}>
                    <span className="folder-symbol" aria-hidden="true">▰</span>
                    <span>{folder.name}</span>
                    <button type="button" onClick={() => deleteFolder(folder)} aria-label={`Delete ${folder.name} folder`}>×</button>
                  </li>
                ))}
                {folders.length === 0 && <li className="folder-empty">Create a folder to group related tasks.</li>}
              </ul>
            </section>
          </section>

          <section className="task-panel" aria-label="Your tasks">
            <div className="task-heading">
              <div>
                <p className="section-label">YOUR WORKLOAD</p>
                <h2>Task list</h2>
              </div>
              <span className="task-count">
                {completedCount} <span>/</span> {todo.length} done
              </span>
            </div>
            <nav className="folder-filters" aria-label="Filter tasks by folder">
              <button
                type="button"
                className={selectedFolder === 'all' ? 'is-selected' : ''}
                aria-pressed={selectedFolder === 'all'}
                onClick={() => setSelectedFolder('all')}
              >
                All tasks <span>{todo.length}</span>
              </button>
              <button
                type="button"
                className={selectedFolder === 'unfiled' ? 'is-selected' : ''}
                aria-pressed={selectedFolder === 'unfiled'}
                onClick={() => setSelectedFolder('unfiled')}
              >
                Unfiled <span>{unfiledCount}</span>
              </button>
              {folderCounts.map((folder) => (
                <button
                  type="button"
                  key={folder.id}
                  className={selectedFolder === folder.id ? 'is-selected' : ''}
                  aria-pressed={selectedFolder === folder.id}
                  onClick={() => setSelectedFolder(folder.id)}
                >
                  {folder.name} <span>{folder.taskCount}</span>
                </button>
              ))}
            </nav>
            {error && <p className="todo-error" role="alert">{error}</p>}
            <ul className="todo-list">
              {loading ? <li className="todo-status">Loading tasks...</li> : filteredTodos.map((item) => (
                <li className={`todo-item${item.done ? ' is-done' : ''}`} key={item.id}>
                  <div className="todo-content">
                    <span className="todo-task">{item.task}</span>
                    <span className="todo-person">
                      <span className="person-avatar" aria-hidden="true">
                        {(item.person || 'U').trim().charAt(0).toUpperCase()}
                      </span>
                      {item.person || 'Unassigned'}
                    </span>
                    {item.notes && <p className="todo-notes">{item.notes}</p>}
                    {item.folderId?.name && (
                      <span className="todo-folder-label">
                        <span aria-hidden="true">▰</span> {item.folderId.name}
                      </span>
                    )}
                    <span className="todo-date-range">
                      {formatTaskDate(item.fromDate) && formatTaskDate(item.toDate) && getDurationDays(item.fromDate, item.toDate) !== null
                        ? <>
                          <time dateTime={item.fromDate}>{formatTaskDate(item.fromDate)}</time>
                          <span aria-hidden="true"> → </span>
                          <time dateTime={item.toDate}>{formatTaskDate(item.toDate)}</time>
                          <span className="todo-duration">
                            {getDurationDays(item.fromDate, item.toDate)} {getDurationDays(item.fromDate, item.toDate) === 1 ? 'day' : 'days'}
                          </span>
                        </>
                        : 'No date range'}
                    </span>
                    {formatTaskDate(item.createdAt) && (
                      <time className="todo-created-date" dateTime={item.createdAt}>
                        Created {formatTaskDate(item.createdAt)}
                      </time>
                    )}
                    {item.attachments?.length > 0 && (
                      <ul className="task-files" aria-label={`Files attached to ${item.task}`}>
                        {item.attachments.map((file) => (
                          <li key={file.fileId}>
                            <a href={`/api/todos/${item.id}/files/${file.fileId}`} title={file.filename}>
                              <span aria-hidden="true">↧</span>
                              {file.filename}
                              <small>{(file.size / (1024 * 1024)).toFixed(2)} MB</small>
                            </a>
                            <button type="button" onClick={() => deleteTaskFile(item, file)} aria-label={`Delete ${file.filename}`}>×</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="todo-actions">
                    <button
                      className="edit-button"
                      type="button"
                      onClick={() => startEditingTodo(item)}
                      aria-label={`Edit ${item.task}`}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="m13.5 3.5 3 3M4 16l3.4-.7L16 6.7 13.3 4 4.7 12.6 4 16Z" />
                      </svg>
                    </button>
                    <button
                      className="done-button"
                      type="button"
                      onClick={() => toggleTodo(item)}
                      aria-label={item.done ? `Mark ${item.task} as not done` : `Mark ${item.task} as done`}
                      aria-pressed={item.done}
                    >
                      ✓
                    </button>
                    <button
                      className="delete-button"
                      type="button"
                      onClick={() => deleteTodo(item.id)}
                      aria-label={`Delete ${item.task}`}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M4 6h12M8 6V4h4v2m-6 0 1 10h6l1-10M9 9v4m2-4v4" />
                      </svg>
                    </button>
                  </div>
                </li>
              ))}
              {!loading && !error && filteredTodos.length === 0 && (
                <li className="empty-state">
                  <span className="empty-icon" aria-hidden="true">✦</span>
                  <strong>{todo.length === 0 ? 'Your list is clear' : 'No tasks in this folder'}</strong>
                  <span>{todo.length === 0 ? 'Add a task to your workspace to get started.' : 'Choose another folder or add a task here.'}</span>
                </li>
              )}
            </ul>
            <p className="list-footer">
              {filteredTodos.length === 0
                ? 'A fresh start whenever you need it.'
                : `${filteredTodos.filter((item) => !item.done).length} ${filteredTodos.filter((item) => !item.done).length === 1 ? 'task' : 'tasks'} left to focus on`}
            </p>
          </section>
        </div>
      </div>
      {editingTodo && editForm && (
        <div
          className="edit-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setEditingTodo(null);
              setEditForm(null);
            }
          }}
        >
          <section
            className="edit-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-task-heading"
          >
            <div className="section-heading">
              <div>
                <p className="section-label">UPDATE YOUR WORK</p>
                <h2 id="edit-task-heading">Edit task</h2>
              </div>
              <button
                className="edit-modal-close"
                type="button"
                aria-label="Close edit task"
                onClick={() => {
                  setEditingTodo(null);
                  setEditForm(null);
                }}
              >
                ×
              </button>
            </div>
            <form className="todo-form" onSubmit={saveTodoEdits}>
              <label>
                <span>Task</span>
                <input
                  type="text"
                  maxLength={200}
                  required
                  value={editForm.task}
                  onChange={(event) => setEditForm({ ...editForm, task: event.target.value })}
                />
              </label>
              <label>
                <span>Person responsible</span>
                <input
                  type="text"
                  maxLength={100}
                  required
                  value={editForm.person}
                  onChange={(event) => setEditForm({ ...editForm, person: event.target.value })}
                />
              </label>
              <label>
                <span>Notes</span>
                <textarea
                  maxLength={5000}
                  required
                  rows={4}
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                />
                <small>{editForm.notes.length}/5000</small>
              </label>
              <label>
                <span>Folder</span>
                <select
                  value={editForm.folderId}
                  onChange={(event) => setEditForm({ ...editForm, folderId: event.target.value })}
                >
                  <option value="">No folder</option>
                  {folders.map((folder) => (
                    <option value={folder.id} key={folder.id}>{folder.name}</option>
                  ))}
                </select>
              </label>
              <div className="date-range-inputs">
                <label>
                  <span>Start date</span>
                  <input
                    type="date"
                    required
                    value={editForm.fromDate}
                    onChange={(event) => setEditForm({ ...editForm, fromDate: event.target.value })}
                  />
                </label>
                <label>
                  <span>Due date</span>
                  <input
                    type="date"
                    min={editForm.fromDate || undefined}
                    required
                    value={editForm.toDate}
                    onChange={(event) => setEditForm({ ...editForm, toDate: event.target.value })}
                  />
                </label>
              </div>
              {editError && <p className="todo-error" role="alert">{editError}</p>}
              <div className="edit-modal-actions">
                <button
                  className="edit-cancel-button"
                  type="button"
                  onClick={() => {
                    setEditingTodo(null);
                    setEditForm(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit">Save changes</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
