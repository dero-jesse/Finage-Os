/**
 * Finage OS v3 - Layer 1: Embedded Workflow & Approval Engine
 * Orbit-R paradigm: Institutional Maker-Checker business processes with embedded liquidity pacing
 */

const WorkflowEngine = {
  /**
   * Evaluates pending workflow tasks across all operational modules
   */
  getPendingTasks(state, roleFilter = null) {
    const tasks = (state.workflowTasks || []).filter(task =>
      !/approved|rejected|returned|completed|released/i.test(task.makerCheckerStatus || '')
    );
    if (!roleFilter) return tasks;

    return tasks.filter(t => {
      if (roleFilter === 'treasury') return t.approverRole.toLowerCase().includes('treasury') || t.approverRole.toLowerCase().includes('finance');
      if (roleFilter === 'credit') return t.approverRole.toLowerCase().includes('credit');
      if (roleFilter === 'front-office') return t.approverRole.toLowerCase().includes('front office') || t.approverRole.toLowerCase().includes('branch') || t.approverRole.toLowerCase().includes('teller') || t.approverRole.toLowerCase().includes('audit');
      if (roleFilter === 'teller') return t.approverRole.toLowerCase().includes('teller') || t.approverRole.toLowerCase().includes('cash');
      if (roleFilter === 'board') return true; // Board can view all governance workflows
      return true;
    });
  },

  /**
   * Executes Maker-Checker action on a task
   */
  async processTask(taskId, action, userRole, notes = '', options = {}) {
    const task = store.state.workflowTasks.find(item => item.id === taskId);
    if (!task || task.type !== 'Loan Application Review') {
      return { success: false, error: 'This workflow type is not enabled for online approval.' };
    }
    try {
      const outcome = await window.Platform.executeDomainAction('review_loan_application', {
        applicationId: task.entityId,
        decision: action,
        reason: notes
      }, options);
      return { success: true, result: outcome.result, refreshError: outcome.refreshError };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  /**
   * Initiates a new Maker workflow task
   */
  async createTask() {
    throw new Error('Only server-created loan application workflows are enabled in this build.');
  }
};

window.WorkflowEngine = WorkflowEngine;
