const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('pageerror: ' + err.message));

  const rendererDir = path.join(__dirname, '..', 'src', 'renderer');

  // Mock the qtiApp bridge that preload.js would normally expose, so we can
  // exercise the renderer's UI logic in isolation from Electron itself.
  // addInitScript runs before any page script on every navigation, so
  // renderer.js sees window.qtiApp already defined when it first executes.
  await page.addInitScript(() => {
    window.qtiApp = {
      selectQtiFiles: async () => ['/fake/path/QTIv12_test_bank_items.zip'],
      selectOutputDir: async () => '/fake/output',
      processFiles: async (files, outDir, sortMode) =>
        files.map((f) => ({
          archiveBaseName: f.split('/').pop().replace('.zip', ''),
          outDir: outDir + '/' + f.split('/').pop().replace('.zip', ''),
          itemCount: 42,
          errorCount: 0,
          ok: true,
        })),
      onProcessProgress: () => () => {},
      getStyle: async () => ({ css: '/* baseline */ body{}', isOverride: false, overrideFilePath: '/fake/style-override.css' }),
      saveStyle: async () => ({ ok: true }),
      resetStyle: async () => ({ ok: true }),
      revealInFolder: async () => {},
      openPath: async () => {},
      onMenuSelectFiles: () => {},
      onMenuSelectOutputDir: () => {},
      onMenuOpenStyleEditor: () => {},
    };
  });

  await page.goto('file://' + path.join(rendererDir, 'index.html'));
  await page.waitForTimeout(200);

  // Exercise: select files -> should populate file list and enable Process
  await page.click('#btnSelectFiles');
  await page.waitForTimeout(100);
  const fileListCount = await page.$$eval('#fileList li', (els) => els.length);

  await page.click('#btnSelectOutputDir');
  await page.waitForTimeout(100);
  const outputLabel = await page.textContent('#outputDirLabel');

  const processDisabledBefore = await page.$eval('#btnProcess', (el) => el.disabled);

  await page.click('#btnProcess');
  await page.waitForTimeout(300);
  const resultsCount = await page.$$eval('#resultsList li', (els) => els.length);
  const resultsHtml = await page.$eval('#resultsList', (el) => el.innerHTML);

  // Exercise style editor
  await page.click('#btnOpenStyleEditor');
  await page.waitForTimeout(100);
  const overlayVisible = await page.$eval('#styleEditorOverlay', (el) => !el.classList.contains('hidden'));
  const styleTextareaValue = await page.$eval('#styleTextarea', (el) => el.value);

  await browser.close();

  console.log('fileListCount:', fileListCount);
  console.log('outputLabel:', outputLabel);
  console.log('processDisabledBefore select:', processDisabledBefore);
  console.log('resultsCount:', resultsCount);
  console.log('resultsHtml includes "Item Preview":', resultsHtml.includes('Item Preview'));
  console.log('styleEditor overlay visible:', overlayVisible);
  console.log('styleTextarea populated:', styleTextareaValue.length > 0);
  console.log('console/page errors:', consoleErrors);

  const pass =
    fileListCount === 1 &&
    outputLabel === '/fake/output' &&
    resultsCount === 1 &&
    resultsHtml.includes('Item Preview') &&
    overlayVisible &&
    styleTextareaValue.length > 0 &&
    consoleErrors.length === 0;

  console.log(pass ? '\nSMOKE TEST PASS' : '\nSMOKE TEST FAIL');
  process.exit(pass ? 0 : 1);
})();
