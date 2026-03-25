document.addEventListener('DOMContentLoaded', () => {

    // ─── CONFIGURATION ────────────────────────────────────────────────────────
    const GIST_ID = '62dcff9fb06d470d2b7bf5c1bdc63cf2';
    const GIST_RAW_BASE = `https://gist.githubusercontent.com/tejasdiscord12-collab/${GIST_ID}/raw/`;
    const API_BASE = 'http://eu1i7.hexonode.com:26113';
    let ADMIN_TOKEN = localStorage.getItem('adminToken') || null;

    function checkMaintenance() {
        const screen = document.getElementById('maintenanceScreen');
        if (MAINTENANCE_MODE && !ADMIN_TOKEN) {
            if (screen) screen.classList.add('active');
            document.body.style.overflow = 'hidden';
        } else {
            if (screen) screen.classList.remove('active');
        }
    }

    // ─── DOM REFS ────────────────────────────────────────────────────────────
    const rankingsList = document.getElementById('rankingsList');
    const playerSearch = document.getElementById('playerSearch');
    const kitButtons = document.querySelectorAll('.kit-btn');
    const navRankings = document.getElementById('navRankings');
    const navQueue = document.getElementById('navQueue');
    const rankingsContainer = document.getElementById('rankingsContainer');
    const queueContainer = document.getElementById('queueContainer');
    const tableHeader = document.getElementById('tableHeader');
    const contentTitle = document.getElementById('contentTitle');
    const statPlayers = document.getElementById('statPlayers');

    // ─── CONFIGURATION (v5.2) ────────────────────────────────────────────────
    const MAINTENANCE_MODE = false; // Toggle this to true to lock the site

    // Modal Refs
    const playerModal = document.getElementById('playerModal');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalName = document.getElementById('modalName');
    const modalTitle = document.getElementById('modalTitle');
    const modalRegion = document.getElementById('modalRegion');
    const modalType = document.getElementById('modalType');
    const modalTiers = document.getElementById('modalTiers');
    const playerModalClose = document.getElementById('playerModalClose');

    const KIT_ICONS = {
        'Sword': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/diamond_sword.png',
        'Nethpot': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/netherite_chestplate.png',
        'Axe': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/diamond_axe.png',
        'Diapot': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/diamond_chestplate.png',
        'UHC': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/golden_apple.png',
        'SmpKit': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/ender_pearl.png',
        'Crystal': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/end_crystal.png',
        'Mace': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/item/mace.png'
    };

    const KIT_DISPLAY = {
        'nethpot': 'Nethpot', 'sword': 'Sword', 'uhc': 'UHC',
        'axe': 'Axe', 'crystal': 'Crystal', 'smpkit': 'SmpKit',
        'diapot': 'Diapot', 'mace': 'Mace'
    };

    const TIER_VALUES = {
        'HT1': 100, 'LT1': 90, 'HT2': 80, 'LT2': 70,
        'HT3': 60, 'LT3': 50, 'HT4': 40, 'LT4': 30,
        'HT5': 20, 'LT5': 10
    };

    let allData = [];
    let currentCategory = 'all';

    function getTierVal(tier) {
        return TIER_VALUES[tier?.toUpperCase().replace(';', '').trim()] || 0;
    }
    function getBestTierValue(tiers) {
        return (tiers || []).reduce((best, t) => Math.max(best, getTierVal(t.tier)), 0);
    }
    function getTitle(bestVal) {
        if (bestVal >= 90) return 'Combat Grandmaster';
        if (bestVal >= 70) return 'Combat Master';
        if (bestVal >= 40) return 'Combat Ace';
        return 'Combat Initiate';
    }
    function normalizeCategory(cat) {
        if (!cat || cat === 'all') return 'all';
        const c = cat.toLowerCase().trim();
        if (c.includes('neth') || c === 'npot' || c === 'nethpot' || c.includes('pot')) return 'nethpot';
        if (c.includes('smp')) return 'smpkit';
        if (c === 'swords' || c === 'sword') return 'sword';
        if (c === 'cpvp' || c === 'crystal') return 'crystal';
        if (c.includes('axe')) return 'axe';
        if (c.includes('uhc')) return 'uhc';
        if (c.includes('mace')) return 'mace';
        if (c.includes('diapot') || c.includes('diamond')) return 'diapot';
        return 'sword';
    }

    async function fetchRankings() {
        try {
            const res = await fetch(`${GIST_RAW_BASE}players.json?v=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Fetch Error ${res.status}`);
            allData = await res.json();
            if (statPlayers) statPlayers.textContent = allData.length;
            renderRankings(allData);
        } catch (e) {
            console.error('Fetch Failed:', e);
            if (rankingsList) rankingsList.innerHTML = `<div class="loading-state"><span>Failed to load: ${e.message}</span></div>`;
        }
    }

    function renderRankings(data) {
        if (!rankingsList) return;
        rankingsList.innerHTML = '';
        
        const normalizedCurrent = currentCategory.toLowerCase();
        const filtered = normalizedCurrent === 'all' 
            ? data.map(p => ({ ...p, bestVal: getBestTierValue(p.tiers), title: getTitle(getBestTierValue(p.tiers)) })).sort((a,b) => b.bestVal - a.bestVal)
            : data.filter(p => (p.tiers || []).some(t => normalizeCategory(t.category) === normalizedCurrent))
                .map(p => {
                    const t = p.tiers.find(ti => normalizeCategory(ti.category) === normalizedCurrent);
                    return { ...p, currentTier: t.tier, tierVal: getTierVal(t.tier) };
                })
                .sort((a,b) => b.tierVal - a.tierVal);

        filtered.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'player-row';
            const rank = index + 1;

            if (normalizedCurrent === 'all') {
                row.innerHTML = `
                    <div class="col-rank">#${rank}</div>
                    <div class="col-player">
                        <img src="https://mc-heads.net/avatar/${player.minecraft_ign}/32">
                        <span>${player.minecraft_ign}</span>
                    </div>
                    <div class="col-region">${player.region || 'AS'}</div>
                    <div class="col-tiers">
                        ${(player.tiers || []).slice(0, 5).map(t => `<span class="tier-badge ${t.tier.toLowerCase().replace(';', '')}">${t.category}: ${t.tier}</span>`).join('')}
                    </div>
                `;
            } else {
                row.innerHTML = `
                    <div class="col-rank">#${rank}</div>
                    <div class="col-player">
                        <img src="https://mc-heads.net/avatar/${player.minecraft_ign}/32">
                        <span>${player.minecraft_ign}</span>
                    </div>
                    <div class="col-region">${player.region || 'AS'}</div>
                    <div class="col-tiers">
                        <span class="tier-badge ${player.currentTier.toLowerCase().replace(';', '')}">${player.currentTier}</span>
                    </div>
                `;
            }
            row.onclick = () => openPlayerModal(player);
            rankingsList.appendChild(row);
        });
    }

    function openPlayerModal(player) {
        modalName.textContent = player.minecraft_ign;
        modalAvatar.src = `https://mc-heads.net/body/${player.minecraft_ign}`;
        modalRegion.textContent = player.region || 'AS';
        modalTiers.innerHTML = (player.tiers || []).map(t => `<div class="modal-stat-card"><div class="msc-info"><div class="msc-val">${t.tier}</div><div class="msc-label">${t.category}</div></div></div>`).join('');
        playerModal.classList.add('modal-open');
    }

    kitButtons.forEach(btn => btn.addEventListener('click', () => {
        kitButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        renderRankings(allData);
    }));

    playerSearch?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allData.filter(p => p.minecraft_ign.toLowerCase().includes(term));
        renderRankings(filtered);
    });

    playerModalClose?.addEventListener('click', () => playerModal.classList.remove('modal-open'));
    window.addEventListener('click', (e) => { if (e.target === playerModal) playerModal.classList.remove('modal-open'); });

    fetchRankings();
    setInterval(fetchRankings, 60000);
    checkMaintenance();
});
