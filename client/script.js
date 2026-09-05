let socket = null;
try { if (typeof io !== 'undefined') socket = io(); } catch (e) {}

const urlParams = new URLSearchParams(window.location.search);
const activeRoom = urlParams.get('room');
const activeType = urlParams.get('type');
let isSynced = !!activeRoom;

// ==========================================
// AUDIO SYSTEM (Custom Uploads & Probability)
// ==========================================
let currentAudio = null;

function playVictorySound() {
    stopVictorySound();

    // 30% chance for special audio, 70% for normal audio
    const isSpecial = Math.random() < 0.3;
    const audioFileName = isSpecial ? 'special.mp3' : 'normal.mp3';

    currentAudio = new Audio(audioFileName);
    currentAudio.play().catch(err => {
        console.log("Audio playback failed (check if files exist):", err);
    });
}

function stopVictorySound() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }
}

function triggerCelebration() {
    playVictorySound();
    const celeb = document.getElementById('celebration-overlay');
    celeb.classList.remove('hidden');
    
    // Hide celebration overlay after 5s and stop audio completely
    setTimeout(() => {
        celeb.classList.add('hidden');
        stopVictorySound();
    }, 5000); 
}

function triggerCelebration() {
    playVictorySound();
    const celeb = document.getElementById('celebration-overlay');
    celeb.classList.remove('hidden');
    setTimeout(() => celeb.classList.add('hidden'), 5000); // Hide after 5s
}

function formatStopwatch(ms) {
    if (ms <= 0) return `00:00:00<span class="ms-small">.00</span>`;
    let totalSecs = Math.floor(ms / 1000);
    let h = Math.floor(totalSecs / 3600);
    let m = Math.floor((totalSecs % 3600) / 60);
    let s = totalSecs % 60;
    let mili = Math.floor((ms % 1000) / 10);
    
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}<span class="ms-small">.${String(mili).padStart(2, '0')}</span>`;
}
let swTimer, swStartMs = 0, swElapsed = 0, swRunning = false, swAbsoluteStart = 0;

function updateStopwatchUI() {
    const timeHTML = formatStopwatch(swElapsed);
    document.getElementById('sw-display').innerHTML = timeHTML;
    document.getElementById('sw-stage-time').innerHTML = timeHTML;
    const btnText = swRunning ? 'Pause' : 'Start';
    document.querySelector('#sw-toggle .btn-content').textContent = btnText;
    document.getElementById('sw-stage-toggle').textContent = btnText;
}

function toggleStopwatch(emit = true) {
    if (swRunning) {
        swRunning = false;
        clearInterval(swTimer);
    } else {
        swRunning = true;
        swAbsoluteStart = Date.now() - swElapsed; 
        swTimer = setInterval(() => {
            swElapsed = Date.now() - swAbsoluteStart;
            updateStopwatchUI();
        }, 30);
    }
    updateStopwatchUI();
    if (emit) emitState();
}

function resetStopwatch(emit = true) {
    swRunning = false;
    clearInterval(swTimer);
    swElapsed = 0;
    swAbsoluteStart = 0;
    updateStopwatchUI();
    if (emit) emitState();
}

document.getElementById('sw-toggle').addEventListener('click', () => toggleStopwatch(true));
document.getElementById('sw-stage-toggle').addEventListener('click', () => toggleStopwatch(true));
document.getElementById('sw-reset').addEventListener('click', () => resetStopwatch(true));
document.getElementById('sw-stage-reset').addEventListener('click', () => resetStopwatch(true));

let stTimer, stTargetMs = 0, stCurrentMs = 0, stRunning = false, stMode = 'down', stAbsoluteTarget = 0;

function updateTimerUI() {
    const stageTimeEl = document.getElementById('stage-time');
    
    if (stCurrentMs <= 0) {
        stageTimeEl.innerHTML = "00";
        stageTimeEl.className = "massive-time dynamic-time tier-secs";
    } else {
        let totalSecs = Math.floor(stCurrentMs / 1000);
        let h = Math.floor(totalSecs / 3600);
        let m = Math.floor((totalSecs % 3600) / 60);
        let s = totalSecs % 60;

        let sStr = String(s).padStart(2, '0');
        let mStr = String(m).padStart(2, '0');
        let hStr = String(h).padStart(2, '0');

        // Dynamic Display Logic
        if (h > 0) {
            stageTimeEl.innerHTML = `${hStr}:${mStr}:${sStr}`;
            stageTimeEl.className = "massive-time dynamic-time tier-hours";
        } else if (m > 0) {
            stageTimeEl.innerHTML = `${mStr}:${sStr}`;
            stageTimeEl.className = "massive-time dynamic-time tier-mins";
        } else {
            stageTimeEl.innerHTML = `${sStr}`;
            stageTimeEl.className = "massive-time dynamic-time tier-secs";
        }
    }
    
    const btnText = stRunning ? 'Pause' : 'Start';
    document.getElementById('stage-toggle').textContent = btnText;
}

function toggleTimer(emit = true) {
    if (stRunning) {
        stRunning = false;
        clearInterval(stTimer);
    } else {
        stRunning = true;
        stAbsoluteTarget = stMode === 'down' ? Date.now() + stCurrentMs : Date.now() - stCurrentMs;
        
        stTimer = setInterval(() => {
            if (stMode === 'down') {
                stCurrentMs = stAbsoluteTarget - Date.now();
                if (stCurrentMs <= 0) { 
                    stCurrentMs = 0; 
                    clearInterval(stTimer); 
                    stRunning = false; 
                    triggerCelebration(); 
                }
            } else {
                stCurrentMs = Date.now() - stAbsoluteTarget;
                if (stCurrentMs >= stTargetMs) { 
                    stCurrentMs = stTargetMs; 
                    clearInterval(stTimer); 
                    stRunning = false; 
                    triggerCelebration(); 
                }
            }
            updateTimerUI();
        }, 30);
    }
    updateTimerUI();
    if (emit) emitState();
}

function resetTimer(emit = true) {
    stRunning = false;
    clearInterval(stTimer);
    stCurrentMs = (stMode === 'down') ? stTargetMs : 0;
    updateTimerUI();
    if (emit) emitState();
}

document.getElementById('stage-toggle').addEventListener('click', () => toggleTimer(true));
document.getElementById('stage-reset').addEventListener('click', () => resetTimer(true));

// ==========================================
// SYNC & ROUTING (Hide Sidebar & Exact Sync)
// ==========================================
let selectedSyncType = 'stopwatch';

document.querySelectorAll('.sync-type-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.sync-type-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        selectedSyncType = e.target.dataset.type;
    });
});

document.getElementById('sync-create').addEventListener('click', () => {
    if (!socket) return alert("Server not running.");
    const roomId = `khush-${Math.random().toString(36).substring(2, 8)}`;
    const roomUrl = `${window.location.origin}${window.location.pathname}?room=${roomId}&type=${selectedSyncType}`;
    navigator.clipboard.writeText(roomUrl).then(() => {
        alert("Room link copied!");
        window.location.href = roomUrl;
    });
});

function emitState() {
    if (!isSynced || !socket) return;
    const payload = activeType === 'stopwatch' ? 
        { absoluteStart: swAbsoluteStart, elapsed: swElapsed, running: swRunning } : 
        { absoluteTarget: stAbsoluteTarget, current: stCurrentMs, target: stTargetMs, mode: stMode, running: stRunning, title: document.getElementById('t-title').value };
    
    socket.emit('update-state', { roomId: activeRoom, state: { type: activeType, data: payload } });
}

if (isSynced) {
    document.body.classList.add('sync-mode');
    
    window.addEventListener('DOMContentLoaded', () => {
        const activeCard = document.querySelector('.panel.active .glass-card');
        if (activeCard && !document.getElementById('leave-room-btn')) {
            const leaveBtn = document.createElement('button');
            leaveBtn.id = 'leave-room-btn';
            leaveBtn.className = 'btn btn-outline full-width mt-3 ripple';
            leaveBtn.style.marginTop = '24px';
            leaveBtn.textContent = '← Leave Room & Return Home';
            
            leaveBtn.addEventListener('click', () => {
                window.location.href = window.location.origin + window.location.pathname;
            });
            
            activeCard.appendChild(leaveBtn);
        }
    });
    
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    if (activeType === 'timer') {
        document.getElementById('panel-timer').classList.add('active');
    } else {
        document.getElementById('panel-stopwatch').classList.add('active');
    }

    if (socket) {
        socket.emit('join-room', activeRoom);
        
        socket.on('sync-state', (state) => {
            if (!state) return;
            
            if (state.type === 'stopwatch') {
                swAbsoluteStart = state.data.absoluteStart;
                swElapsed = state.data.running ? Date.now() - swAbsoluteStart : state.data.elapsed;
                
                if (state.data.running && !swRunning) toggleStopwatch(false);
                if (!state.data.running && swRunning) toggleStopwatch(false);
                updateStopwatchUI();
            } else if (state.type === 'timer') {
                stAbsoluteTarget = state.data.absoluteTarget;
                stTargetMs = state.data.target;
                stMode = state.data.mode;
                document.getElementById('stage-title').textContent = state.data.title;
                
                if (state.data.running) {
                    stCurrentMs = stMode === 'down' ? stAbsoluteTarget - Date.now() : Date.now() - stAbsoluteTarget;
                    if (!stRunning) toggleTimer(false);
                } else {
                    stCurrentMs = state.data.current;
                    if (stRunning) toggleTimer(false);
                }
                updateTimerUI();
            }
        });
    }
}

const navBtns = document.querySelectorAll('.nav-btn');
const panels = document.querySelectorAll('.panel');
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.target).classList.add('active');
    });
});

document.getElementById('sw-launch').addEventListener('click', () => document.getElementById('sw-overlay').classList.remove('hidden'));
document.getElementById('sw-close-stage').addEventListener('click', () => document.getElementById('sw-overlay').classList.add('hidden'));
document.getElementById('t-launch').addEventListener('click', () => {
    stTargetMs = ((parseFloat(document.getElementById('t-hours').value) || 0) * 3600 + (parseFloat(document.getElementById('t-mins').value) || 0) * 60 + (parseFloat(document.getElementById('t-secs').value) || 0)) * 1000;
    stMode = document.getElementById('t-mode').value;
    stCurrentMs = (stMode === 'down') ? stTargetMs : 0;
    document.getElementById('stage-title').textContent = document.getElementById('t-title').value;
    updateTimerUI();
    document.getElementById('stage-overlay').classList.remove('hidden');
    emitState();
});
document.getElementById('stage-close').addEventListener('click', () => document.getElementById('stage-overlay').classList.add('hidden'));