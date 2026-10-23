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

function App() {
  const [todo, settodo] = useState([]);
  const [newtodo, setnewtodo] = useState("");
  const [personName, setPersonName] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTodos() {
      try {
        const result = await requestApi('/api/todos');
        if (!Array.isArray(result)) throw new Error('The todo API returned an invalid task list.');
        settodo(result);
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
    if (!task) return;
    if (!person) {
      setError('Enter the name of the person responsible for this task.');
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
        body: JSON.stringify({ task, person, fromDate, toDate }),
      });
      settodo((currentTodos) => [...currentTodos, result]);
      setnewtodo('');
      setPersonName('');
      setFromDate('');
      setToDate('');
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

  return (
    <main className="todo-app">
      <header className="app-header">
        <div className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">✓</span>
            <span className="brand-name">daymark<span>.</span></span>
          </div>
          <span className="workspace-label">PERSONAL WORKSPACE</span>
          <span className="today-date">{todayLabel}</span>
        </div>
        <div className="welcome">
          <p className="eyebrow">YOUR DAY, IN FOCUS</p>
          <h1>Make room for what matters.</h1>
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
            {error && <p className="todo-error" role="alert">{error}</p>}
            <ul className="todo-list">
              {loading ? <li className="todo-status">Loading tasks...</li> : todo.map((item) => (
                <li className={`todo-item${item.done ? ' is-done' : ''}`} key={item.id}>
                  <div className="todo-content">
                    <span className="todo-task">{item.task}</span>
                    <span className="todo-person">
                      <span className="person-avatar" aria-hidden="true">
                        {(item.person || 'U').trim().charAt(0).toUpperCase()}
                      </span>
                      {item.person || 'Unassigned'}
                    </span>
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
                  </div>
                  <div className="todo-actions">
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
              {!loading && !error && todo.length === 0 && (
                <li className="empty-state">
                  <span className="empty-icon" aria-hidden="true">✦</span>
                  <strong>Your list is clear</strong>
                  <span>Add a task to your workspace to get started.</span>
                </li>
              )}
            </ul>
            <p className="list-footer">
              {todo.length === 0
                ? 'A fresh start whenever you need it.'
                : `${activeCount} ${activeCount === 1 ? 'task' : 'tasks'} left to focus on`}
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

export default App;
