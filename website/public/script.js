document.addEventListener('DOMContentLoaded', () => {

    // ─── CONFIGURATION ────────────────────────────────────────────────────────
    const GIST_ID = '62dcff9fb06d470d2b7bf5c1bdc63cf2';
    const GIST_RAW_BASE = `https://gist.githubusercontent.com/tejasdiscord12-collab/${GIST_ID}/raw/`;
    const API_BASE = 'http://eu1i7.hexonode.com:26113';
    let ADMIN_TOKEN = localStorage.getItem('adminToken') || null;

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
    const navbar = document.getElementById('navbar');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.sidebar');
    
    // Modal Refs
    const playerModal = document.getElementById('playerModal');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalName = document.getElementById('modalName');
    const modalTitle = document.getElementById('modalTitle');
    const modalRegion = document.getElementById('modalRegion');
    const modalType = document.getElementById('modalType');
    const modalTiers = document.getElementById('modalTiers');
    const playerModalClose = document.getElementById('playerModalClose');

    // ─── KIT ICONS ───────────────────────────────────────────────────────────
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

    // ─── STATE ───────────────────────────────────────────────────────────────
    let allData = [];
    let currentCategory = 'all';
    let currentView = 'rankings';

    // ─── HELPERS ─────────────────────────────────────────────────────────────
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
        if (c === 'all') return 'all';
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

    // ─── FETCH ───────────────────────────────────────────────────────────────
    async function fetchRankings() {
        try {
            const res = await fetch(`${GIST_RAW_BASE}players.json?v=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Fetch Error ${res.status}`);
            allData = await res.json();
            if (statPlayers) statPlayers.textContent = allData.length;
            
            const kitList = document.getElementById('kitList');
            if (kitList) {
                kitList.innerHTML = `<button class="kit-btn ${currentCategory === 'all' ? 'active' : ''}" data-category="all">
                    <i class="fa-solid fa-layer-group"></i>
                    <span>Overall</span>
                </button>`;
                
                Object.keys(KIT_DISPLAY).forEach(kitKey => {
                    const disp = KIT_DISPLAY[kitKey];
                    const btn = document.createElement('button');
                    btn.className = `kit-btn ${currentCategory === kitKey ? 'active' : ''}`;
                    btn.dataset.category = kitKey;
                    btn.innerHTML = `
                        <img src="${KIT_ICONS[disp] || KIT_ICONS['Sword']}" style="width:18px; image-rendering:pixelated; margin-right:8px;">
                        <span>${disp}</span>
                    `;
                    btn.onclick = () => {
                        document.querySelectorAll('.kit-btn').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        currentCategory = kitKey;
                        renderRankings(allData);
                        if (window.innerWidth <= 1000) sidebar.classList.remove('active');
                    };
                    kitList.appendChild(btn);
                });
            }

            renderRankings(allData);
        } catch (e) {
            console.error('Fetch Failed:', e);
            if (rankingsList) rankingsList.innerHTML = `<div class="loading-state"><span>Failed to load node: ${e.message}</span></div>`;
        }
    }

    async function fetchQueue() {
        try {
            const res = await fetch(`${GIST_RAW_BASE}queue.json?v=${Date.now()}`, { cache: 'no-store' });
            if (!res.ok) return;
            const data = await res.json();
            renderQueue(data.queue || [], data.isOpen || false);
        } catch (e) { }
    }

    // ─── RENDER ──────────────────────────────────────────────────────────────
    function renderRankings(data) {
        if (!rankingsList) return;
        rankingsList.innerHTML = '';
        
        const normalizedCurrent = currentCategory.toLowerCase();
        
        if (normalizedCurrent === 'all') {
            if (tableHeader) tableHeader.style.display = 'flex';
            if (contentTitle) contentTitle.innerHTML = `<i class="fa-solid fa-trophy" style="color:var(--primary)"></i> OVERALL RANKINGS`;
            
            const playersWithRank = data.map(p => {
                const bestVal = getBestTierValue(p.tiers);
                return { ...p, bestVal, title: getTitle(bestVal) };
            }).sort((a,b) => b.bestVal - a.bestVal);

            renderPodium(playersWithRank.slice(0, 3));

            playersWithRank.forEach((player, index) => {
                const row = document.createElement('div');
                row.className = 'player-row';
                
                const bestTier = player.tiers?.length > 0 ? player.tiers.reduce((prev, curr) => (getTierVal(prev.tier) > getTierVal(curr.tier)) ? prev : curr) : null;
                const tierColorClass = bestTier ? `tier-${bestTier.tier.toLowerCase().replace(';', '')}` : '';
                if (tierColorClass) row.classList.add(tierColorClass);

                const rank = index + 1;
                let rankDisp = `#${rank}`;
                if (rank === 1) rankDisp = '🥇';
                if (rank === 2) rankDisp = '🥈';
                if (rank === 3) rankDisp = '🥉';

                row.innerHTML = `
                    <div class="col-rank" style="width:70px; font-weight:800; color:var(--primary); font-size:1.1rem;">${rankDisp}</div>
                    <div class="col-player" style="flex:2; display:flex; align-items:center; gap:12px;">
                        <img src="https://mc-heads.net/avatar/${player.minecraft_ign}/32" style="border-radius:4px; border:1px solid rgba(255,255,255,0.1);">
                        <div>
                            <div style="font-weight:700; color:#fff;">${player.minecraft_ign}</div>
                            <div style="font-size:0.65rem; color:var(--text-muted); font-weight:800; text-transform:uppercase; letter-spacing:1px;">${player.title}</div>
                        </div>
                    </div>
                    <div class="col-region" style="width:100px; text-align:center; font-size:0.75rem; font-weight:800; opacity:0.5;">${player.region || 'GLOBAL'}</div>
                    <div class="col-tiers" style="flex:3; display:flex; gap:8px; flex-wrap:wrap;">
                        ${(player.tiers || []).sort((a,b) => getTierVal(b.tier) - getTierVal(a.tier)).slice(0, 5).map(t => `<span class="tier-pill-small ${t.tier.toUpperCase().replace(';', '')}">${t.category}: ${t.tier}</span>`).join('')}
                    </div>
                `;
                row.onclick = () => openPlayerModal(player);
                rankingsList.appendChild(row);
            });
        } else {
            if (tableHeader) tableHeader.style.display = 'flex';
            const disp = KIT_DISPLAY[normalizedCurrent] || normalizedCurrent;
            if (contentTitle) contentTitle.innerHTML = `<img src="${KIT_ICONS[disp] || KIT_ICONS['Sword']}" style="width:24px; vertical-align:middle; margin-right:10px;"> ${disp.toUpperCase()} RANKINGS`;

            const filtered = data.filter(p => (p.tiers || []).some(t => normalizeCategory(t.category) === normalizedCurrent))
                .map(p => {
                    const t = p.tiers.find(ti => normalizeCategory(ti.category) === normalizedCurrent);
                    return { ...p, currentTier: t.tier, tierVal: getTierVal(t.tier) };
                })
                .sort((a,b) => b.tierVal - a.tierVal);

            renderPodium(filtered.slice(0, 3));

            filtered.forEach((player, index) => {
                const row = document.createElement('div');
                row.className = 'player-row';
                const rank = index + 1;
                let rankDisp = `#${rank}`;
                if (rank === 1) rankDisp = '🥇';
                if (rank === 2) rankDisp = '🥈';
                if (rank === 3) rankDisp = '🥉';

                row.innerHTML = `
                    <div class="col-rank" style="width:70px; font-weight:800; color:var(--primary);">${rankDisp}</div>
                    <div class="col-player" style="flex:2; display:flex; align-items:center; gap:12px;">
                        <img src="https://mc-heads.net/avatar/${player.minecraft_ign}/32" style="border-radius:4px;">
                        <span style="font-weight:700;">${player.minecraft_ign}</span>
                    </div>
                    <div class="col-region" style="width:100px; text-align:center; opacity:0.5; font-size:0.75rem;">${player.region || 'GLOBAL'}</div>
                    <div class="col-tiers" style="flex:3;">
                        <span class="tier-pill-small ${player.currentTier.toUpperCase().replace(';', '')}" style="background:rgba(225,0,60,0.1); border:1px solid var(--primary-glow);">${player.currentTier}</span>
                    </div>
                `;
                row.onclick = () => openPlayerModal(player);
                rankingsList.appendChild(row);
            });
        }
    }

    function renderPodium(top3) {
        document.querySelector('.podium-section')?.remove();
        if (!top3 || top3.length === 0) return;
        const podium = document.createElement('div');
        podium.className = 'podium-section';
        const order = [top3[1], top3[0], top3[2]].filter(Boolean);
        podium.innerHTML = `<div class="podium-title">🏆 Top Players</div><div class="podium-stage">${order.map(p => { const rank = top3.indexOf(p) + 1; const medals = ['🥇', '🥈', '🥉']; return `<div class="podium-spot rank-${rank}"><img class="podium-avatar" src="https://mc-heads.net/avatar/${p.minecraft_ign}/96"><div class="podium-ign">${p.minecraft_ign}</div><div class="podium-block"><span>${medals[rank-1]}</span></div></div>`; }).join('')}</div>`;
        document.querySelector('.content-toolbar')?.insertAdjacentElement('afterend', podium);
    }

    function renderQueue(queue, isOpen) {
        const qCount = document.getElementById('statQueueCount'); if (qCount) qCount.textContent = queue.length;
        const qStatusText = document.getElementById('queueStatusText'); if (qStatusText) qStatusText.textContent = isOpen ? 'QUEUE OPEN' : 'QUEUE CLOSED';
        document.getElementById('queueStatusBanner')?.classList.toggle('open', isOpen);
        const qList = document.getElementById('queueList'); if (!qList) return;
        if (queue.length === 0) { qList.innerHTML = '<div class="tcp-empty">The queue is currently empty.</div>'; return; }
        qList.innerHTML = queue.map((q, i) => `<div class="player-row" style="height: 60px;"><div class="col-rank"><div class="rank-box"><span class="rank-text">${i + 1}</span></div></div><div class="col-player"><div class="player-card"><div class="avatar-wrapper"><img src="https://mc-heads.net/avatar/${q.minecraft_ign}/32"></div><div class="player-name">${q.minecraft_ign}</div></div></div><div class="col-region"><span class="region-badge region-AS">${q.category}</span></div></div>`).join('');
    }

    function openPlayerModal(player) {
        if (!modalName || !playerModal) return;
        modalName.textContent = player.minecraft_ign;
        modalAvatar.src = `https://mc-heads.net/body/${player.minecraft_ign}`;
        modalRegion.textContent = player.region || 'AS';
        modalType.textContent = player.account_type || 'Premium';
        const bestVal = getBestTierValue(player.tiers);
        modalTitle.textContent = getTitle(bestVal);
        modalTiers.innerHTML = (player.tiers || []).sort((a,b) => getTierVal(b.tier) - getTierVal(a.tier)).map(t => {
            const cleanTier = t.tier.toUpperCase().replace(';', '').trim();
            const dispName = KIT_DISPLAY[normalizeCategory(t.category)] || t.category;
            return `<div class="modal-stat-card"><div class="msc-icon"><img src="${KIT_ICONS[dispName] || KIT_ICONS['Sword']}"></div><div class="msc-info"><div class="msc-val tier-color-${cleanTier}">${cleanTier}</div><div class="msc-label">${dispName}</div></div></div>`;
        }).join('');
        playerModal.classList.add('modal-open');
    }

    // ─── EVENTS ──────────────────────────────────────────────────────────────
    navRankings?.addEventListener('click', (e) => {
        e.preventDefault();
        currentView = 'rankings';
        if (rankingsContainer) rankingsContainer.style.display = 'block';
        if (queueContainer) queueContainer.style.display = 'none';
        navRankings.classList.add('active');
        navQueue?.classList.remove('active');
    });

    navQueue?.addEventListener('click', (e) => {
        e.preventDefault();
        currentView = 'queue';
        if (rankingsContainer) rankingsContainer.style.display = 'none';
        if (queueContainer) queueContainer.style.display = 'block';
        navQueue.classList.add('active');
        navRankings?.classList.remove('active');
    });

    playerSearch?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allData.filter(p => p.minecraft_ign.toLowerCase().includes(term));
        renderRankings(filtered);
    });

    mobileMenuBtn?.addEventListener('click', () => {
        if (sidebar) sidebar.classList.toggle('active');
    });

    playerModalClose?.addEventListener('click', () => playerModal.classList.remove('modal-open'));
    window.addEventListener('click', (e) => { if (e.target === playerModal) playerModal.classList.remove('modal-open'); });

    fetchRankings();
    fetchQueue();
    setInterval(() => { fetchRankings(); fetchQueue(); }, 60000);

});
