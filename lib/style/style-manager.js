'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Style storage model:
 *   - lib/style/baseline.css (bundled with the app, read-only, derived from
 *     the source assessment platform's CSS -- see that file's own header
 *     comment for the derivation notes) is the factory default.
 *   - <userData>/style-override.css is the user's editable copy. It does
 *     NOT exist until the user's first save; until then, the baseline is
 *     the effective style.
 *   - "Reset to baseline" deletes the override file (rather than
 *     overwriting it with baseline content), so the effective style always
 *     falls cleanly back to whatever ships with the app, including in any
 *     future app update that changes the bundled baseline.
 *
 * Per the project decision to support "both" an in-app editor AND raw file
 * access, getOverrideFilePath() below is what the renderer's "Reveal file"
 * button uses (via shell.showItemInFolder) so a power user can hand-edit
 * style-override.css in their own editor; the app picks up changes next
 * time it reads the effective style (see getEffectiveStyle()), and the
 * in-app editor's "Reload from disk" action re-reads it without restarting
 * the app.
 */
class StyleManager {
  constructor(userDataDir, baselineCssPath) {
    this.baselineCssPath = baselineCssPath;
    this.overrideCssPath = path.join(userDataDir, 'style-override.css');
  }

  getBaselineCss() {
    return fs.readFileSync(this.baselineCssPath, 'utf8');
  }

  hasOverride() {
    return fs.existsSync(this.overrideCssPath);
  }

  /** The CSS actually used for the next batch of generated output. */
  getEffectiveCss() {
    if (this.hasOverride()) {
      return fs.readFileSync(this.overrideCssPath, 'utf8');
    }
    return this.getBaselineCss();
  }

  /** Absolute path to whichever file is effective right now (for copying into output folders). */
  getEffectiveCssPath() {
    return this.hasOverride() ? this.overrideCssPath : this.baselineCssPath;
  }

  saveOverride(cssText) {
    fs.writeFileSync(this.overrideCssPath, cssText, 'utf8');
  }

  resetToBaseline() {
    if (this.hasOverride()) {
      fs.unlinkSync(this.overrideCssPath);
    }
  }

  getOverrideFilePath() {
    return this.overrideCssPath;
  }
}

module.exports = { StyleManager };
