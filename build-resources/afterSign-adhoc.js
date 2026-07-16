'use strict';

/**
 * electron-builder "afterSign" hook (runs after packaging, before the
 * dmg/zip targets are built). We have no paid Apple Developer account, so
 * electron-builder finds no signing identity and skips signing entirely --
 * the built .app ships with NO code signature at all.
 *
 * That's worse than the usual "unidentified developer" Gatekeeper warning:
 * Apple Silicon's kernel refuses to execute an arm64 binary with no
 * signature whatsoever, which macOS reports as "<app> is damaged and can't
 * be opened" -- a hard block, not a warning a user can click through.
 *
 * The fix costs nothing: apply a free ad-hoc signature (codesign's "-"
 * identity, no certificate required). That satisfies the kernel's signature
 * requirement so the app actually launches. It is still NOT notarized, so
 * first launch still shows the standard (dismissable) "unidentified
 * developer" Gatekeeper prompt -- but not the "damaged" hard failure.
 */

const { execFileSync } = require('child_process');
const path = require('path');

module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const productFilename = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${productFilename}.app`);

  console.log(`[afterSign] Applying a free ad-hoc signature to ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });

  console.log('[afterSign] Verifying the signature...');
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });

  console.log('[afterSign] Ad-hoc signature applied and verified.');
};
