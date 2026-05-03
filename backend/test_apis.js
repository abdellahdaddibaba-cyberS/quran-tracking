async function testAPIs() {
  const baseURL = 'http://localhost:5001/api';
  try {
    console.log('Testing /tracking/all...');
    const res1 = await fetch(`${baseURL}/tracking/all?startDate=2026-05-02&endDate=2026-05-07`);
    console.log('Status /tracking/all:', res1.status);
    if (res1.status !== 200) console.log(await res1.text());

    console.log('Testing /reports/award-students...');
    const res2 = await fetch(`${baseURL}/reports/award-students`);
    console.log('Status /reports/award-students:', res2.status);
    if (res2.status !== 200) console.log(await res2.text());

    console.log('Testing /reports/recent-prizes...');
    const res3 = await fetch(`${baseURL}/reports/recent-prizes`);
    console.log('Status /reports/recent-prizes:', res3.status);
    if (res3.status !== 200) console.log(await res3.text());

    process.exit(0);
  } catch (err) {
    console.error('API Test Failed:', err.message);
    process.exit(1);
  }
}

testAPIs();
