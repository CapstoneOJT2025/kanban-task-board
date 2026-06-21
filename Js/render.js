
window.TaskFlow = window.TaskFlow || {};

(function (TF) {
  'use strict';

  /* -----------------------------------------------------------------
     CATEGORY OPTIONS
     ----------------------------------------------------------------- */

  /** Rebuilds the category <select> + <datalist> options from current tasks. */
  function refreshCategoryOptions() {
    const categoryFilter = document.getElementById('categoryFilter');
    const categorySuggestions = document.getElementById('categorySuggestions');

    const categories = Array.from(
      new Set(TF.state.tasks.map((t) => t.category).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    // Category filter dropdown (preserve current selection if still valid)
    const currentValue = categoryFilter.value;
    categoryFilter.innerHTML = '<option value="all">All categories</option>';
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      categoryFilter.appendChild(opt);
    });
    if (categories.includes(currentValue)) {
      categoryFilter.value = currentValue;
    } else {
      TF.state.filters.category = 'all';
      categoryFilter.value = 'all';
    }

    // Datalist suggestions for the task form's category input
    categorySuggestions.innerHTML = '';
    categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      categorySuggestions.appendChild(opt);
    });
  }

  /* -----------------------------------------------------------------
     TASK CARD RENDERING
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

    const urgency = TF.getDueUrgency(task.dueDate);
    const dueClass = urgency === 'overdue' ? 'task-card__due--overdue' : urgency === 'soon' ? 'task-card__due--soon' : '';

    card.innerHTML = `
      <div class="task-card__actions">
        <button type="button" class="task-card__action-btn task-card__action-btn--edit" aria-label="Edit task: ${TF.escapeHtml(task.title)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button type="button" class="task-card__action-btn task-card__action-btn--delete" aria-label="Delete task: ${TF.escapeHtml(task.title)}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>

      <div class="task-card__top">
        <span class="task-card__title">${TF.escapeHtml(task.title)}</span>
      </div>

      <span class="task-card__priority task-card__priority--${task.priority}">${task.priority}</span>

      ${task.description ? `<p class="task-card__desc">${TF.escapeHtml(task.description)}</p>` : ''}

      <div class="task-card__meta">
        ${task.category ? `<span class="task-card__category">${TF.escapeHtml(task.category)}</span>` : '<span></span>'}
        ${task.dueDate ? `
          <span class="task-card__due ${dueClass}">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            ${TF.formatDueDate(task.dueDate)}
          </span>` : ''}
      </div>
    `;

    // Drag events (handlers live in theme.js)
    card.addEventListener('dragstart', TF.handleDragStart);
    card.addEventListener('dragend', TF.handleDragEnd);

    // Click to edit (whole card), with action buttons stopping propagation
    card.addEventListener('click', (e) => {
      if (e.target.closest('.task-card__action-btn--delete')) {
        e.stopPropagation();
        TF.openConfirmModal(task.id);
        return;
      }
      if (e.target.closest('.task-card__action-btn--edit')) {
        e.stopPropagation();
        TF.openEditModal(task.id);
        return;
      }
      TF.openEditModal(task.id);
    });

    // Keyboard accessibility: Enter/Space opens edit, Delete key removes
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        TF.openEditModal(task.id);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement === card) {
          e.preventDefault();
          TF.openConfirmModal(task.id);
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

  /* -----------------------------------------------------------------
     BOARD / DASHBOARD RENDERING
     ----------------------------------------------------------------- */

  /** Full re-render of the board, stat cards, and counts from current state. */
  function render() {
    const lists = {
      backlog: document.getElementById('list-backlog'),
      todo: document.getElementById('list-todo'),
      inprogress: document.getElementById('list-inprogress'),
      done: document.getElementById('list-done')
    };
    const counts = {
      backlog: document.getElementById('countBacklog'),
      todo: document.getElementById('countTodo'),
      inprogress: document.getElementById('countInprogress'),
      done: document.getElementById('countDone')
    };

    const filtered = TF.getFilteredTasks();

    // Group filtered tasks by status, sorted by priority then due date.
    const grouped = { backlog: [], todo: [], inprogress: [], done: [] };
    filtered.forEach((task) => grouped[task.status].push(task));

    TF.STATUSES.forEach((status) => {
      grouped[status].sort((a, b) => {
        const pw = TF.PRIORITY_WEIGHT[a.priority] - TF.PRIORITY_WEIGHT[b.priority];
        if (pw !== 0) return pw;
        return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
      });
    });

    TF.STATUSES.forEach((status) => {
      const list = lists[status];
      list.innerHTML = '';

      if (grouped[status].length === 0) {
        list.appendChild(renderEmptyState(status));
      } else {
        const fragment = document.createDocumentFragment();
        grouped[status].forEach((task) => fragment.appendChild(renderTaskCard(task)));
        list.appendChild(fragment);
      }

      counts[status].textContent = grouped[status].length;
    });

    updateDashboard();
    updateResultsHint(filtered.length);
  }

  /** Updates the four analytics cards + progress bar based on ALL tasks (not filtered). */
  function updateDashboard() {
    const statTotal = document.getElementById('statTotal');
    const statCompleted = document.getElementById('statCompleted');
    const statPending = document.getElementById('statPending');
    const statRate = document.getElementById('statRate');
    const progressBarFill = document.getElementById('progressBarFill');
    const progressBar = document.getElementById('progressBar');

    const total = TF.state.tasks.length;
    const completed = TF.state.tasks.filter((t) => t.status === 'done').length;
    const pending = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);

    statTotal.textContent = total;
    statCompleted.textContent = completed;
    statPending.textContent = pending;
    statRate.textContent = `${rate}%`;
    progressBarFill.style.width = `${rate}%`;
    progressBar.setAttribute('aria-valuenow', String(rate));
  }

  /** Updates the small "showing X of Y tasks" hint in the toolbar. */
  function updateResultsHint(filteredCount) {
    const resultsHint = document.getElementById('resultsHint');
    const total = TF.state.tasks.length;
    const hasActiveFilters =
      TF.state.filters.search.trim() !== '' ||
      TF.state.filters.priority !== 'all' ||
      TF.state.filters.category !== 'all';

    if (!hasActiveFilters) {
      resultsHint.textContent = total === 1 ? '1 task' : `${total} tasks`;
    } else {
      resultsHint.textContent = `Showing ${filteredCount} of ${total} tasks`;
    }
  }

  /* -----------------------------------------------------------------
     PUBLIC EXPORTS
     ----------------------------------------------------------------- */

  TF.refreshCategoryOptions = refreshCategoryOptions;
  TF.renderTaskCard = renderTaskCard;
  TF.renderEmptyState = renderEmptyState;
  TF.render = render;
  TF.updateDashboard = updateDashboard;
  TF.updateResultsHint = updateResultsHint;

})(window.TaskFlow);