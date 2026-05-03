async function testLogin() {
  try {
    console.log('Testing login for admin...');
    const adminRes = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'password123' })
    });
    console.log('Admin login response:', await adminRes.json());
  } catch (err) {
    console.log('Admin login failed:', err.message);
  }

  try {
    console.log('Testing login for صالح...');
    const parentRes = await fetch('http://localhost:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'صالح', password: 'password123' })
    });
    console.log('Parent login response:', await parentRes.json());
  } catch (err) {
    console.log('Parent login failed:', err.message);
  }
}

testLogin();
