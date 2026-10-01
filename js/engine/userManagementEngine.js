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
   * Authenticate a user — tries Supabase Auth first, falls back to local email lookup.
   * Returns { success, error } so callers can await it.
   */
  async loginWithAuth(state, email, password) {
    // --- PATH 1: Supabase Auth (real operations) ---
    if (window.supabase) {
      try {
        const { data, error } = await window.supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Auth failed — return the Supabase error message
          return { success: false, error: error.message };
        }
        if (data.user?.user_metadata?.password_change_required === true) {
          state.passwordChangeRequired = true;
          state.passwordChangeEmail = data.user.email || email;
          state.isAuthenticated = true;
          return { success: true, passwordChangeRequired: true };
        }
        if (window.Platform) await window.Platform.init();
        const normalizedEmail = email.toLowerCase();
        let systemUser = state.users.find(u => u.email.toLowerCase() === normalizedEmail);

        if (window.Platform?.isSuperuser()) {
          const platformUser = window.Platform.context.platformUser;
          systemUser = systemUser && systemUser.status === 'Active' ? systemUser : {
            id: 'USR-000',
            name: platformUser.name,
            email: platformUser.email,
            roles: ['ROLE-ADMIN'],
            branchId: null,
            branchName: 'Platform',
            singleApprovalLimit: 0,
            dailyApprovalLimit: 0,
            status: 'Active',
            mfaEnabled: true
          };
          if (!state.users.some(user => user.id === systemUser.id)) state.users.push(systemUser);
          this._applyLogin(state, systemUser);
          state.orgSelectorShown = true;
          return { success: true };
        }

        if (window.SupabaseSync && window.Platform?.context?.currentOrgSchema) {
          await window.SupabaseSync.init(window.store);
          systemUser = state.users.find(u => u.email.toLowerCase() === normalizedEmail);
        }
        if (!systemUser || systemUser.status !== 'Active') {
          await window.supabase.auth.signOut();
          return { success: false, error: 'Auth succeeded but no active system user record found for this email.' };
        }
        this._applyLogin(state, systemUser);
        return { success: true };
      } catch (e) {
        return { success: false, error: 'Auth service unreachable: ' + e.message };
      }
    }

    // --- PATH 2: Local fallback (dev / offline mode) ---
    const user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && user.status === 'Active') {
      this._applyLogin(state, user);
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials or inactive account.' };
  },

  /**
   * Legacy sync login — kept for quick-login buttons in dev.
   * In production the async loginWithAuth() is used.
   */
  login(state, email) {
    const user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (user && user.status === 'Active') {
      this._applyLogin(state, user);
      return true;
    }
    return false;
  },

  /**
   * Shared login-state mutation (used by both auth paths).
   */
  _applyLogin(state, user) {
    const roles = user.roles ? user.roles.map(rId => this.getRoleById(state, rId)).filter(Boolean) : [];
    const firstRole = roles.length > 0 ? roles[0] : null;
    const preferredRoleCategory = roles.some(r => r.category === 'teller')
      ? 'teller'
      : roles.some(r => r.category === 'front-office')
        ? 'front-office'
        : (firstRole ? firstRole.category : null);

    if (window.Platform && !window.supabase) {
      window.Platform.context.isPlatformSuperuser = user.email && user.email.toLowerCase() === 'superuser@finage.io';
    }

    state.isAuthenticated = true;
    state.currentUserId = user.id;
    state.currentRole = preferredRoleCategory;
    state.selectedBranchId = user.branchId;
    state.selectedMemberId = null;
  },

  /**
   * Sign out — ends Supabase session and clears local state.
   */
  async logout(state) {
    if (window.supabase) {
      try { await window.supabase.auth.signOut(); } catch (_) {}
    }
    state.isAuthenticated = false;
    state.currentUserId = null;
    state.currentRole = null;
    state.selectedBranchId = null;
    state.selectedMemberId = null;
  },

  /**
   * Restore session on page load (Supabase persists the JWT in localStorage).
   * Call this once at boot to auto-log in returning operators.
   */
  async restoreSession(state) {
    if (!window.supabase) return false;
    try {
      const { data: { session } } = await window.supabase.auth.getSession();
      if (session && session.user) {
        if (session.user.user_metadata?.password_change_required === true) {
          state.passwordChangeRequired = true;
          state.passwordChangeEmail = session.user.email || null;
          state.isAuthenticated = true;
          return true;
        }
        const email = session.user.email;
        const user = state.users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user && user.status === 'Active') {
          this._applyLogin(state, user);
          return true;
        }
      }
    } catch (e) {
      console.warn('[Auth] Could not restore session:', e.message);
    }
    return false;
  },

  /**
   * Create a Supabase Auth account for a new operator.
   * Called by store.addUser() when Supabase is available.
   */
  async createAuthUser(email, password) {
    if (!window.supabase) return { success: false, error: 'Supabase not available' };
    // Use admin signUp — works with anon key in Supabase (sends confirm email)
    const { data, error } = await window.supabase.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true, userId: data?.user?.id };
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
