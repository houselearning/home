// --- Game State Variables ---
let clicks = 0;
let baseClickValue = 1; // New: Can be increased by Milestones
let autoClicksPerSecond = 0;
let snowballs = 0;
let prestigeMultiplier = 1.0;
let totalClicksGained = 0; // For Prestige calculation
let spinSpeed = 5; 

// --- Upgrade Definitions (Easily scalable now!) ---
const upgrades = [
    { id: 1, name: 'Stringy Banner', cost: 10, autoClickIncrease: 0.1, effect: 'stringbanner()' },
    { id: 2, name: 'Steering Wheel', cost: 50, autoClickIncrease: 3, effect: 'steeringwheel()' },
    { id: 3, name: 'Rainbow Clicker', cost: 100, autoClickIncrease: 8, effect: 'activateRainbowCursor()' },
    { id: 4, name: 'Reinforced Steel', cost: 200, autoClickIncrease: 20, effect: 'reinforcedsteel()' },
    { id: 5, name: 'Professional Sledder', cost: 500, autoClickIncrease: 40, effect: 'ProfessionalSledder()' },
    { id: 6, name: 'Tunes', cost: 1000, autoClickIncrease: 80, effect: 'playMusic()' },
    { id: 7, name: 'Hacker', cost: 2000, autoClickIncrease: 100, effect: 'hacker()' },
    { id: 8, name: 'jUsT gImMe MoNeY!', cost: 5000, autoClickIncrease: 120, effect: 'money()' },
    { id: 9, name: 'Santa', cost: 10000, autoClickIncrease: 200, effect: 'santa()' }
];

const milestones = [
    { id: 101, name: 'A Better Grip', cost: 500, clickBonus: 1, bought: false },
    { id: 102, name: 'Aerodynamic Wax', cost: 2500, clickBonus: 2, bought: false },
    { id: 103, name: 'Rocket Thrusters', cost: 10000, clickBonus: 5, bought: false }
];

// Stores the number of times each auto-clicker upgrade has been purchased
let upgradeLevels = Array(upgrades.length).fill(0);

// --- DOM Element References ---
const clicksDisplay = document.getElementById('clicks');
const cpsDisplay = document.getElementById('cps-display');
const shopDiv = document.getElementById('shop');
const milestonesDiv = document.getElementById('milestones');
const sledImg = document.getElementById('sled');
const snowballsDisplay = document.getElementById('snowballs');
const prestigeMultiplierDisplay = document.getElementById('prestige-multiplier');
const prestigeButton = document.getElementById('prestige-button');

// --- Initialization and Load ---
window.onload = function() {
    loadGame();
    renderUpgrades();
    renderMilestones();
    updateDisplays();
    sledImg.addEventListener('click', manualClick);
    setInterval(autoClick, 1000); // Main auto-click loop
    setInterval(saveGame, 5000); // Save every 5 seconds
    setInterval(updateSnowflakes, 10000); // Snowflakes
    updateSpinSpeed(); // Start the spin animation
};

// --- Save/Load System (Local Storage) ---
function saveGame() {
    const gameState = {
        clicks: clicks,
        baseClickValue: baseClickValue,
        autoClicksPerSecond: autoClicksPerSecond,
        snowballs: snowballs,
        prestigeMultiplier: prestigeMultiplier,
        totalClicksGained: totalClicksGained,
        upgradeLevels: upgradeLevels,
        milestones: milestones
    };
    localStorage.setItem('sledClickerGame', JSON.stringify(gameState));
}

function loadGame() {
    const saved = localStorage.getItem('sledClickerGame');
    if (saved) {
        const gameState = JSON.parse(saved);
        clicks = gameState.clicks || 0;
        baseClickValue = gameState.baseClickValue || 1;
        autoClicksPerSecond = gameState.autoClicksPerSecond || 0;
        snowballs = gameState.snowballs || 0;
        prestigeMultiplier = gameState.prestigeMultiplier || 1.0;
        totalClicksGained = gameState.totalClicksGained || 0;
        upgradeLevels = gameState.upgradeLevels || Array(upgrades.length).fill(0);
        // Load milestones state, ensuring new ones are initialized as 'false'
        if (gameState.milestones) {
            milestones.forEach((m, i) => {
                const savedM = gameState.milestones.find(sm => sm.id === m.id);
                if (savedM) {
                    milestones[i].bought = savedM.bought;
                }
            });
        }
        
        // Re-apply upgrade effects (like music, rainbow cursor)
        upgrades.forEach((u, i) => {
            if (upgradeLevels[i] > 0) {
                // Only run the effect once if it's a permanent change
                if (u.effect === 'playMusic()' || u.effect === 'activateRainbowCursor()') {
                    eval(u.effect);
                }
            }
        });
        
        prestigeMultiplier = 1 + snowballs * 0.1; // Recalculate based on loaded snowballs
    }
}

// --- Core Game Functions ---
function manualClick(event) {
    const clickAmount = Math.floor(baseClickValue * prestigeMultiplier);
    clicks += clickAmount;
    totalClicksGained += clickAmount;
    updateDisplays();
    generateParticles(event.clientX, event.clientY);
    
    // Slight spin increase on manual click
    spinSpeed = Math.max(0.5, spinSpeed - 0.01);
    updateSpinSpeed();
}

function autoClick() {
    const autoAmount = autoClicksPerSecond * prestigeMultiplier;
    clicks += autoAmount;
    totalClicksGained += autoAmount;
    updateDisplays();
}

function buyUpgrade(index) {
    const upgrade = upgrades[index];
    const cost = upgrade.cost * Math.pow(1.5, upgradeLevels[index]); // Exponential cost increase

    if (clicks >= cost) {
        clicks -= cost;
        upgradeLevels[index]++;
        autoClicksPerSecond += upgrade.autoClickIncrease;
        
        // Run the visual effect only on the first purchase
        if (upgradeLevels[index] === 1 && upgrade.effect) {
            eval(upgrade.effect); 
        }

        // Slightly faster spin on upgrade purchase
        spinSpeed = Math.max(1, spinSpeed - 0.05);
        updateSpinSpeed();

        updateDisplays();
        renderUpgrades(); // Re-render to show new cost
    } else {
        alert('Not enough Clicks!');
    }
}

function buyMilestone(index) {
    const milestone = milestones[index];
    if (clicks >= milestone.cost && !milestone.bought) {
        clicks -= milestone.cost;
        milestone.bought = true;
        baseClickValue += milestone.clickBonus; // Permanent manual click increase
        alert(`Milestone "${milestone.name}" purchased! Your base click value is now ${baseClickValue}.`);
        updateDisplays();
        renderMilestones(); // Re-render to show as bought
    } else {
        alert('Milestone already purchased or not enough Clicks!');
    }
}

function prestige() {
    const snowballsToGain = Math.floor(Math.sqrt(totalClicksGained / 10000));
    
    if (snowballsToGain >= 1) {
        // Confirm before resetting
        if (!confirm(`Are you sure you want to Prestige? You will reset all Clicks and Auto-Upgrades, but gain ${snowballsToGain} Snowball(s)!`)) {
            return;
        }

        snowballs += snowballsToGain;
        prestigeMultiplier = 1 + snowballs * 0.1; // New multiplier calculation
        
        // Reset everything except Snowballs, Milestones, and Total Clicks
        clicks = 0;
        autoClicksPerSecond = 0;
        upgradeLevels = Array(upgrades.length).fill(0);
        
        // Reset effects that might be running (optional)
        document.body.style.backgroundImage = 'none';
        document.body.style.cursor = 'auto';
        document.getElementById("music").pause(); 

        alert(`PRESTIGE COMPLETE! Your new multiplier is ${prestigeMultiplier.toFixed(2)}x!`);
        updateDisplays();
        renderUpgrades();
    }
}

// --- Display/Rendering Functions ---
function updateDisplays() {
    clicksDisplay.innerText = Math.floor(clicks).toLocaleString();
    cpsDisplay.innerText = (autoClicksPerSecond * prestigeMultiplier).toFixed(1);
    snowballsDisplay.innerText = snowballs;
    prestigeMultiplierDisplay.innerText = prestigeMultiplier.toFixed(2);
    
    // Update Prestige Button State
    const snowballsAvailable = Math.floor(Math.sqrt(totalClicksGained / 10000));
    const nextPrestigeClicks = (snowballs + 1) * (snowballs + 1) * 10000;
    
    if (snowballsAvailable >= 1) {
        prestigeButton.disabled = false;
        prestigeButton.innerText = `PRESTIGE! (+${snowballsAvailable} Snowball(s))`;
    } else {
        prestigeButton.disabled = true;
        prestigeButton.innerText = `Reach ${nextPrestigeClicks.toLocaleString()} Total Clicks for next Snowball`;
    }
    document.getElementById('prestige-info').innerText = `Total Clicks: ${totalClicksGained.toLocaleString()}. Next Snowball at ${nextPrestigeClicks.toLocaleString()}.`;
}

function renderUpgrades() {
    shopDiv.innerHTML = '';
    upgrades.forEach((upgrade, index) => {
        const cost = upgrade.cost * Math.pow(1.5, upgradeLevels[index]);
        const level = upgradeLevels[index];
        
        const button = document.createElement('button');
        button.id = 'upgrade' + upgrade.id;
        button.innerText = `${upgrade.name} (Level ${level}) - Cost: ${Math.floor(cost).toLocaleString()} - Gives: +${upgrade.autoClickIncrease} CPS`;
        button.onclick = () => buyUpgrade(index);
        
        // Disable button if not enough clicks
        button.disabled = clicks < cost;

        shopDiv.appendChild(button);
    });
}

function renderMilestones() {
    milestonesDiv.innerHTML = '';
    milestones.forEach((milestone, index) => {
        const button = document.createElement('button');
        button.id = 'milestone' + milestone.id;
        button.disabled = milestone.bought || clicks < milestone.cost;

        if (milestone.bought) {
            button.innerText = `${milestone.name} (BOUGHT!) - Base Click +${milestone.clickBonus}`;
            button.style.backgroundColor = '#2ecc71'; // Green for bought
        } else {
            button.innerText = `${milestone.name} - Cost: ${milestone.cost.toLocaleString()} - Base Click +${milestone.clickBonus}`;
            button.onclick = () => buyMilestone(index);
        }

        milestonesDiv.appendChild(button);
    });
}

// --- Visual/Effect Functions ---
function updateSpinSpeed() {
    sledImg.style.animation = `spin ${spinSpeed}s linear infinite`;
}

function generateParticles(x, y) {
    // ... (Your original particle logic remains here)
    // The visual particle effect is still great!
    const particleCount = 10; 
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');
        document.body.appendChild(particle);

        particle.style.left = `${x - 5}px`;
        particle.style.top = `${y - 5}px`;

        const angle = Math.random() * 2 * Math.PI;
        const distance = Math.random() * 100 + 50; 

        const deltaX = Math.cos(angle) * distance;
        const deltaY = Math.sin(angle) * distance;

        particle.style.setProperty('--x', `${deltaX}px`);
        particle.style.setProperty('--y', `${deltaY}px`);

        setTimeout(() => {
            particle.remove();
        }, 500); 
    }
}

function updateSnowflakes() {
    // ... (Your original snowflake logic remains here)
    const snowflakeCount = 30; 
    for (let i = 0; i < snowflakeCount; i++) {
        const snowflake = document.createElement('div');
        snowflake.classList.add('snowflake');
        document.body.appendChild(snowflake);

        const xPos = Math.random() * window.innerWidth;
        const size = Math.random() * 5 + 5; 
        snowflake.style.left = `${xPos}px`;
        snowflake.style.width = `${size}px`;
        snowflake.style.height = `${size}px`;

        snowflake.style.animationDuration = `${Math.random() * 5 + 5}s`; 

        setTimeout(() => {
            snowflake.remove();
        }, 10000);
    }
}


// --- Legacy Upgrade Effects (Kept for fun) ---
function playMusic() {
    let audio = document.getElementById("music");
    audio.play().catch(e => console.log('Music autoplay prevented. Click anywhere to enable.', e));
}

let colors = ["red", "orange", "yellow", "green", "blue", "indigo", "violet"];
let colorIndex = 0; // Renamed from 'index' to avoid conflict

function activateRainbowCursor() {
    setInterval(() => {
        document.body.style.cursor = `url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><circle cx="16" cy="16" r="8" fill="${colors[colorIndex]}"/></svg>') 16 16, auto`;
        colorIndex = (colorIndex + 1) % colors.length;
    }, 100); 
}

// Background functions (kept from original for fun)
function stringbanner() { document.body.style.backgroundImage = "url('https://images.thdstatic.com/productImages/ce381c6d-b778-480d-8dcd-6baf82b4f645/svn/novelty-place-house-flags-np-pennantbanner-75pcs-2pc-1d_600.jpg')"; document.body.style.backgroundSize = "cover"; }
function steeringwheel() { document.body.style.backgroundImage = "url('https://media.tenor.com/7Cv0ZYqWR9gAAAAM/gta-v-flip.gif')"; document.body.style.backgroundSize = "cover"; }
function reinforcedsteel() { document.body.style.backgroundImage = "url('https://i.pinimg.com/originals/4b/cb/35/4bcb35a715c7b0913748a7b71251722a.gif')"; document.body.style.backgroundSize = "cover"; }
function ProfessionalSledder() { document.body.style.backgroundImage = "url('https://media.tenor.com/rEcB3Dw7LTcAAAAM/sled-fail.gif')"; document.body.style.backgroundSize = "cover"; }
function money() { document.body.style.backgroundImage = "url('https://i.giphy.com/14vTnFcC3Oom4M.webp')"; document.body.style.backgroundSize = "cover"; }
function santa() { document.body.style.backgroundImage = "url('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQdxxjg8Uth5MvH7mtdjod0BgnWtAWGuAkjgIVlm5nv723L4NE0YeZzFZYeM1wc_ZwUskY&usqp=CAU')"; document.body.style.backgroundSize = "cover"; }
function hacker() { alert('HACKING COMPLETE: All clicks are now multiplied by 1.01x!'); } // Placeholder effect
