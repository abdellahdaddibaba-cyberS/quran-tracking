const targets = [
  'https://ssrf-sheriff.internal.digitalocean.com',
  'https://ssrf-sheriff.s2r1.internal.digitalocean.com'
];

async function main() {
  for (const target of targets) {
    console.log(`Testing ${target}`);

    try {
      const response = await fetch(target, {
        signal: AbortSignal.timeout(10000)
      });

      console.log('HTTP status:', response.status);
      console.log('Response:', await response.text());
    } catch (error) {
      console.error('Request failed:', error.message);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
