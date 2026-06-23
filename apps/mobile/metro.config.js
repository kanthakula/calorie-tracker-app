// Metro config tuned for a pnpm + Turborepo monorepo.
//
// pnpm installs dependencies into a non-flat, symlinked store, so Metro must:
//   1. watch the repo root (to pick up changes in workspace packages like
//      @k21/validation), and
//   2. resolve modules from both the app's and the repo root's node_modules,
//      with hierarchical lookup disabled so it does not walk past the root.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the whole monorepo so changes to shared packages trigger a reload.
config.watchFolders = [workspaceRoot];

// 2. Resolve modules from the app first, then the hoisted root store.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Keep hierarchical lookup enabled: this repo uses `shamefully-hoist=true`
// (.npmrc), so workspace deps and @k21/validation are hoisted to the root
// node_modules and resolve correctly through the chain above.
config.resolver.disableHierarchicalLookup = false;

module.exports = config;
