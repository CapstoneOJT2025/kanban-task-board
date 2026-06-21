window.TaskFlow = window.TaskFlow || {};

(function (TF) {
  'use strict';

  let lastFocusedElement = null;

  /* -----------------------------------------------------------------
     TASK MODAL (Create / Edit)
     ----------------------------------------------------------------- */

  function openCreateModal(presetStatus) {
    const taskForm = document.getElementById('taskForm');
    const taskIdInput = document.getElementById('taskId');
    const modalTitle = document.getElementById('modalTitle');
    const deleteTaskBtn = document.getElementById('deleteTaskBtn');
    const taskStatusInput = document.getElementById('taskStatus');
    const taskPriorityInput = document.getElementById('taskPriority');
    const taskTitleInput = document.getElementById('taskTitle');

    lastFocusedElement = document.activeElement;
    taskForm.reset();
    taskIdInput.value = '';
    modalTitle.textContent = 'New Task';
    deleteTaskBtn.hidden = true;
    taskStatusInput.value = presetStatus || 'backlog';
    taskPriorityInput.value = 'medium';
    clearFieldError();
    showModal(document.getElementById('taskModalOverlay'));
    taskTitleInput.focus();
  }

  function openEditModal(taskId) {
    const task = TF.state.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const modalTitle = document.getElementById('modalTitle');
    const deleteTaskBtn = document.getElementById('deleteTaskBtn');
    const taskIdInput = document.getElementById('taskId');
    const taskTitleInput = document.getElementById('taskTitle');
    const taskDescriptionInput = document.getElementById('taskDescription');
    const taskPriorityInput = document.getElementById('taskPriority');
    const taskDueDateInput = document.getElementById('taskDueDate');
    const taskCategoryInput = document.getElementById('taskCategory');
    const taskStatusInput = document.getElementById('taskStatus');

    lastFocusedElement = document.activeElement;
    modalTitle.textContent = 'Edit Task';
    deleteTaskBtn.hidden = false;

    taskIdInput.value = task.id;
    taskTitleInput.value = task.title;
    taskDescriptionInput.value = task.description;
    taskPriorityInput.value = task.priority;
    taskDueDateInput.value = task.dueDate || '';
    taskCategoryInput.value = task.category;
    taskStatusInput.value = task.status;

    clearFieldError();
    showModal(document.getElementById('taskModalOverlay'));
    taskTitleInput.focus();
  }

  function closeTaskModal() {
    hideModal(document.getElementById('taskModalOverlay'));
    restoreFocus();
  }

  function clearFieldError() {
    document.getElementById('taskTitle').closest('.field').classList.remove('has-error');
  }

  function setFieldError() {
    document.getElementById('taskTitle').closest('.field').classList.add('has-error');
  }

  /* -----------------------------------------------------------------
     DELETE CONFIRMATION MODAL
     ----------------------------------------------------------------- */

  function openConfirmModal(taskId) {
    TF.setPendingDeleteId(taskId);
    lastFocusedElement = document.activeElement;
    showModal(document.getElementById('confirmModalOverlay'));
    document.getElementById('confirmDeleteBtn').focus();
  }

  function closeConfirmModal() {
    TF.setPendingDeleteId(null);
    hideModal(document.getElementById('confirmModalOverlay'));
    restoreFocus();
  }

  function handleConfirmDelete() {
    const pendingDeleteId = TF.getPendingDeleteId();
    if (!pendingDeleteId) return;

    const task = TF.state.tasks.find((t) => t.id === pendingDeleteId);
    TF.deleteTask(pendingDeleteId);
    TF.refreshCategoryOptions();
    TF.render();
    closeConfirmModal();
    TF.showToast(`"${task ? task.title : 'Task'}" was deleted`, 'info');
  }

  /* -----------------------------------------------------------------
     SHARED MODAL HELPERS (show/hide + focus trap + Esc to close)
     ----------------------------------------------------------------- */

  function showModal(overlay) {
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleModalKeydown);
  }

  function hideModal(overlay) {
    overlay.hidden = true;
    const taskModalOverlay = document.getElementById('taskModalOverlay');
    const confirmModalOverlay = document.getElementById('confirmModalOverlay');
    if (taskModalOverlay.hidden && confirmModalOverlay.hidden) {
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
    const taskModalOverlay = document.getElementById('taskModalOverlay');
    const confirmModalOverlay = document.getElementById('confirmModalOverlay');

    if (e.key === 'Escape') {
      if (!confirmModalOverlay.hidden) {
        closeConfirmModal();
      } else if (!taskModalOverlay.hidden) {
        closeTaskModal();
      }
      return;
    }

    if (e.key === 'Tab') {
      // Simple focus trap within whichever modal is currently open.
      const activeOverlay = !confirmModalOverlay.hidden ? confirmModalOverlay : taskModalOverlay;
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
     PUBLIC EXPORTS
     ----------------------------------------------------------------- */

  TF.openCreateModal = openCreateModal;
  TF.openEditModal = openEditModal;
  TF.closeTaskModal = closeTaskModal;
  TF.clearFieldError = clearFieldError;
  TF.setFieldError = setFieldError;

  TF.openConfirmModal = openConfirmModal;
  TF.closeConfirmModal = closeConfirmModal;
  TF.handleConfirmDelete = handleConfirmDelete;

  TF.showModal = showModal;
  TF.hideModal = hideModal;

})(window.TaskFlow);