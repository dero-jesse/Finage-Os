const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const root = path.join(__dirname, '..');
const branchViewSource = fs.readFileSync(path.join(root, 'js/views/branchView.js'), 'utf8');

function createBranchView() {
  const window = {};
  vm.runInNewContext(branchViewSource, {
    window,
    Formatter: {
      money: value => String(value),
      dateTime: value => String(value || ''),
      currencySymbol: '$'
    }
  }, { filename: 'js/views/branchView.js' });
  return window.BranchView;
}

function createContainer() {
  return {
    innerHTML: '',
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

test('FOSA renders an explanatory empty state when there are no branches', () => {
  const container = createContainer();

  createBranchView().render(container, { branches: [] });

  assert.match(container.innerHTML, /FOSA branch operations unavailable/);
  assert.match(container.innerHTML, /No branches are configured for this organization yet/);
});

test('FOSA renders when a branch has no till balance list', () => {
  const container = createContainer();

  createBranchView().render(container, {
    branches: [{
      id: 'branch-1',
      name: 'Main Branch',
      code: 'MAIN',
      tellerCount: 0,
      vaultLimit: 0,
      cashInVault: 0
    }],
    workflowTasks: []
  });

  assert.match(container.innerHTML, /Main Branch/);
  assert.match(container.innerHTML, /Total Float Across 0 Drawers/);
});
