import sys

server_file = 'c:/Users/ASHIT TIWARY/OneDrive/Desktop/LABH_LITE(WD PROJECT)/api/index.js'
with open(server_file, 'r', encoding='utf-8') as f:
    content = f.read()

start_marker = 'async function fetchStockNews() {'
end_marker = '}\n\napp.get("/api/news"'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

new_func = r'''async function fetchStockNews() {
  try {
    const fetchOpts = { headers: { "User-Agent": "Mozilla/5.0" } };
    const [resIn, resGlobal] = await Promise.all([
      fetch("https://news.google.com/rss/search?q=NSE+BSE+stock+market+India+shares&hl=en-IN&gl=IN&ceid=IN:en", fetchOpts),
      fetch("https://news.google.com/rss/search?q=global+stock+market+finance+wall+street&hl=en-US&gl=US&ceid=US:en", fetchOpts)
    ]);
    
    const [xmlIn, xmlGlobal] = await Promise.all([
      resIn.ok ? resIn.text() : "",
      resGlobal.ok ? resGlobal.text() : ""
    ]);

    const parseXML = (xml) => {
      const parsed = [];
      const itemRegex = /<item>([\s\S]*?)<\/item>/g;
      let match;
      while ((match = itemRegex.exec(xml)) !== null && parsed.length < 8) {
        const block = match[1];
        const title = (block.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "";
        const link = (block.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || "";
        const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || "";
        parsed.push({
          title: title.replace(/<!\[CDATA\[|\]\]>/g, ""),
          link,
          source,
        });
      }
      return parsed;
    };

    const itemsIn = parseXML(xmlIn);
    const itemsGlobal = parseXML(xmlGlobal);
    
    const items = [];
    const maxLength = Math.max(itemsIn.length, itemsGlobal.length);
    for (let i = 0; i < maxLength; i++) {
      if (itemsIn[i]) items.push(itemsIn[i]);
      if (itemsGlobal[i]) items.push(itemsGlobal[i]);
      if (items.length >= 10) break;
    }

    newsCache = items;
    newsCacheTime = Date.now();
  } catch (e) {
    console.error("News fetch error");
  }
}
'''

if start_idx != -1 and end_idx != -1:
    new_content = content[:start_idx] + new_func + content[end_idx:]
    with open(server_file, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("api/index.js updated")
