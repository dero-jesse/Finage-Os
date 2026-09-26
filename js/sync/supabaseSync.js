/**
 * Finage OS v3 — Supabase Synchronization Engine
 * =====================================================================
 * Single-Source Data Protocol:
 *   - CLIENT-FIRST (localStorage): Operational source of truth at runtime.
 *     Immediate UI responses, 0ms network latency for teller & workflow actions.
 *   - CANONICAL CLOUD (Supabase): Centralized, persistent multi-device store.
 *
 * Synchronization Policy:
 *   1. DIRTY PUSH: Debounced (300ms) upsert of mutated tables on every
 *      store.save() and store.saveQuiet() call.
 *   2. HEARTBEAT PULL: Automated fetch every 60 seconds (1 minute) to
 *      merge remote updates into local state.
 *   3. FIRST BOOT SEED: If remote database is unseeded/empty, pushes
 *      institutional baseline seed data automatically to Supabase.
 *   4. STATUS BADGE: Live header indicator (Synced, Syncing, Offline, Error)
 *      with on-click instant sync and toast notification.
 *   5. NO ICONS: Pure typographic styling matching Finage OS aesthetic.
 * =====================================================================
 */

const SupabaseSync = (() => {
  // --- Private State ---
  let _status = 'offline'; // 'offline' | 'syncing' | 'synced' | 'error'
  let _lastSync = null;
  const _pushQueue = new Set();
  let _pullTimer = null;
  let _pushDebounceTimer = null;
  let _pushInFlight = false;
  let _connected = false;
  let _storeRef = null;

  // --- Helpers ---
  function db() {
    return window.supabase;
  }

  function isAvailable() {
    return !!(window.supabase);
  }

  function setStatus(s) {
    _status = s;
    _renderStatusBadge();
  }

  function _renderStatusBadge() {
    const badge = document.getElementById('sync-status-badge');
    if (!badge) return;

    const timeStr = _lastSync
      ? new Date(_lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    const labelMap = {
      offline: 'Local Only',
      syncing: 'Syncing…',
      synced: `Synced ${timeStr}`,
      error: 'Sync Error'
    };

    const colorMap = {
      offline: 'var(--text-muted, #64748b)',
      syncing: 'var(--accent-amber, #d97706)',
      synced: 'var(--accent-emerald, #059669)',
      error: 'var(--accent-rose, #dc2626)'
    };

    const borderMap = {
      offline: 'rgba(100, 116, 139, 0.3)',
      syncing: 'rgba(217, 119, 6, 0.4)',
      synced: 'rgba(5, 150, 105, 0.35)',
      error: 'rgba(220, 38, 38, 0.4)'
    };

    const bgMap = {
      offline: 'rgba(100, 116, 139, 0.05)',
      syncing: 'rgba(217, 119, 6, 0.08)',
      synced: 'rgba(5, 150, 105, 0.06)',
      error: 'rgba(220, 38, 38, 0.08)'
    };

    badge.textContent = labelMap[_status] || _status;
    badge.style.color = colorMap[_status] || '#64748b';
    badge.style.borderColor = borderMap[_status] || '#cbd5e1';
    badge.style.backgroundColor = bgMap[_status] || 'transparent';
  }

  // --- Schema Sanitizers ---

  function sanitizeMember(m) {
    if (!m || !m.id) return null;
    return {
      id:                   m.id,
      name:                 m.name || 'Unknown Member',
      nationalId:           String(m.nationalId || m.national_id || ''),
      phone:                m.phone || '',
      email:                m.email || `${m.id.toLowerCase()}@finage.local`,
      joinDate:             m.joinDate || m.membershipDate || new Date().toISOString().slice(0, 10),
      branchId:             m.branchId || 'br-01',
      branchName:           m.branchName || 'Head Office',
      kycStatus:            m.kycStatus || 'Verified',
      occupation:           m.occupation || m.employer_sector || 'Business Member',
      employer:             m.employer || m.employerName || 'Self-Employed',
      riskSegment:          m.riskSegment || 'Standard Risk',
      relationshipScore:    Number(m.relationshipScore) || 75,
      savingsBalance:       Number(m.savingsBalance) || 0,
      fixedDepositBalance:  Number(m.fixedDepositBalance) || 0,
      shareCapital:         Number(m.shareCapital) || 0,
      activeLoans:          Array.isArray(m.activeLoans) ? m.activeLoans : [],
      guarantorCommitments: Array.isArray(m.guarantorCommitments) ? m.guarantorCommitments : []
    };
  }

  function sanitizeTransaction(t) {
    if (!t || !t.id) return null;
    let d = t.timestamp || t.date;
    if (!d) {
      d = new Date().toISOString();
    }
    return {
      id:           t.id,
      date:         d,
      type:         t.type || 'Unknown',
      status:       t.status || 'Completed',
      channel:      t.channel || 'Branch FOSA',
      memberId:     t.memberId || null,
      memberName:   t.client || t.memberName || null,
      amount:       Number(t.amount) || 0,
      details:      t.description || t.narrative || t.client || t.type || null,
      approver:     t.approver || null,
      approverRole: t.approverRole || null,
      glDebit:      t.glDebit || t.glDebitCode || null,
      glCredit:     t.glCredit || t.glCreditCode || null,
      batchId:      t.batchId || null
    };
  }

  function sanitizeAudit(a) {
    if (!a || !a.id) return null;
    return {
      id:          a.id,
      timestamp:   a.timestamp || new Date().toISOString(),
      action:      a.action || 'SYSTEM_EVENT',
      userId:      a.userId || 'USR-SYSTEM',
      userName:    a.userName || 'System Operator',
      module:      a.module || 'Core Banking Engine (Layer 0)',
      entityId:    a.entityId || a.id,
      description: a.description || a.action || 'Institutional event',
      ipAddress:   a.ipAddress || '127.0.0.1'
    };
  }

  function sanitizeGL(g) {
    if (!g || !g.code) return null;
    return {
      code:     String(g.code),
      name:     g.name || '',
      category: g.category || 'Assets',
      balance:  Number(g.balance) || 0,
      normal:   g.normal || 'Debit'
    };
  }

  // --- Push Operations ---

  async function upsertBatch(table, rows, conflictKey = 'id') {
    if (!rows || rows.length === 0) return;
    const valid = rows.filter(Boolean);
    if (valid.length === 0) return;

    const CHUNK = 100;
    for (let i = 0; i < valid.length; i += CHUNK) {
      const chunk = valid.slice(i, i + CHUNK);
      const { error } = await db()
        .from(table)
        .upsert(chunk, { onConflict: conflictKey, ignoreDuplicates: false });
      if (error) {
        console.error(`[SyncEngine] upsert ${table} failed:`, error.message);
        throw error;
      }
    }
  }

  async function pushDirty(state) {
    if (!isAvailable() || !state) return;
    if (_pushInFlight) return;
    _pushInFlight = true;
    setStatus('syncing');

    try {
      const ops = [];

      if (_pushQueue.has('members')) {
        const rows = (state.members || []).map(sanitizeMember).filter(Boolean);
        ops.push(upsertBatch('members', rows, 'id'));
      }

      if (_pushQueue.has('transactions')) {
        const rows = (state.recentTransactions || []).slice(0, 500).map(sanitizeTransaction).filter(Boolean);
        ops.push(upsertBatch('transactions', rows, 'id'));
      }

      if (_pushQueue.has('auditTrail')) {
        const rows = (state.auditTrail || []).slice(0, 500).map(sanitizeAudit).filter(Boolean);
        ops.push(upsertBatch('audit_trail', rows, 'id'));
      }

      if (_pushQueue.has('generalLedger')) {
        const rows = (state.generalLedger || []).map(sanitizeGL).filter(Boolean);
        ops.push(upsertBatch('general_ledger', rows, 'code'));
      }

      if (_pushQueue.has('branches')) {
        const rows = (state.branches || []).map(b => ({
          id: b.id,
          name: b.name,
          code: b.code,
          tellerCount: b.tellerCount,
          vaultLimit: b.vaultLimit,
          cashInVault: b.cashInVault || 0,
          tillBalances: b.tillBalances || [],
          lastReconciledAt: b.lastReconciledAt || new Date().toISOString(),
          reconciliationDiscrepancy: b.reconciliationDiscrepancy || 0,
          status: b.status || 'Active'
        }));
        ops.push(upsertBatch('branches', rows, 'id'));
      }

      if (_pushQueue.has('users')) {
        const rows = (state.users || []).map(u => ({
          id: u.id,
          name: u.name,
          email: u.email,
          roles: u.roles || [],
          branchId: u.branchId,
          branchName: u.branchName,
          singleApprovalLimit: u.singleApprovalLimit || 0,
          dailyApprovalLimit: u.dailyApprovalLimit || 0,
          status: u.status || 'Active',
          mfaEnabled: u.mfaEnabled !== false,
          lastLogin: u.lastLogin || null
        }));
        ops.push(upsertBatch('users', rows, 'id'));
      }

      if (_pushQueue.has('roles')) {
        const rows = (state.roles || []).map(r => ({
          id: r.id,
          name: r.name,
          category: r.category,
          permissions: r.permissions || []
        }));
        ops.push(upsertBatch('roles', rows, 'id'));
      }

      await Promise.all(ops);
      _pushQueue.clear();
      _lastSync = new Date().toISOString();
      _connected = true;
      setStatus('synced');
    } catch (e) {
      console.warn('[SyncEngine] pushDirty error:', e.message);
      setStatus('error');
      _connected = false;
    } finally {
      _pushInFlight = false;
    }
  }

  async function pushAll(state) {
    if (!isAvailable() || !state) return;
    ['roles', 'branches', 'users', 'members', 'generalLedger', 'transactions', 'auditTrail'].forEach(k => _pushQueue.add(k));
    await pushDirty(state);
  }

  // --- Pull Operations ---

  async function pullAll(state) {
    if (!isAvailable() || !state) return;
    setStatus('syncing');

    try {
      const [
        { data: roles },
        { data: users },
        { data: branches },
        { data: members },
        { data: gl },
        { data: transactions },
        { data: audit }
      ] = await Promise.all([
        db().from('roles').select('*'),
        db().from('users').select('*'),
        db().from('branches').select('*'),
        db().from('members').select('*'),
        db().from('general_ledger').select('*'),
        db().from('transactions').select('*').order('date', { ascending: false }).limit(500),
        db().from('audit_trail').select('*').order('timestamp', { ascending: false }).limit(500)
      ]);

      let changed = false;

      if (roles && roles.length > 0) {
        state.roles = roles;
        changed = true;
      }

      if (users && users.length > 0) {
        const remoteMap = new Map(users.map(u => [u.id, u]));
        const localOnly = (state.users || []).filter(u => !remoteMap.has(u.id));
        state.users = [...users, ...localOnly];
        changed = true;
      }

      if (branches && branches.length > 0) {
        const remoteMap = new Map(branches.map(b => [b.id, b]));
        const localOnly = (state.branches || []).filter(b => !remoteMap.has(b.id));
        state.branches = [...branches, ...localOnly];
        changed = true;
      }

      if (members && members.length > 0) {
        const remoteMap = new Map(members.map(m => [m.id, m]));
        const localOnly = (state.members || []).filter(m => !remoteMap.has(m.id));
        const merged = members.map(rm => {
          const local = (state.members || []).find(lm => lm.id === rm.id);
          return local ? { ...local, ...rm } : rm;
        });
        state.members = [...merged, ...localOnly];
        changed = true;
      }

      if (gl && gl.length > 0) {
        const remoteMap = new Map(gl.map(g => [g.code, g]));
        state.generalLedger = (state.generalLedger || []).map(lg => {
          const rg = remoteMap.get(String(lg.code));
          return rg ? { ...lg, balance: rg.balance } : lg;
        });
        changed = true;
      }

      if (transactions && transactions.length > 0) {
        const localMap = new Map((state.recentTransactions || []).map(t => [t.id, t]));
        transactions.forEach(rt => {
          localMap.set(rt.id, {
            id: rt.id,
            type: rt.type,
            channel: rt.channel,
            memberId: rt.memberId,
            client: rt.memberName || rt.details || rt.type,
            amount: rt.amount,
            status: rt.status,
            time: rt.date ? new Date(rt.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
            timestamp: rt.date,
            description: rt.details
          });
        });
        state.recentTransactions = [...localMap.values()]
          .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        changed = true;
      }

      if (audit && audit.length > 0) {
        const localMap = new Map((state.auditTrail || []).map(a => [a.id, a]));
        audit.forEach(ra => {
          if (!localMap.has(ra.id)) {
            localMap.set(ra.id, {
              id: ra.id,
              timestamp: ra.timestamp,
              userId: ra.userId,
              userName: ra.userName,
              module: ra.module || 'Core Banking Engine (Layer 0)',
              action: ra.action,
              entityId: ra.entityId,
              description: ra.description || ra.action,
              ipAddress: ra.ipAddress || '127.0.0.1'
            });
          }
        });
        state.auditTrail = [...localMap.values()]
          .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        changed = true;
      }

      if (changed) {
        localStorage.setItem((_storeRef && _storeRef.storageKey) || 'finage_v3_state', JSON.stringify(state));
        _lastSync = new Date().toISOString();
        _connected = true;
        if (_storeRef && _storeRef.notify) {
          _storeRef.notify();
        }
      }

      _lastSync = new Date().toISOString();
      _connected = true;
      setStatus('synced');
    } catch (e) {
      console.warn('[SyncEngine] pullAll error:', e.message);
      setStatus('error');
      _connected = false;
    }
  }

  // --- Realtime Subscription ---

  function setupRealtime(storeInstance) {
    if (!isAvailable()) return;
    try {
      db().channel('public:finage_realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions' }, payload => {
          const s = (storeInstance && storeInstance.state) || (window.store && store.state);
          if (!s || !payload.new) return;
          const exists = (s.recentTransactions || []).some(t => t.id === payload.new.id);
          if (!exists) {
            s.recentTransactions = s.recentTransactions || [];
            s.recentTransactions.unshift({
              id: payload.new.id,
              type: payload.new.type,
              client: payload.new.memberName || payload.new.details || payload.new.type,
              amount: payload.new.amount,
              time: payload.new.date ? new Date(payload.new.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
              timestamp: payload.new.date,
              status: payload.new.status,
              channel: payload.new.channel
            });
            if (storeInstance && storeInstance.saveQuiet) storeInstance.saveQuiet();
            if (storeInstance && storeInstance.notify) storeInstance.notify();
          }
        })
        .subscribe();
    } catch (e) {
      console.warn('[SyncEngine] realtime setup error:', e);
    }
  }

  // --- Public Interface ---

  function markDirty(...keys) {
    keys.forEach(k => _pushQueue.add(k));
    _schedulePush();
  }

  function _schedulePush() {
    clearTimeout(_pushDebounceTimer);
    _pushDebounceTimer = setTimeout(() => {
      const s = (_storeRef && _storeRef.state) || (window.store && store.state);
      if (!s) return;
      pushDirty(s);
    }, 300);
  }

  function startAutoSync(storeInstance) {
    if (!isAvailable()) {
      setStatus('offline');
      return;
    }
    if (storeInstance) _storeRef = storeInstance;

    // Pull every 60 seconds (1 minute protocol)
    clearInterval(_pullTimer);
    _pullTimer = setInterval(() => {
      const s = (_storeRef && _storeRef.state) || (window.store && store.state);
      if (s) pullAll(s);
    }, 60000);

    console.log('[SyncEngine] Heartbeat active: Pull every 60s, debounced push on mutations.');
  }

  function stopAutoSync() {
    clearInterval(_pullTimer);
    clearTimeout(_pushDebounceTimer);
    _pullTimer = null;
    setStatus('offline');
  }

  async function forcePush() {
    const s = (_storeRef && _storeRef.state) || (window.store && store.state);
    if (!s) return;
    setStatus('syncing');
    await pushAll(s);
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Push completed: Local data synchronized to Supabase.', 'success');
    }
  }

  async function forcePull() {
    const s = (_storeRef && _storeRef.state) || (window.store && store.state);
    if (!s) return;
    setStatus('syncing');
    await pullAll(s);
    if (typeof App !== 'undefined' && App.showToast) {
      App.showToast('Pull completed: Canonical data fetched from Supabase.', 'success');
    }
  }

  async function init(storeInstance) {
    if (storeInstance) _storeRef = storeInstance;
    const s = (_storeRef && _storeRef.state) || (window.store && store.state);

    if (!isAvailable()) {
      console.warn('[SyncEngine] Supabase client not found. Running offline on localStorage.');
      setStatus('offline');
      return;
    }

    setStatus('syncing');
    try {
      // Introspect remote members count
      const { data: members, error } = await db().from('members').select('id').limit(2);
      if (!error && (!members || members.length === 0)) {
        // First boot: Remote is empty, push baseline state up
        console.log('[SyncEngine] Remote unseeded. Seeding Supabase from institutional baseline...');
        await pushAll(s);
      } else {
        // Remote has data, execute pull & merge
        console.log('[SyncEngine] Remote data detected. Performing intelligent merge...');
        await pullAll(s);
      }

      setupRealtime(_storeRef);
      startAutoSync(_storeRef);

      window.addEventListener('online', () => {
        console.log('[SyncEngine] Network reconnected. Triggering sync...');
        const stateNow = (_storeRef && _storeRef.state) || (window.store && store.state);
        if (stateNow) pullAll(stateNow);
      });

      window.addEventListener('offline', () => {
        console.warn('[SyncEngine] Network disconnected.');
        setStatus('offline');
      });

      setStatus('synced');
    } catch (e) {
      console.warn('[SyncEngine] Initialization exception:', e);
      setStatus('error');
    }
  }

  return {
    init,
    startAutoSync,
    stopAutoSync,
    markDirty,
    forcePush,
    forcePull,
    pushAll,
    pullAll,
    sanitizeMember,
    sanitizeTransaction,
    sanitizeAudit,
    get status() { return _status; },
    get lastSync() { return _lastSync; },
    get connected() { return _connected; }
  };
})();

window.SupabaseSync = SupabaseSync;
