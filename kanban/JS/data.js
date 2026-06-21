
window.TaskFlow = window.TaskFlow || {};

(function (TF) {
  'use strict';

  /* -----------------------------------------------------------------
     CONSTANTS
     ----------------------------------------------------------------- */

  const STORAGE_KEY = 'taskflow_pro_tasks_v1';

  const STATUSES = ['backlog', 'todo', 'inprogress', 'done'];

  const STATUS_LABELS = {
    backlog: 'Backlog',
    todo: 'To Do',
    inprogress: 'In Progress',
    done: 'Done'
  };

  const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

  /* -----------------------------------------------------------------
     STATE
     In-memory application state, mirrored to localStorage on every
     mutation. Exposed on TF.state so every module shares one source
     of truth.
     ----------------------------------------------------------------- */

  const state = {
    tasks: [],          // Array of task objects
    filters: {
      search: '',
      priority: 'all',
      category: 'all'
    },
    draggedTaskId: null  // Currently dragged task, used by D&D handlers
  };

  let pendingDeleteId = null; // Task awaiting confirmation in the delete modal

  /* -----------------------------------------------------------------
     PERSISTENCE (localStorage)
     ----------------------------------------------------------------- */

  /** Persist the current task list to localStorage. */
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    } catch (err) {
      console.error('Failed to save tasks to localStorage:', err);
      TF.showToast('Could not save changes locally. Storage may be full.', 'error');
    }
  }

  /** Load tasks from localStorage, or seed with sample data on first run. */
  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          state.tasks = parsed;
          return;
        }
      }
    } catch (err) {
      console.error('Failed to parse tasks from localStorage:', err);
    }
    // First-run experience: seed a handful of example tasks so the board
    // doesn't look empty/broken on first load.
    state.tasks = createSeedTasks();
    saveTasks();
  }

  /** Sample tasks shown on first visit, demonstrating each column/priority. */
  function createSeedTasks() {
    const today = new Date();
    const iso = (offsetDays) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    };

    return [
      {
        id: TF.generateId(),
        title: 'Define Q3 product roadmap',
        description: 'Draft the high-level roadmap themes and review with leadership before the planning offsite.',
        priority: 'high',
        dueDate: iso(5),
        category: 'Strategy',
        status: 'backlog',
        createdAt: Date.now() - 86400000 * 6
      },
      {
        id: TF.generateId(),
        title: 'Research competitor pricing',
        description: 'Collect pricing pages for 5 competitors and summarize tiering strategy.',
        priority: 'low',
        dueDate: '',
        category: 'Research',
        status: 'backlog',
        createdAt: Date.now() - 86400000 * 5
      },
      {
        id: TF.generateId(),
        title: 'Design new onboarding flow',
        description: 'Create wireframes for the revamped first-run experience, focused on reducing drop-off.',
        priority: 'high',
        dueDate: iso(-1),
        category: 'Design',
        status: 'todo',
        createdAt: Date.now() - 86400000 * 4
      },
      {
        id: TF.generateId(),
        title: 'Write API documentation',
        description: 'Document the public REST endpoints, including authentication and rate limits.',
        priority: 'medium',
        dueDate: iso(3),
        category: 'Engineering',
        status: 'todo',
        createdAt: Date.now() - 86400000 * 3
      },
      {
        id: TF.generateId(),
        title: 'Build drag-and-drop board',
        description: 'Implement the Kanban board interactions using native HTML5 drag and drop events.',
        priority: 'high',
        dueDate: iso(1),
        category: 'Engineering',
        status: 'inprogress',
        createdAt: Date.now() - 86400000 * 2
      },
      {
        id: TF.generateId(),
        title: 'Set up analytics dashboard',
        description: 'Wire up the task counters and completion-rate progress bar to live data.',
        priority: 'medium',
        dueDate: iso(2),
        category: 'Engineering',
        status: 'inprogress',
        createdAt: Date.now() - 86400000 * 1
      },
      {
        id: TF.generateId(),
        title: 'Ship landing page redesign',
        description: 'Deployed the new marketing landing page with updated messaging and visuals.',
        priority: 'medium',
        dueDate: iso(-3),
        category: 'Marketing',
        status: 'done',
        createdAt: Date.now() - 86400000 * 8
      },
      {
        id: TF.generateId(),
        title: 'Kickoff meeting with design team',
        description: 'Aligned on scope and timeline for the next sprint.',
        priority: 'low',
        dueDate: iso(-5),
        category: 'Design',
        status: 'done',
        createdAt: Date.now() - 86400000 * 9
      }
    ];
  }

  /* -----------------------------------------------------------------
     TASK CRUD OPERATIONS
     ----------------------------------------------------------------- */

  function addTask(taskData) {
    const newTask = {
      id: TF.generateId(),
      title: taskData.title.trim(),
      description: taskData.description.trim(),
      priority: taskData.priority,
      dueDate: taskData.dueDate,
      category: taskData.category.trim(),
      status: taskData.status,
      createdAt: Date.now()
    };
    state.tasks.push(newTask);
    saveTasks();
    return newTask;
  }

  function updateTask(id, taskData) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task) return null;
    task.title = taskData.title.trim();
    task.description = taskData.description.trim();
    task.priority = taskData.priority;
    task.dueDate = taskData.dueDate;
    task.category = taskData.category.trim();
    task.status = taskData.status;
    saveTasks();
    return task;
  }

  function deleteTask(id) {
    const index = state.tasks.findIndex((t) => t.id === id);
    if (index === -1) return;
    state.tasks.splice(index, 1);
    saveTasks();
  }

  function moveTask(id, newStatus) {
    const task = state.tasks.find((t) => t.id === id);
    if (!task || task.status === newStatus) return false;
    task.status = newStatus;
    saveTasks();
    return true;
  }

  /* -----------------------------------------------------------------
     FILTERING
     ----------------------------------------------------------------- */

  /** Returns the task list filtered by current search + priority + category. */
  function getFilteredTasks() {
    const { search, priority, category } = state.filters;
    const query = search.trim().toLowerCase();

    return state.tasks.filter((task) => {
      const matchesSearch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query);

      const matchesPriority = priority === 'all' || task.priority === priority;
      const matchesCategory = category === 'all' || task.category === category;

      return matchesSearch && matchesPriority && matchesCategory;
    });
  }

  /* -----------------------------------------------------------------
     PUBLIC EXPORTS
     ----------------------------------------------------------------- */

  TF.STORAGE_KEY = STORAGE_KEY;
  TF.STATUSES = STATUSES;
  TF.STATUS_LABELS = STATUS_LABELS;
  TF.PRIORITY_WEIGHT = PRIORITY_WEIGHT;

  TF.state = state;
  TF.getPendingDeleteId = () => pendingDeleteId;
  TF.setPendingDeleteId = (id) => { pendingDeleteId = id; };

  TF.saveTasks = saveTasks;
  TF.loadTasks = loadTasks;

  TF.addTask = addTask;
  TF.updateTask = updateTask;
  TF.deleteTask = deleteTask;
  TF.moveTask = moveTask;

  TF.getFilteredTasks = getFilteredTasks;

})(window.TaskFlow);