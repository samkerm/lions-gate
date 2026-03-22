const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const coreSrc = path.join(monorepoRoot, 'packages', 'core', 'src');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...new Set([...(config.watchFolders ?? []), monorepoRoot])];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;

/**
 * Metro sometimes resolves TypeScript sources using `.js` specifiers (Node ESM style).
 * Our package ships `.ts` sources only — map sibling `*.js` requests to `*.ts` when present.
 */
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    typeof moduleName === 'string' &&
    moduleName.startsWith('.') &&
    moduleName.endsWith('.js') &&
    context.originModulePath &&
    context.originModulePath.startsWith(coreSrc)
  ) {
    const dir = path.dirname(context.originModulePath);
    const absJs = path.normalize(path.join(dir, moduleName));
    const absTs = absJs.replace(/\.js$/, '.ts');
    if (fs.existsSync(absTs)) {
      return { type: 'sourceFile', filePath: absTs };
    }
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
