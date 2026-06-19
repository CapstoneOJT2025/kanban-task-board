/* ===================================================================
   TaskFlow Pro — Application Logic
   Vanilla JS Kanban board: state, rendering, drag & drop, persistence.
   =================================================================== */

(function () {
  'use strict';

  /* -----------------------------------------------------------------
     1. CONSTANTS & STATE
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

  // In-memory application state, mirrored to localStorage on every mutation.
  let state = {
    tasks: [],          // Array of task objects
    filters: {
      search: '',
      priority: 'all',
      category: 'all'
    },
    draggedTaskId: null  // Currently dragged task, used by HTML5 D&D handlers
  };

  /* -----------------------------------------------------------------
     2. DOM REFERENCES
     ----------------------------------------------------------------- */

  const dom = {
    // Topbar
    searchInput: document.getElementById('searchInput'),
    searchClearBtn: document.getElementById('searchClearBtn'),
    addTaskBtn: document.getElementById('addTaskBtn'),

    // Dashboard
    statTotal: document.getElementById('statTotal'),
    statCompleted: document.getElementById('statCompleted'),
    statPending: document.getElementById('statPending'),
    statRate: document.getElementById('statRate'),
    progressBarFill: document.getElementById('progressBarFill'),
    progressBar: document.getElementById('progressBar'),

    // Toolbar / filters
    priorityFilter: document.getElementById('priorityFilter'),
    categoryFilter: document.getElementById('categoryFilter'),
    clearFiltersBtn: document.getElementById('clearFiltersBtn'),
    resultsHint: document.getElementById('resultsHint'),

    // Board
    board: document.getElementById('board'),
    lists: {
      backlog: document.getElementById('list-backlog'),
      todo: document.getElementById('list-todo'),
      inprogress: document.getElementById('list-inprogress'),
      done: document.getElementById('list-done')
    },
    counts: {
      backlog: document.getElementById('countBacklog'),
      todo: document.getElementById('countTodo'),
      inprogress: document.getElementById('countInprogress'),
      done: document.getElementById('countDone')
    },

    // Task modal
    taskModalOverlay: document.getElementById('taskModalOverlay'),
    taskForm: document.getElementById('taskForm'),
    modalTitle: document.getElementById('modalTitle'),
    modalCloseBtn: document.getElementById('modalCloseBtn'),
    cancelTaskBtn: document.getElementById('cancelTaskBtn'),
    deleteTaskBtn: document.getElementById('deleteTaskBtn'),
    taskIdInput: document.getElementById('taskId'),
    taskTitleInput: document.getElementById('taskTitle'),
    taskDescriptionInput: document.getElementById('taskDescription'),
    taskPriorityInput: document.getElementById('taskPriority'),
    taskDueDateInput: document.getElementById('taskDueDate'),
    taskCategoryInput: document.getElementById('taskCategory'),
    taskStatusInput: document.getElementById('taskStatus'),
    categorySuggestions: document.getElementById('categorySuggestions'),
    titleError: document.getElementById('titleError'),

    // Confirm modal
    confirmModalOverlay: document.getElementById('confirmModalOverlay'),
    confirmCancelBtn: document.getElementById('confirmCancelBtn'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),

    // Toasts
    toastContainer: document.getElementById('toastContainer')
  };

  let pendingDeleteId = null; // Task awaiting confirmation in the delete modal

  /* -----------------------------------------------------------------
     3. UTILITIES
     ----------------------------------------------------------------- */

  /** Generate a reasonably unique id without external libraries. */
  function generateId() {
    return 'task_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /** Escape user-provided text before inserting into innerHTML. */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  /** Format an ISO date string (YYYY-MM-DD) into a short human label. */
  function formatDueDate(isoDate) {
    if (!isoDate) return '';
    const [year, month, day] = isoDate.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  /** Returns 'overdue' | 'soon' | 'normal' relative to today, ignoring time-of-day. */
  function getDueUrgency(isoDate) {
    if (!isoDate) return 'normal';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [year, month, day] = isoDate.split('-').map(Number);
    const due = new Date(year, month - 1, day);
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 2) return 'soon';
    return 'normal';
  }

  /** Debounce helper for search input. */
  function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  /* -----------------------------------------------------------------
     4. PERSISTENCE (localStorage)
     ----------------------------------------------------------------- */

  /** Persist the current task list to localStorage. */
  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
    } catch (err) {
      console.error('Failed to save tasks to localStorage:', err);
      showToast('Could not save changes locally. Storage may be full.', 'error');
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
        id: generateId(),
        title: 'Define Q3 product roadmap',
        description: 'Draft the high-level roadmap themes and review with leadership before the planning offsite.',
        priority: 'high',
        dueDate: iso(5),
        category: 'Strategy',
        status: 'backlog',
        createdAt: Date.now() - 86400000 * 6
      },
      {
        id: generateId(),
        title: 'Research competitor pricing',
        description: 'Collect pricing pages for 5 competitors and summarize tiering strategy.',
        priority: 'low',
        dueDate: '',
        category: 'Research',
        status: 'backlog',
        createdAt: Date.now() - 86400000 * 5
      },
      {
        id: generateId(),
        title: 'Design new onboarding flow',
        description: 'Create wireframes for the revamped first-run experience, focused on reducing drop-off.',
        priority: 'high',
        dueDate: iso(-1),
        category: 'Design',
        status: 'todo',
        createdAt: Date.now() - 86400000 * 4
      },
      {
        id: generateId(),
        title: 'Write API documentation',
        description: 'Document the public REST endpoints, including authentication and rate limits.',
        priority: 'medium',
        dueDate: iso(3),
        category: 'Engineering',
        status: 'todo',
        createdAt: Date.now() - 86400000 * 3
      },
      {
        id: generateId(),
        title: 'Build drag-and-drop board',
        description: 'Implement the Kanban board interactions using native HTML5 drag and drop events.',
        priority: 'high',
        dueDate: iso(1),
        category: 'Engineering',
        status: 'inprogress',
        createdAt: Date.now() - 86400000 * 2
      },
      {
        id: generateId(),
        title: 'Set up analytics dashboard',
        description: 'Wire up the task counters and completion-rate progress bar to live data.',
        priority: 'medium',
        dueDate: iso(2),
        category: 'Engineering',
        status: 'inprogress',
        createdAt: Date.now() - 86400000 * 1
      },
      {
        id: generateId(),
        title: 'Ship landing page redesign',
        description: 'Deployed the new marketing landing page with updated messaging and visuals.',
        priority: 'medium',
        dueDate: iso(-3),
        category: 'Marketing',
        status: 'done',
        createdAt: Date.now() - 86400000 * 8
      },
      {
        id: generateId(),
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
     5. TASK CRUD OPERATIONS
     ----------------------------------------------------------------- */

  function addTask(taskData) {
    const newTask = {
      id: generateId(),
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
     6. FILTERING
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

  /** Rebuilds the category <select> + <datalist> options from current tasks. */
  function refreshCategoryOptions() {
    const categories = Array.from(
      new Set(state.tasks.map((t) => t.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    // Category filter dropdown (preserve current selection if still valid)
    const currentValue = dom.categoryFilter.value;
    dom.categoryFilter.innerHTML = '<option value="all">All categories</option>';
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      dom.categoryFilter.appendChild(opt);
    });
    if (categories.includes(currentValue)) {
      dom.categoryFilter.value = currentValue;
    } else {
      state.filters.category = 'all';
      dom.categoryFilter.value = 'all';
    }

    // Datalist suggestions for the task form's category input
    dom.categorySuggestions.innerHTML = '';
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      dom.categorySuggestions.appendChild(opt);
    });
  }

  /* -----------------------------------------------------------------
     7. RENDERING
     ----------------------------------------------------------------- */

  /** Builds the DOM node for a single task card. */
  function renderTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.draggable = true;
    card.dataset.id = task.id;
    card.dataset.priority = task.priority;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Task: ${task.title}. Priority: ${task.priority}. Press Enter to edit.`);

    const urgency = getDueUrgency(task.dueDate);
    const dueClass = urgency === 'overdue' ? 'task-card__due--overdue' : urgency === 'soon' ? 'task-card__due--soon' : '';

    card.innerHTML = `
      <div class="task-card__actions">
        <button type="button" class="task-card__action-btn task-card__action-btn--edit" aria-label="Edit task: ${escapeHtml(task.title)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="task-card__action-btn task-card__action-btn--delete" aria-label="Delete task: ${escapeHtml(task.title)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <div class="task-card__top">
        <span class="task-card__title">${escapeHtml(task.title)}</span>
      </div>

      <span class="task-card__priority task-card__priority--${task.priority}">${task.priority}</span>

      ${task.description ? `<p class="task-card__desc">${escapeHtml(task.description)}</p>` : ''}

      <div class="task-card__meta">
        ${task.category ? `<span class="task-card__category">${escapeHtml(task.category)}</span>` : '<span></span>'}
        ${task.dueDate ? `
          <span class="task-card__due ${dueClass}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            ${formatDueDate(task.dueDate)}
          </span>` : ''}
      </div>
    `;

    // Drag events
    card.addEventListener('dragstart', handleDragStart);
    card.addEventListener('dragend', handleDragEnd);

    // Click to edit (whole card), with action buttons stopping propagation
    card.addEventListener('click', (e) => {
      if (e.target.closest('.task-card__action-btn--delete')) {
        e.stopPropagation();
        openConfirmModal(task.id);
        return;
      }
      if (e.target.closest('.task-card__action-btn--edit')) {
        e.stopPropagation();
        openEditModal(task.id);
        return;
      }
      openEditModal(task.id);
    });

    // Keyboard accessibility: Enter/Space opens edit, Delete key removes
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openEditModal(task.id);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement === card) {
          e.preventDefault();
          openConfirmModal(task.id);
        }
      }
    });

    return card;
  }

  /** Builds the "no tasks here" placeholder for an empty column. */
  function renderEmptyState(status) {
    const messages = {
      backlog: 'No ideas parked here yet. Add a task to get started.',
      todo: 'Nothing queued up. Pull a task in or create a new one.',
      inprogress: 'Nothing in motion right now.',
      done: 'No completed tasks yet — finish one to see it here.'
    };
    const wrapper = document.createElement('div');
    wrapper.className = 'column__empty';
    wrapper.innerHTML = `
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3 3"/><path d="M9 12h6M12 9v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      <span class="column__empty-text">${messages[status]}</span>
    `;
    return wrapper;
  }

  /** Full re-render of the board, stat cards, and counts from current state. */
  function render() {
    const filtered = getFilteredTasks();

    // Group filtered tasks by status, sorted by priority then due date.
    const grouped = { backlog: [], todo: [], inprogress: [], done: [] };
    filtered.forEach((task) => grouped[task.status].push(task));

    STATUSES.forEach((status) => {
      grouped[status].sort((a, b) => {
        const pw = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
        if (pw !== 0) return pw;
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      });
    });

    STATUSES.forEach((status) => {
      const list = dom.lists[status];
      list.innerHTML = '';

      if (grouped[status].length === 0) {
        list.appendChild(renderEmptyState(status));
      } else {
        const fragment = document.createDocumentFragment();
        grouped[status].forEach((task) => fragment.appendChild(renderTaskCard(task)));
        list.appendChild(fragment);
      }

      dom.counts[status].textContent = grouped[status].length;
    });

    updateDashboard();
    updateResultsHint(filtered.length);
  }

  /** Updates the four analytics cards + progress bar based on ALL tasks (not filtered). */
  function updateDashboard() {
    const total = state.tasks.length;
    const completed = state.tasks.filter((t) => t.status === 'done').length;
    const pending = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    dom.statTotal.textContent = total;
    dom.statCompleted.textContent = completed;
    dom.statPending.textContent = pending;
    dom.statRate.textContent = `${rate}%`;
    dom.progressBarFill.style.width = `${rate}%`;
    dom.progressBar.setAttribute('aria-valuenow', String(rate));
  }

  /** Updates the small "showing X of Y tasks" hint in the toolbar. */
  function updateResultsHint(filteredCount) {
    const total = state.tasks.length;
    const hasActiveFilters =
      state.filters.search.trim() !== '' ||
      state.filters.priority !== 'all' ||
      state.filters.category !== 'all';

    if (!hasActiveFilters) {
      dom.resultsHint.textContent = total === 1 ? '1 task' : `${total} tasks`;
    } else {
      dom.resultsHint.textContent = `Showing ${filteredCount} of ${total} tasks`;
    }
  }

  /* -----------------------------------------------------------------
     8. DRAG & DROP (native HTML5 API)
     ----------------------------------------------------------------- */

  function handleDragStart(e) {
    const card = e.currentTarget;
    state.draggedTaskId = card.dataset.id;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Some browsers require data to be set for drag to initiate reliably.
    e.dataTransfer.setData('text/plain', card.dataset.id);
  }

  function handleDragEnd(e) {
    e.currentTarget.classList.remove('is-dragging');
    state.draggedTaskId = null;
    document.querySelectorAll('.column__list.is-drag-over').forEach((el) => {
      el.classList.remove('is-drag-over');
    });
  }

  function handleDragOver(e) {
    e.preventDefault(); // Required to allow dropping
    e.dataTransfer.dropEffect = 'move';
    e.currentTarget.classList.add('is-drag-over');
  }

  function handleDragLeave(e) {
    // Only remove the highlight when actually leaving the list container
    // (not when moving over a child card within it).
    if (!e.currentTarget.contains(e.relatedTarget)) {
      e.currentTarget.classList.remove('is-drag-over');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const list = e.currentTarget;
    list.classList.remove('is-drag-over');

    const taskId = state.draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const newStatus = list.dataset.status;
    const moved = moveTask(taskId, newStatus);
    if (moved) {
      render();
      showToast(`Task moved to ${STATUS_LABELS[newStatus]}`, 'success');
    }
  }

  function initDragAndDropZones() {
    STATUSES.forEach((status) => {
      const list = dom.lists[status];
      list.addEventListener('dragover', handleDragOver);
      list.addEventListener('dragleave', handleDragLeave);
      list.addEventListener('drop', handleDrop);
    });
  }

  /* -----------------------------------------------------------------
     9. TASK MODAL (Create / Edit)
     ----------------------------------------------------------------- */

  let lastFocusedElement = null;

  function openCreateModal(presetStatus) {
    lastFocusedElement = document.activeElement;
    dom.taskForm.reset();
    dom.taskIdInput.value = '';
    dom.modalTitle.textContent = 'New Task';
    dom.deleteTaskBtn.hidden = true;
    dom.taskStatusInput.value = presetStatus || 'backlog';
    dom.taskPriorityInput.value = 'medium';
    clearFieldError();
    showModal(dom.taskModalOverlay);
    dom.taskTitleInput.focus();
  }

  function openEditModal(taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    lastFocusedElement = document.activeElement;
    dom.modalTitle.textContent = 'Edit Task';
    dom.deleteTaskBtn.hidden = false;

    dom.taskIdInput.value = task.id;
    dom.taskTitleInput.value = task.title;
    dom.taskDescriptionInput.value = task.description;
    dom.taskPriorityInput.value = task.priority;
    dom.taskDueDateInput.value = task.dueDate || '';
    dom.taskCategoryInput.value = task.category;
    dom.taskStatusInput.value = task.status;

    clearFieldError();
    showModal(dom.taskModalOverlay);
    dom.taskTitleInput.focus();
  }

  function closeTaskModal() {
    hideModal(dom.taskModalOverlay);
    restoreFocus();
  }

  function clearFieldError() {
    document.getElementById('taskTitle').closest('.field').classList.remove('has-error');
  }

  function setFieldError() {
    document.getElementById('taskTitle').closest('.field').classList.add('has-error');
  }

  /** Handles submission for both create and edit flows. */
  function handleTaskFormSubmit(e) {
    e.preventDefault();

    const title = dom.taskTitleInput.value.trim();
    if (!title) {
      setFieldError();
      dom.taskTitleInput.focus();
      return;
    }
    clearFieldError();

    const taskData = {
      title,
      description: dom.taskDescriptionInput.value,
      priority: dom.taskPriorityInput.value,
      dueDate: dom.taskDueDateInput.value,
      category: dom.taskCategoryInput.value,
      status: dom.taskStatusInput.value
    };

    const existingId = dom.taskIdInput.value;

    if (existingId) {
      updateTask(existingId, taskData);
      showToast('Task updated successfully', 'success');
    } else {
      addTask(taskData);
      showToast('Task created successfully', 'success');
    }

    refreshCategoryOptions();
    render();
    closeTaskModal();
  }

  /* -----------------------------------------------------------------
     10. DELETE CONFIRMATION MODAL
     ----------------------------------------------------------------- */

  function openConfirmModal(taskId) {
    pendingDeleteId = taskId;
    lastFocusedElement = document.activeElement;
    showModal(dom.confirmModalOverlay);
    dom.confirmDeleteBtn.focus();
  }

  function closeConfirmModal() {
    pendingDeleteId = null;
    hideModal(dom.confirmModalOverlay);
    restoreFocus();
  }

  function handleConfirmDelete() {
    if (!pendingDeleteId) return;
    const task = state.tasks.find((t) => t.id === pendingDeleteId);
    deleteTask(pendingDeleteId);
    refreshCategoryOptions();
    render();
    closeConfirmModal();
    showToast(`"${task ? task.title : 'Task'}" was deleted`, 'info');
  }

  /* -----------------------------------------------------------------
     11. MODAL HELPERS (shared show/hide + focus trap + Esc to close)
     ----------------------------------------------------------------- */

  function showModal(overlay) {
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleModalKeydown);
  }

  function hideModal(overlay) {
    overlay.hidden = true;
    if (dom.taskModalOverlay.hidden && dom.confirmModalOverlay.hidden) {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleModalKeydown);
    }
  }

  function restoreFocus() {
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
    }
  }

  function handleModalKeydown(e) {
    if (e.key === 'Escape') {
      if (!dom.confirmModalOverlay.hidden) {
        closeConfirmModal();
      } else if (!dom.taskModalOverlay.hidden) {
        closeTaskModal();
      }
      return;
    }

    if (e.key === 'Tab') {
      // Simple focus trap within whichever modal is currently open.
      const activeOverlay = !dom.confirmModalOverlay.hidden ? dom.confirmModalOverlay : dom.taskModalOverlay;
      if (activeOverlay.hidden) return;

      const focusable = activeOverlay.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  /* -----------------------------------------------------------------
     12. TOAST NOTIFICATIONS
     ----------------------------------------------------------------- */

  const TOAST_ICONS = {
    success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
    info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>',
    warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  /** Shows a transient toast notification. type: success | error | info | warning */
  function showToast(message, type = 'info', duration = 3200) {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <span class="toast__icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
      <span class="toast__text">${escapeHtml(message)}</span>
    `;
    dom.toastContainer.appendChild(toast);

    const remove = () => {
      toast.classList.add('is-leaving');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    };

    const timer = setTimeout(remove, duration);
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      remove();
    });
  }

  /* -----------------------------------------------------------------
     13. FILTER & SEARCH EVENT WIRING
     ----------------------------------------------------------------- */

  function handleSearchInput() {
    state.filters.search = dom.searchInput.value;
    dom.searchClearBtn.hidden = state.filters.search.length === 0;
    render();
  }

  function handleClearSearch() {
    dom.searchInput.value = '';
    state.filters.search = '';
    dom.searchClearBtn.hidden = true;
    render();
    dom.searchInput.focus();
  }

  function handlePriorityFilterChange() {
    state.filters.priority = dom.priorityFilter.value;
    render();
  }

  function handleCategoryFilterChange() {
    state.filters.category = dom.categoryFilter.value;
    render();
  }

  function handleClearFilters() {
    state.filters = { search: '', priority: 'all', category: 'all' };
    dom.searchInput.value = '';
    dom.searchClearBtn.hidden = true;
    dom.priorityFilter.value = 'all';
    dom.categoryFilter.value = 'all';
    render();
    showToast('Filters cleared', 'info', 1800);
  }

  /* -----------------------------------------------------------------
     14. EVENT BINDING
     ----------------------------------------------------------------- */

  function bindEvents() {
    // Topbar
    dom.addTaskBtn.addEventListener('click', () => openCreateModal('backlog'));
    dom.searchInput.addEventListener('input', debounce(handleSearchInput, 150));
    dom.searchClearBtn.addEventListener('click', handleClearSearch);

    // Toolbar filters
    dom.priorityFilter.addEventListener('change', handlePriorityFilterChange);
    dom.categoryFilter.addEventListener('change', handleCategoryFilterChange);
    dom.clearFiltersBtn.addEventListener('click', handleClearFilters);

    // Column "add task" buttons
    document.querySelectorAll('.column__add-btn').forEach((btn) => {
      btn.addEventListener('click', () => openCreateModal(btn.dataset.status));
    });

    // Task modal
    dom.taskForm.addEventListener('submit', handleTaskFormSubmit);
    dom.modalCloseBtn.addEventListener('click', closeTaskModal);
    dom.cancelTaskBtn.addEventListener('click', closeTaskModal);
    dom.taskModalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.taskModalOverlay) closeTaskModal();
    });
    dom.deleteTaskBtn.addEventListener('click', () => {
      const id = dom.taskIdInput.value;
      if (!id) return;
      closeTaskModal();
      openConfirmModal(id);
    });

    // Live-clear the title validation error as the user types
    dom.taskTitleInput.addEventListener('input', () => {
      if (dom.taskTitleInput.value.trim()) clearFieldError();
    });

    // Confirm delete modal
    dom.confirmCancelBtn.addEventListener('click', closeConfirmModal);
    dom.confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    dom.confirmModalOverlay.addEventListener('click', (e) => {
      if (e.target === dom.confirmModalOverlay) closeConfirmModal();
    });

    // Drag & drop zones
    initDragAndDropZones();
  }

  /* -----------------------------------------------------------------
     15. INITIALIZATION
     ----------------------------------------------------------------- */

  function init() {
    loadTasks();
    refreshCategoryOptions();
    bindEvents();
    render();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
