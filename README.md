# نظام متابعة تحصيل القرآن الكريم

تطبيق full-stack لإدارة الحلقات، التحصيل اليومي، التقارير، وإشعارات أولياء الأمور.

## التشغيل السريع

```bash
cp backend/.env.example backend/.env   # ثم عدّل قيم PostgreSQL و JWT_SECRET
npm run install-all
npm run dev                            # Backend :5000 + Frontend :3000
npm run mobile                         # تطبيق Expo (مجلد mobile)
```

## الهيكل

| مجلد | الوصف |
|------|--------|
| `backend/` | Express + Sequelize + PostgreSQL |
| `frontend/` | لوحة المشرف/المعلم (React + Vite) |
| `mobile/` | تطبيق ولي الأمر (Expo) |

## الأمان

- مسارات الإدارة (`/api/halaqat`, `/students`, `/tracking`, `/reports`, `/ai`) تتطلب JWT + دور `admin` أو `teacher`.
- مسارات `/api/mobile/*` لحسابات `parent` فقط.
- عيّن `JWT_SECRET` في الإنتاج؛ لا يُستخدم fallback إلا في التطوير.
