window.TaskFlow = window.TaskFlow || {};

(function (TF) {
  'use strict';

  /* -----------------------------------------------------------------
     UTILITIES
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
     TOAST NOTIFICATIONS
     ----------------------------------------------------------------- */

  const TOAST_ICONS = {
    success: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M20 6 9 17l-5-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    error: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M18 6 6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
    info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/></svg>',
    warning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 9v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
  };

  /** Shows a transient toast notification. type: success | error | info | warning */
  function showToast(message, type = 'info', duration = 3200) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML = `
      <span class="toast__icon">${TOAST_ICONS[type] || TOAST_ICONS.info}</span>
      <span class="toast__text">${escapeHtml(message)}</span>
    `;
    toastContainer.appendChild(toast);

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
     DRAG & DROP (native HTML5 API)
     ----------------------------------------------------------------- */

  function handleDragStart(e) {
    const card = e.currentTarget;
    TF.state.draggedTaskId = card.dataset.id;
    card.classList.add('is-dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Some browsers require data to be set for drag to initiate reliably.
    e.dataTransfer.setData('text/plain', card.dataset.id);
  }

  function handleDragEnd(e) {
    e.currentTarget.classList.remove('is-dragging');
    TF.state.draggedTaskId = null;
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

    const taskId = TF.state.draggedTaskId || e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const newStatus = list.dataset.status;
    const moved = TF.moveTask(taskId, newStatus);
    if (moved) {
      TF.render();
      showToast(`Task moved to ${TF.STATUS_LABELS[newStatus]}`, 'success');
    }
  }

  function initDragAndDropZones(lists) {
    TF.STATUSES.forEach((status) => {
      const list = lists[status];
      list.addEventListener('dragover', handleDragOver);
      list.addEventListener('dragleave', handleDragLeave);
      list.addEventListener('drop', handleDrop);
    });
  }

  /* -----------------------------------------------------------------
     PUBLIC EXPORTS
     ----------------------------------------------------------------- */

  TF.generateId = generateId;
  TF.escapeHtml = escapeHtml;
  TF.formatDueDate = formatDueDate;
  TF.getDueUrgency = getDueUrgency;
  TF.debounce = debounce;

  TF.showToast = showToast;

  TF.handleDragStart = handleDragStart;
  TF.handleDragEnd = handleDragEnd;
  TF.initDragAndDropZones = initDragAndDropZones;

})(window.TaskFlow);