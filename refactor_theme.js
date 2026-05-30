const fs = require('fs');
const path = require('path');

const dir = 'c:/Users/Administrator/Desktop/متابعة التحصيل/mobile/app';

const processFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('useAppTheme')) {
    return; // Already processed
  }

  // Find the component function name
  const compMatch = content.match(/export default function ([a-zA-Z0-9_]+)\s*\(/);
  if (!compMatch) return;
  const compName = compMatch[1];

  // 1. Add import
  content = content.replace(
    /import { StyleSheet,/,
    "import { useAppTheme } from '../context/ThemeContext';\nimport { StyleSheet,"
  );
  if (!content.includes('useAppTheme')) {
    content = content.replace(
      /import React/,
      "import { useAppTheme } from '@/context/ThemeContext';\nimport React"
    );
  }
  // Let's just fix imports blindly
  content = "import { useAppTheme } from '../context/ThemeContext';\n" + content;

  // 2. Add hook to component
  content = content.replace(
    new RegExp(`export default function ${compName}\\s*\\(.*?\\)\\s*{`),
    `export default function ${compName}() {\n  const { colors, theme, toggleTheme } = useAppTheme();\n  const styles = getStyles(colors);`
  );

  // Note: some components have props, let's preserve them
  content = content.replace(
    /export default function ([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*\{/g,
    function(match, p1, p2) {
      if(match.includes('useAppTheme')) return match;
      return `export default function ${p1}(${p2}) {\n  const { colors, theme, toggleTheme } = useAppTheme();\n  const styles = getStyles(colors);`;
    }
  );

  // 3. Replace StyleSheet.create with getStyles
  content = content.replace(
    /const styles = StyleSheet\.create\({/g,
    'const getStyles = (colors: any) => StyleSheet.create({'
  );

  // 4. Replace colors in the styles
  content = content.replace(/'#0f172a'/gi, 'colors.background');
  content = content.replace(/'#f8fafc'/gi, 'colors.text');
  content = content.replace(/'#94a3b8'/gi, 'colors.textMuted');
  content = content.replace(/'#cbd5e1'/gi, 'colors.textSecondary');
  content = content.replace(/'#64748b'/gi, 'colors.textMuted');
  content = content.replace(/'#3b82f6'/gi, 'colors.primary');
  content = content.replace(/'#22c55e'/gi, 'colors.success');
  content = content.replace(/'#ef4444'/gi, 'colors.danger');
  content = content.replace(/'#f59e0b'/gi, 'colors.warning');
  content = content.replace(/'#eab308'/gi, 'colors.gold');
  content = content.replace(/'#fbbf24'/gi, 'colors.gold');
  
  content = content.replace(/'rgba\(255, 255, 255, 0\.05\)'/gi, 'colors.surfaceTrans');
  content = content.replace(/'rgba\(255,255,255,0\.05\)'/gi, 'colors.surfaceTrans');
  content = content.replace(/'rgba\(255, 255, 255, 0\.1\)'/gi, 'colors.border');
  content = content.replace(/'rgba\(255,255,255,0\.1\)'/gi, 'colors.border');
  
  content = content.replace(/'rgba\(34, 197, 94, 0\.1\)'/gi, 'colors.successBg');
  content = content.replace(/'rgba\(239, 68, 68, 0\.1\)'/gi, 'colors.dangerBg');
  content = content.replace(/'rgba\(234, 179, 8, 0\.1\)'/gi, 'colors.goldBg');
  content = content.replace(/'rgba\(251, 191, 36, 0\.1\)'/gi, 'colors.goldBg');
  
  // 5. Some inline colors might be left, but this is a good start.

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Refactored ${filePath}`);
};

const processDir = (d) => {
  const files = fs.readdirSync(d);
  for (const file of files) {
    const full = path.join(d, file);
    if (fs.statSync(full).isDirectory()) {
      processDir(full);
    } else if (full.endsWith('.tsx') && !file.includes('_layout')) {
      processFile(full);
    }
  }
};

processDir(dir);
