/**
 * FARMA HORA - SISTEMA PRINCIPAL DE CONTROLE
 * Desenvolvido especialmente para o Sr. Antenor
 */

// BASE DE DADOS OFICIAL DOS MEDICAMENTOS SOLICITADOS
const initialMedicines = [
    {
        id: "dipirona",
        name: "Dipirona",
        dosage: "500 mg",
        time: "14:00",
        status: "pending", // 'taken', 'pending', 'late'
        icon: "💊",
        pillType: "1 COMPRIMIDO"
    },
    {
        id: "losartana",
        name: "Losartana",
        dosage: "50 mg",
        time: "08:00",
        status: "taken",
        icon: "⚪",
        pillType: "1 COMPRIMIDO"
    },
    {
        id: "paracetamol",
        name: "Paracetamol",
        dosage: "750 mg",
        time: "20:00",
        status: "pending",
        icon: "🟡",
        pillType: "1 COMPRIMIDO"
    },
    {
        id: "omeprazol",
        name: "Omeprazol",
        dosage: "20 mg",
        time: "07:00",
        status: "taken",
        icon: "🟢",
        pillType: "1 CÁPSULA"
    },
    {
        id: "atenolol",
        name: "Atenolol",
        dosage: "25 mg",
        time: "18:00",
        status: "pending",
        icon: "🔴",
        pillType: "1 COMPRIMIDO"
    },
    {
        id: "vitaminad",
        name: "Vitamina D",
        dosage: "1 cápsula",
        time: "09:00",
        status: "taken",
        icon: "🟠",
        pillType: "1 CÁPSULA"
    }
];

let medicines = [...initialMedicines];
let currentHeroMed = null;
let webcamStream = null;

// ÁUDIO DOS ALARMES — desbloqueado na primeira interação do usuário
let alarmAudioContext = null;
let alarmAudioUnlocked = false;
let lastAlarmKey = null;

function getLocalDateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getAlarmAudioContext() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!alarmAudioContext) alarmAudioContext = new AudioContext();
    if (alarmAudioContext.state === 'suspended') {
        alarmAudioContext.resume().catch(() => {});
    }
    return alarmAudioContext;
}

function unlockAlarmAudio() {
    const ctx = getAlarmAudioContext();
    if (!ctx) return false;
    try {
        const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        alarmAudioUnlocked = true;
        updateAlarmStatus('🔔 Alarmes ativos');
        return true;
    } catch (e) {
        console.log('Não foi possível ativar o áudio:', e);
        return false;
    }
}

function playBeepSound(freq = 880, type = 'sine', duration = 0.3) {
    try {
        const ctx = getAlarmAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.02);
    } catch (e) {
        console.log('Áudio indisponível:', e);
    }
}

function updateAlarmStatus(text) {
    const el = document.getElementById('alarm-status');
    if (el) el.textContent = text;
}

// SINTETIZADOR DE VOZ (SpeechSynthesis)
function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Para áudios anteriores
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'pt-BR';
        utterance.rate = 0.9; // Velocidade levemente reduzida para idosos
        utterance.pitch = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// Mantém os horários/status durante uma atualização da página.
function saveMedicineState() {
    try {
        localStorage.setItem('farmaHoraMedicines', JSON.stringify(medicines));
        localStorage.setItem('farmaHoraDate', getLocalDateKey());
    } catch (e) {}
}

function loadMedicineState() {
    try {
        const today = getLocalDateKey();
        const savedDate = localStorage.getItem('farmaHoraDate');
        const saved = localStorage.getItem('farmaHoraMedicines');
        const officialIds = new Set(initialMedicines.map(m => m.id));

        if (saved && savedDate === today) {
            const parsed = JSON.parse(saved);
            const savedOfficial = Array.isArray(parsed) ? parsed.filter(m => officialIds.has(m.id)) : [];
            medicines = initialMedicines.map(base => {
                const savedMed = savedOfficial.find(m => m.id === base.id);
                return savedMed ? { ...base, status: savedMed.status } : { ...base };
            });
        } else {
            medicines = initialMedicines.map(m => ({ ...m, status: 'pending' }));
        }

        localStorage.setItem('farmaHoraMedicines', JSON.stringify(medicines));
        localStorage.setItem('farmaHoraDate', today);
    } catch (e) {
        medicines = [...initialMedicines];
    }
}

function renderCalendarStrip() {
    const strip = document.getElementById('calendar-strip');
    if (!strip) return;

    const now = new Date();
    // Exibe a semana de segunda a domingo contendo a data atual.
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const mondayOffset = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - mondayOffset);

    const dayNames = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
    strip.innerHTML = Array.from({ length: 7 }, (_, i) => {
        const date = new Date(monday);
        date.setDate(monday.getDate() + i);
        const isToday = date.toDateString() === today.toDateString();
        const isPast = date < today;
        const cls = isToday ? 'day-chip active' : 'day-chip';
        const dot = isToday ? '<i class="dot active-dot"></i>' : (isPast ? '<i class="dot done"></i>' : '<i class="dot"></i>');
        return `<div class="${cls}" title="${date.toLocaleDateString('pt-BR')}"><span>${dayNames[i]}</span><strong>${date.getDate()}</strong>${dot}</div>`;
    }).join('');
}

// INICIALIZAÇÃO DO SISTEMA
document.addEventListener('DOMContentLoaded', () => {
    loadMedicineState();
    updateClock();
    renderCalendarStrip();
    updateCountdown();
    setInterval(updateClock, 1000);
    setInterval(updateCountdown, 1000);

    renderMedicinesGrid();
    renderTimelineAgenda();
    updateDashboard();

    // Qualquer primeira interação desbloqueia o áudio dos alarmes no navegador.
    const unlockOnce = () => {
        unlockAlarmAudio();
        document.removeEventListener('pointerdown', unlockOnce);
        document.removeEventListener('keydown', unlockOnce);
    };
    document.addEventListener('pointerdown', unlockOnce, { passive: true });
    document.addEventListener('keydown', unlockOnce);

    // A sineta ativa o áudio e permite testar imediatamente o alarme.
    document.getElementById('btn-alarm-test').addEventListener('click', async () => {
        unlockAlarmAudio();
        if ('Notification' in window && Notification.permission === 'default') {
            try { await Notification.requestPermission(); } catch (e) {}
        }
        triggerAlarmModal(medicines.find(m => m.status === 'pending') || medicines[0], true);
    });
});

// NAVEGAÇÃO ENTRE TELAS SEM RECARREGAR A PÁGINA
function navigateTo(screenId) {
    playBeepSound(600, 'sine', 0.1);

    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }

    // Atualiza estado visual do menu inferior
    document.querySelectorAll('.bottom-nav .nav-item').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeNavBtn = document.getElementById('nav-' + screenId.replace('screen-', ''));
    if (activeNavBtn) {
        activeNavBtn.classList.add('active');
    }

    // Parar câmera caso mude de tela
    if (screenId !== 'screen-camera' && webcamStream) {
        stopWebcam();
    }
}

// ATUALIZAÇÃO DO RELÓGIO EM TEMPO REAL
function updateClock() {
    const now = new Date();
    const hrs = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    const secs = String(now.getSeconds()).padStart(2, '0');

    document.getElementById('current-time-display').textContent = `${hrs}:${mins}:${secs}`;

    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    document.getElementById('current-date-display').textContent = days[now.getDay()];
    renderCalendarStrip();

    // Checagem automática: não depende de acertar exatamente o segundo 00.
    // O mesmo alarme só dispara uma vez por medicamento em cada minuto.
    const timeFormatted = `${hrs}:${mins}`;
    const alarmKey = `${getLocalDateKey(now)}-${timeFormatted}`;
    if (lastAlarmKey !== alarmKey) {
        const dueMed = medicines.find(m => m.time === timeFormatted && m.status === 'pending');
        if (dueMed) {
            lastAlarmKey = alarmKey;
            triggerAlarmModal(dueMed);
        }
    }
}

// CONTAGEM REGRESSIVA E SELEÇÃO DO PRÓXIMO MEDICAMENTO
function getNextOccurrence(med, now = new Date()) {
    const [hours, minutes] = med.time.split(':').map(Number);
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target < now) target.setDate(target.getDate() + 1);
    return target;
}

function getPendingMedicinesSorted(now = new Date()) {
    return medicines
        .filter(m => m.status === 'pending')
        .slice()
        .sort((a, b) => getNextOccurrence(a, now) - getNextOccurrence(b, now));
}

function updateCountdown() {
    const now = new Date();
    const pendingMeds = getPendingMedicinesSorted(now);

    if (pendingMeds.length === 0) {
        currentHeroMed = null;
        document.getElementById('hero-med-name').textContent = 'TUDO TOMADO!';
        document.getElementById('hero-med-dose').textContent = 'Parabéns, Sr. Antenor';
        document.getElementById('hero-med-time').textContent = '--:--';
        document.getElementById('hero-countdown').textContent = 'Sem pendências';
        document.getElementById('hero-progress-fill').style.width = '100%';
        document.getElementById('hero-progress-text').textContent = '100% dos remédios tomados hoje!';
        return;
    }

    currentHeroMed = pendingMeds[0];
    const targetDate = getNextOccurrence(currentHeroMed, now);
    const diffMs = Math.max(0, targetDate - now);
    const totalMinutes = Math.floor(diffMs / 60000);
    const diffHrs = Math.floor(totalMinutes / 60);
    const diffMins = totalMinutes % 60;

    document.getElementById('hero-med-name').textContent = currentHeroMed.name.toUpperCase();
    document.getElementById('hero-med-dose').textContent = currentHeroMed.dosage;
    document.getElementById('hero-med-time').textContent = currentHeroMed.time;
    document.getElementById('hero-med-icon').textContent = currentHeroMed.icon;
    document.getElementById('hero-countdown').textContent = diffHrs > 0 ? `Faltam ${diffHrs}h ${diffMins}m` : `Faltam ${diffMins} min`;

    const totalDayMins = 24 * 60;
    const remainingMins = totalMinutes;
    const pct = Math.max(10, Math.min(100, Math.round(((totalDayMins - remainingMins) / totalDayMins) * 100)));
    document.getElementById('hero-progress-fill').style.width = `${pct}%`;
    document.getElementById('hero-progress-text').textContent = `${pct}% do progresso diário concluído`;
}

// MARCAR PRÓXIMO REMÉDIO COMO TOMADO NO HERO
function markHeroAsTaken() {
    if (!currentHeroMed) return;

    playBeepSound(1200, 'sine', 0.4);

    const medIndex = medicines.findIndex(m => m.id === currentHeroMed.id);
    if (medIndex !== -1) {
        medicines[medIndex].status = 'taken';
        saveMedicineState();
    }

    speakText(`Muito bem, Senhor Antenor! Remédio ${currentHeroMed.name} registrado como tomado.`);

    // Efeito de feedback no card principal
    const heroCard = document.getElementById('hero-card-container');
    heroCard.style.transform = 'scale(0.98)';
    setTimeout(() => heroCard.style.transform = 'none', 200);

    renderMedicinesGrid();
    renderTimelineAgenda();
    updateDashboard();
    updateCountdown();
}

// RENDERIZAR GRID DE MEDICAMENTOS
function renderMedicinesGrid() {
    const gridHome = document.getElementById('meds-grid-container');
    const gridFull = document.getElementById('full-meds-grid');

    if (!gridHome) return;

    const orderedMedicines = medicines.slice().sort((a, b) => a.time.localeCompare(b.time));
    const htmlCards = orderedMedicines.map(med => {
        let statusClass = 'status-pending-bg';
        let statusText = '⏳ PENDENTE';

        if (med.status === 'taken') {
            statusClass = 'status-taken-bg';
            statusText = '✓ TOMADO';
        } else if (med.status === 'late') {
            statusClass = 'status-late-bg';
            statusText = '⚠️ ATRASADO';
        }

        const isNext = (currentHeroMed && currentHeroMed.id === med.id);

        return `
            <div class="med-card ${isNext ? 'status-next' : ''} ${med.status === 'taken' ? 'status-taken' : ''}" data-med-id="${med.id}">
                ${isNext ? '<div class="med-card-top-tag">PRÓXIMO</div>' : ''}
                <div class="med-card-icon">${med.icon}</div>
                <div class="med-card-name">${med.name}</div>
                <div class="med-card-dose">${med.dosage}</div>
                <div class="med-card-time">
                    <span>⏰</span> ${med.time}
                </div>
                <div class="med-status-badge ${statusClass}">
                    ${statusText}
                </div>
            </div>
        `;
    }).join('');

    gridHome.innerHTML = htmlCards;
    if (gridFull) gridFull.innerHTML = htmlCards;
}

// RENDERIZAR AGENDA / TIMELINE
function renderTimelineAgenda() {
    const timeline = document.getElementById('agenda-timeline');
    if (!timeline) return;

    const orderedMedicines = medicines.slice().sort((a, b) => a.time.localeCompare(b.time));
    timeline.innerHTML = orderedMedicines.map(med => `
        <div class="action-card" style="margin-bottom:12px;">
            <div class="action-icon bg-green-light" style="font-size:28px;">
                ${med.icon}
            </div>
            <div class="action-text">
                <h3>${med.time} — ${med.name}</h3>
                <p>Dosagem: ${med.dosage} (${med.pillType})</p>
            </div>
            <span class="med-status-badge ${med.status === 'taken' ? 'status-taken-bg' : 'status-pending-bg'}" style="width:auto; padding:6px 12px;">
                ${med.status === 'taken' ? '✓ OK' : 'PENDENTE'}
            </span>
        </div>
    `).join('');
}

// ATUALIZAR DASHBOARD DE ESTATÍSTICAS
function updateDashboard() {
    const takenCount = medicines.filter(m => m.status === 'taken').length;
    const total = medicines.length;
    const pct = Math.round((takenCount / total) * 100);

    document.getElementById('stat-taken-count').textContent = `${takenCount} / ${total}`;
    document.getElementById('stat-adherence-pct').textContent = `${pct}%`;

    const donut = document.getElementById('adherence-donut');
    if (donut) {
        donut.style.background = `conic-gradient(var(--accent-orange) 0% ${pct}%, #E2E8F0 ${pct}% 100%)`;
    }

    const textSub = document.getElementById('stat-adherence-text');
    if (pct === 100) textSub.textContent = "Excelente!";
    else if (pct >= 50) textSub.textContent = "Muito bom!";
    else textSub.textContent = "Atenção!";
}

// FILTRO DE BUSCA DE MEDICAMENTOS
function filterMedicines() {
    const term = document.getElementById('med-search-input').value.trim().toLowerCase();
    const cards = document.querySelectorAll('#meds-grid-container .med-card');

    cards.forEach(card => {
        const med = medicines.find(m => m.id === card.dataset.medId);
        const medName = med ? med.name.toLowerCase() : '';
        card.style.display = medName.includes(term) ? 'flex' : 'none';
    });
}

// DISPARO DO ALARME DE MEDICAMENTO
function triggerAlarmModal(med, isTest = false) {
    if (!med) return;
    currentHeroMed = med;

    const modal = document.getElementById('alarm-modal');
    document.getElementById('modal-med-name').textContent = med.name;
    document.getElementById('modal-med-dose').textContent = med.dosage;
    document.getElementById('modal-med-time').textContent = med.time;
    document.getElementById('modal-med-icon').textContent = med.icon;

    modal.classList.add('active');
    document.body.classList.add('alarm-ringing');

    // Alerta visual + vibração quando disponível.
    if (navigator.vibrate) {
        navigator.vibrate([500, 200, 500, 200, 800, 300, 800]);
    }

    // Toca várias sequências para ficar impossível confundir com um clique comum.
    unlockAlarmAudio();
    playAlarmSequence();

    const mensagem = isTest
        ? `Teste de alarme. O remédio selecionado é ${med.name}.`
        : `Senhor Antenor, está na hora do seu remédio ${med.name}.`;
    speakText(mensagem);

    // Notificação do sistema se o usuário tiver autorizado.
    if (!isTest && 'Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('FARMA HORA — Hora do remédio', {
                body: `${med.name} ${med.dosage} — horário ${med.time}.`,
                tag: `farma-hora-${med.id}`,
                requireInteraction: true
            });
        } catch (e) {}
    }
}

function playAlarmSequence() {
    const notes = [900, 1100, 900, 1200, 900, 1100];
    notes.forEach((freq, i) => {
        setTimeout(() => playBeepSound(freq, 'square', 0.35), i * 450);
    });
}

function stopAlarmFeedback() {
    document.body.classList.remove('alarm-ringing');
    if (navigator.vibrate) navigator.vibrate(0);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

function takeFromModal() {
    // Este botão NÃO abre a câmera. O usuário pode confirmar apenas pelo alarme.
    stopAlarmFeedback();
    document.getElementById('alarm-modal').classList.remove('active');
    markHeroAsTaken();
}


function verifyFromModal() {
    stopAlarmFeedback();
    document.getElementById('alarm-modal').classList.remove('active');
    openCameraScreen();
}

// PORTAL DE AJUDA COM RECONHECIMENTO DE VOZ (SpeechRecognition API)
function startVoiceRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        speakText("O seu navegador não suporta reconhecimento de voz direto. Use os botões abaixo.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    const statusTxt = document.getElementById('voice-status-text');
    statusTxt.textContent = "🎙️ Ouvindo agora... PODE FALAR!";
    statusTxt.style.color = "#F47C20";
    statusTxt.style.fontWeight = "bold";

    speakText("Pode falar, estou te ouvindo.");

    recognition.start();

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript.toLowerCase();
        statusTxt.textContent = `Você falou: "${transcript}"`;
        statusTxt.style.color = "#0F7A3B";

        processVoiceQuery(transcript);
    };

    recognition.onerror = () => {
        statusTxt.textContent = "Não consegui te ouvir direito. Clique novamente para falar.";
        speakText("Não consegui te ouvir. Por favor, tente clicar no botão de novo.");
    };
}

// PROCESSADOR DE PERGUNTAS POR VOZ
function processVoiceQuery(query) {
    if (query.includes('remedio') || query.includes('remédio') || query.includes('agora') || query.includes('tomo')) {
        if (currentHeroMed) {
            speakText(`Senhor Antenor, o seu remédio agora é ${currentHeroMed.name}, dosagem de ${currentHeroMed.dosage}, às ${currentHeroMed.time}.`);
        } else {
            speakText("O senhor já tomou todos os remédios agendados para hoje. Parabéns!");
        }
    } else if (query.includes('hora') || query.includes('horas')) {
        const now = new Date();
        speakText(`Agora são ${now.getHours()} horas e ${now.getMinutes()} minutos.`);
    } else if (query.includes('próximo') || query.includes('proximo')) {
        if (currentHeroMed) {
            speakText(`O próximo remédio é ${currentHeroMed.name} às ${currentHeroMed.time}.`);
        } else {
            speakText("Não há próximos remédios pendentes hoje.");
        }
    } else {
        speakText("Entendi. Para ver seus remédios, olhe a tela principal do seu aplicativo.");
    }
}

// ABRIR TELA + CÂMERA A PARTIR DE UM CLIQUE DO USUÁRIO
function openCameraScreen() {
    navigateTo('screen-camera');
    initCamera();
}

// INTEGRAÇÃO COM A CÂMERA DO DISPOSITIVO
async function initCamera() {
    const video = document.getElementById('webcam-video');
    const placeholder = document.getElementById('camera-placeholder');
    const btnStart = document.getElementById('btn-start-camera');
    const btnConfirm = document.getElementById('btn-confirm-photo');
    const fileInput = document.getElementById('camera-file-input');

    updateCameraMedication();

    if (!video || !placeholder || !btnStart || !btnConfirm) return;

    // Se a câmera ao vivo não estiver disponível (por exemplo, arquivo aberto
    // via file://), usa o seletor de imagem/câmera como fallback.
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        if (fileInput) fileInput.click();
        else speakText('Não foi possível abrir a câmera neste navegador.');
        return;
    }

    try {
        stopWebcam();
        webcamStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });

        video.srcObject = webcamStream;
        video.removeAttribute('src');
        video.controls = false;
        video.style.display = 'block';
        placeholder.style.display = 'none';
        btnStart.style.display = 'none';
        btnConfirm.style.display = 'flex';
        speakText('Câmera aberta. Posicione o medicamento.');
    } catch (err) {
        console.warn('Câmera ao vivo indisponível:', err);
        if (fileInput) {
            speakText('Não consegui abrir a câmera ao vivo. Você pode tirar ou selecionar uma foto.');
            fileInput.click();
        } else {
            speakText('Não foi possível abrir a câmera.');
        }
    }
}

function updateCameraMedication() {
    if (!currentHeroMed) {
        const next = getPendingMedicinesSorted()[0];
        if (next) currentHeroMed = next;
    }
    if (!currentHeroMed) return;

    document.getElementById('cam-med-name').textContent = currentHeroMed.name.toUpperCase();
    document.getElementById('cam-med-dose').textContent = `${currentHeroMed.dosage} — ${currentHeroMed.pillType}`;
    document.getElementById('cam-med-time').textContent = `⏰ ${currentHeroMed.time}`;
    document.getElementById('cam-med-icon').textContent = currentHeroMed.icon;
}

function handleCameraFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const video = document.getElementById('webcam-video');
    const placeholder = document.getElementById('camera-placeholder');
    const btnStart = document.getElementById('btn-start-camera');
    const btnConfirm = document.getElementById('btn-confirm-photo');

    if (video.dataset.objectUrl) URL.revokeObjectURL(video.dataset.objectUrl);
    const url = URL.createObjectURL(file);
    video.dataset.objectUrl = url;
    video.srcObject = null;
    video.src = url;
    video.controls = false;
    video.style.display = 'block';
    placeholder.style.display = 'none';
    btnStart.style.display = 'none';
    btnConfirm.style.display = 'flex';
    updateCameraMedication();
    speakText('Foto carregada. Se estiver correta, toque em confirmar e tomar remédio.');
}

function stopWebcam() {
    if (webcamStream) {
        webcamStream.getTracks().forEach(track => track.stop());
        webcamStream = null;
    }
}

function confirmCameraTake() {
    stopWebcam();
    const video = document.getElementById('webcam-video');
    if (video.dataset.objectUrl) {
        URL.revokeObjectURL(video.dataset.objectUrl);
        delete video.dataset.objectUrl;
    }
    video.removeAttribute('src');
    video.load();
    video.style.display = 'none';
    document.getElementById('camera-placeholder').style.display = 'flex';
    document.getElementById('btn-start-camera').style.display = 'flex';
    document.getElementById('btn-confirm-photo').style.display = 'none';
    document.getElementById('camera-file-input').value = '';

    playBeepSound(1000, 'sine', 0.5);
    if (currentHeroMed) {
        speakText(`Foto confirmada. ${currentHeroMed.name} registrado como tomado.`);
        markHeroAsTaken();
    }
    navigateTo('screen-inicio');
}

// ADICIONAR MEDICAMENTO
function openAddMedicineModal() {
    const modal = document.getElementById('add-medicine-modal');
    modal.classList.add('active');
    setTimeout(() => document.getElementById('new-med-name').focus(), 50);
}

function closeAddMedicineModal() {
    document.getElementById('add-medicine-modal').classList.remove('active');
}

function addMedicine(event) {
    event.preventDefault();

    const name = document.getElementById('new-med-name').value.trim();
    const dosage = document.getElementById('new-med-dose').value.trim();
    const time = document.getElementById('new-med-time').value;
    const pillType = document.getElementById('new-med-type').value;
    const icon = document.getElementById('new-med-icon').value;

    if (!name || !dosage || !time) return;

    medicines.push({
        id: `${name.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}`,
        name, dosage, time, status: 'pending', icon, pillType
    });

    saveMedicineState();
    renderMedicinesGrid();
    renderTimelineAgenda();
    updateDashboard();
    updateCountdown();
    closeAddMedicineModal();
    document.getElementById('add-medicine-form').reset();
    speakText(`${name} foi adicionado à sua agenda às ${time}.`);
}
