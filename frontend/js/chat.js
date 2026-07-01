import { apiCall, getAuthUser } from "./api.js";

export function setupChat() {
  const input = document.getElementById("chatInput");
  const sendBtn = document.getElementById("chatSend");
  const msgContainer = document.getElementById("chatMessages");
  const attachBtn = document.getElementById("chatAttachBtn");
  const fileInput = document.getElementById("chatFileInput");
  const previewContainer = document.getElementById("chatAttachmentPreview");

  if (!input || !sendBtn || !msgContainer) return;

  let attachedFiles = [];

  // File selection logic
  attachBtn?.addEventListener("click", () => fileInput.click());

  fileInput?.addEventListener("change", async (e) => {
    const files = Array.from(e.target.files);
    processFiles(files);
    fileInput.value = ""; // Reset for same file selection
  });

  const processFiles = (files) => {
    for (const file of files) {
      const ext = file.name.split('.').pop().toLowerCase();
      const isImage = file.type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
      
      if (isImage) {
        const reader = new FileReader();
        reader.onload = (event) => {
          attachedFiles.push({
            name: file.name,
            type: file.type || "image/png", // Force image type if OS failed to provide it
            data: event.target.result,
            id: Date.now() + Math.random(),
          });
          renderPreviews();
          sendBtn.classList.add("active");
        };
        reader.readAsDataURL(file);
      } else if (ext === "xlsx" || ext === "xls" || ext === "csv") {
        // Use XLSX parser for Excel files
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const data = new Uint8Array(event.target.result);
            // If window.XLSX is missing, it will throw safely and we skip
            const workbook = window.XLSX.read(data, { type: "array" });
            let allText = "";
            workbook.SheetNames.forEach(sheetName => {
                allText += `\n--- Sheet: ${sheetName} ---\n`;
                allText += window.XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
            });
            attachedFiles.push({
              name: file.name,
              type: "text/csv", // Represent as text to backend
              data: allText.slice(0, 10000), // Max 10k chars
              id: Date.now() + Math.random(),
            });
            renderPreviews();
            sendBtn.classList.add("active");
          } catch (e) {
            console.error("Excel parse error", e);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === "docx") {
        // Use Mammoth parser for Word files
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            window.mammoth.extractRawText({ arrayBuffer: event.target.result })
              .then((result) => {
                attachedFiles.push({
                  name: file.name,
                  type: "text/plain",
                  data: result.value.slice(0, 10000), // Max 10k chars
                  id: Date.now() + Math.random(),
                });
                renderPreviews();
                sendBtn.classList.add("active");
              })
              .catch(console.error);
          } catch (e) {
             console.error("Word parse error", e);
          }
        };
        reader.readAsArrayBuffer(file);
      } else if (ext === "pdf") {
        // Use PDF.js parser for PDF files
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const typedarray = new Uint8Array(event.target.result);
            // If window.pdfjsLib is missing, it throws safely
            const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              fullText += textContent.items.map(item => item.str).join(" ") + "\n";
            }
            attachedFiles.push({
              name: file.name,
              type: "text/plain",
              data: fullText.slice(0, 15000), // Max 15k chars for PDF
              id: Date.now() + Math.random(),
            });
            renderPreviews();
            sendBtn.classList.add("active");
          } catch (e) {
             console.error("PDF parse error", e);
          }
        };
        reader.readAsArrayBuffer(file);
      } else {
        // Standard text reading fallback
        const reader = new FileReader();
        reader.onload = (event) => {
          attachedFiles.push({
            name: file.name,
            type: file.type || "text/plain",
            data: event.target.result,
            id: Date.now() + Math.random(),
          });
          renderPreviews();
          sendBtn.classList.add("active");
          sendBtn.classList.add("active");
        };
        reader.readAsText(file.slice(0, 10000));
      }
    }
  };

  input?.addEventListener("paste", (e) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      // Allow pasting text normally, but if there are files (like an image), process them
      processFiles(Array.from(e.clipboardData.files));
    }
  });

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  msgContainer?.addEventListener("dragover", handleDragOver);
  msgContainer?.addEventListener("drop", handleDrop);
  input?.addEventListener("dragover", handleDragOver);
  input?.addEventListener("drop", handleDrop);

  function renderPreviews() {
    if (!previewContainer) return;
    if (attachedFiles.length === 0) {
      previewContainer.classList.add("hidden");
      return;
    }
    previewContainer.classList.remove("hidden");
    previewContainer.innerHTML = attachedFiles
      .map(
        (f) => `
            <div class="preview-item">
                ${(f.type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(f.name.split('.').pop().toLowerCase())) ? `<img src="${f.data}">` : `<span class="material-symbols-outlined file-icon">description</span>`}
                <div class="remove-btn" onclick="window.removeAttachment(${f.id})">×</div>
            </div>
        `,
      )
      .join("");
  }

  window.removeAttachment = (id) => {
    attachedFiles = attachedFiles.filter((f) => f.id !== id);
    renderPreviews();
    if (attachedFiles.length === 0 && input.value.trim() === "")
      sendBtn.classList.remove("active");
  };

  // Auto-resize textarea
  input.addEventListener("input", () => {
    input.style.height = "46px"; // Reset to base height (adjust based on padding)
    const newHeight = Math.min(input.scrollHeight, 400);
    input.style.height = newHeight + "px";
    
    if (input.value.trim().length > 0 || attachedFiles.length > 0)
      sendBtn.classList.add("active");
    else sendBtn.classList.remove("active");
  });

  window.currentAiModel = "auto";
  window.selectModel = (modelId, modelName, location) => {
      window.currentAiModel = modelId;
      const nameEl = document.getElementById(`currentModelName${location}`);
      if (nameEl) nameEl.textContent = modelName;
      const menuEl = document.getElementById(`modelMenu${location}`);
      if (menuEl) menuEl.classList.add("hidden");
  };

  // Also close the dropdown if clicking outside
  document.addEventListener("click", (e) => {
      if (!e.target.closest('.custom-model-dropdown')) {
          const m1 = document.getElementById('modelMenuMain');
          const m2 = document.getElementById('modelMenuGlobe');
          if (m1) m1.classList.add('hidden');
          if (m2) m2.classList.add('hidden');
      }
  });

  let currentAbortController = null;

  const sendMessage = async () => {
    const text = input.value.trim();
    const hasNewContent = text || attachedFiles.length > 0;

    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
        sendBtn.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
        sendBtn.classList.remove("generating");
        const thinkEl = document.querySelector(".msg-ai-wrap .gemini-loader")?.parentElement;
        if (thinkEl) thinkEl.remove();
        
        // If the user just clicked the Stop button (no new content), stop here.
        if (!hasNewContent) {
            return;
        }
        // If there IS new content (they clicked a ticker or typed a new prompt), 
        // we aborted the old one and now we'll continue on to send the new one!
    }

    if (!hasNewContent) return;

    const currentAttachments = [...attachedFiles];

    // Reset UI
    input.value = "";
    input.style.height = "46px";
    attachedFiles = [];
    renderPreviews();
    sendBtn.classList.remove("active");
    sendBtn.classList.add("generating");
    sendBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 20px;">stop</span>';

    currentAbortController = new AbortController();

    // User Message HTML (showing attachments)
    let attachmentsHTML = currentAttachments
      .map((f) => {
        if (f.type.startsWith("image/"))
          return `<img src="${f.data}" style="max-width: 200px; border-radius: 8px; margin-top: 8px; display: block;">`;
        return `<div style="margin-top:8px; display:flex; align-items:center; gap:8px; background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; font-size:12px;"><span class="material-symbols-outlined" style="font-size:16px;">description</span> ${f.name}</div>`;
      })
      .join("");

    msgContainer.insertAdjacentHTML('beforeend', `
            <div class="msg-user-wrap fade-in">
                <div class="msg-content-user">
                    ${text ? `<div>${text}</div>` : ""}
                    ${attachmentsHTML}
                </div>
            </div>
        `);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    // --- PROFESSIONAL THINKING LOADER ---
    const thinkingId = "sathi-think-" + Date.now();
    const phases = [
      "Thinking",
      "Analyzing market data",
      "Cross-referencing portfolio",
      "Generating insight"
    ];
      msgContainer.insertAdjacentHTML('beforeend', `
      <div class="msg-ai-wrap fade-in" id="${thinkingId}">
        <div class="gemini-loader">
          <div class="gemini-loader-icon">
            <span class="material-symbols-outlined sparkle-1">auto_awesome</span>
          </div>
          <span class="think-phase-label">Thinking</span>
        </div>
      </div>`);
    msgContainer.scrollTop = msgContainer.scrollHeight;

    let phaseIdx = 0;
    const phaseInterval = setInterval(() => {
      phaseIdx = (phaseIdx + 1) % phases.length;
      const el = document.querySelector(`#${thinkingId} .think-phase-label`);
      if (el) el.textContent = phases[phaseIdx];
    }, 1800);
    // -----------------------------------

    try {
      // Get selected model
      let selectedModel = window.currentAiModel || "llama-3.1-8b-instant";

      const currentUser = getAuthUser();
      const data = await apiCall("/ai/chat", {
        method: "POST",
        signal: currentAbortController.signal,
        body: JSON.stringify({
          prompt: text,
          userId: currentUser?.id || null,
          modelId: selectedModel,
          attachments: currentAttachments.map((f) => ({
            name: f.name,
            type: f.type,
            data: f.data,
          })),
        }),
      });

      // Remove thinking loader
      clearInterval(phaseInterval);
      const thinkEl = document.getElementById(thinkingId);
      if (thinkEl) thinkEl.remove();

      // --- BUILD EXTRA HTML BASED ON RESPONSE TYPE ---
      let extraHtml = "";

      // Trade buttons
      const marketData = window.marketData || [];
      if (
        data.tradeSymbol &&
        (marketData.length === 0 || marketData.some((m) => m.sym === data.tradeSymbol))
      ) {
        if (typeof window.openTradeModal === "function") {
            extraHtml += `
                    <div style="margin-top: 12px; display: flex; gap: 8px;">
                        <button style="flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: var(--text); font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(34,197,94,0.18)'; this.style.borderColor='var(--green)'; this.style.color='var(--green)';" onmouseout="this.style.background='rgba(255,255,255,0.06)'; this.style.borderColor='rgba(255,255,255,0.15)'; this.style.color='var(--text)';" onclick="window.openTradeModal('${data.tradeSymbol}', 'BUY')">Buy ${data.tradeSymbol}</button>
                        <button style="flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06); color: var(--text); font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.18)'; this.style.borderColor='var(--red)'; this.style.color='var(--red)';" onmouseout="this.style.background='rgba(255,255,255,0.06)'; this.style.borderColor='rgba(255,255,255,0.15)'; this.style.color='var(--text)';" onclick="window.openTradeModal('${data.tradeSymbol}', 'SELL')">Sell ${data.tradeSymbol}</button>
                    </div>`;
        }
      }

      // Chart.js rendering placeholder
      let chartId = null;
      if (data.chartConfig) {
        chartId = "sathi-chart-" + Date.now();
        extraHtml += `
          <div class="chat-chart-container">
            <div class="chat-chart-label">
              <span class="material-symbols-outlined" style="font-size: 14px;">show_chart</span>
              Chart — Powered by Labh Sathi
            </div>
            <canvas id="${chartId}" height="200"></canvas>
          </div>`;
      }
      
      // Lightweight Charts rendering placeholder (Trading Chart)
      let aiChartId = null;
      let aiChartWrapperId = null;
      if (data.aiChart) {
        aiChartId = "ai-trading-chart-" + Date.now();
        aiChartWrapperId = aiChartId + "-wrapper";
        extraHtml += `
          <div id="${aiChartWrapperId}" class="chat-chart-container" style="padding-bottom: 8px; width: 100%;">
            <div class="chat-chart-label">
              <span class="material-symbols-outlined" style="font-size: 14px;">candlestick_chart</span>
              Interactive Trading Chart: ${data.aiChart.symbol}
            </div>
            <button class="chat-chart-fullscreen-btn" title="Toggle fullscreen" onclick="(function(btn){
              const wrapper = document.getElementById('${aiChartWrapperId}');
              const chartDiv = document.getElementById('${aiChartId}');
              if (!wrapper || !chartDiv) return;
              const isFS = wrapper.classList.toggle('chart-fullscreen');
              btn.innerHTML = '<span class=\\'material-symbols-outlined\\' style=\\'font-size:18px\\'>' + (isFS ? 'close_fullscreen' : 'open_in_full') + '</span>';
              if (isFS) {
                chartDiv.style.height = 'calc(100vh - 80px)';
                chartDiv.style.flex = '1';
              } else {
                chartDiv.style.height = '250px';
                chartDiv.style.flex = '';
              }
              window.dispatchEvent(new Event('resize'));
            })(this)">
              <span class="material-symbols-outlined" style="font-size: 18px;">open_in_full</span>
            </button>
            <div id="${aiChartId}" style="height: 250px; position: relative; width: 100%;"></div>
          </div>`;
      }

      // Heatmap rendering
      if (data.heatmapData && data.heatmapData.length > 0) {
        extraHtml += `
          <div class="chat-heatmap-container" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 8px; margin-top: 12px;">
            ${data.heatmapData.map(item => {
              const val = Number(item.change || 0);
              let color = 'rgba(255,255,255,0.1)';
              if (val > 2) color = 'rgba(34,197,94,0.4)';
              else if (val > 0) color = 'rgba(34,197,94,0.15)';
              else if (val < -2) color = 'rgba(239,68,68,0.4)';
              else if (val < 0) color = 'rgba(239,68,68,0.15)';
              
              return `
                <div class="chat-mover-btn" onclick="document.getElementById('aiWidgetPanel').classList.add('hidden'); window.switchTab('home'); setTimeout(() => window.openStockDetail('${item.symbol}'), 100)" style="cursor: pointer; background: ${color}; border-radius: 6px; padding: 8px; text-align: center; border: 1px solid rgba(255,255,255,0.05); transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.3)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.filter='none'; this.style.transform='none';">
                  <div style="font-size: 12px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px;">${item.symbol}</div>
                  <div style="font-size: 13px; font-weight: 700; color: ${val >= 0 ? 'var(--green)' : 'var(--red)'};">${val >= 0 ? '+' : ''}${val.toFixed(2)}%</div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      // Dumbbell rendering
      if (data.dumbbellData && data.dumbbellData.length > 0) {
        extraHtml += `
          <div class="chat-dumbbell-container" style="margin-top: 16px; display: flex; flex-direction: column; gap: 12px;">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Before/After Comparison</div>
            ${data.dumbbellData.map(item => {
              const isGain = item.end >= item.start;
              const color = isGain ? 'var(--green)' : 'var(--red)';
              
              return `
                <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 6px;">
                  <div style="display: flex; justify-content: space-between; font-size: 12px; font-weight: 700;">
                    <span style="color: ${color};">${item.symbol}</span>
                    <span style="color: var(--text); font-weight: 500;">₹${Number(item.start).toFixed(2)} &rarr; ₹${Number(item.end).toFixed(2)}</span>
                  </div>
                  <div style="height: 10px; background: rgba(255,255,255,0.03); border-radius: 5px; position: relative;">
                    <div style="position: absolute; left: 0; right: 0; top: 4px; height: 2px; background: ${color}; opacity: 0.4; border-radius: 1px;"></div>
                    <div style="position: absolute; ${isGain ? 'right: 0;' : 'left: 0;'} top: 0px; width: 10px; height: 10px; border-radius: 50%; background: ${color}; box-shadow: 0 0 8px ${color};"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `;
      }

      // Pie Chart rendering
      if (data.pieChartData && Array.isArray(data.pieChartData) && data.pieChartData.length > 0) {
        const pieData = [...data.pieChartData].sort((a,b) => b.value - a.value);
        const total = pieData.reduce((sum, item) => sum + Number(item.value), 0);
        let currentAngle = 0;
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b'];
        
        let gradientStops = [];
        let legendHtml = '';
        
        pieData.forEach((item, i) => {
          const percentage = total > 0 ? (Number(item.value) / total) * 100 : 0;
          const start = currentAngle;
          const end = currentAngle + percentage;
          const color = colors[i % colors.length];
          gradientStops.push(`${color} ${start}% ${end}%`);
          currentAngle = end;
          
          legendHtml += `
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <div style="width: 10px; height: 10px; border-radius: 2px; background: ${color};"></div>
                <span style="color: var(--text);">${item.label}</span>
              </div>
              <strong style="color: var(--text-muted);">${percentage.toFixed(1)}%</strong>
            </div>
          `;
        });
        
        const gradient = `conic-gradient(${gradientStops.join(', ')})`;
        
        extraHtml += `
          <div class="chat-pie-container" style="margin-top: 16px; background: rgba(255,255,255,0.02); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
            <div style="font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 16px;">Sector Breakdown</div>
            <div style="display: flex; align-items: center; gap: 24px;">
              <div style="width: 90px; height: 90px; border-radius: 50%; background: ${gradient};"></div>
              <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
                ${legendHtml}
              </div>
            </div>
          </div>
        `;
      }
      // Scenario Impact Card
      if (data.scenarioImpact) {
        const si = data.scenarioImpact;
        const isPositive = (si.totalPnlPct || 0) >= 0;
        const sectorsHtml = (si.sectors || []).map(s => {
          const cls = s.impactPct < 0 ? "negative" : "positive";
          const sign = s.impactPct >= 0 ? "+" : "";
          return `<div class="scenario-sector-item"><span class="sector-name">${s.name}</span><span class="sector-impact ${cls}">${sign}${s.impactPct}%</span></div>`;
        }).join("");

        const totalSign = (si.totalPnlPct || 0) >= 0 ? "+" : "";
        const totalColor = (si.totalPnlPct || 0) < 0 ? "var(--red)" : "var(--green)";

        // Do not add link if we are already on the globe page
        const isGlobePage = window.location.href.includes('globe-gl');

        extraHtml += `
          <div class="scenario-card ${isPositive ? 'positive' : ''}">
            <div class="scenario-header">
              <span class="material-symbols-outlined" style="font-size: 16px;">crisis_alert</span>
              Portfolio Impact Simulation
            </div>
            <div class="scenario-sectors">${sectorsHtml}</div>
            <div class="scenario-total">
              <span style="color: var(--muted);">Projected Net Impact</span>
              <span style="color: ${totalColor}; font-family: var(--font-mono);">${totalSign}${si.totalPnlPct || 0}%</span>
            </div>
            ${!isGlobePage && si.affectedCountries && si.affectedCountries.length > 0 ? `<a href="globe-gl/index.html" class="scenario-globe-link"><span class="material-symbols-outlined" style="font-size: 14px;">public</span> View on Threat Globe →</a>` : ''}
          </div>`;
      }

      // Screener Results Card
      if (data.screenerResults && Array.isArray(data.screenerResults) && data.screenerResults.length > 0) {
        // Ultimate fallback: if marketData is missing for any reason, fetch it right now!
        if (typeof window === 'undefined' || !window.marketData || window.marketData.length === 0) {
            try {
                const fRes = await fetch("/api/markets");
                if (fRes.ok) {
                    window.marketData = await fRes.json();
                }
            } catch(e) {
                console.error("Fallback markets fetch failed in chat:", e);
            }
        }
        const chipsHtml = data.screenerResults.map(ticker => {
          let price = "--";
          let change = "";
          let changeColor = "var(--text)";
          let name = "";
          // Fix scoping issue: marketData is global in app.js but might not be on window
          const mData = typeof window.marketData !== 'undefined' ? window.marketData : (typeof marketData !== 'undefined' ? marketData : []);
          
          if (mData && mData.length > 0) {
             const cleanTicker = String(ticker).trim().toUpperCase();
             const stock = mData.find(s => String(s.sym).trim().toUpperCase() === cleanTicker);
             if (stock) {
                 price = (typeof window.formatPrice === 'function') ? window.formatPrice(stock.price || stock.previousClose || 0) : "₹" + Number(stock.price || stock.previousClose || 0).toFixed(2);
                 const sign = (stock.change >= 0) ? "+" : "";
                 change = sign + (stock.change || 0).toFixed(2) + "%";
                 changeColor = stock.change >= 0 ? "var(--text)" : "var(--text)";
                 name = stock.name || "";
             }
          }
          
          return `
          <button class="screener-chip" style="background: #16181c; border: 1px solid #2d3139; color: #fff; padding: 12px 14px; border-radius: 12px; cursor: pointer; text-align: left; font-family: var(--font-mono); margin: 4px; transition: 0.2s; min-width: 150px; display: flex; flex-direction: column; gap: 4px;" onmouseover="this.style.background='#1f2228'; this.style.borderColor='#888';" onmouseout="this.style.background='#16181c'; this.style.borderColor='#2d3139';" onclick="document.getElementById('aiWidgetPanel').classList.add('hidden'); window.switchTab('home'); setTimeout(() => window.openStockDetail('${ticker}'), 100)">
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                <strong style="font-size: 14px; color: var(--text);"><span class="material-symbols-outlined" style="font-size: 14px; vertical-align: bottom; margin-right: 2px;">troubleshoot</span> ${ticker}</strong>
                <span style="font-size: 12px; color: ${changeColor}; font-weight: 600;">${change}</span>
            </div>
            <div style="font-size: 11px; color: #8b949e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">${name}</div>
            <div style="font-size: 15px; font-weight: bold; margin-top: 4px; color: #fff;">${price}</div>
          </button>
          `;
        }).join("");
        
        extraHtml += `
          <div class="screener-results-card" style="margin-top: 12px; padding: 12px; background: #09090b; border: 1px solid #2d3139; border-radius: 12px;">
            <div style="font-size: 12px; font-weight: 600; color: var(--text); margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
              <span class="material-symbols-outlined" style="font-size: 16px;">filter_alt</span> Market Screener Matches
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 4px;">
              ${chipsHtml}
            </div>
          </div>
        `;
      }

      // Trade Journal Card
      if (data.journal && data.isJournal) {
        const j = data.journal;
        const gradeLetter = (j.grade || "C").charAt(0).toUpperCase();
        const gradeClass = gradeLetter === "A" ? "grade-a" : gradeLetter === "B" ? "grade-b" : gradeLetter === "D" ? "grade-d" : "grade-c";

        const entriesHtml = (j.entries || []).map(e => `
          <div class="journal-entry">
            <div class="journal-entry-side ${(e.type || 'BUY').toLowerCase()}">${e.type || 'TRADE'}</div>
            <div class="journal-entry-body">
              <div class="journal-entry-ticker">${e.ticker || '—'}</div>
              <div class="journal-entry-analysis">${e.analysis || ''}</div>
            </div>
          </div>`).join("");

        extraHtml += `
          <div class="journal-card">
            <div class="journal-header">
              <span class="journal-title"><span class="material-symbols-outlined" style="font-size:16px; vertical-align:middle; margin-right:4px;">book</span> AI Trade Journal</span>
              <span class="journal-grade ${gradeClass}">${gradeLetter}</span>
            </div>
            <div class="journal-summary">${j.summary || ''}</div>
            ${entriesHtml}
            ${j.suggestions ? `<div class="journal-suggestions"><strong><span class="material-symbols-outlined" style="font-size:14px; vertical-align:middle; margin-right:4px;">lightbulb</span> Suggestion:</strong> ${j.suggestions}</div>` : ''}
          </div>`;
      }

      msgContainer.insertAdjacentHTML('beforeend', `
                <div class="msg-ai-wrap fade-in">
                    <div class="ai-avatar-sparkle">
                        <img src="img/logo.png" alt="Labh Sathi" style="width: 18px; height: 18px; filter: grayscale(1) invert(1) brightness(1.5) opacity(0.9); object-fit: contain;" onerror="this.outerHTML='<span class=\\'material-symbols-outlined\\'>robot_2</span>'">
                    </div>
                    <div class="msg-content-ai">
                        <div class="ai-markdown-reply">
                            ${(() => {
                                let replyTxt = typeof data.reply === 'string' ? data.reply : String(data.reply);
                                // Check if marked is available
                                if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                                    return marked.parse(replyTxt);
                                }
                                return replyTxt;
                            })()}
                        </div>
                        ${extraHtml}
                    </div>
                </div>
            `);

      // Render Chart.js AFTER DOM insertion
      if (data.chartConfig && chartId) {
        setTimeout(() => {
          const canvas = document.getElementById(chartId);
          if (canvas && typeof Chart !== "undefined") {
            try {
              new Chart(canvas, data.chartConfig);
            } catch(e) {
              console.warn("[Sathi Chart] Failed to render:", e);
            }
          }
        }, 100);
      }

      // Render Lightweight Trading Chart AFTER DOM insertion
      if (data.aiChart && aiChartId) {
        setTimeout(async () => {
          const container = document.getElementById(aiChartId);
          if (!container || typeof LightweightCharts === "undefined") {
            console.error("[aiChart] Container or LightweightCharts not found", { container: !!container, lw: typeof LightweightCharts });
            return;
          }

          try {
            // Resolve CSS variables to actual hex/rgb — canvas can't use var()
            const rootStyle = getComputedStyle(document.documentElement);
            const greenColor = rootStyle.getPropertyValue('--green').trim() || '#22c55e';
            const redColor = rootStyle.getPropertyValue('--red').trim() || '#ef4444';

            // Setup chart
            const isDark = document.body.dataset.theme === "dark";
            const chart = LightweightCharts.createChart(container, {
              height: 250,
              layout: {
                background: { type: "solid", color: "transparent" },
                textColor: isDark ? "#D9D9D9" : "#191919",
              },
              grid: {
                vertLines: { color: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
                horzLines: { color: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
              },
              crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
              timeScale: { timeVisible: false },
            });
            
            // Fix collapsed graph by dynamically observing width changes
            new ResizeObserver(entries => {
                if (entries.length === 0 || entries[0].target !== container) { return; }
                const newRect = entries[0].contentRect;
                // Only update width, height is fixed at 250px via style
                chart.applyOptions({ width: newRect.width });
            }).observe(container);

            // Fetch Real Data (Single Source of Truth)
            const sym = data.aiChart.symbol;
            const tf = data.aiChart.timeframe || "3mo";
            
            // ALWAYS fetch 1y of data so long-term indicators (like SMA 50) have enough lookback data
            // to draw from the very beginning of the requested visible timeframe.
            const response = await apiCall(`/chart/${sym}?range=1y&interval=1d`);
            const candles = response.candles || [];
            if (candles.length === 0) {
              console.warn("[aiChart] No candle data returned for", sym);
              container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;">No chart data available for ${sym}</div>`;
              return;
            }

            // Draw Price Series — use resolved hex colors, NOT CSS vars
            const mainSeries = chart.addCandlestickSeries({
              upColor: greenColor, downColor: redColor,
              borderVisible: false, wickUpColor: greenColor, wickDownColor: redColor
            });
            mainSeries.setData(candles.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));

            // Draw Indicators (Simple SMA Calculator)
            if (data.aiChart.indicators && data.aiChart.indicators.length > 0) {
              data.aiChart.indicators.forEach(ind => {
                if (ind.type === "sma" && ind.period && candles.length >= ind.period) {
                  const smaData = [];
                  for (let i = ind.period - 1; i < candles.length; i++) {
                    let sum = 0;
                    for (let j = 0; j < ind.period; j++) {
                      sum += candles[i - j].close;
                    }
                    smaData.push({ time: candles[i].time, value: sum / ind.period });
                  }
                  const smaSeries = chart.addLineSeries({ color: ind.color || "#3b82f6", lineWidth: 2, title: `SMA ${ind.period}` });
                  smaSeries.setData(smaData);
                }
              });
            }

            // Draw Volume
            const volumeSeries = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "" });
            volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
            volumeSeries.setData(candles.map(c => ({
              time: c.time, value: c.volume || 0,
              color: c.close >= c.open ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)",
            })));

            // Draw AI Annotations
            if (data.aiChart.annotations && data.aiChart.annotations.length > 0) {
              const markersMap = new Map();

              data.aiChart.annotations.forEach(ann => {
                if (!ann.date) return;
                const targetTimeMs = new Date(ann.date).getTime();
                if (isNaN(targetTimeMs)) return;

                const closestCandle = candles.reduce((prev, curr) => {
                  const currMs = typeof curr.time === 'string' ? new Date(curr.time).getTime() : curr.time * 1000;
                  const prevMs = typeof prev.time === 'string' ? new Date(prev.time).getTime() : prev.time * 1000;
                  return Math.abs(currMs - targetTimeMs) < Math.abs(prevMs - targetTimeMs) ? curr : prev;
                });

                const isBullish = ann.type === "bullish";
                markersMap.set(closestCandle.time, {
                  time: closestCandle.time,
                  position: isBullish ? "belowBar" : "aboveBar",
                  color: isBullish ? greenColor : redColor,
                  shape: isBullish ? "arrowUp" : "arrowDown",
                  text: ann.text || ann.title || "Note"
                });
              });

              const markers = Array.from(markersMap.values()).sort((a, b) => {
                const aT = typeof a.time === 'string' ? new Date(a.time).getTime() : a.time;
                const bT = typeof b.time === 'string' ? new Date(b.time).getTime() : b.time;
                return aT - bT;
              });

              if (markers.length > 0) {
                mainSeries.setMarkers(markers);
              }
            }

            // Determine the visible timeframe window to hide the extra lookback data used for SMA
            let displayDays = 90; // default 3mo
            if (tf === '1mo') displayDays = 21; // ~21 trading days
            if (tf === '3mo') displayDays = 63; // ~63 trading days
            if (tf === '6mo') displayDays = 126; // ~126 trading days
            if (tf === '1y') displayDays = 252; // ~252 trading days
            
            const toTime = candles[candles.length - 1].time;
            const fromIndex = Math.max(0, candles.length - displayDays);
            const fromTime = candles[fromIndex].time;
            
            chart.timeScale().setVisibleRange({ from: fromTime, to: toTime });

            // Resize observer for responsive behavior (width AND height for fullscreen)
            const ro = new ResizeObserver(() => {
              chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
              // Re-enforce the visible range on resize if needed, but usually LW handles it.
            });
            ro.observe(container);

            // Escape key exits fullscreen
            const escHandler = (e) => {
              if (e.key === 'Escape') {
                const wrapper = container.closest('.chart-fullscreen');
                if (wrapper) {
                  wrapper.classList.remove('chart-fullscreen');
                  container.style.height = '250px';
                  container.style.flex = '';
                  const btn = wrapper.querySelector('.chat-chart-fullscreen-btn');
                  if (btn) btn.innerHTML = '<span class="material-symbols-outlined" style="font-size:18px">open_in_full</span>';
                  window.dispatchEvent(new Event('resize'));
                }
              }
            };
            document.addEventListener('keydown', escHandler);

          } catch (err) {
            console.error("[aiChart] Failed to render trading chart:", err);
            container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;">Chart failed to load</div>`;
          }
        }, 200);
      }


    } catch (e) {
      clearInterval(phaseInterval);
      const thinkEl = document.getElementById(thinkingId);
      if (thinkEl) thinkEl.remove();

      if (e.name === 'AbortError') {
          console.log('Generation stopped by user');
      } else {
          msgContainer.insertAdjacentHTML('beforeend', `
              <div class="msg-ai-wrap fade-in">
                  <div class="ai-avatar-sparkle" style="border-color:var(--red);">
                      <img src="img/logo.png" alt="Labh Sathi" style="width: 18px; height: 18px; filter: sepia(1) hue-rotate(-50deg) saturate(5) brightness(1.2); object-fit: contain;">
                  </div>
                  <div class="msg-content-ai" style="color: var(--red);">
                      <strong>Error:</strong> ${e.message || "Something went wrong."}
                  </div>
              </div>
          `);
      }
    } finally {
        currentAbortController = null;
        sendBtn.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
        sendBtn.classList.remove("generating");
        msgContainer.scrollTop = msgContainer.scrollHeight;
    }
  };

  sendBtn.addEventListener("click", sendMessage);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Listen for custom API error events
  window.addEventListener("chatError", (e) => {
    appendMessage(
      "system",
      `Error: ${e.detail.error || "Unable to connect to the analysis engine."}`,
    );
  });

  // --- Custom Left-Edge Resizer ---
  const panel = document.getElementById("aiWidgetPanel");
  if (panel) {
    let resizer = document.createElement("div");
    resizer.className = "panel-left-resizer";
    resizer.style.cssText = "position:absolute; top:0; left:-5px; width:10px; height:100%; cursor:ew-resize; z-index:100;";
    panel.appendChild(resizer);

    let isResizing = false;
    let startX, startWidth;

    resizer.addEventListener("mousedown", (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(document.defaultView.getComputedStyle(panel).width, 10);
      document.body.style.cursor = "ew-resize";
      e.preventDefault();
    });

    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const newWidth = startWidth - (e.clientX - startX);
      if (newWidth >= 320 && newWidth <= window.innerWidth * 0.9) {
        panel.style.width = newWidth + "px";
      }
    });

    document.addEventListener("mouseup", () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = "default";
      }
    });
  }
}

// Global helper for quick asking
window.askSathi = (prompt) => {
    const panel = document.getElementById('aiWidgetPanel');
    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');
    
    if (panel && input && sendBtn) {
        panel.classList.remove('hidden');
        input.value = prompt;
        input.dispatchEvent(new Event('input'));
        setTimeout(() => sendBtn.click(), 100);
    }
};

// Make tickers in AI tables clickable
document.addEventListener('DOMContentLoaded', () => {
    // Add CSS to make them look clickable
    const style = document.createElement('style');
    style.innerHTML = `
        .ai-markdown-reply table td strong {
            cursor: pointer;
            color: #3b82f6;
            transition: color 0.2s;
            position: relative;
        }
        .ai-markdown-reply table td strong:hover {
            color: #60a5fa;
            text-decoration: underline;
        }
        .ai-markdown-reply table td strong:hover::after {
            content: "Click to analyze & show chart";
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: var(--card-bg, #1e1e1e);
            color: var(--text, #e2e8f0);
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            white-space: nowrap;
            pointer-events: none;
            border: 1px solid var(--border, #333);
            z-index: 100;
            margin-bottom: 6px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
    `;
    document.head.appendChild(style);
});

// Single effective prompt for clicking tickers
const handleTickerClick = (e) => {
    const strong = e.target.closest(".ai-markdown-reply table td strong");
    if (strong) {
        const ticker = strong.textContent.trim().toUpperCase();
        if (/^[A-Z0-9]{1,10}$/.test(ticker)) {
            e.preventDefault();
            window.askSathi(`Analyze ${ticker} and show a detailed chart`);
        }
    }
};

document.addEventListener("click", handleTickerClick);
document.addEventListener("contextmenu", handleTickerClick);
