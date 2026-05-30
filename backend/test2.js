async function test() {
  try {
    const loginRes = await fetch('http://127.0.0.1:5001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin'
      })
    });
    const loginData = await loginRes.json();
    const token = loginData.data.token;
    console.log('Login successful');

    const updateRes = await fetch('http://127.0.0.1:5001/api/auth/profile', {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        username: 'admin',
        oldPassword: 'admin',
        password: 'newpassword123'
      })
    });

    const updateData = await updateRes.json();
    console.log('Update result:', updateData);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();
