const fs = require('fs');
const path = require('path');

const replaceInDir = (dir) => {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== '.expo') {
        replaceInDir(fullPath);
      }
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const newContent = content.replace(/['"]ar-EG-u-nu-latn['"]/g, "'ar-DZ'");
      if (content !== newContent) {
        fs.writeFileSync(fullPath, newContent, 'utf8');
        console.log('Updated', fullPath);
      }
    }
  }
};

replaceInDir('c:/Users/Administrator/Desktop/متابعة التحصيل/frontend/src');
replaceInDir('c:/Users/Administrator/Desktop/متابعة التحصيل/mobile');
