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
  processTask(taskId, action, userRole, notes = '') {
    if (action === 'Approve') {
      return store.approveWorkflowTask(taskId, userRole);
    } else {
      const task = store.state.workflowTasks.find(t => t.id === taskId);
      if (!task) return false;

      task.makerCheckerStatus = 'Rejected / Returned to Maker';
      task.history.push({
        step: 'Checker Rejection',
        user: `${userRole.toUpperCase()} Lead`,
        action: `Rejected: ${notes}`,
        timestamp: new Date().toISOString()
      });

      if (task.type === 'Loan Application Review') {
        store.updateDisbursementStatus(task.entityId, 'Rejected');
      }

      store.state.auditTrail.unshift({
        id: `AUD-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        userId: `usr_${userRole}`,
        userName: `${userRole} Checker`,
        action: 'WORKFLOW_TASK_REJECTED',
        module: 'Workflow Engine (Layer 1)',
        entityId: taskId,
        description: `Task ${taskId} rejected by ${userRole}. Reason: ${notes || 'Policy Exception'}`,
        ipAddress: '192.168.1.50',
        glImpact: 'None'
      });

      store.save();
      return true;
    }
  },

  /**
   * Initiates a new Maker workflow task
   */
  createTask({ type, entityId, title, amount, requestedBy, makerUserId = null, approverRole, priority = 'Medium' }) {
    const pacing = PacingEngine.getPacingAnalysis(store.state);
    const liquidityCheck = amount <= pacing.safeHeadroomTarget ? 
      `PASSED (Headroom ${Formatter.money(pacing.safeHeadroomTarget, true)} > ${Formatter.money(amount, true)})` : 
      `PACING REQUIRED (Exceeds immediate buffer, requires staggered batching)`;

    const newTask = {
      id: `WF-${Date.now().toString().slice(-3)}`,
      type,
      entityId,
      title,
      amount,
      requestedBy,
      makerUserId,
      currentStep: 'Maker Verification & Pacing Review',
      approverRole,
      makerCheckerStatus: 'Pending Checker Release',
      liquidityImpactCheck: liquidityCheck,
      priority,
      createdAt: new Date().toISOString(),
      history: [
        { step: 'Maker Initiation', user: requestedBy, action: 'Initiated', timestamp: new Date().toISOString() }
      ]
    };

    store.state.workflowTasks.unshift(newTask);
    store.save();
    return newTask.id;
  }
};

window.WorkflowEngine = WorkflowEngine;
