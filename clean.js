const fs = require('fs');
const path = require('path');

const cleanFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix import path based on directory depth
  const relPath = path.relative('c:/Users/Administrator/Desktop/متابعة التحصيل/mobile/app', filePath);
  const depth = relPath.split(path.sep).length - 1;
  let importPrefix = '../';
  if (depth === 1) importPrefix = '../../';
  if (depth === 2) importPrefix = '../../../';
  
  // Remove all useAppTheme imports
  content = content.replace(/import { useAppTheme } from '.*?';\n/g, '');
  content = content.replace(/import { useAppTheme } from '.*?';\r\n/g, '');
  
  // Add correct import at the top
  content = `import { useAppTheme } from '${importPrefix}context/ThemeContext';\n` + content;

  // Remove duplicate hook declarations
  content = content.replace(/const { colors, theme, toggleTheme } = useAppTheme\(\);\s*const styles = getStyles\(colors\);\s*/g, '');
  
  // Re-insert exactly once right after export default function XYZ() {
  content = content.replace(
    /(export default function [a-zA-Z0-9_]+\s*\([^)]*\)\s*\{)/g,
    "$1\n  const { colors, theme, toggleTheme } = useAppTheme();\n  const styles = getStyles(colors);"
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Cleaned ${filePath}`);
};

const processDir = (d) => {
  const files = fs.readdirSync(d);
  for (const file of files) {
    const full = path.join(d, file);
    if (fs.statSync(full).isDirectory()) {
      processDir(full);
    } else if (full.endsWith('.tsx') && !file.includes('_layout')) {
      cleanFile(full);
    }
  }
};

processDir('c:/Users/Administrator/Desktop/متابعة التحصيل/mobile/app');
