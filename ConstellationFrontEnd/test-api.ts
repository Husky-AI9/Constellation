import fs from 'fs';

async function testApi() {
  try {
    const res = await fetch("https://google-backend-655371403841.us-west1.run.app/api/hometown/hubs");
    console.log("Status:", res.status);
    console.log("Headers:");
    for (const [key, value] of res.headers.entries()) {
      console.log(`  ${key}: ${value}`);
    }
  } catch (err: any) {
    console.error("Error:", err.message);
  }
}

testApi();
