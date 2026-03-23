// script.js
const WORK_DURATION_MINUTES = 1; // Used 1 minute for testing per requirements
const WORK_DURATION_MS = WORK_DURATION_MINUTES * 60 * 1000;
const WEBHOOK_URL = 'https://isuruudara.app.n8n.cloud/webhook/relaxation-break';

document.addEventListener('DOMContentLoaded', () => {
    const screens = {
        home: document.getElementById('home-screen'),
        start: document.getElementById('start-screen'),
        login: document.getElementById('login-screen'),
        player: document.getElementById('player-screen'),
        settings: document.getElementById('settings-screen')
    };

    let startTimerInterval;
    let timerStartTime = 0;
    let timerElapsed = 0;
    
    let currentVideos = [];
    let currentVideoIndex = 0;
    let retryCount = 0;

    // Navigation and Transition Logic
    function showScreen(screenName) {
        // Fade out active screens
        Object.values(screens).forEach(s => {
            if(s.classList.contains('active')) {
                s.classList.remove('active');
            }
        });
        
        // Wait for fade out, then display hidden and unhide new screen
        setTimeout(() => {
            Object.values(screens).forEach(s => s.classList.add('hidden'));
            const target = screens[screenName];
            target.classList.remove('hidden');
            
            // Trigger reflow
            void target.offsetWidth;
            
            target.classList.add('active');
            
            if (screenName === 'player') {
                initTimer();
            }
        }, 400); // 0.4s fade transition matches CSS
    }

    // Wiring up Navigation Buttons
    document.getElementById('btn-go-start').addEventListener('click', () => {
        setupForm('start');
        showScreen('start');
    });
    document.getElementById('btn-go-login').addEventListener('click', () => {
        setupForm('login');
        showScreen('login');
    });
    document.getElementById('btn-go-settings-home').addEventListener('click', () => showScreen('settings'));
    document.getElementById('btn-back-start').addEventListener('click', () => showScreen('home'));
    document.getElementById('btn-back-login').addEventListener('click', () => showScreen('home'));
    document.getElementById('btn-back-settings').addEventListener('click', () => showScreen('home'));
    document.getElementById('btn-settings-player').addEventListener('click', () => showScreen('settings'));

    // Pill MCQ Logic
    document.querySelectorAll('.pill').forEach(pill => {
        pill.addEventListener('click', function() {
            const container = this.closest('.pill-options');
            container.querySelectorAll('.pill').forEach(p => p.classList.remove('selected'));
            this.classList.add('selected');
            validateForm(this.closest('.screen').id === 'start-screen' ? 'start' : 'login');
        });
    });

    const inputsStart = [
        document.getElementById('user-name')
    ];
    inputsStart.forEach(i => i.addEventListener('input', () => validateForm('start')));

    const inputsLogin = [
        document.getElementById('login-user-name')
    ];
    inputsLogin.forEach(i => i.addEventListener('input', () => validateForm('login')));

    function validateForm(type) {
        const prefix = type === 'start' ? '' : 'login-';
        const nameValid = document.getElementById(prefix + 'user-name').value.trim() !== '';
        
        let allQuestions = true;
        ['q1', 'q2', 'q3', 'q4', 'q5'].forEach(q => {
            const group = document.getElementById(`${prefix}${q}-group`);
            if (group && !group.querySelector('.pill.selected')) {
                allQuestions = false;
            }
        });

        const submitBtn = document.getElementById(type === 'start' ? 'btn-submit-start' : 'btn-submit-login');
        if (submitBtn) {
            submitBtn.disabled = !(nameValid && allQuestions);
        }
    }

    function setupForm(type) {
        const prefix = type === 'start' ? '' : 'login-';
        const nameInput = document.getElementById(prefix + 'user-name');
        
        if (nameInput) nameInput.value = localStorage.getItem('mp_name') || '';
        
        const customQ5 = document.getElementById(prefix + 'q5-custom');
        if (customQ5) customQ5.value = localStorage.getItem('mp_q5_custom') || '';

        ['q1', 'q2', 'q3', 'q4', 'q5'].forEach(q => {
            const val = localStorage.getItem(`mp_${q}`);
            if (val) {
                // Remove existing selection
                document.querySelectorAll(`#${prefix}${q}-group .pill`).forEach(p => p.classList.remove('selected'));
                // Add selection to matching option
                const pill = document.querySelector(`#${prefix}${q}-group .pill[data-val="${val}"]`);
                if (pill) {
                    pill.classList.add('selected');
                }
            }
        });
        validateForm(type);
    }

    function saveFormData(type) {
        const prefix = type === 'start' ? '' : 'login-';
        
        const nameInput = document.getElementById(prefix + 'user-name');
        if (nameInput) localStorage.setItem('mp_name', nameInput.value.trim());
        
        const customQ5 = document.getElementById(prefix + 'q5-custom');
        if (customQ5) localStorage.setItem('mp_q5_custom', customQ5.value.trim());

        ['q1', 'q2', 'q3', 'q4', 'q5'].forEach(q => {
            const pill = document.querySelector(`#${prefix}${q}-group .pill.selected`);
            if (pill) {
                localStorage.setItem(`mp_${q}`, pill.getAttribute('data-val'));
            }
        });
    }

    document.getElementById('btn-submit-start').addEventListener('click', () => {
        saveFormData('start');
        showScreen('player');
    });

    document.getElementById('btn-submit-login').addEventListener('click', () => {
        saveFormData('login');
        showScreen('player');
    });

    // Clear Data Features
    function clearData() {
        if(confirm("Are you sure you want to clear all your profile data?")) {
            const keys = ['mp_name', 'mp_q1', 'mp_q2', 'mp_q3', 'mp_q4', 'mp_q5', 'mp_q5_custom', 'mp_history'];
            keys.forEach(k => localStorage.removeItem(k));
            alert('All data cleared.');
            showScreen('home');
        }
    }

    document.getElementById('btn-clear-data-login').addEventListener('click', clearData);
    document.getElementById('btn-clear-data-settings').addEventListener('click', clearData);


    // Player & Timer Logic
    const timerRing = document.getElementById('timer-ring');
    const timerText = document.getElementById('timer-text');
    const playerHello = document.getElementById('player-hello');
    
    let breakSessionStarted = false;

    // Modal Variables
    const modalOverlay = document.getElementById('modal-overlay');
    const modalIcon = document.getElementById('modal-icon');
    const modalMessage = document.getElementById('modal-message');
    const btnModalClose = document.getElementById('btn-modal-close');
    let modalAction = null;

    function showModal(icon, message, goHomeOnClose) {
        modalIcon.textContent = icon;
        modalMessage.textContent = message;
        
        modalAction = () => {
            modalOverlay.classList.remove('active');
            setTimeout(() => {
                modalOverlay.classList.add('hidden');
                if (goHomeOnClose) {
                    showScreen('home');
                }
            }, 300);
        };
        
        modalOverlay.classList.remove('hidden');
        void modalOverlay.offsetWidth;
        modalOverlay.classList.add('active');
    }

    btnModalClose.addEventListener('click', () => {
        if (modalAction) modalAction();
    });

    function initTimer() {
        playerHello.textContent = `Ready for focus, ${localStorage.getItem('mp_name') || ''}?`;
        
        // Reset player views
        document.getElementById('timer-view').classList.remove('hidden');
        document.getElementById('loading-view').classList.add('hidden');
        document.getElementById('content-view').classList.add('hidden');
        
        const spinBorder = document.getElementById('break-spin-border');
        if (spinBorder) {
            spinBorder.style.display = breakSessionStarted ? 'none' : 'block';
        }
        
        if (breakSessionStarted && !startTimerInterval) {
            startTimerInterval = setInterval(updateTimer, 1000);
        }
        updateTimer();
    }

    function updateTimer() {
        if (breakSessionStarted) {
            timerElapsed = Date.now() - timerStartTime;
        } else {
            timerElapsed = 0;
        }
        
        let remaining = WORK_DURATION_MS - timerElapsed;
        if(remaining < 0) remaining = 0;

        // Display elapsed time counting up from 00:00 to 25:00
        const totalSecsElapsed = Math.floor(timerElapsed / 1000);
        const mins = Math.floor(totalSecsElapsed / 60);
        const secs = totalSecsElapsed % 60;
        
        // Ensure UI doesn't exceed target visual time if sitting there
        if(timerElapsed <= WORK_DURATION_MS){
            timerText.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            const maxMins = Math.floor(WORK_DURATION_MINUTES);
            const maxSecs = 0;
            timerText.textContent = `${maxMins.toString().padStart(2, '0')}:${maxSecs.toString().padStart(2, '0')}`;
        }

        // Update SVG (722.57 is full circumference)
        const progress = Math.min(timerElapsed / WORK_DURATION_MS, 1);
        const dashoffset = 722.57 * (1 - progress);
        timerRing.style.strokeDashoffset = dashoffset;
    }

    document.getElementById('btn-take-break').addEventListener('click', () => {
        if (!breakSessionStarted) {
            // First click
            breakSessionStarted = true;
            timerStartTime = Date.now();
            retryCount = 0;
            
            const spinBorder = document.getElementById('break-spin-border');
            if (spinBorder) spinBorder.style.display = 'none';
            
            if (startTimerInterval) clearInterval(startTimerInterval);
            startTimerInterval = setInterval(updateTimer, 1000);
            updateTimer();
            
            fetchBreak();
        } else {
            // Subsequent clicks
            if (timerElapsed < WORK_DURATION_MS) {
                showModal("💪", "Go back and remember you should win this", false);
            } else {
                // Reset timer and start new break
                timerStartTime = Date.now();
                timerElapsed = 0;
                retryCount = 0;
                updateTimer();
                fetchBreak();
            }
        }
    });

    async function fetchBreak(retryNote = null) {
        document.getElementById('timer-view').classList.add('hidden');
        document.getElementById('content-view').classList.add('hidden');
        document.getElementById('loading-view').classList.remove('hidden');

        let historyArray = [];
        try {
            historyArray = JSON.parse(localStorage.getItem('mp_history') || '[]');
        } catch(e) {
            historyArray = [];
        }
        let formattedHistoryString = "";
        if (historyArray.length > 0) {
            formattedHistoryString = historyArray.map(item => `- ${item}`).join('\n');
        }

        const payload = {
            q1: localStorage.getItem('mp_q1'),
            q2: localStorage.getItem('mp_q2'),
            q3: localStorage.getItem('mp_q3'),
            q4: localStorage.getItem('mp_q4'),
            q5: localStorage.getItem('mp_q5'),
            q5_custom: localStorage.getItem('mp_q5_custom') || '',
            history: formattedHistoryString
        };

        if (retryNote) {
            payload.retry_note = retryNote;
        }

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error('Failed to fetch break content. Please try again.');
            
            const data = await response.json();
            
            if (data.quote) {
                document.getElementById('content-quote').textContent = data.quote;
            } else {
                document.getElementById('content-quote').textContent = "Remember, you're doing great. Keep pushing forward.";
            }

            if (data.videos && data.videos.length > 0) {
                currentVideos = data.videos.map(toEmbedUrl).filter(Boolean);
                currentVideoIndex = 0;
                if (currentVideos.length > 0) {
                    embedVideo(currentVideos[0]);
                } else {
                    embedVideo('https://www.youtube.com/embed/jfKfPfyJRdk');
                }
            } else {
                // Fallback safe URL if data is somehow missing from webhook
                embedVideo('https://www.youtube.com/embed/jfKfPfyJRdk');
            }

            document.getElementById('loading-view').classList.add('hidden');
            document.getElementById('content-view').classList.remove('hidden');

        } catch (error) {
            alert(error.message);
            document.getElementById('loading-view').classList.add('hidden');
            document.getElementById('timer-view').classList.remove('hidden'); // Return to timer
        }
    }

    function toEmbedUrl(url) {
        try {
            if (url.includes('/embed/')) return url;
            const videoId = url.split('v=')[1]?.split('&')[0];
            if (!videoId) return null;
            return 'https://www.youtube.com/embed/' + videoId;
        } catch (e) {
            return null;
        }
    }

    function embedVideo(url) {
        document.getElementById('video-iframe').src = url;
    }

    // Feedback Handlers
    document.getElementById('btn-feedback-yes').addEventListener('click', () => {
        const iframe = document.getElementById('video-iframe');
        const currentUrl = iframe ? iframe.src : '';
        
        const q2value = localStorage.getItem('mp_q2') || '';
        const q3value = localStorage.getItem('mp_q3') || '';
        const q5value = localStorage.getItem('mp_q5') || '';
        const entryString = q3value + ", " + q2value + ", felt " + q5value;
        
        let history = [];
        try {
            history = JSON.parse(localStorage.getItem('mp_history') || '[]');
        } catch(e) {
            history = [];
        }
        
        history.unshift(entryString);
        history = history.slice(0, 20);
        localStorage.setItem('mp_history', JSON.stringify(history));

        showModal("🏆", "Go back and win your game!", true);
    });

    document.getElementById('btn-feedback-no').addEventListener('click', () => {
        retryCount++;
        if (retryCount >= 3) {
            showModal("🏆", "Go back and win your game!", true);
            retryCount = 0;
        } else {
            fetchBreak("The user didn't enjoy the previous suggestion. Please recommend something different.");
        }
    });
});
