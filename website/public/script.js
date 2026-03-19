document.addEventListener('DOMContentLoaded', () => {

    // ─── CONFIGURATION ────────────────────────────────────────────────────────
    const GIST_RAW_BASE = 'https://gist.githubusercontent.com/tejasdiscord12-collab/0583dadbe079dbae6e0a5ac18bcac33b/raw/';
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
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    
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
            renderRankings(allData);
        } catch (e) {
            console.error('❌ Fetch Error:', e);
            if (rankingsList) rankingsList.innerHTML = `<div class="loading-state"><span>Failed to load rankings: ${e.message}</span></div>`;
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
    function renderRankings(players) {
        if (!rankingsList) return;
        rankingsList.innerHTML = '';
        if (!players || players.length === 0) {
            rankingsList.innerHTML = '<div class="loading-state"><span>No players found.</span></div>';
            return;
        }

        const playersWithData = players.map(p => {
            const bestVal = getBestTierValue(p.tiers);
            return { ...p, bestVal, title: getTitle(bestVal) };
        });

        const normalizedCurrent = normalizeCategory(currentCategory);

        if (normalizedCurrent === 'all') {
            tableHeader.style.display = 'flex';
            contentTitle.innerHTML = '<i class="fa-solid fa-trophy" style="color:#ffb800"></i> Overall Rankings';
            const sorted = [...playersWithData].sort((a,b) => b.bestVal - a.bestVal || (b.tiers||[]).length - (a.tiers||[]).length);
            renderPodium(sorted.slice(0, 3));

            sorted.forEach((player, index) => {
                const isTop3 = index < 3;
                const row = document.createElement('div');
                row.className = `player-row${isTop3 ? ' top-rank' : ''}`;
                row.addEventListener('click', () => openPlayerModal(player));

                const processedTiers = (player.tiers || []).reduce((acc, current) => {
                    let cat = normalizeCategory(current.category);
                    const existingIdx = acc.findIndex(t => t.category === cat);
                    if (existingIdx === -1) acc.push({ tier: current.tier, category: cat });
                    else if (getTierVal(current.tier) > getTierVal(acc[existingIdx].tier)) acc[existingIdx].tier = current.tier;
                    return acc;
                }, []).sort((a,b) => getTierVal(b.tier) - getTierVal(a.tier));

                const tiersHtml = processedTiers.map(t => {
                    const cleanTier = t.tier.replace(';', '').trim();
                    const dispName = KIT_DISPLAY[t.category] || t.category;
                    return `<div class="tier-item tier-color-${cleanTier}"><div class="tier-circle"><img src="${KIT_ICONS[dispName] || KIT_ICONS['Sword']}"></div><span class="tier-badge-label">${cleanTier}</span></div>`;
                }).join('');

                const regionCode = (player.region || 'AS').split('/')[0].toUpperCase();
                row.innerHTML = `<div class="col-rank"><div class="rank-box"><span class="rank-text">${index + 1}</span></div></div><div class="col-player"><div class="player-card"><div class="avatar-wrapper"><img src="https://mc-heads.net/avatar/${player.minecraft_ign}/42"></div><div class="player-info"><div class="player-name">${player.minecraft_ign}</div><div class="player-title"><i class="fa-solid fa-medal title-icon"></i> ${player.title}</div></div></div></div><div class="col-region"><span class="region-badge region-${regionCode}">${player.region || 'AS'}</span></div><div class="col-tiers"><div class="tiers-list">${tiersHtml}</div></div>`;
                rankingsList.appendChild(row);
            });
        } else {
            tableHeader.style.display = 'flex';
            const dispName = KIT_DISPLAY[normalizedCurrent] || normalizedCurrent;
            contentTitle.innerHTML = `<img src="${KIT_ICONS[dispName] || KIT_ICONS['Sword']}" class="title-kit-icon"> ${dispName} Rankings`;
            
            const filtered = playersWithData.filter(p => (p.tiers || []).some(t => normalizeCategory(t.category) === normalizedCurrent))
                .sort((a,b) => {
                    const tA = a.tiers.find(t => normalizeCategory(t.category) === normalizedCurrent);
                    const tB = b.tiers.find(t => normalizeCategory(t.category) === normalizedCurrent);
                    return getTierVal(tB.tier) - getTierVal(tA.tier);
                });
            renderPodium(filtered.slice(0, 3));
            filtered.forEach((player, index) => {
                const row = document.createElement('div');
                row.className = `player-row ${index < 3 ? 'top-rank' : ''}`;
                row.addEventListener('click', () => openPlayerModal(player));
                const t = player.tiers.find(ti => normalizeCategory(ti.category) === normalizedCurrent);
                const cleanTier = t.tier.replace(';', '').trim();
                const regionCode = (player.region || 'AS').split('/')[0].toUpperCase();
                row.innerHTML = `<div class="col-rank"><div class="rank-box"><span class="rank-text">${index + 1}</span></div></div><div class="col-player"><div class="player-card"><div class="avatar-wrapper"><img src="https://mc-heads.net/avatar/${player.minecraft_ign}/42"></div><div class="player-info"><div class="player-name">${player.minecraft_ign}</div><div class="player-title"><i class="fa-solid fa-medal title-icon"></i> ${player.title}</div></div></div></div><div class="col-region"><span class="region-badge region-${regionCode}">${player.region || 'AS'}</span></div><div class="col-tiers"><div class="tiers-list"><div class="tier-item tier-color-${cleanTier}"><div class="tier-circle"><img src="${KIT_ICONS[dispName] || KIT_ICONS['Sword']}"></div><span class="tier-badge-label">${cleanTier}</span></div></div></div>`;
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
        rankingsContainer.style.display = 'block';
        queueContainer.style.display = 'none';
        navRankings.classList.add('active');
        navQueue.classList.remove('active');
    });

    navQueue?.addEventListener('click', (e) => {
        e.preventDefault();
        currentView = 'queue';
        rankingsContainer.style.display = 'none';
        queueContainer.style.display = 'block';
        navQueue.classList.add('active');
        navRankings.classList.remove('active');
    });

    kitButtons.forEach(btn => btn.addEventListener('click', () => {
        kitButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        renderRankings(allData);
        if (window.innerWidth <= 900) sidebar.classList.remove('active');
    }));

    playerSearch?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allData.filter(p => p.minecraft_ign.toLowerCase().includes(term));
        renderRankings(filtered);
    });

    mobileMenuBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    playerModalClose?.addEventListener('click', () => playerModal.classList.remove('modal-open'));
    window.addEventListener('click', (e) => { if (e.target === playerModal || e.target === document.getElementById('adminModal')) { playerModal.classList.remove('modal-open'); document.getElementById('adminModal')?.classList.remove('modal-open'); } });

    adminLoginBtn?.addEventListener('click', () => {
        document.getElementById('adminModal')?.classList.add('modal-open');
    });

    document.getElementById('adminModalClose')?.addEventListener('click', () => {
        document.getElementById('adminModal')?.classList.remove('modal-open');
    });

    document.getElementById('adminLoginSubmit')?.addEventListener('click', async () => {
        const pass = document.getElementById('adminPassword')?.value;
        if (!pass) return;
        try {
            const res = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: pass })
            });
            if (res.ok) {
                const data = await res.json();
                ADMIN_TOKEN = data.token;
                localStorage.setItem('adminToken', ADMIN_TOKEN);
                document.getElementById('adminModal')?.classList.remove('modal-open');
                location.reload();
            } else { alert('Invalid Password!'); }
        } catch (e) { alert('Server error'); }
    });

    if (ADMIN_TOKEN) {
        document.body.classList.add('is-admin');
        const lockIcon = document.querySelector('#adminLoginBtn i');
        if (lockIcon) { lockIcon.classList.replace('fa-lock', 'fa-unlock'); }
    }

    fetchRankings();
    fetchQueue();
    setInterval(() => { fetchRankings(); fetchQueue(); }, 60000);

});
