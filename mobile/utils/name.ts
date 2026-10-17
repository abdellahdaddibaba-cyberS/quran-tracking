/**
 * تنقية اسم الابن من اسم الأب والجد بمقارنته مع الاسم الكامل للولي
 * Strips the father's and grandfather's names from the student's full name by comparing it with the parent's full name.
 */
export function cleanStudentName(studentName: string, parentName: string): string {
  if (!studentName) return '';
  if (!parentName) return studentName.trim();

  // Normalize names: replace multiple spaces, trim, and convert to lowercase
  const normalize = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase();
  
  const normStudent = normalize(studentName);
  const normParent = normalize(parentName);

  // If the student's name ends with the parent's name, strip it directly
  if (normStudent.endsWith(normParent)) {
    const cleaned = studentName.substring(0, studentName.length - parentName.length).trim();
    if (cleaned) return cleaned;
  }

  // Split both names into words
  const studentWords = normStudent.split(' ');
  const parentWords = normParent.split(' ');

  // Find the longest suffix of studentWords that matches a prefix of parentWords
  // E.g. studentWords = ["أحمد", "عبد", "الله", "دادي"]
  // parentWords = ["عبد", "الله", "دادي", "بابا"]
  // Match suffix of length k
  for (let k = studentWords.length - 1; k >= 1; k--) {
    const studentSuffix = studentWords.slice(studentWords.length - k).join(' ');
    const parentPrefix = parentWords.slice(0, k).join(' ');
    
    if (studentSuffix === parentPrefix) {
      const originalStudentWords = studentName.replace(/\s+/g, ' ').trim().split(' ');
      const cleanedWords = originalStudentWords.slice(0, originalStudentWords.length - k);
      return cleanedWords.join(' ');
    }
  }

  // Fallback: Remove any word from the end of studentWords that exists in parentWords
  const parentSet = new Set(parentWords);
  const originalStudentWords = studentName.replace(/\s+/g, ' ').trim().split(' ');
  let endIndex = originalStudentWords.length;
  
  while (endIndex > 1) {
    const word = originalStudentWords[endIndex - 1].toLowerCase();
    if (parentSet.has(word)) {
      endIndex--;
    } else {
      break;
    }
  }

  if (endIndex > 0) {
    return originalStudentWords.slice(0, endIndex).join(' ');
  }

  return studentName;
}
