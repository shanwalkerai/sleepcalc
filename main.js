import Chart from 'chart.js/auto'; // Import Chart.js
import flatpickr from "flatpickr"; // Import flatpickr

// --- Global Config Variable ---
let config = {}; // Will be populated by fetchConfig

// --- DOM Elements ---
// Use functions to get elements to ensure they exist when needed
const getElement = (id) => document.getElementById(id);
const querySelector = (selector) => document.querySelector(selector);
const querySelectorAll = (selector) => document.querySelectorAll(selector);

// --- Constants (Defaults, will be updated from config) ---
let FALL_ASLEEP_TIME_MINUTES = 15;
let SLEEP_CYCLE_MINUTES = 90;
let NUM_CYCLES_SUGGESTIONS = 6;
let MIN_CYCLES = 3;

// --- Chart Instance ---
let remChartInstance = null;

// --- Utility Functions ---

function formatTime(totalMinutes) {
  const hours24 = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const ampm = hours24 < 12 ? 'AM' : 'PM';
  return `${String(hours12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function parseFormattedTime(timeString) {
    if (!timeString || typeof timeString !== 'string') return null;
    // Adjusted regex to be more flexible with h:mm vs hh:mm
    const match = timeString.match(/(\d{1,2}):(\d{2})\s(AM|PM)/i);
    if (match) {
        return {
            hour: match[1],
            minute: match[2],
            ampm: match[3].toUpperCase()
        };
    }
    console.warn("Could not parse time string:", timeString); // Add warning
    return null;
}

/**
 * Converts time string from Flatpickr input (e.g., "9:30 AM") to total minutes from midnight.
 * @param {string} timeStr - The time string from the Flatpickr input.
 * @returns {number | null} Total minutes from midnight or null if invalid.
 */
function timeInputToMinutes(timeStr) {
    const parsed = parseFormattedTime(timeStr);
    if (!parsed) return null;
    let hour = parseInt(parsed.hour, 10);
    const minute = parseInt(parsed.minute, 10);
    const ampm = parsed.ampm;

    if (isNaN(hour) || isNaN(minute)) return null; // Check parsing result

    if (ampm === 'PM' && hour !== 12) hour += 12;
    else if (ampm === 'AM' && hour === 12) hour = 0; // Midnight case
    return hour * 60 + minute;
}

// --- Theme Toggle ---
function toggleTheme() {
  const themeToggle = getElement('theme-toggle'); // Get element when needed
  if (!themeToggle) return;
  document.body.classList.toggle('dark-mode');
  document.body.classList.toggle('light-mode');
  const isDarkMode = document.body.classList.contains('dark-mode');
  themeToggle.textContent = isDarkMode ? '☀️' : '🌙';
  localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
  if (remChartInstance) {
      updateChartColors(remChartInstance, isDarkMode);
      remChartInstance.update();
  }
}

function applyInitialTheme() {
  const themeToggle = getElement('theme-toggle'); // Get element when needed
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
    if (themeToggle) themeToggle.textContent = '☀️';
  } else {
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode');
    if (themeToggle) themeToggle.textContent = '🌙';
  }
}

// --- Tab Switching ---
function handleTabClick(event) {
  const clickedTab = event.target;
  if (!clickedTab || !clickedTab.classList.contains('tab-button')) return;

  const targetTab = clickedTab.dataset.tab;
  if (!targetTab) return;

  const targetFormId = targetTab === 'wake-up' ? 'wake-up-form' : 'go-to-bed-form';
  const tabButtons = querySelectorAll('#sleep-cycle-calculator .tab-button'); // Scope to calculator section
  const calculatorForms = querySelectorAll('#sleep-cycle-calculator .calculator-form'); // Scope to calculator section
  const wakeUpResultsDiv = getElement('wake-up-results');
  const goToBedResultsDiv = getElement('go-to-bed-results');


  tabButtons.forEach(button => button.classList.remove('active'));
  clickedTab.classList.add('active');

  calculatorForms.forEach(form => {
    if (form.id === targetFormId) {
      form.classList.add('active-form');
    } else {
      form.classList.remove('active-form');
    }
  });

  if (wakeUpResultsDiv) wakeUpResultsDiv.style.display = 'none';
  if (goToBedResultsDiv) goToBedResultsDiv.style.display = 'none';
}

// --- Sleep Cycle Calculations ---

function calculateBedtimes(wakeUpTimeMinutes) {
  const bedtimes = [];
  for (let i = NUM_CYCLES_SUGGESTIONS; i >= MIN_CYCLES; i--) {
    const totalSleepNeeded = i * SLEEP_CYCLE_MINUTES;
    let bedtimeMinutes = wakeUpTimeMinutes - totalSleepNeeded - FALL_ASLEEP_TIME_MINUTES;
    bedtimeMinutes = (bedtimeMinutes + 24 * 60) % (24 * 60);
    bedtimes.push({ time: formatTime(bedtimeMinutes), cycles: i });
  }
  return bedtimes.reverse();
}

function calculateWakeUpTimes(bedTimeMinutes) {
  const wakeUpTimes = [];
  const fallAsleepTimeMinutes = (bedTimeMinutes + FALL_ASLEEP_TIME_MINUTES) % (24 * 60);
  for (let i = MIN_CYCLES; i <= NUM_CYCLES_SUGGESTIONS; i++) {
    const totalSleepDuration = i * SLEEP_CYCLE_MINUTES;
    let wakeUpTime = (fallAsleepTimeMinutes + totalSleepDuration) % (24 * 60);
    wakeUpTimes.push({ time: formatTime(wakeUpTime), cycles: i });
  }
  return wakeUpTimes;
}

// --- REM Cycle Estimation ---

function estimateRemPhases(bedTimeMinutes, totalSleepHours, age) {
    const fallAsleepTimeMinutes = (bedTimeMinutes + FALL_ASLEEP_TIME_MINUTES) % (24 * 60);
    const totalSleepMinutes = totalSleepHours * 60;
    const wakeUpTimeMinutes = (fallAsleepTimeMinutes + totalSleepMinutes) % (24 * 60);
    const phases = [];
    let currentCycleStart = fallAsleepTimeMinutes;
    const numCycles = Math.floor(totalSleepMinutes / SLEEP_CYCLE_MINUTES);

    for (let i = 1; i <= numCycles; i++) {
        const cycleEnd = (currentCycleStart + SLEEP_CYCLE_MINUTES) % (24 * 60);
        const remDurationApprox = 10 + (i * 5);
        const remStartApprox = (cycleEnd - remDurationApprox + 24 * 60) % (24 * 60);
        const remEndApprox = cycleEnd;
        const lightSleepStart = currentCycleStart;
        const lightSleepEnd = (currentCycleStart + 30 + 24*60) % (24 * 60);

        phases.push({
            cycle: i,
            cycleStart: formatTime(currentCycleStart),
            cycleEnd: formatTime(cycleEnd),
            remStart: formatTime(remStartApprox),
            remEnd: formatTime(remEndApprox),
            lightSleepWindow: `${formatTime(lightSleepStart)} - ${formatTime(lightSleepEnd)}`
        });
        currentCycleStart = cycleEnd;
    }
    // Age adjustment placeholder remains simplified
    return { phases, wakeUpTime: formatTime(wakeUpTimeMinutes) };
}

// --- Display Results ---

function displayBedtimes(targetTime, bedtimes) {
  const targetWakeTimeSpan = getElement('target-wake-time');
  const bedtimeOptionsList = getElement('bedtime-options');
  const wakeUpResultsDiv = getElement('wake-up-results');
  const goToBedResultsDiv = getElement('go-to-bed-results');

  if (!targetWakeTimeSpan || !bedtimeOptionsList || !wakeUpResultsDiv) return;
  targetWakeTimeSpan.textContent = targetTime;
  bedtimeOptionsList.innerHTML = '';
  bedtimes.forEach(bedtime => {
    const timeParts = parseFormattedTime(bedtime.time);
    if (!timeParts) return;
    const li = document.createElement('li');
    li.classList.add('time-result-item');
    li.innerHTML = `
      <span class="time-part hour">${timeParts.hour}</span><span class="time-separator">:</span><span class="time-part minute">${timeParts.minute}</span>
      <span class="time-part ampm">${timeParts.ampm}</span>
      <span class="cycle-count">(${bedtime.cycles} cycles)</span>`;
    bedtimeOptionsList.appendChild(li);
  });
  wakeUpResultsDiv.style.display = 'block';
  if (goToBedResultsDiv) goToBedResultsDiv.style.display = 'none';
}

function displayWakeUpTimes(targetTime, wakeUpTimes) {
  const targetBedTimeSpan = getElement('target-bed-time');
  const wakeupOptionsList = getElement('wakeup-options');
  const goToBedResultsDiv = getElement('go-to-bed-results');
  const wakeUpResultsDiv = getElement('wake-up-results');

  if (!targetBedTimeSpan || !wakeupOptionsList || !goToBedResultsDiv) return;
  targetBedTimeSpan.textContent = targetTime;
  wakeupOptionsList.innerHTML = '';
  wakeUpTimes.forEach(wakeUp => {
     const timeParts = parseFormattedTime(wakeUp.time);
     if (!timeParts) return;
     const li = document.createElement('li');
     li.classList.add('time-result-item');
     li.innerHTML = `
       <span class="time-part hour">${timeParts.hour}</span><span class="time-separator">:</span><span class="time-part minute">${timeParts.minute}</span>
       <span class="time-part ampm">${timeParts.ampm}</span>
       <span class="cycle-count">(${wakeUp.cycles} cycles)</span>`;
    wakeupOptionsList.appendChild(li);
  });
  goToBedResultsDiv.style.display = 'block';
  if (wakeUpResultsDiv) wakeUpResultsDiv.style.display = 'none';
}

function displayRemResults(remData) {
    const remPhaseList = getElement('rem-phase-list');
    const remResultsDiv = getElement('rem-results');
    if (!remPhaseList || !remResultsDiv) return;

    remPhaseList.innerHTML = '';
    if (!remData || !remData.phases || remData.phases.length === 0) {
        const li = document.createElement('li');
        li.textContent = "Could not estimate phases. Ensure total sleep duration allows for at least one full cycle.";
        li.style.fontStyle = 'italic';
        remPhaseList.appendChild(li);
        remResultsDiv.style.display = 'block';
        renderRemChart(null);
        return;
    }

    remData.phases.forEach(phase => {
        const li = document.createElement('li');
        li.classList.add('rem-result-item');
        li.innerHTML = `<strong>Cycle ${phase.cycle}:</strong> ${phase.cycleStart} - ${phase.cycleEnd} <br>
                        &nbsp;&nbsp;<em>Est. REM:</em> ${phase.remStart} - ${phase.remEnd} <br>
                        &nbsp;&nbsp;<em>Light Sleep Window:</em> ${phase.lightSleepWindow}`;
        remPhaseList.appendChild(li);
    });

     const wakeLi = document.createElement('li');
     wakeLi.classList.add('rem-result-item', 'final-wake');
     wakeLi.innerHTML = `<strong>Final Wake Up:</strong> ${remData.wakeUpTime}`;
     remPhaseList.appendChild(wakeLi);

    remResultsDiv.style.display = 'block';
    renderRemChart(remData);
}

// --- Chart.js Integration ---

function getChartColors(isDarkMode) {
    // Color definitions remain the same
    return {
        background: isDarkMode ? 'rgba(90, 85, 226, 0.2)' : 'rgba(106, 130, 251, 0.2)',
        border: isDarkMode ? '#5a55e2' : '#6a82fb',
        grid: isDarkMode ? 'rgba(224, 224, 224, 0.2)' : 'rgba(51, 51, 51, 0.1)',
        ticks: isDarkMode ? '#e0e0e0' : '#333',
        pointBg: isDarkMode ? '#fbc2eb' : '#ffafbd',
        deepSleep: isDarkMode ? 'rgba(59, 55, 160, 0.7)' : 'rgba(50, 70, 180, 0.7)',
        lightSleep: isDarkMode ? 'rgba(90, 85, 226, 0.5)' : 'rgba(106, 130, 251, 0.5)',
        remSleep: isDarkMode ? 'rgba(251, 194, 235, 0.7)' : 'rgba(255, 175, 189, 0.7)',
        awake: isDarkMode ? 'rgba(200, 200, 200, 0.5)' : 'rgba(150, 150, 150, 0.5)',
    };
}

function updateChartColors(chart, isDarkMode) {
    if (!chart) return;
    const colors = getChartColors(isDarkMode);
    if (chart.data.datasets && chart.data.datasets.length > 0) {
        chart.data.datasets[0].backgroundColor = colors.background;
        chart.data.datasets[0].borderColor = colors.border;
        chart.data.datasets[0].pointBackgroundColor = colors.pointBg;
        // Note: Segment colors might need specific update logic if used dynamically
    }
    if (chart.options.scales) {
        if (chart.options.scales.x) {
            chart.options.scales.x.grid.color = colors.grid;
            chart.options.scales.x.ticks.color = colors.ticks;
        }
        if (chart.options.scales.y) {
            chart.options.scales.y.grid.color = colors.grid;
            chart.options.scales.y.ticks.color = colors.ticks;
        }
    }
}

function renderRemChart(remData) {
    const remChartCanvas = getElement('rem-chart'); // Get element when needed
    if (!remChartCanvas) return;
    const ctx = remChartCanvas.getContext('2d');
    const isDarkMode = document.body.classList.contains('dark-mode');
    const colors = getChartColors(isDarkMode);
    const chartContainer = remChartCanvas.closest('.chart-container');

    if (remChartInstance) {
        remChartInstance.destroy();
        remChartInstance = null;
    }

    if (!remData || !remData.phases || remData.phases.length === 0) {
        remChartCanvas.style.display = 'none';
        if (chartContainer) chartContainer.style.display = 'none';
        return;
    }

    remChartCanvas.style.display = 'block';
    if (chartContainer) chartContainer.style.display = 'block';

    const labels = [];
    const sleepStageData = [];
    const addPoint = (timeStr, stage) => {
        if (timeStr && typeof timeStr === 'string' && timeStr.includes(':')) {
             labels.push(timeStr);
             sleepStageData.push(stage);
        } else {
            console.warn("Skipping invalid time string for chart:", timeStr);
        }
    };

    if (remData.phases.length > 0 && remData.phases[0].cycleStart) {
        addPoint(remData.phases[0].cycleStart, 2); // Start Light
    }

    remData.phases.forEach((phase, index) => {
        const cycleStartMinutes = timeInputToMinutes(phase.cycleStart); // Use correct function
        let cycleMidPointApproxTime = null;
        if (cycleStartMinutes !== null) {
             cycleMidPointApproxTime = formatTime(cycleStartMinutes + Math.round(SLEEP_CYCLE_MINUTES / 3));
        }

        if (cycleMidPointApproxTime) {
            addPoint(cycleMidPointApproxTime, index < 2 ? 1 : 2); // Deep early, Light later
        }
        addPoint(phase.remStart, 2); // Light before REM
        addPoint(phase.remEnd, 3);   // REM
        addPoint(phase.cycleEnd, 2); // Light after REM
    });

    if (remData.wakeUpTime) {
        addPoint(remData.wakeUpTime, 4); // Awake
    }

    // Chart configuration (simplified segment logic for clarity)
    remChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: config?.remCalculator?.chartLabel || 'Estimated Sleep Stage',
                data: sleepStageData,
                fill: true,
                backgroundColor: colors.background,
                borderColor: colors.border,
                borderWidth: 2,
                pointBackgroundColor: colors.pointBg,
                tension: 0.3,
                stepped: false,
                 // Simplified segment logic - apply general colors
                 segment: {
                     borderColor: colors.border, // Use general border color
                     backgroundColor: colors.background, // Use general background color
                 }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    min: 0.5, max: 4.5,
                    ticks: {
                        color: colors.ticks, stepSize: 1,
                        callback: (value) => {
                            switch(Math.round(value)) {
                                case 1: return 'Deep'; case 2: return 'Light';
                                case 3: return 'REM'; case 4: return 'Awake';
                                default: return '';
                            }
                        }
                    },
                    grid: { color: colors.grid }
                },
                x: {
                    ticks: { color: colors.ticks, maxRotation: 45, minRotation: 0, autoSkip: true, maxTicksLimit: 8 },
                    grid: { color: colors.grid }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (tooltipItems) => tooltipItems[0].label,
                        label: (context) => {
                            const stageValue = context.parsed.y;
                            let stageName = 'Unknown';
                            switch(Math.round(stageValue)) {
                                case 1: stageName = 'Deep Sleep'; break; case 2: stageName = 'Light Sleep'; break;
                                case 3: stageName = 'REM Sleep'; break; case 4: stageName = 'Awake'; break;
                            }
                            return `Stage: ${stageName}`;
                        }
                    }
                }
            },
            interaction: { intersect: false, mode: 'index' },
        }
    });
}

// --- Event Listeners ---

function addEventListeners() {
    const themeToggle = getElement('theme-toggle');
    const tabsContainer = querySelector('#sleep-cycle-calculator .tabs'); // Scope to calculator section
    const wakeUpForm = getElement('wake-up-form');
    const goToBedForm = getElement('go-to-bed-form');
    const remForm = getElement('rem-form');
    const mainNav = querySelector('.main-nav'); // Get the main navigation container

    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    if (tabsContainer) tabsContainer.addEventListener('click', handleTabClick);

    // Add listener to the navigation container
    if (mainNav) {
        mainNav.addEventListener('click', (e) => {
            // Check if the clicked element is an anchor tag within the nav
            if (e.target.tagName === 'A' && e.target.closest('.main-nav')) {
                const href = e.target.getAttribute('href');
                console.log(`Nav link clicked: ${href}`); // Log click

                // Check if it's an internal link (starts with /) and not just '#'
                if (href && href.startsWith('/') && href !== '#') {
                    // Let's try *not* preventing default first, just log
                    console.log('Allowing default navigation for:', href);
                } else if (href === '#') {
                     e.preventDefault(); // Prevent jumping for '#' links if any
                     console.log('Ignoring # link click.');
                }
            }
        });
    }

    if (wakeUpForm) wakeUpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const wakeUpTimeInput = getElement('wake-up-time-input');
      if (!wakeUpTimeInput || !wakeUpTimeInput.value) {
          alert("Please select a wake-up time.");
          return;
      }
      const wakeUpTimeMinutes = timeInputToMinutes(wakeUpTimeInput.value);
      if (wakeUpTimeMinutes === null) {
          alert("Invalid wake-up time selected.");
          return;
      }
      const targetTime = wakeUpTimeInput.value; // Use the formatted string directly
      const bedtimes = calculateBedtimes(wakeUpTimeMinutes);
      displayBedtimes(targetTime, bedtimes);
    });

    if (goToBedForm) goToBedForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const bedTimeInput = getElement('bed-time-input');
       if (!bedTimeInput || !bedTimeInput.value) {
           alert("Please select a bedtime.");
           return;
       }
      const bedTimeMinutes = timeInputToMinutes(bedTimeInput.value);
       if (bedTimeMinutes === null) {
           alert("Invalid bedtime selected.");
           return;
       }
      const targetTime = bedTimeInput.value; // Use the formatted string directly
      const wakeUpTimes = calculateWakeUpTimes(bedTimeMinutes);
      displayWakeUpTimes(targetTime, wakeUpTimes);
    });

    if (remForm) remForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const remBedTimeInput = getElement('rem-bed-time-input');
        if (!remBedTimeInput || !remBedTimeInput.value) {
            alert("Please select a bedtime for REM calculation.");
            return;
        }
        const bedTimeMinutes = timeInputToMinutes(remBedTimeInput.value);
        if (bedTimeMinutes === null) {
            alert("Invalid bedtime selected for REM calculation.");
            return;
        }

        const totalSleepHoursInput = getElement('total-sleep-hours');
        const totalSleepHours = parseFloat(totalSleepHoursInput.value);
        const ageInput = getElement('user-age');
        const age = ageInput?.value ? parseInt(ageInput.value, 10) : null;

        if (isNaN(totalSleepHours) || totalSleepHours <= 0 || totalSleepHours > 24) {
            alert(config?.remCalculator?.invalidDurationMessage || "Please enter a valid number of sleep hours (e.g., 1-16).");
            if (totalSleepHoursInput) {
                totalSleepHoursInput.focus();
                totalSleepHoursInput.select();
            }
            const remPhaseList = getElement('rem-phase-list');
            const remResultsDiv = getElement('rem-results');
            if(remPhaseList) remPhaseList.innerHTML = '<li>Invalid input for sleep duration.</li>';
            if(remResultsDiv) remResultsDiv.style.display = 'block';
            renderRemChart(null);
            return;
        }
        const remData = estimateRemPhases(bedTimeMinutes, totalSleepHours, age);
        displayRemResults(remData);
    });
}

// --- Update UI with Config ---
function updateUIFromConfig() {
    if (!config) {
        console.warn("Config not loaded, cannot update UI.");
        return;
    }

    // Helper to safely set text content
    const setText = (selector, text) => {
        const element = querySelector(selector);
        if (element) element.textContent = text || ''; // Use empty string if text is null/undefined
    };
     // Helper to safely set node value (for text nodes)
    const setNodeText = (selector, nodeIndex, text) => {
        const element = querySelector(selector);
        if (element && element.childNodes[nodeIndex]) {
             element.childNodes[nodeIndex].nodeValue = text || '';
        }
    };
     // Helper to safely set attribute
     const setAttr = (selector, attr, value) => {
        const element = querySelector(selector);
        if (element) element.setAttribute(attr, value || '');
     };
     // Helper to safely set style display
     const setDisplay = (selector, visible) => {
         const element = getElement(selector.substring(1)); // Assumes ID selector
         if (element) element.style.display = visible ? 'block' : 'none';
     };

    // Update text content
    document.title = config.siteTitle || 'Sleep Calculator';
    setAttr('meta[name="description"]', 'content', config.description);
    setText('header h1', config.siteTitle);

    // Sleep Cycle Calculator Section
    if (config.sleepCycleCalculator) {
        setNodeText('#sleep-cycle-calculator h2', 1, ` ${config.sleepCycleCalculator.title}`);
        setText('#sleep-cycle-calculator > p', config.sleepCycleCalculator.description); // Target direct child p
        setText('.tab-button[data-tab="wake-up"]', config.sleepCycleCalculator.wakeUpTab);
        setText('.tab-button[data-tab="go-to-bed"]', config.sleepCycleCalculator.goToBedTab);
        setText('#wake-up-form label', config.sleepCycleCalculator.wakeUpLabel);
        setText('#go-to-bed-form label', config.sleepCycleCalculator.bedTimeLabel);
        setText('#wake-up-form .calculate-button', config.sleepCycleCalculator.calculateBedtimesButton);
        setText('#go-to-bed-form .calculate-button', config.sleepCycleCalculator.calculateWakeUpTimesButton);
        // Safely update result text parts
        const wakeUpP = querySelector('#wake-up-results p:first-of-type');
        if (wakeUpP && wakeUpP.childNodes.length > 1) {
            wakeUpP.childNodes[0].nodeValue = `${config.sleepCycleCalculator.wakeUpResultPrefix || 'If you want to wake up at'} `;
            wakeUpP.childNodes[2].nodeValue = ` ${config.sleepCycleCalculator.wakeUpResultSuffix || ', you should aim to fall asleep at one of these times:'}`;
        }
        const goToBedP = querySelector('#go-to-bed-results p:first-of-type');
         if (goToBedP && goToBedP.childNodes.length > 1) {
            goToBedP.childNodes[0].nodeValue = `${config.sleepCycleCalculator.goToBedResultPrefix || 'If you go to bed at'} `;
            goToBedP.childNodes[2].nodeValue = ` ${config.sleepCycleCalculator.goToBedResultSuffix || ', you should aim to wake up at one of these times for optimal rest:'}`;
        }
        setText('#wake-up-results .note', config.sleepCycleCalculator.fallAsleepNote);
        setText('#go-to-bed-results .note', config.sleepCycleCalculator.wakeUpNote);
    }

    // REM Calculator Section
    if (config.remCalculator) {
        setDisplay('#rem-calculator', config.remCalculator.visible);
        if (config.remCalculator.visible) {
            setNodeText('#rem-calculator h2', 1, ` ${config.remCalculator.title}`);
            setText('#rem-calculator > p', config.remCalculator.description); // Target direct child p
            setText('#rem-form label[for="rem-bed-time-input"]', config.remCalculator.bedTimeLabel); // Update label 'for' attribute
            setText('#rem-form label[for="total-sleep-hours"]', config.remCalculator.sleepDurationLabel);
            setText('#sleep-hours-desc', config.remCalculator.sleepDurationDescription);
            setText('#rem-form label[for="user-age"]', config.remCalculator.ageLabel);
            setText('#age-desc', config.remCalculator.ageDescription);
            setText('#rem-form .calculate-button', config.remCalculator.calculateButton);
            setText('#rem-results p:first-of-type', config.remCalculator.resultsTitle);
        }
    }

    // AI Features Section
    if (config.aiFeatures) {
        setDisplay('#ai-features', config.aiFeatures.visible);
        if (config.aiFeatures.visible) {
            setNodeText('#ai-features h2', 1, ` ${config.aiFeatures.title}`);
            setText('#ai-features > p', config.aiFeatures.description); // Target direct child p
            const placeholders = querySelectorAll('#ai-features .feature-placeholder');
            if (placeholders.length >= 3) {
                setText(placeholders[0].querySelector('h4'), config.aiFeatures.adviceTitle);
                setText(placeholders[0].querySelector('p'), config.aiFeatures.adviceText);
                setText(placeholders[1].querySelector('h4'), config.aiFeatures.scoreTitle);
                setText(placeholders[1].querySelector('p'), config.aiFeatures.scoreText);
                setText(placeholders[2].querySelector('h4'), config.aiFeatures.chatbotTitle);
                setText(placeholders[2].querySelector('p'), config.aiFeatures.chatbotText);
            }
        }
    }

    // Footer
    if (config.footer) {
         const footerP = querySelector('footer p');
         if (footerP && footerP.firstChild) {
             // Update copyright text, keeping the year dynamic
             footerP.innerHTML = `&copy; <span id="current-year">${new Date().getFullYear()}</span> ${config.footer.copyrightText || 'Sleep Calculator. All rights reserved.'}`;
         }
    }

    // Update constants used in calculations
    if (config.sleepCycleCalculator) {
        FALL_ASLEEP_TIME_MINUTES = config.sleepCycleCalculator.fallAsleepTimeMinutes ?? 15;
        SLEEP_CYCLE_MINUTES = config.sleepCycleCalculator.sleepCycleMinutes ?? 90;
        NUM_CYCLES_SUGGESTIONS = config.sleepCycleCalculator.numCycleSuggestions ?? 6;
        MIN_CYCLES = config.sleepCycleCalculator.minCycles ?? 3;
    }
}

// --- Fetch Config ---
async function fetchConfig() {
    try {
        const response = await fetch('/api/config');
        if (!response.ok) {
             // If config.json doesn't exist (404), use an empty object
             if (response.status === 404) {
                 console.log('Config file not found, using default empty object.');
                 config = {};
             } else {
                throw new Error(`HTTP error! status: ${response.status}`);
             }
        } else {
            config = await response.json();
            console.log('Config loaded:', config);
        }
        updateUIFromConfig(); // Update UI first
        addEventListeners(); // Then add listeners
    } catch (error) {
        console.error("Could not fetch config. Using default values.", error);
        config = {}; // Use empty config as default
        updateUIFromConfig(); // Attempt update with defaults
        addEventListeners(); // Add listeners anyway
    }
}

// --- Initialize Flatpickr ---
function initializeFlatpickr() {
    const commonOptions = {
        enableTime: true,
        noCalendar: true,
        dateFormat: "h:i K", // Format: 9:30 AM
        time_24hr: false,
        minuteIncrement: 1,
    };

    flatpickr("#wake-up-time-input", commonOptions);
    flatpickr("#bed-time-input", commonOptions);
    flatpickr("#rem-bed-time-input", commonOptions);
    console.log("Flatpickr initialized.");
}

// --- Set Active Nav Link ---
function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = querySelectorAll('.main-nav a');
    navLinks.forEach(link => {
        link.classList.remove('active'); // Remove active from all first
        // Check if the link's href matches the current path
        // Special case for root path '/'
        if (link.getAttribute('href') === currentPath || (currentPath === '/' && link.getAttribute('href') === '/')) {
            link.classList.add('active');
        }
    });
}


// --- Initialization ---
function init() {
  applyInitialTheme();
  initializeFlatpickr(); // Initialize flatpickr inputs
  const currentYearSpan = getElement('current-year');
  if (currentYearSpan) {
    currentYearSpan.textContent = new Date().getFullYear();
  }

  // Set default active tab/form (ensure elements exist)
  const defaultTab = querySelector('#sleep-cycle-calculator .tab-button[data-tab="wake-up"]');
  if (defaultTab) {
      defaultTab.classList.add('active');
      const defaultFormId = defaultTab.dataset.tab === 'wake-up' ? 'wake-up-form' : 'go-to-bed-form';
      const defaultForm = getElement(defaultFormId);
      if (defaultForm) {
          defaultForm.classList.add('active-form');
      }
  }

  // Hide result sections initially
  const wakeUpResultsDiv = getElement('wake-up-results');
  const goToBedResultsDiv = getElement('go-to-bed-results');
  const remResultsDiv = getElement('rem-results');
  const remChartCanvas = getElement('rem-chart');
  if (wakeUpResultsDiv) wakeUpResultsDiv.style.display = 'none';
  if (goToBedResultsDiv) goToBedResultsDiv.style.display = 'none';
  if (remResultsDiv) remResultsDiv.style.display = 'none';
  if (remChartCanvas) {
      const chartContainer = remChartCanvas.closest('.chart-container');
      if (chartContainer) chartContainer.style.display = 'none';
      remChartCanvas.style.display = 'none';
  }

  setActiveNavLink(); // Set the active nav link based on the current page

  // Fetch config and update UI/add listeners after fetch
  fetchConfig();
}

// --- Run Initialization ---
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
