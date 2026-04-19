// js/main-page-integration.js

let allParticipants = [];

function loadParticipants() {
    const saved = localStorage.getItem('all_participants');
    if (saved) allParticipants = JSON.parse(saved);
}

function saveParticipants() {
    localStorage.setItem('all_participants', JSON.stringify(allParticipants));
}

function downloadCSV() {
    if (allParticipants.length === 0) return;
    const headers = ['participant_id', 'scenario', 'consent', 'timestamp', 'session_id'];
    const rows = allParticipants.map(p => [p.id, p.scenario, p.consent, p.timestamp, p.sessionId]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'participants.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function addParticipant(id, scenario, consent, sessionId) {
    allParticipants.push({ id, scenario, consent, timestamp: new Date().toISOString(), sessionId });
    saveParticipants();
    downloadCSV();
}

function showMyMainPage() {
    console.log('🏠 Показываем главную страницу');
    loadParticipants();
    
    const cinemaApp = document.getElementById('cinema-app');
    const calibrationOverlay = document.getElementById('calibrationOverlay');
    const videoMonitor = document.getElementById('videoMonitor');
    const myFormsContainer = document.getElementById('my-forms-container');
    const myMainPage = document.getElementById('my-main-page');
    
    if (cinemaApp) cinemaApp.classList.add('hidden');
    if (calibrationOverlay) calibrationOverlay.style.display = 'none';
    if (videoMonitor) videoMonitor.style.display = 'none';
    if (myFormsContainer) myFormsContainer.style.display = 'none';
    if (myMainPage) myMainPage.style.display = 'block';
    
    initMyMainPageHandlers();
}

function initMyMainPageHandlers() {
    const startBtn = document.getElementById('startBtn');
    const participantIdInput = document.getElementById('participantId');
    const radioYes = document.querySelector('input[name="ready"][value="yes"]');
    const radioNo = document.querySelector('input[name="ready"][value="no"]');
    const statusMessage = document.getElementById('statusMessage');
    
    if (!startBtn) {
        console.error('❌ startBtn не найден');
        return;
    }
    
    // Функция проверки и активации кнопки
    function checkForm() {
        const id = participantIdInput?.value.trim();
        const isReady = radioYes?.checked;
        
        console.log('🔍 checkForm вызван:', { id, isReady });
        
        if (id && isReady) {
            startBtn.disabled = false;  // Активируем кнопку
            statusMessage.textContent = '✅ Можно начинать';
            statusMessage.style.color = '#4caf50';
            console.log('✅ Кнопка АКТИВИРОВАНА');
        } else {
            startBtn.disabled = true;   // Деактивируем кнопку
            statusMessage.textContent = '';
            console.log('❌ Кнопка ЗАБЛОКИРОВАНА');
        }
    }
    
    function onStartClick(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        
        console.log('🔴 КНОПКА НАЖАТА!');
        
        const participantId = participantIdInput.value.trim();
        const isReady = radioYes?.checked;
        
        if (!participantId || !isReady) return;
        
        const scenario = localStorage.getItem('currentScenario') || 'without';
        const sessionId = `${participantId}_${Date.now()}`;
        
        addParticipant(participantId, scenario, 'yes', sessionId);
        
        localStorage.setItem('participantData', JSON.stringify({
            participantId, scenario, sessionId, timestamp: new Date().toISOString()
        }));
        
        statusMessage.textContent = '✅ Переход к калибровке...';
        
        // Скрываем главную страницу
        const myMainPage = document.getElementById('my-main-page');
        if (myMainPage) myMainPage.style.display = 'none';
        
        // Показываем калибровку
        const calibrationOverlay = document.getElementById('calibrationOverlay');
        if (calibrationOverlay) calibrationOverlay.style.display = 'flex';
        
        // Запускаем калибровку
        setTimeout(() => {
            if (typeof startCalibration === 'function') {
                startCalibration();
            } else {
                console.error('❌ startCalibration не найдена');
            }
        }, 100);
    }
    
    // Навешиваем обработчики
    startBtn.onclick = onStartClick;
    
    if (participantIdInput) {
        participantIdInput.addEventListener('input', checkForm);
        participantIdInput.addEventListener('change', checkForm);
    }
    
    if (radioYes) {
        radioYes.addEventListener('change', checkForm);
    }
    
    if (radioNo) {
        radioNo.addEventListener('change', () => {
            startBtn.disabled = true;
            statusMessage.textContent = '';
        });
    }
    
    // Принудительно вызываем проверку при загрузке
    checkForm();
    
    console.log('✅ Обработчики главной страницы настроены');
}

window.addEventListener('DOMContentLoaded', () => {
    showMyMainPage();
});

window.showMyMainPage = showMyMainPage;