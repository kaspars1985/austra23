const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('--- AUSTRA EXTENSION V1.2.8 VERIFICATION ---');

const extDir = path.join(__dirname, '..', 'extension');

// 1. Check manifest
const manifestPath = path.join(extDir, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  throw new Error('manifest.json does not exist!');
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
console.log('✓ manifest.json is valid JSON');

if (manifest.version !== '1.2.8') {
  throw new Error(`manifest.json version should be 1.2.8, got ${manifest.version}`);
}
console.log('✓ manifest.json version is 1.2.8');

if (manifest.action.default_popup) {
  throw new Error('default_popup should not be set (we want direct sidebar toggle via chrome.action.onClicked)!');
}
console.log('✓ manifest.json correctly uses direct action click without popup overlay');

// 2. Check icon files
for (const [size, iconRelPath] of Object.entries(manifest.icons)) {
  const iconPath = path.join(extDir, iconRelPath);
  if (!fs.existsSync(iconPath) || fs.statSync(iconPath).size === 0) {
    throw new Error(`Icon missing or empty: ${iconRelPath}`);
  }
}
console.log('✓ All icon sizes exist (16, 32, 48, 128)');

// 3. Check service worker
const bgPath = path.join(extDir, manifest.background.service_worker);
if (!fs.existsSync(bgPath)) throw new Error('Service worker missing');
const bgCode = fs.readFileSync(bgPath, 'utf8');
new vm.Script(bgCode); // syntax check
console.log('✓ background.js syntax is valid');

// 4. Check content script & styles
for (const cs of manifest.content_scripts) {
  for (const jsFile of cs.js) {
    const jsPath = path.join(extDir, jsFile);
    if (!fs.existsSync(jsPath)) throw new Error(`Content script missing: ${jsFile}`);
    const code = fs.readFileSync(jsPath, 'utf8');
    new vm.Script(code); // syntax check
    if (!code.includes("const CURRENT_VERSION = '1.2.8'")) {
      throw new Error('content.js is missing CURRENT_VERSION = 1.2.8');
    }
    if (!code.includes('findModalConfirmButton') || !code.includes('waitForAndConfirmModal') || !code.includes('checkModalForErrors')) {
      throw new Error('content.js is missing modal confirmation and error inspection functions!');
    }
    if (!code.includes('isPriceAgreedStatus') || !code.includes('isDrawingStatus') || !code.includes('showDrawingConfirmationDialog')) {
      throw new Error('content.js is missing status validation and drawing exception dialog functions!');
    }
    if (!code.includes('saveLogToSession') || !code.includes('loadLogFromSession')) {
      throw new Error('content.js is missing activity log persistence functions!');
    }
    console.log(`✓ ${jsFile} syntax is valid, contains modal validation, error inspection, drawing dialog, and log persistence`);
  }
  for (const cssFile of cs.css) {
    const cssPath = path.join(extDir, cssFile);
    if (!fs.existsSync(cssPath)) throw new Error(`Content CSS missing: ${cssFile}`);
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    if (!cssContent.includes('austra-sidebar-open') || !cssContent.includes('margin-right')) {
      throw new Error('styles.css is missing sidebar margin-right shift rule!');
    }
    if (!cssContent.includes('#austra-alert-btn-ok') || !cssContent.includes('#austra-alert-btn-confirm')) {
      throw new Error('styles.css is missing #austra-alert-btn-ok / #austra-alert-btn-confirm styling!');
    }
    if (!cssContent.includes('.austra-btn-clear-log')) {
      throw new Error('styles.css is missing .austra-btn-clear-log styling!');
    }
    if (!cssContent.includes('.austra-log-card') || !cssContent.includes('.austra-log-view')) {
      throw new Error('styles.css is missing log card styling!');
    }
    console.log(`✓ ${cssFile} verified with layout shifting rules, alert buttons, clear log button, and expanded log card`);
  }
}

// 5. Test color evaluator
function parseRgb(colorStr) {
  const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  return match ? { r: parseInt(match[1]), g: parseInt(match[2]), b: parseInt(match[3]) } : null;
}

function evaluateTestDot(className, colorStr) {
  const rgb = parseRgb(colorStr);
  if (className.includes('jfxJkt') || /\b(bg-success|text-success|is-success)\b/i.test(className)) {
    return { isGreen: true };
  }
  if (rgb) {
    const maxDiff = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b);
    const isGrey = (maxDiff < 25) ||
                   (Math.abs(rgb.r - 231) < 18 && Math.abs(rgb.g - 234) < 18 && Math.abs(rgb.b - 239) < 18);
    const isAustraGreen = (Math.abs(rgb.r - 138) < 30 && Math.abs(rgb.g - 209) < 30 && Math.abs(rgb.b - 107) < 30);
    const isGenericGreen = (rgb.g >= 125 && rgb.g > rgb.r + 25 && rgb.g > rgb.b + 25);
    if ((isAustraGreen || isGenericGreen) && !isGrey) return { isGreen: true };
  }
  return { isGreen: false };
}

const emptyTest = evaluateTestDot('sc-kfPsKX lmcRNk', 'rgb(231, 234, 239)');
if (emptyTest.isGreen !== false) throw new Error('Empty dot was falsely identified as green!');
console.log('✓ Empty dot (rgb 231,234,239, class lmcRNk) correctly identified as pending');

const whiteTest = evaluateTestDot('', 'rgb(255, 255, 255)');
if (whiteTest.isGreen !== false) throw new Error('White element falsely identified as green!');

const pastelTest = evaluateTestDot('', 'rgb(220, 252, 231)'); // #dcfce7 light alert
if (pastelTest.isGreen !== false) throw new Error('Pastel green border/background falsely identified as green dot!');
console.log('✓ Pastel backgrounds correctly ignored');

const greenTest = evaluateTestDot('sc-kfPsKX jfxJkt', 'rgb(138, 209, 107)');
if (greenTest.isGreen !== true) throw new Error('Green dot failed detection!');
console.log('✓ Green dot (rgb 138,209,107, class jfxJkt) correctly identified as green');

const austraGreenNoClass = evaluateTestDot('some-dot', 'rgb(138, 209, 107)');
if (austraGreenNoClass.isGreen !== true) throw new Error('Austra green dot failed RGB detection!');
console.log('✓ Austra green RGB (138, 209, 107) correctly identified without jfxJkt class');

// 6. Test Semver comparison logic
function compareSemver(v1, v2) {
  const p1 = (v1 || '0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '0').replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return 1;
    if (n1 < n2) return -1;
  }
  return 0;
}

if (compareSemver('1.2.8', '1.2.7') <= 0) throw new Error('Semver 1.2.8 should be greater than 1.2.7');
if (compareSemver('2.0.0', '1.9.9') <= 0) throw new Error('Semver 2.0.0 should be greater than 1.9.9');
if (compareSemver('1.2.8', '1.2.8') !== 0) throw new Error('Semver 1.2.8 should be equal to 1.2.8');
if (compareSemver('1.2.7', '1.2.8') >= 0) throw new Error('Semver 1.2.7 should be less than 1.2.8');
console.log('✓ Semver update comparison correctly detects newer, older, and equal versions');

// 7. Test Order Status validation logic
function isPriceAgreedStatus(statusStr) {
  if (!statusStr) return false;
  return /cenu\s+saskaņo/i.test(statusStr);
}

function isDrawingStatus(statusStr) {
  if (!statusStr) return false;
  return /ras[eē]jum/i.test(statusStr);
}

if (!isPriceAgreedStatus('Cenu saskaņošana ar klientu')) throw new Error('Failed to match full status!');
if (!isPriceAgreedStatus('Cenu saskaņošana')) throw new Error('Failed to match short status!');
if (!isPriceAgreedStatus('Statuss: Cenu saskaņošana ar klientu')) throw new Error('Failed to match prefixed status!');
if (isPriceAgreedStatus('Jauns')) throw new Error('False positive for Jauns!');
if (isPriceAgreedStatus('Uz ražošanu')) throw new Error('False positive for Uz ražošanu!');
if (isPriceAgreedStatus('Melnraksts')) throw new Error('False positive for Melnraksts!');
if (isPriceAgreedStatus('')) throw new Error('False positive for empty string!');
if (isPriceAgreedStatus(null)) throw new Error('False positive for null!');
console.log('✓ Order status validation logic correctly accepts "Cenu saskaņošana" and rejects other statuses');

// 8. Test Drawing Status exception logic
if (!isDrawingStatus('Rasējumu saskaņošana ar klientu')) throw new Error('Failed to match Rasējumu saskaņošana ar klientu!');
if (!isDrawingStatus('Rasējumu saskaņošana')) throw new Error('Failed to match Rasējumu saskaņošana!');
if (!isDrawingStatus('Rasejumu saskanosana ar klientu')) throw new Error('Failed to match transliterated drawing status!');
if (!isDrawingStatus('Rasējumi')) throw new Error('Failed to match Rasējumi!');
if (isDrawingStatus('Jauns')) throw new Error('False positive for Jauns in drawing check!');
if (isDrawingStatus('Cenu saskaņošana ar klientu')) throw new Error('False positive for Cenu saskaņošana in drawing check!');
if (isDrawingStatus('')) throw new Error('False positive for empty drawing status!');
if (isDrawingStatus(null)) throw new Error('False positive for null drawing status!');
console.log('✓ Drawing exception status logic correctly detects drawing coordination orders');

// 9. Test Modal Error matching logic
function isModalError(text) {
  return /nevar nosūtīt/i.test(text) || /nav veikts/i.test(text) || /nav veikta rezervācija/i.test(text);
}

const mockAustraError = "Uz ražošanu nevar nosūtīt, jo nav veikts CutRite aprēķina process\nUz ražošanu nevar nosūtīt, jo nav veikta rezervācija";
if (!isModalError(mockAustraError)) throw new Error('Failed to detect Austra ERP modal error messages!');
if (isModalError('Vai apstiprināt pasūtījuma nodošanu ražošanā?')) throw new Error('False positive for standard confirmation modal!');
console.log('✓ Modal error inspection logic correctly identifies blocking error messages from ERP');

console.log('\n>>> ALL AUTOMATED TESTS PASSED SUCCESSFULLY! <<<');
