import { useState, useEffect, useMemo } from 'react';
import { BarChart2, ChevronRight, ChevronLeft, Download, FileSpreadsheet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import { halaqatAPI, studentsAPI, trackingAPI } from '../services/api';

function getWeekDays(dateInput) {
  const [y, m, d] = dateInput.split('-');
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const diffToSun = day;
  const sunday = new Date(date);
  sunday.setDate(date.getDate() - diffToSun);
  const days = [];
  const dayNames = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  for (let i = 0; i < 6; i++) {
    const current = new Date(sunday);
    current.setDate(sunday.getDate() + i);
    days.push({
      dateStr: `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`,
      label: dayNames[current.getDay()],
      shortDate: current.toLocaleDateString('ar-DZ', { month: 'numeric', day: 'numeric' }),
    });
  }
  return days;
}

function toLocalDate(isoStr) {
  const d = new Date(isoStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function WeeklyReport() {
  const [baseDate, setBaseDate] = useState(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return today < '2026-06-14' ? '2026-06-14' : today;
  });
  const weekDays = useMemo(() => getWeekDays(baseDate), [baseDate]);

  const weekName = useMemo(() => {
    const start = new Date(2026, 5, 14);
    const [y, m, d] = baseDate.split('-');
    const current = new Date(y, m - 1, d);
    const diffDays = Math.floor((current - start) / (1000 * 60 * 60 * 24));
    const weekNum = Math.max(1, Math.floor(diffDays / 7) + 1);
    const names = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];
    return names[weekNum - 1] || String(weekNum);
  }, [baseDate]);

  const [halaqat, setHalaqat] = useState([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState('');
  const [students, setStudents] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    halaqatAPI.getAll().then(r => setHalaqat(r.data.data)).catch(() => { });
  }, []);

  useEffect(() => {
    if (!selectedHalaqa) { setStudents([]); setMatrix({}); return; }
    const load = async () => {
      setLoading(true);
      try {
        const startDate = weekDays[0].dateStr;
        const endDate = weekDays[5].dateStr;
        const [sRes, tRes] = await Promise.all([
          studentsAPI.getByHalaqa(selectedHalaqa),
          trackingAPI.getByHalaqa(selectedHalaqa, { startDate, endDate }),
        ]);
        const fetchedStudents = sRes.data.data;
        const fetchedTracking = tRes.data.data;

        const m = {};
        fetchedStudents.forEach(st => {
          m[st._id] = {};
          weekDays.forEach(day => { m[st._id][day.dateStr] = null; });
        });
        fetchedTracking.forEach(rec => {
          const sid = rec.studentId?._id || rec.studentId;
          const rDate = toLocalDate(rec.date);
          if (m[sid]) m[sid][rDate] = { pages: rec.pagesMemorized, attendance: rec.attendance, isLate: rec.isLate };
        });

        setStudents(fetchedStudents);
        setMatrix(m);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    };
    load();
  }, [selectedHalaqa, baseDate, weekDays]);

  const shiftWeek = offset => {
    const [y, m, d] = baseDate.split('-');
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + offset * 7);
    let newDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
    if (newDate < '2026-06-14') newDate = '2026-06-14';
    setBaseDate(newDate);
  };

  const weekTotal = (st) =>
    weekDays.reduce((sum, day) => {
      const c = matrix[st._id]?.[day.dateStr];
      return sum + (c && c.pages !== null && c.pages !== undefined && c.attendance !== 'absent' ? Number(c.pages) : 0);
    }, 0);

  const weekRequired = (st) => st.dailyTarget * weekDays.length;

  const dayTotal = (dateStr) =>
    students.reduce((sum, st) => {
      const c = matrix[st._id]?.[dateStr];
      return sum + (c && c.pages !== null && c.pages !== undefined && c.attendance !== 'absent' ? Number(c.pages) : 0);
    }, 0);

  const dayRequired = students.reduce((s, st) => s + st.dailyTarget, 0);
  const grandTotal = students.reduce((s, st) => s + weekTotal(st), 0);
  const grandReq = students.reduce((s, st) => s + weekRequired(st), 0);
  const grandPct = grandReq > 0 ? Math.round((grandTotal / grandReq) * 100) : 0;

  const levelColor = { level1: '#818cf8', level2: '#22d3ee', level3: '#f59e0b', level4: '#4ade80' };
  const levelLabel = { level1: 'الأول', level2: 'الثاني', level3: 'الثالث', level4: 'الرابع' };

  // ─── تصدير جميع الحلقات بتصميم "مذهل" ───────────────────────────
  const handleExportAll = async () => {
    const toastId = toast.loading('جاري تصدير التقرير الفاخر...');
    try {
      const startDate = weekDays[0].dateStr;
      const endDate = weekDays[5].dateStr;

      const [hRes, sRes, tRes, totalRes] = await Promise.all([
        halaqatAPI.getAll(),
        studentsAPI.getAll(),
        trackingAPI.getAllRange({ startDate, endDate }),
        trackingAPI.getAllRange({ startDate: '2000-01-01', endDate: '2099-12-31' }) // جلب كل التاريخ للتراكمي
      ]);

      const allHalaqat = hRes.data.data;
      const allStudents = sRes.data.data;
      const allTracking = tRes.data.data;
      const fullHistory = totalRes.data.data;

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'نظام متابعة التحصيل';

      const colors = {
        emerald: 'FF064E3B', // زمردي غامق
        gold: 'FFB45309',    // ذهبي
        lightEmerald: 'FFECFDF5',
        grayBg: 'FFF9FAFB',
        textDark: 'FF111827',
        border: 'FFD1D5DB'
      };

      // ─── 1. صفحة الملخص العام (Summary Dashboard) ───
      const summarySheet = workbook.addWorksheet('الملخص العام', { views: [{ rightToLeft: true, showGridLines: false }] });

      summarySheet.mergeCells('A1:F2');
      const sTitle = summarySheet.getCell('A1');
      sTitle.value = 'لوحة التحكم وإحصائيات الإنجاز الأسبوعي';
      sTitle.font = { name: 'Arial', bold: true, size: 20, color: { argb: 'FFFFFFFF' } };
      sTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.emerald } };
      sTitle.alignment = { horizontal: 'center', vertical: 'middle' };
      summarySheet.getRow(1).height = 30;
      summarySheet.getRow(2).height = 30;

      // حساب إحصائيات عامة لجميع الحلقات
      const totalPages = allTracking.reduce((s, r) => s + r.pagesMemorized, 0);
      const totalReq = allStudents.reduce((s, st) => s + (st.dailyTarget * 6), 0);
      const totalPct = totalReq > 0 ? Math.round((totalPages / totalReq) * 100) : 0;

      const statBox = summarySheet.getCell('A4');
      summarySheet.mergeCells('A4:C7');
      statBox.value = `📊 إجمالي صفحات الحلقات:\n${totalPages} صفحة\n\n🎯 نسبة الإنجاز الكلية:\n${totalPct}%`;
      statBox.font = { name: 'Arial', bold: true, size: 16, color: { argb: colors.emerald } };
      statBox.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
      statBox.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.lightEmerald } };
      statBox.border = { outline: true, style: 'medium', color: { argb: colors.gold } };

      // جدول الحلقات في الملخص
      summarySheet.getRow(9).values = ['#', 'اسم الحلقة', 'المشرف', 'عدد الطلاب', 'الإنجاز', 'الحالة'];
      const sHeader = summarySheet.getRow(9);
      sHeader.height = 25;
      sHeader.eachCell(c => {
        c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
        c.alignment = { horizontal: 'center' };
      });

      allHalaqat.forEach((h, i) => {
        const hStudents = allStudents.filter(s => (s.halaqaId?._id || s.halaqaId) === h._id);
        const hPages = allTracking.filter(r => hStudents.some(s => (r.studentId?._id || r.studentId) === s._id)).reduce((s, r) => s + r.pagesMemorized, 0);
        const hReq = hStudents.length * 6; // تبسيط للتمثيل
        const hPct = hReq > 0 ? Math.round((hPages / (hStudents.reduce((s, st) => s + st.dailyTarget, 0) * 6)) * 100) : 0;

        const r = summarySheet.addRow([i + 1, h.name, h.supervisor, hStudents.length, `${hPct}%`, hPct >= 80 ? 'ممتاز' : hPct >= 50 ? 'جيد' : 'يحتاج متابعة']);
        r.alignment = { horizontal: 'center' };
      });

      // ─── 2. صفحات الحلقات التفصيلية ───
      for (const halaqa of allHalaqat) {
        const halaqaStudents = allStudents.filter(s => (s.halaqaId?._id || s.halaqaId) === halaqa._id);
        if (halaqaStudents.length === 0) continue;

        const worksheet = workbook.addWorksheet(halaqa.name.replace(/[/\\?*[\]:]/g, '').substring(0, 31) || 'Report', {
          views: [{ rightToLeft: true, showGridLines: false }]
        });

        // 1. ترويسة الصفحة (Emerald Gradient Style)
        worksheet.mergeCells('A1:L2');
        const headerCell = worksheet.getCell('A1');
        headerCell.value = 'التقرير الختامي لإنجازات التحفيظ الأسبوعية';
        headerCell.font = { name: 'Arial', bold: true, size: 22, color: { argb: 'FFFFFFFF' } };
        headerCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.emerald } };
        headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
        worksheet.getRow(1).height = 30;
        worksheet.getRow(2).height = 30;

        // 2. بطاقة المعلومات (Info Card)
        worksheet.mergeCells('A3:E5');
        const infoCard = worksheet.getCell('A3');
        infoCard.value = `📍 حلقة: ${halaqa.name}\n👤 المشرف: ${halaqa.supervisor}\n📅 الفترة: من ${startDate} إلى ${endDate}`;
        infoCard.font = { name: 'Arial', size: 12, color: { argb: colors.textDark } };
        infoCard.alignment = { wrapText: true, horizontal: 'right', vertical: 'middle' };
        infoCard.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.grayBg } };
        infoCard.border = {
          left: { style: 'thick', color: { argb: colors.emerald } },
          bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } }
        };

        // 3. ملخص الأداء (Stat Card)
        worksheet.mergeCells('I3:L5');
        const hTotal = allTracking.filter(r => halaqaStudents.some(s => (r.studentId?._id || r.studentId) === s._id)).reduce((s, r) => s + r.pagesMemorized, 0);
        const hReq = halaqaStudents.reduce((s, st) => s + (st.dailyTarget * 6), 0);
        const hPct = hReq > 0 ? Math.round((hTotal / hReq) * 100) : 0;

        const statCard = worksheet.getCell('I3');
        statCard.value = `🎯 الإنجاز الكلي: ${hTotal} صفحة\n📈 النسبة الكلية: ${hPct}%`;
        statCard.font = { name: 'Arial', bold: true, size: 14, color: { argb: colors.emerald } };
        statCard.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
        statCard.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.lightEmerald } };
        statCard.border = { outline: true, style: 'medium', color: { argb: colors.emerald } };

        worksheet.addRow([]); // Spacer

        // 4. أعمدة الجدول الرئيسي
        const columns = [
          { header: '#', key: 'idx', width: 6 },
          { header: 'اسم الطالب', key: 'name', width: 32 },
          { header: 'المستوى', key: 'level', width: 14 },
          { header: 'القسط', key: 'target', width: 10 },
          ...weekDays.map(d => ({ header: d.label, key: d.dateStr, width: 12 })),
          { header: 'المجموع الأسبوعي', key: 'total', width: 15 },
          { header: 'الإنجاز التراكمي', key: 'cumulative', width: 15 },
          { header: 'النسبة', key: 'pct', width: 12 }
        ];

        // نحدد المفاتيح والعرض فقط حتى لا يقوم ExcelJS بكتابة الهيدر في الصف الأول (فوق العنوان)
        worksheet.columns = columns.map(col => ({ key: col.key, width: col.width }));

        // 5. كتابة الهيدر صراحة في الصف السابع وتنسيقه
        const tableHeader = worksheet.getRow(7);
        tableHeader.values = columns.map(col => col.header);
        tableHeader.height = 35;
        tableHeader.eachCell((cell) => {
          cell.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = { bottom: { style: 'thick', color: { argb: colors.gold } } };
        });

        // 6. إضافة البيانات والجماليات (Heatmap)
        halaqaStudents.forEach((st, index) => {
          const rowData = { idx: index + 1, name: st.name, level: levelLabel[st.level] || st.level, target: st.dailyTarget };
          let sTotal = 0;
          weekDays.forEach(day => {
            const rec = allTracking.find(r => (r.studentId?._id === st._id || r.studentId === st._id) && toLocalDate(r.date) === day.dateStr);
            const val = rec && rec.attendance !== 'absent' ? rec.pagesMemorized : 0;
            rowData[day.dateStr] = rec?.attendance === 'absent' ? 'غ' : (rec ? rec.pagesMemorized : '');
            sTotal += val;
          });
          rowData.total = sTotal;

          // حساب الإنجاز التراكمي من التاريخ الكامل
          const sFullTotal = fullHistory
            .filter(r => (r.studentId?._id === st._id || r.studentId === st._id))
            .reduce((sum, r) => sum + r.pagesMemorized, 0);
          rowData.cumulative = sFullTotal;

          const sReq = (st.dailyTarget || 0) * 6;
          const sPct = sReq > 0 ? Math.round((sTotal / sReq) * 100) : 0;
          rowData.pct = `${sPct}%`;

          const row = worksheet.addRow(rowData);
          row.height = 30;
          row.eachCell((cell, colNumber) => {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };

            if (colNumber === 2) { // Name
              cell.font = { bold: true, size: 11 };
              cell.alignment = { horizontal: 'right', vertical: 'middle', indent: 1 };
            }

            if (colNumber >= 5 && colNumber <= 10) { // Days (Heatmap)
              const cellVal = cell.value;
              if (cellVal === 'غ') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                cell.font = { color: { argb: 'FFDC2626' }, bold: true };
              } else {
                const val = Number(cellVal);
                if (val >= st.dailyTarget) {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
                  cell.font = { color: { argb: 'FF065F46' }, bold: true };
                } else if (val > 0) {
                  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
                }
              }
            }

            if (colNumber === columns.length) { // Percentage
              const p = parseInt(cell.value);
              cell.font = { bold: true, color: { argb: p >= 80 ? 'FF065F46' : p >= 50 ? 'FFB45309' : 'FFB91C1C' } };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
            }
          });
        });
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      // طريقة يدوية قوية للتحميل لضمان الاسم والامتداد
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Weekly_Report_${startDate}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('تم تصدير التقرير بنجاح 💎', { id: toastId });
    } catch (err) {
      toast.error('حدث خطأ أثناء التصدير', { id: toastId });
    }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '2rem' }}>
        <div className="page-title">
          <div className="page-title-icon"><BarChart2 size={20} /></div>
          ملخص التحصيل الأسبوعي
        </div>

        <button className="btn btn-secondary" onClick={handleExportAll} style={{ gap: '0.6rem', padding: '0.6rem 1.2rem' }}>
          <FileSpreadsheet size={18} />
          تصدير التقرير الفاخر (Excel)
        </button>

        {students.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'flex-start' }}>
            <div className="stat-card green" style={{ padding: '0.75rem 1.25rem', minWidth: '160px' }}>
              <div><div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--green-400)' }}>{grandTotal}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>إجمالي صفحات الأسبوع</div></div>
            </div>
            <div className="stat-card blue" style={{ padding: '0.75rem 1.25rem', minWidth: '160px' }}>
              <div><div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--info)' }}>{grandReq}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>المطلوب الكلي</div></div>
            </div>
            <div className={`stat-card ${grandPct >= 80 ? 'green' : grandPct >= 50 ? 'gold' : 'red'}`} style={{ padding: '0.75rem 1.25rem', minWidth: '160px' }}>
              <div><div style={{ fontSize: '1.5rem', fontWeight: 900, color: grandPct >= 80 ? 'var(--green-400)' : grandPct >= 50 ? 'var(--gold-400)' : 'var(--danger)' }}>{grandPct}%</div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>نسبة الإنجاز الكلية</div></div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="form-row" style={{ alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">الحلقة</label>
            <select className="form-control" value={selectedHalaqa} onChange={e => setSelectedHalaqa(e.target.value)}>
              <option value="">اختر الحلقة</option>
              {halaqat.map(h => <option key={h._id} value={h._id}>{h.name} — {h.supervisor}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">الأسبوع</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="btn btn-secondary" onClick={() => shiftWeek(-1)} title="الأسبوع السابق"><ChevronRight size={18} /></button>
              <input type="date" className="form-control" min="2026-06-14" value={baseDate} onChange={e => { if (e.target.value >= '2026-06-14') setBaseDate(e.target.value); }} style={{ textAlign: 'center' }} />
              <button className="btn btn-secondary" onClick={() => shiftWeek(1)} title="الأسبوع القادم"><ChevronLeft size={18} /></button>
            </div>
          </div>
          <div style={{ paddingBottom: '0.1rem' }}><div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.65rem 1rem', fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>📅 الأسبوع {weekName} | {weekDays[0]?.shortDate} — {weekDays[5]?.shortDate}</div></div>
        </div>
      </div>

      {!selectedHalaqa ? (
        <div className="card"><div className="empty-state"><BarChart2 size={48} /><h3>اختر الحلقة أولاً</h3><p>حدد الحلقة والأسبوع لعرض ملخص التحصيل</p></div></div>
      ) : loading ? (
        <div className="loading-wrap"><div className="spinner" /><span>جاري تحميل بيانات الأسبوع...</span></div>
      ) : students.length === 0 ? (
        <div className="card"><div className="empty-state"><BarChart2 size={48} /><h3>لا يوجد طلبة في هذه الحلقة</h3></div></div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ minWidth: 160 }}>اسم الطالب</th>
                <th style={{ textAlign: 'center', width: 80 }}>المستوى</th>
                <th style={{ textAlign: 'center', width: 70 }}>القسط/يوم</th>
                {weekDays.map(day => (<th key={day.dateStr} style={{ textAlign: 'center', minWidth: 85 }}><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{day.label}</div><div>{day.shortDate}</div></th>))}
                <th style={{ textAlign: 'center', minWidth: 120, background: 'rgba(34,197,94,0.08)' }}>مجموع الأسبوع</th>
                <th style={{ textAlign: 'center', minWidth: 110, background: 'rgba(34,197,94,0.08)' }}>نسبة الإنجاز</th>
              </tr>
            </thead>
            <tbody>
              {students.map((st, idx) => {
                const total = weekTotal(st);
                const req = weekRequired(st);
                const pct = req > 0 ? Math.round((total / req) * 100) : 0;
                const pctColor = pct >= 80 ? 'var(--green-400)' : pct >= 50 ? 'var(--gold-400)' : 'var(--danger)';
                return (
                  <tr key={st._id}>
                    <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                    <td style={{ fontWeight: 700 }}>{st.name}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, background: `${levelColor[st.level] || '#94a3b8'}22`, color: levelColor[st.level] || 'var(--text-secondary)', border: `1px solid ${levelColor[st.level] || '#94a3b8'}44` }}>{levelLabel[st.level] || st.level}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: '50%', background: 'rgba(34,197,94,0.12)', color: 'var(--green-400)', fontWeight: 800, fontSize: '0.78rem' }}>{st.dailyTarget}</span>
                    </td>
                    {weekDays.map(day => {
                      const c = matrix[st._id]?.[day.dateStr];
                      const hasVal = c && (c.pages !== null || c.attendance === 'absent');
                      const num = c?.pages !== null && c?.pages !== undefined ? Number(c.pages) : null;
                      const ok = hasVal && num >= st.dailyTarget && c.attendance !== 'absent';
                      const zero = hasVal && (num === 0 || c.attendance === 'absent');
                      return (
                        <td key={day.dateStr} style={{ textAlign: 'center', padding: '0.6rem 0.5rem', position: 'relative' }}>
                          {hasVal ? (
                            <>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: 34, height: 28, borderRadius: 'var(--radius-sm)',
                                fontWeight: 700, fontSize: '0.85rem',
                                background: c.attendance === 'absent' ? 'rgba(239,68,68,0.1)' : ok ? 'rgba(34,197,94,0.12)' : zero ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                                color: c.attendance === 'absent' ? 'var(--danger)' : ok ? 'var(--green-400)' : zero ? 'var(--danger)' : 'var(--gold-400)',
                              }}>
                                {c.attendance === 'absent' ? 'غ' : num}
                              </span>
                              {c.isLate && <span style={{ position: 'absolute', top: '2px', right: '4px', fontSize: '0.65rem', color: 'var(--gold-500)', fontWeight: 'bold' }}>ت</span>}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ textAlign: 'center', background: 'rgba(34,197,94,0.04)' }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><span style={{ fontWeight: 900, fontSize: '1.05rem', color: pctColor }}>{total}</span><span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>/ {req}</span></div></td>
                    <td style={{ textAlign: 'center', background: 'rgba(34,197,94,0.04)', padding: '0.5rem 0.75rem' }}><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontWeight: 800, color: pctColor, fontSize: '0.9rem' }}>{pct}%</span><div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: pctColor }} /></div></div></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: 'rgba(34,197,94,0.08)', borderTop: '2px solid var(--border-green)' }}>
                <td colSpan={3} style={{ padding: '0.75rem 1rem', fontWeight: 800, color: 'var(--green-400)', fontSize: '0.85rem' }}>الإجمالي الكلي</td>
                <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}><span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,197,94,0.15)', color: 'var(--green-400)', borderRadius: 'var(--radius-sm)', padding: '2px 10px', fontWeight: 800, fontSize: '0.85rem' }}>{dayRequired}</span></td>
                {weekDays.map(day => {
                  const tot = dayTotal(day.dateStr);
                  const pct = dayRequired > 0 ? Math.round((tot / dayRequired) * 100) : 0;
                  const hasD = students.some(st => matrix[st._id]?.[day.dateStr] !== null && matrix[st._id]?.[day.dateStr] !== undefined);
                  const pctColor = pct >= 80 ? 'var(--green-400)' : pct >= 50 ? 'var(--gold-400)' : 'var(--danger)';
                  return (
                    <td key={day.dateStr} style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                      {hasD ? (<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}><span style={{ fontWeight: 800, fontSize: '1rem', color: pctColor }}>{tot}</span><span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '1px 6px' }}>{pct}%</span></div>) : (<span style={{ color: 'var(--text-muted)' }}>—</span>)}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'center', padding: '0.75rem 0.5rem', background: 'rgba(34,197,94,0.04)' }}><div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}><span style={{ fontWeight: 900, fontSize: '1.15rem', color: grandPct >= 80 ? 'var(--green-400)' : grandPct >= 50 ? 'var(--gold-400)' : 'var(--danger)' }}>{grandTotal}</span><span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>/ {grandReq}</span></div></td>
                <td style={{ textAlign: 'center', padding: '0.75rem 0.75rem', background: 'rgba(34,197,94,0.04)' }}><div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}><span style={{ fontWeight: 900, fontSize: '1rem', color: grandPct >= 80 ? 'var(--green-400)' : grandPct >= 50 ? 'var(--gold-400)' : 'var(--danger)' }}>{grandPct}%</span><div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${Math.min(grandPct, 100)}%`, background: grandPct >= 80 ? 'var(--green-400)' : grandPct >= 50 ? 'var(--gold-400)' : 'var(--danger)' }} /></div></div></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
