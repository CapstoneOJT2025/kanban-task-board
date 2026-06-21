window.TaskFlow = window.TaskFlow || {};

(function (TF) {
  'use strict';

  /* -----------------------------------------------------------------
     TASK FORM SUBMISSION
     ----------------------------------------------------------------- */

  /** Handles submission for both create and edit flows. */
  function handleTaskFormSubmit(e) {
    e.preventDefault();

    const taskTitleInput = document.getElementById('taskTitle');
    const taskDescriptionInput = document.getElementById('taskDescription');
    const taskPriorityInput = document.getElementById('taskPriority');
    const taskDueDateInput = document.getElementById('taskDueDate');
    const taskCategoryInput = document.getElementById('taskCategory');
    const taskStatusInput = document.getElementById('taskStatus');
    const taskIdInput = document.getElementById('taskId');

    const title = taskTitleInput.value.trim();
    if (!title) {
      TF.setFieldError();
      taskTitleInput.focus();
      return;
    }
    TF.clearFieldError();

    const taskData = {
      title,
      description: taskDescriptionInput.value,
      priority: taskPriorityInput.value,
      dueDate: taskDueDateInput.value,
      category: taskCategoryInput.value,
      status: taskStatusInput.value
    };

    const existingId = taskIdInput.value;

    if (existingId) {
      TF.updateTask(existingId, taskData);
      TF.showToast('Task updated successfully', 'success');
    } else {
      TF.addTask(taskData);
      TF.showToast('Task created successfully', 'success');
    }

    TF.refreshCategoryOptions();
    TF.render();
    TF.closeTaskModal();
  }

  /* -----------------------------------------------------------------
     SEARCH & FILTER HANDLERS
     ----------------------------------------------------------------- */

  function handleSearchInput() {
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');

    TF.state.filters.search = searchInput.value;
    searchClearBtn.hidden = TF.state.filters.search.length === 0;
    TF.render();
  }

  function handleClearSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');

    searchInput.value = '';
    TF.state.filters.search = '';
    searchClearBtn.hidden = true;
    TF.render();
    searchInput.focus();
  }

  function handlePriorityFilterChange() {
    const priorityFilter = document.getElementById('priorityFilter');
    TF.state.filters.priority = priorityFilter.value;
    TF.render();
  }

  function handleCategoryFilterChange() {
    const categoryFilter = document.getElementById('categoryFilter');
    TF.state.filters.category = categoryFilter.value;
    TF.render();
  }

  function handleClearFilters() {
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    const priorityFilter = document.getElementById('priorityFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    TF.state.filters = { search: '', priority: 'all', category: 'all' };
    searchInput.value = '';
    searchClearBtn.hidden = true;
    priorityFilter.value = 'all';
    categoryFilter.value = 'all';
    TF.render();
    TF.showToast('Filters cleared', 'info', 1800);
  }

  /* -----------------------------------------------------------------
     PUBLIC EXPORTS
     ----------------------------------------------------------------- */

  TF.handleTaskFormSubmit = handleTaskFormSubmit;

  TF.handleSearchInput = handleSearchInput;
  TF.handleClearSearch = handleClearSearch;
  TF.handlePriorityFilterChange = handlePriorityFilterChange;
  TF.handleCategoryFilterChange = handleCategoryFilterChange;
  TF.handleClearFilters = handleClearFilters;

})(window.TaskFlow);