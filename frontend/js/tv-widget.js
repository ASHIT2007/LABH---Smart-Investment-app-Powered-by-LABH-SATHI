/* =========================================================
 * LIVE TV WIDGET LOGIC (YouTube IFrame Player API)
 * Persists state across pages
 * ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
    const liveTvToggleBtn = document.getElementById("liveTvToggleBtn");
    const liveTvWidget = document.getElementById("liveTvWidget");
    const liveTvHeader = document.getElementById("liveTvHeader");
    const liveTvCloseBtn = document.getElementById("liveTvCloseBtn");
    const liveTvMinimizeBtn = document.getElementById("liveTvMinimizeBtn");
    const liveTvVolumeBtn = document.getElementById("liveTvVolumeBtn");
    const liveTvChannelSelect = document.getElementById("liveTvChannelSelect");

    if (!liveTvWidget) return;

    let ytPlayer = null;
    let isMuted = true;
    let isDragging = false;
    let currentX = 0, currentY = 0, initialX = 0, initialY = 0;
    
    // Load persisted state
    let xOffset = parseFloat(localStorage.getItem('liveTvX')) || 0;
    let yOffset = parseFloat(localStorage.getItem('liveTvY')) || 0;
    if (xOffset || yOffset) {
        liveTvWidget.style.transform = `translate3d(${xOffset}px, ${yOffset}px, 0)`;
    }

    if (localStorage.getItem('liveTvMinimized') === 'true') {
        liveTvWidget.classList.add("minimized");
        if(liveTvMinimizeBtn) {
            const icon = liveTvMinimizeBtn.querySelector("span");
            if(icon) icon.textContent = "keyboard_arrow_up";
        }
    }

    const savedChannel = localStorage.getItem('liveTvChannel');
    if (savedChannel && liveTvChannelSelect) {
        liveTvChannelSelect.value = savedChannel;
    }

    function createPlayer(videoId) {
        if (ytPlayer && ytPlayer.destroy) {
            try { ytPlayer.destroy(); } catch(e) {}
        }
        ytPlayer = null;

        const container = document.getElementById("liveTvPlayer");
        if (!container) return;
        container.innerHTML = "";

        const playerDiv = document.createElement("div");
        playerDiv.id = "liveTvPlayerInner";
        container.appendChild(playerDiv);

        if (typeof YT === "undefined" || typeof YT.Player === "undefined") {
            setTimeout(() => createPlayer(videoId), 500);
            return;
        }

        ytPlayer = new YT.Player("liveTvPlayerInner", {
            videoId: videoId,
            width: "100%",
            height: "100%",
            playerVars: {
                autoplay: 1, mute: 1, controls: 0, rel: 0,
                iv_load_policy: 3, disablekb: 1, fs: 0,
                modestbranding: 1, playsinline: 1,
                origin: window.location.origin
            },
            events: {
                onReady: (event) => {
                    event.target.playVideo();
                    isMuted = true;
                    updateVolumeIcon();
                }
            }
        });
        
        if (liveTvChannelSelect) {
            localStorage.setItem('liveTvChannel', liveTvChannelSelect.value);
        }
    }

    function updateVolumeIcon() {
        if (!liveTvVolumeBtn) return;
        const icon = liveTvVolumeBtn.querySelector("span");
        if (isMuted) {
            icon.textContent = "volume_off";
            liveTvVolumeBtn.title = "Unmute";
        } else {
            icon.textContent = "volume_up";
            liveTvVolumeBtn.title = "Mute";
        }
    }

    if (liveTvVolumeBtn) {
        liveTvVolumeBtn.addEventListener("click", () => {
            if (!ytPlayer || typeof ytPlayer.isMuted !== "function") return;
            if (isMuted) {
                ytPlayer.unMute();
                ytPlayer.setVolume(80);
                isMuted = false;
            } else {
                ytPlayer.mute();
                isMuted = true;
            }
            updateVolumeIcon();
        });
    }

    function openWidget() {
        liveTvWidget.classList.remove("hidden");
        localStorage.setItem('liveTvOpen', 'true');
        if (liveTvChannelSelect) {
            createPlayer(liveTvChannelSelect.value);
        }
    }

    function closeWidget() {
        liveTvWidget.classList.add("hidden");
        localStorage.setItem('liveTvOpen', 'false');
        if (ytPlayer && ytPlayer.destroy) {
            try { ytPlayer.destroy(); } catch(e) {}
            ytPlayer = null;
        }
    }

    if (liveTvToggleBtn) {
        liveTvToggleBtn.addEventListener("click", () => {
            if (liveTvWidget.classList.contains("hidden")) {
                openWidget();
            } else {
                closeWidget();
            }
        });
    }

    if (liveTvCloseBtn) {
        liveTvCloseBtn.addEventListener("click", closeWidget);
    }

    if (liveTvMinimizeBtn) {
        liveTvMinimizeBtn.addEventListener("click", () => {
            const isMin = liveTvWidget.classList.toggle("minimized");
            localStorage.setItem('liveTvMinimized', isMin);
            const icon = liveTvMinimizeBtn.querySelector("span");
            if(icon) {
                icon.textContent = isMin ? "keyboard_arrow_up" : "keyboard_arrow_down";
            }
        });
    }

    if (liveTvChannelSelect) {
        liveTvChannelSelect.addEventListener("change", () => {
            if (!liveTvWidget.classList.contains("hidden")) {
                createPlayer(liveTvChannelSelect.value);
            }
        });
    }

    if (liveTvHeader) {
        liveTvHeader.addEventListener("mousedown", (e) => {
            if (e.target.closest("button") || e.target.closest("select")) return;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
            isDragging = true;
        });
    }

    document.addEventListener("mouseup", () => {
        if (isDragging) {
            isDragging = false;
            localStorage.setItem('liveTvX', xOffset);
            localStorage.setItem('liveTvY', yOffset);
        }
    });

    document.addEventListener("mousemove", (e) => {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            xOffset = currentX;
            yOffset = currentY;
            liveTvWidget.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }
    });

    // Auto-open if it was left open
    if (localStorage.getItem('liveTvOpen') === 'true') {
        openWidget();
    }
});
