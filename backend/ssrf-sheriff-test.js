
const targets = [
  'http://ssrf-sheriff.internal.digitalocean.com/',
  'http://ssrf-sheriff.s2r1.internal.digitalocean.com/'
];

async function test() {
  for (const url of targets) {
    console.log('\nTesting:', url);

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(5000)
      });

      const body = await response.text();

      console.log('HTTP status:', response.status);
      console.log('Response:', body);
    } catch (error) {
      console.log('Request failed:', error.message);
    }
  }
}

test();
