async function testKimi() {
  try {
    console.log("Sending request to local server...");
    const res = await fetch("http://localhost:3001/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Hello",
        modelId: "moonshotai/kimi-k2.6"
      })
    });
    
    if (!res.ok) {
      console.log("Server responded with status:", res.status);
      const text = await res.text();
      console.log("Error body:", text);
    } else {
      const data = await res.json();
      console.log("Response:", data);
    }
  } catch(e) {
    console.error("Fetch failed (Did server crash?):", e.message);
  }
}

testKimi();
