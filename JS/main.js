window.TaskFlow = window.TaskFlow || {};

(function (TF) {
  'use strict';

  /* -----------------------------------------------------------------
     EVENT BINDING
     ----------------------------------------------------------------- */

  function bindEvents() {
    const addTaskBtn = document.getElementById('addTaskBtn');
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    const priorityFilter = document.getElementById('priorityFilter');
    const categoryFilter = document.getElementById('categoryFilter');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    const taskForm = document.getElementById('taskForm');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const cancelTaskBtn = document.getElementById('cancelTaskBtn');
    const taskModalOverlay = document.getElementById('taskModalOverlay');
    const deleteTaskBtn = document.getElementById('deleteTaskBtn');
    const taskTitleInput = document.getElementById('taskTitle');
    const taskIdInput = document.getElementById('taskId');

    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    const confirmModalOverlay = document.getElementById('confirmModalOverlay');

    const lists = {
      backlog: document.getElementById('list-backlog'),
      todo: document.getElementById('list-todo'),
      inprogress: document.getElementById('list-inprogress'),
      done: document.getElementById('list-done')
    };

    // Topbar
    addTaskBtn.addEventListener('click', () => TF.openCreateModal('backlog'));
    searchInput.addEventListener('input', TF.debounce(TF.handleSearchInput, 150));
    searchClearBtn.addEventListener('click', TF.handleClearSearch);

    // Toolbar filters
    priorityFilter.addEventListener('change', TF.handlePriorityFilterChange);
    categoryFilter.addEventListener('change', TF.handleCategoryFilterChange);
    clearFiltersBtn.addEventListener('click', TF.handleClearFilters);

    // Column "add task" buttons
    document.querySelectorAll('.column__add-btn').forEach((btn) => {
      btn.addEventListener('click', () => TF.openCreateModal(btn.dataset.status));
    });

    // Task modal
    taskForm.addEventListener('submit', TF.handleTaskFormSubmit);
    modalCloseBtn.addEventListener('click', TF.closeTaskModal);
    cancelTaskBtn.addEventListener('click', TF.closeTaskModal);
    taskModalOverlay.addEventListener('click', (e) => {
      if (e.target === taskModalOverlay) TF.closeTaskModal();
    });
    deleteTaskBtn.addEventListener('click', () => {
      const id = taskIdInput.value;
      if (!id) return;
      TF.closeTaskModal();
      TF.openConfirmModal(id);
    });

    // Live-clear the title validation error as the user types
    taskTitleInput.addEventListener('input', () => {
      if (taskTitleInput.value.trim()) TF.clearFieldError();
    });

    // Confirm delete modal
    confirmCancelBtn.addEventListener('click', TF.closeConfirmModal);
    confirmDeleteBtn.addEventListener('click', TF.handleConfirmDelete);
    confirmModalOverlay.addEventListener('click', (e) => {
      if (e.target === confirmModalOverlay) TF.closeConfirmModal();
    });

    // Drag & drop zones
    TF.initDragAndDropZones(lists);
  }

  /* -----------------------------------------------------------------
     INITIALIZATION
     ----------------------------------------------------------------- */

  function init() {
    TF.loadTasks();
    TF.refreshCategoryOptions();
    bindEvents();
    TF.render();
  }

  document.addEventListener('DOMContentLoaded', init);

})(window.TaskFlow);