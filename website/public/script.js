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

    const HIERARCHY = ['HT1', 'LT1', 'HT2', 'LT2', 'HT3', 'LT3', 'HT4', 'LT4', 'HT5', 'LT5'];

    // ─── STATE ───────────────────────────────────────────────────────────────
    let allData = [];
    let currentCategory = 'all';
    let currentView = 'rankings';

    // ─── NAV SCROLL ──────────────────────────────────────────────────────────
    window.addEventListener('scroll', () => {
        navbar?.classList.toggle('scrolled', window.scrollY > 20);
    });

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    function getTierVal(tier) {
        return TIER_VALUES[tier?.toUpperCase().replace(';', '').trim()] || 0;
    }
    function getBestTierValue(tiers) {
        return (tiers || []).reduce((best, t) => Math.max(best, getTierVal(t.tier)), 0);
    }
    function getPoints(tiers) {
        return (tiers || []).reduce((sum, t) => sum + getTierVal(t.tier), 0);
    }
    function getTitle(bestVal) {
        if (bestVal >= 90) return 'Combat Grandmaster';
        if (bestVal >= 70) return 'Combat Master';
        if (bestVal >= 40) return 'Combat Ace';
        return 'Combat Initiate';
    }
    function normalizeCategory(cat) {
        if (!cat) return 'sword';
        const c = cat.toLowerCase().trim();
        if (c.includes('neth') || c.includes('pot')) return 'nethpot';
        if (c.includes('smp')) return 'smpkit';
        if (c === 'swords' || c === 'sword') return 'sword';
        if (c === 'cpvp' || c === 'crystal') return 'crystal';
        if (c.includes('axe')) return 'axe';
        if (c.includes('uhc')) return 'uhc';
        if (c.includes('mace')) return 'mace';
        return 'sword';
    }

    // ─── FETCH ───────────────────────────────────────────────────────────────
    async function fetchRankings() {
        try {
            console.log("🔍 Syncing rankings via Raw Gist...");
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

            const sorted = [...playersWithData].sort((a, b) => b.bestVal - a.bestVal || (b.tiers || []).length - (a.tiers || []).length);
            renderPodium(sorted.slice(0, 3));

            sorted.forEach((player, index) => {
                const isTop3 = index < 3;
                const row = document.createElement('div');
                row.className = `player-row${isTop3 ? ' top-rank' : ''} row-${index + 1}`;

                const processedTiers = (player.tiers || []).reduce((acc, current) => {
                    let cat = normalizeCategory(current.category);
                    const existing = acc.find(t => normalizeCategory(t.category) === cat);
                    if (!existing) acc.push({ ...current, category: cat });
                    else if (getTierVal(current.tier) > getTierVal(existing.tier)) Object.assign(existing, { ...current, category: cat });
                    return acc;
                }, []).sort((a, b) => getTierVal(b.tier) - getTierVal(a.tier));

                const tiersHtml = processedTiers.map(t => {
                    const cleanTier = t.tier.toUpperCase().replace(';', '').trim();
                    const colorClass = `tier-color-${cleanTier}`;
                    const displayCat = KIT_DISPLAY[t.category.toLowerCase()] || t.category;
                    const iconName = Object.keys(KIT_ICONS).find(k => k.toLowerCase() === displayCat.toLowerCase());
                    const icon = KIT_ICONS[iconName] || KIT_ICONS['Sword'];
                    return `
                        <div class="tier-item ${colorClass}">
                            <div class="tier-circle"><img src="${icon}" alt="${displayCat}"></div>
                            <span class="tier-badge-label">${cleanTier}</span>
                            <div class="tier-tooltip">
                                <strong>${displayCat}</strong>
                                <span>Tier ${cleanTier}</span>
                            </div>
                        </div>`;
                }).join('');

                const regionCode = (player.region || 'AS').toUpperCase().split('/')[0];
                row.innerHTML = `
                    <div class="col-rank"><div class="rank-box"><span class="rank-text">${index + 1}</span></div></div>
                    <div class="col-player">
                        <div class="player-card">
                            <div class="avatar-wrapper"><img src="https://mc-heads.net/avatar/${player.minecraft_ign}/42"></div>
                            <div class="player-info">
                                <div class="player-name">${player.minecraft_ign}</div>
                                <div class="player-title"><i class="fa-solid fa-medal title-icon"></i> ${player.title}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-region"><span class="region-badge region-${regionCode}">${player.region || 'AS'}</span></div>
                    <div class="col-tiers"><div class="tiers-list">${tiersHtml}</div></div>
                `;
                rankingsList.appendChild(row);
            });
        } else {
            tableHeader.style.display = 'flex';
            const dispName = KIT_DISPLAY[normalizedCurrent] || normalizedCurrent;
            contentTitle.innerHTML = `<img src="${KIT_ICONS[dispName] || KIT_ICONS['Sword']}" class="title-kit-icon"> ${dispName} Rankings`;

            const filtered = playersWithData.filter(p => (p.tiers || []).some(t => normalizeCategory(t.category) === normalizedCurrent))
                .sort((a, b) => {
                    const tA = a.tiers.find(t => normalizeCategory(t.category) === normalizedCurrent);
                    const tB = b.tiers.find(t => normalizeCategory(t.category) === normalizedCurrent);
                    return getTierVal(tB.tier) - getTierVal(tA.tier);
                });

            renderPodium(filtered.slice(0, 3));

            filtered.forEach((player, index) => {
                const isTop3 = index < 3;
                const row = document.createElement('div');
                row.className = `player-row${isTop3 ? ' top-rank' : ''} row-${index + 1}`;
                const t = player.tiers.find(ti => normalizeCategory(ti.category) === normalizedCurrent);
                const cleanTier = t.tier.toUpperCase().replace(';', '').trim();
                const regionCode = (player.region || 'AS').toUpperCase().split('/')[0];

                row.innerHTML = `
                    <div class="col-rank"><div class="rank-box"><span class="rank-text">${index + 1}</span></div></div>
                    <div class="col-player">
                        <div class="player-card">
                            <div class="avatar-wrapper"><img src="https://mc-heads.net/avatar/${player.minecraft_ign}/42"></div>
                            <div class="player-info">
                                <div class="player-name">${player.minecraft_ign}</div>
                                <div class="player-title"><i class="fa-solid fa-medal title-icon"></i> ${player.title}</div>
                            </div>
                        </div>
                    </div>
                    <div class="col-region"><span class="region-badge region-${regionCode}">${player.region || 'AS'}</span></div>
                    <div class="col-tiers">
                        <div class="tiers-list">
                            <div class="tier-item tier-color-${cleanTier}">
                                <div class="tier-circle"><img src="${KIT_ICONS[dispName] || KIT_ICONS['Sword']}"></div>
                                <span class="tier-badge-label">${cleanTier}</span>
                            </div>
                        </div>
                    </div>
                `;
                rankingsList.appendChild(row);
            });
        }
    }

    function renderPodium(top3) {
        document.querySelector('.podium-section')?.remove();
        if (!top3 || top3.length === 0) return;

        const podium = document.createElement('div');
        podium.className = 'podium-section';
        podium.id = 'podiumSection';
        const order = [top3[1], top3[0], top3[2]].filter(Boolean);
        
        podium.innerHTML = `<div class="podium-title">🏆 Top Players</div><div class="podium-stage">
            ${order.map((p) => {
                const rank = top3.indexOf(p) + 1;
                const h = [75, 100, 55][rank - 1];
                const medals = ['🥇', '🥈', '🥉'];
                return `<div class="podium-spot rank-${rank}">
                        ${rank === 1 ? '<div class="podium-crown">👑</div>' : ''}
                        <img class="podium-avatar" src="https://mc-heads.net/avatar/${p.minecraft_ign}/96" alt="${p.minecraft_ign}">
                        <div class="podium-ign">${p.minecraft_ign}</div>
                        <div class="podium-block" style="height:${h}px"><span>${medals[rank - 1]}</span></div>
                    </div>`;
            }).join('')}
        </div>`;
        const toolbar = document.querySelector('.content-toolbar');
        if (toolbar) toolbar.insertAdjacentElement('afterend', podium);
    }

    function renderQueue(queue, isOpen) {
        const qCount = document.getElementById('statQueueCount');
        if (qCount) qCount.textContent = queue.length;
        const qStatusText = document.getElementById('queueStatusText');
        if (qStatusText) qStatusText.textContent = isOpen ? 'QUEUE OPEN' : 'QUEUE CLOSED';
        document.getElementById('queueStatusBanner')?.classList.toggle('open', isOpen);
        
        const qList = document.getElementById('queueList');
        if (!qList) return;
        if (queue.length === 0) {
            qList.innerHTML = '<div class="tcp-empty">The queue is currently empty.</div>';
            return;
        }
        qList.innerHTML = queue.map((q, i) => `
            <div class="player-row" style="height: 60px;">
                <div class="col-rank">
                    <div class="rank-box"><span class="rank-text">${i + 1}</span></div>
                </div>
                <div class="col-player">
                    <div class="player-card">
                        <div class="avatar-wrapper"><img src="https://mc-heads.net/avatar/${q.minecraft_ign}/32"></div>
                        <div class="player-name">${q.minecraft_ign}</div>
                    </div>
                </div>
                <div class="col-region"><span class="region-badge region-AS">${q.category}</span></div>
            </div>`).join('');
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

    // ─── INITIALIZE ───────────────────────────────────────────────────────────
    fetchRankings();
    fetchQueue();
    setInterval(() => {
        fetchRankings();
        fetchQueue();
    }, 60000);

});
