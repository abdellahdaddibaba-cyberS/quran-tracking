async function test() {
  const BASE = 'http://127.0.0.1:5001/api';
  
  // Step 1: Login as salah
  console.log('1. Logging in as salah...');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'salah ', password: 'salah' })
  });
  const loginData = await loginRes.json();
  console.log('Login response:', JSON.stringify(loginData));
  
  if (!loginData.success) {
    console.log('\nTrying without space...');
    const loginRes2 = await fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'salah', password: 'salah' })
    });
    const loginData2 = await loginRes2.json();
    console.log('Login response 2:', JSON.stringify(loginData2));
    return;
  }
  
  const token = loginData.data.token;
  console.log('Token obtained ✅');
  
  // Step 2: Try to update profile
  console.log('\n2. Trying to update profile...');
  const updateRes = await fetch(`${BASE}/auth/profile`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      username: 'salah',
      oldPassword: 'salah',
      password: 'salah123'
    })
  });
  const updateData = await updateRes.json();
  console.log('Update response status:', updateRes.status);
  console.log('Update response:', JSON.stringify(updateData));
}

test().catch(console.error);
