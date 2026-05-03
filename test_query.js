const { sequelize } = require('./backend/config/db'); 

sequelize.query('SELECT dt."studentId", dt."date", dt."pagesRequired", dt."pagesMemorized", dt."isSurahCompleted", s."name" as "studentName", h."name" as "halaqaName" FROM "daily_trackings" dt JOIN "students" s ON dt."studentId" = s."_id" JOIN "halaqat" h ON s."halaqaId" = h."_id" WHERE dt."attendance" = \'present\' ORDER BY dt."studentId", dt."date" DESC', { type: sequelize.QueryTypes.SELECT })
  .then(r => console.log(JSON.stringify(r.filter(x => x.studentName && x.studentName.includes('زكرياء')), null, 2)))
  .catch(console.error)
  .finally(() => process.exit(0));
