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
            } else {
                if(startTimerInterval) clearInterval(startTimerInterval);
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
    document.getElementById('btn-return-home').addEventListener('click', () => showScreen('home'));

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
        document.getElementById('user-name'),
        document.getElementById('api-key-1')
    ];
    inputsStart.forEach(i => i.addEventListener('input', () => validateForm('start')));

    const inputsLogin = [
        document.getElementById('login-user-name'),
        document.getElementById('login-api-key-1')
    ];
    inputsLogin.forEach(i => i.addEventListener('input', () => validateForm('login')));

    function validateForm(type) {
        const prefix = type === 'start' ? '' : 'login-';
        const nameValid = document.getElementById(prefix + 'user-name').value.trim() !== '';
        // API key 1 is required
        let key1Valid = false;
        const key1Elem = document.getElementById(prefix + 'api-key-1');
        if(key1Elem) {
            key1Valid = key1Elem.value.trim() !== '';
        }
        
        let allQuestions = true;
        ['q1', 'q2', 'q3', 'q4', 'q5'].forEach(q => {
            const group = document.getElementById(`${prefix}${q}-group`);
            if (group && !group.querySelector('.pill.selected')) {
                allQuestions = false;
            }
        });

        const submitBtn = document.getElementById(type === 'start' ? 'btn-submit-start' : 'btn-submit-login');
        if (submitBtn) {
            submitBtn.disabled = !(nameValid && key1Valid && allQuestions);
        }
    }

    function setupForm(type) {
        const prefix = type === 'start' ? '' : 'login-';
        const nameInput = document.getElementById(prefix + 'user-name');
        
        if (nameInput) nameInput.value = localStorage.getItem('mp_name') || '';
        
        const key1Input = document.getElementById(prefix + 'api-key-1');
        if (key1Input) key1Input.value = localStorage.getItem('mp_key1') || '';
        
        const key2Input = document.getElementById(prefix + 'api-key-2');
        if (key2Input) key2Input.value = localStorage.getItem('mp_key2') || '';
        
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
        
        const key1Input = document.getElementById(prefix + 'api-key-1');
        if (key1Input) localStorage.setItem('mp_key1', key1Input.value.trim());
        
        const key2Input = document.getElementById(prefix + 'api-key-2');
        if (key2Input) localStorage.setItem('mp_key2', key2Input.value.trim());
        
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
            const keys = ['mp_name', 'mp_q1', 'mp_q2', 'mp_q3', 'mp_q4', 'mp_q5', 'mp_q5_custom', 'mp_key1', 'mp_key2', 'mp_key1_exhausted'];
            keys.forEach(k => localStorage.removeItem(k));
            alert('All data cleared.');
            showScreen('home');
        }
    }

    function clearKeys() {
        if(confirm("Are you sure you want to clear your API configuration?")) {
            localStorage.removeItem('mp_key1');
            localStorage.removeItem('mp_key2');
            localStorage.removeItem('mp_key1_exhausted');
            alert('API keys cleared.');
        }
    }

    document.getElementById('btn-clear-data-login').addEventListener('click', clearData);
    document.getElementById('btn-clear-keys-login').addEventListener('click', clearKeys);
    document.getElementById('btn-clear-data-settings').addEventListener('click', clearData);
    document.getElementById('btn-clear-keys-settings').addEventListener('click', clearKeys);


    // Player & Timer Logic
    function getActiveApiKey() {
        const key1 = localStorage.getItem('mp_key1');
        const key2 = localStorage.getItem('mp_key2');
        const exhausted = localStorage.getItem('mp_key1_exhausted');

        if (exhausted) {
            // Check if exhausted date is today
            const exhaustDate = new Date(parseInt(exhausted)).toDateString();
            const today = new Date().toDateString();
            
            if (exhaustDate === today) {
                return key2; // fallback to key 2
            } else {
                localStorage.removeItem('mp_key1_exhausted'); // Reset for new day
                return key1;
            }
        }
        return key1;
    }

    const timerRing = document.getElementById('timer-ring');
    const timerText = document.getElementById('timer-text');
    const playerHello = document.getElementById('player-hello');
    const breakWarning = document.getElementById('timer-warning');

    function initTimer() {
        playerHello.textContent = `Ready for focus, ${localStorage.getItem('mp_name') || ''}?`;
        
        // Reset player views
        document.getElementById('timer-view').classList.remove('hidden');
        document.getElementById('loading-view').classList.add('hidden');
        document.getElementById('content-view').classList.add('hidden');
        document.getElementById('feedback-section').classList.remove('hidden');
        document.getElementById('success-msg-section').classList.add('hidden');
        breakWarning.classList.add('hidden');
        
        timerStartTime = Date.now();
        timerElapsed = 0;
        retryCount = 0;
        
        if(startTimerInterval) clearInterval(startTimerInterval);
        startTimerInterval = setInterval(updateTimer, 1000);
        updateTimer();
    }

    function updateTimer() {
        timerElapsed = Date.now() - timerStartTime;
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

        // Update SVG (565.48 is full circumference)
        const progress = Math.min(timerElapsed / WORK_DURATION_MS, 1);
        const dashoffset = 565.48 * (1 - progress);
        timerRing.style.strokeDashoffset = dashoffset;
    }

    document.getElementById('btn-take-break').addEventListener('click', () => {
        if (timerElapsed < WORK_DURATION_MS) {
            // Warn if clicked before duration
            breakWarning.classList.remove('hidden');
        } else {
            // Success
            breakWarning.classList.add('hidden');
            fetchBreak();
        }
    });

    async function fetchBreak(retryNote = null) {
        document.getElementById('timer-view').classList.add('hidden');
        document.getElementById('content-view').classList.add('hidden');
        document.getElementById('loading-view').classList.remove('hidden');

        const apiKey = getActiveApiKey();

        if (!apiKey) {
            alert('No valid API Key found. Please configure it in settings.');
            showScreen('settings');
            return;
        }

        const payload = {
            q1: localStorage.getItem('mp_q1'),
            q2: localStorage.getItem('mp_q2'),
            q3: localStorage.getItem('mp_q3'),
            q4: localStorage.getItem('mp_q4'),
            q5: localStorage.getItem('mp_q5'),
            q5_custom: localStorage.getItem('mp_q5_custom') || '',
            api_key: apiKey
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

            if (response.status === 429 || response.status === 403) {
                if(localStorage.getItem('mp_key1') === apiKey) {
                    // Exhausted Key 1
                    localStorage.setItem('mp_key1_exhausted', Date.now().toString());
                    const fallback = localStorage.getItem('mp_key2');
                    if (fallback) {
                        return fetchBreak(retryNote); // Retry immediately with fallback
                    } else {
                        throw new Error('API Key exhausted and no backup key found.');
                    }
                } else {
                    // Exhausted Key 2
                    throw new Error('Both API keys exhausted or rate limited.');
                }
            }

            if (!response.ok) throw new Error('Failed to fetch break curation.');
            
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
        document.getElementById('feedback-section').classList.add('hidden');
        document.getElementById('success-msg-section').classList.remove('hidden');
    });

    document.getElementById('btn-feedback-no').addEventListener('click', () => {
        retryCount++;
        if (retryCount >= 3) {
            document.getElementById('feedback-section').classList.add('hidden');
            document.getElementById('success-msg-section').classList.remove('hidden');
            retryCount = 0;
        } else {
            fetchBreak("The user didn't enjoy the previous suggestion. Please recommend something different.");
        }
    });
});
