/**
 * Finage OS - Layer 4: User Management & RBAC Engine
 */

const UserManagementEngine = {
  /**
   * Retrieves a role by its ID
   */
  getRoleById(state, roleId) {
    return state.roles.find(r => r.id === roleId) || null;
  },

  /**
   * Retrieves all full role objects for a user
   */
  getUserRoles(state, userId) {
    const user = this.getUserById(state, userId);
    if (!user || !user.roles) return [];
    return user.roles.map(roleId => this.getRoleById(state, roleId)).filter(Boolean);
  },

  /**
   * Authenticate a user by email
   */
  login(state, email) {
    const user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && user.status === 'Active') {
      const roles = user.roles ? user.roles.map(rId => this.getRoleById(state, rId)).filter(Boolean) : [];
      const firstRole = roles.length > 0 ? roles[0] : null;
      const preferredRoleCategory = roles.some(r => r.category === 'teller')
        ? 'counter-ops'
        : roles.some(r => r.category === 'front-office')
          ? 'front-office'
          : (firstRole ? firstRole.category : null);
      
      state.isAuthenticated = true;
      state.currentUserId = user.id;
      state.currentRole = preferredRoleCategory;
      state.selectedBranchId = user.branchId;
      state.selectedMemberId = null;
      return true;
    }
    return false;
  },

  /**
   * Log out current user
   */
  logout(state) {
    state.isAuthenticated = false;
    state.currentUserId = null;
    state.currentRole = null;
    state.selectedBranchId = null;
    state.selectedMemberId = null;
  },

  /**
   * Retrieves a user by their ID
   */
  getUserById(state, userId) {
    return state.users.find(u => u.id === userId) || null;
  },

  /**
   * Retrieves all users in the institution
   */
  getAllUsers(state) {
    return state.users || [];
  },

  /**
   * Filters users by their role category (e.g. 'teller', 'credit', 'treasury')
   */
  getUsersByRole(state, roleCategory) {
    return state.users.filter(u => {
      const roles = u.roles ? u.roles.map(rId => this.getRoleById(state, rId)).filter(Boolean) : [];
      return roles.some(r => r.category === roleCategory);
    });
  },

  /**
   * Filters users by branch ID
   */
  getUsersByBranch(state, branchId) {
    return state.users.filter(u => u.branchId === branchId);
  },

  /**
   * Checks if a specific user has a required permission
   */
  checkPermission(state, userId, permissionCode) {
    const user = this.getUserById(state, userId);
    if (!user || user.status !== 'Active') return false;
    
    const roles = user.roles ? user.roles.map(rId => this.getRoleById(state, rId)).filter(Boolean) : [];
    if (roles.length === 0) return false;
    
    // Board members might have 'READ_ALL_MODULES' override
    if (roles.some(r => r.permissions.includes('READ_ALL_MODULES'))) {
      return true;
    }
    
    return roles.some(r => r.permissions.includes(permissionCode));
  },

  /**
   * Returns a normalized action policy check for critical operational actions.
   */
  canPerformAction(state, userId, requiredPermission, extraChecks = {}) {
    const user = this.getUserById(state, userId);
    if (!user || user.status !== 'Active') {
      return { allowed: false, error: 'Active user session required.' };
    }

    if (requiredPermission && !this.checkPermission(state, userId, requiredPermission)) {
      return { allowed: false, error: 'User lacks permission to perform this action.' };
    }

    if (extraChecks.memberId) {
      const member = state.members.find(m => m.id === extraChecks.memberId);
      if (!member) {
        return { allowed: false, error: 'Selected member is not valid.' };
      }
    }

    if (extraChecks.amount !== undefined && Number(extraChecks.amount) <= 0) {
      return { allowed: false, error: 'Transaction amount must be greater than zero.' };
    }

    return { allowed: true };
  },

  /**
   * Evaluates if a user can approve a transaction of a given amount
   */
  canApproveAmount(state, userId, amount) {
    const user = this.getUserById(state, userId);
    if (!user || user.status !== 'Active') return false;
    
    return amount <= user.singleApprovalLimit;
  },

  /**
   * Retrieves metrics about the institution's user base
   */
  getUserMetrics(state) {
    const users = this.getAllUsers(state);
    const activeUsers = users.filter(u => u.status === 'Active');
    const mfaEnabledCount = users.filter(u => u.mfaEnabled).length;
    
    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      mfaAdoptionPct: users.length > 0 ? (mfaEnabledCount / users.length) * 100 : 0,
      roleDistribution: {
        'front-office': this.getUsersByRole(state, 'front-office').length,
        teller: this.getUsersByRole(state, 'teller').length,
        credit: this.getUsersByRole(state, 'credit').length,
        treasury: this.getUsersByRole(state, 'treasury').length,
        board: this.getUsersByRole(state, 'board').length,
        member: this.getUsersByRole(state, 'member').length
      }
    };
  }
};

window.UserManagementEngine = UserManagementEngine;
