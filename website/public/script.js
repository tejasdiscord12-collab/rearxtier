document.addEventListener('DOMContentLoaded', () => {

    // ─── CONFIGURATION ────────────────────────────────────────────────────────
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
        'diapot': 'Diapot', 'mace': 'Mace', 'crystal': 'Crystal'
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
        navbar.classList.toggle('scrolled', window.scrollY > 20);
    });

    // ─── PARTICLES ───────────────────────────────────────────────────────────
    const particleContainer = document.getElementById('heroParticles');
    if (particleContainer) {
        for (let i = 0; i < 30; i++) {
            const p = document.createElement('div');
            p.className = 'particle';
            p.style.cssText = `
                left: ${Math.random() * 100}%;
                bottom: ${Math.random() * 30}%;
                width: ${Math.random() * 3 + 1}px;
                height: ${Math.random() * 3 + 1}px;
                animation-duration: ${Math.random() * 6 + 4}s;
                animation-delay: ${Math.random() * 5}s;
                opacity: ${Math.random() * 0.6 + 0.2};
            `;
            particleContainer.appendChild(p);
        }
    }

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    function getTierVal(tier) {
        return TIER_VALUES[tier?.toUpperCase().replace(';', '').trim()] || 0;
    }
    function getBestTierValue(tiers) {
        return tiers.reduce((best, t) => Math.max(best, getTierVal(t.tier)), 0);
    }
    function getPoints(tiers) {
        return tiers.reduce((sum, t) => sum + getTierVal(t.tier), 0);
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
            const res = await fetch(`${API_BASE}/api/tiers`);
            allData = await res.json();
            statPlayers.textContent = allData.length;
            renderRankings(allData);
        } catch (e) {
            console.error('Fetch error:', e);
            rankingsList.innerHTML = '<div class="loading-state">Failed to load rankings.</div>';
        }
    }

    async function fetchQueue() {
        try {
            const res = await fetch(`${API_BASE}/api/queue`);
            const { queue, isOpen } = await res.json();
            renderQueue(queue, isOpen);
        } catch (e) {
            renderQueue([], false); // Default if file doesn't exist yet
        }
    }



    // ─── RENDER RANKINGS ──────────────────────────────────────────────────────
    function renderRankings(players) {
        rankingsList.innerHTML = '';

        if (!players || players.length === 0) {
            rankingsList.innerHTML = '<div class="loading-state"><span>No players found.</span></div>';
            return;
        }

        const playersWithData = players.map(p => {
            const bestVal = getBestTierValue(p.tiers || []);
            return { ...p, points: getPoints(p.tiers || []), bestVal, title: getTitle(bestVal) };
        });

        if (currentCategory === 'all') {
            tableHeader.style.display = 'flex';
            contentTitle.innerHTML = '<i class="fa-solid fa-trophy" style="color:#ffb800"></i> Overall Rankings';

            const sorted = [...playersWithData].sort((a, b) => {
                if (b.bestVal !== a.bestVal) return b.bestVal - a.bestVal;
                return b.tiers.length - a.tiers.length;
            });

            // Show Top 3 Podium
            renderPodium(sorted.slice(0, 3));

            sorted.forEach((player, index) => {
                const isTop3 = index < 3;
                const row = document.createElement('div');
                row.className = `player-row${isTop3 ? ' top-rank' : ''} row-${index + 1}`;

                // Deduplicate & sort tiers
                const processedTiers = (player.tiers || []).reduce((acc, current) => {
                    let cat = normalizeCategory(current.category);
                    const existing = acc.find(t => normalizeCategory(t.category) === cat);
                    if (!existing) {
                        acc.push({ ...current, category: cat });
                    } else if (getTierVal(current.tier) > getTierVal(existing.tier)) {
                        Object.assign(existing, { ...current, category: cat });
                    }
                    return acc;
                }, []).sort((a, b) => getTierVal(b.tier) - getTierVal(a.tier));

                const tiersHtml = processedTiers.map(t => {
                    const cleanTier = t.tier.toUpperCase().replace(';', '').trim();
                    const colorClass = `tier-color-${cleanTier}`;
                    const displayCat = KIT_DISPLAY[t.category.toLowerCase()] || t.category;
                    const iconKey = Object.keys(KIT_ICONS).find(k => k.toLowerCase() === displayCat.toLowerCase());
                    const iconSrc = iconKey ? KIT_ICONS[iconKey] : KIT_ICONS['Sword'];
                    return `
                        <div class="tier-item ${colorClass}">
                            <div class="tier-circle">
                                <img src="${iconSrc}" alt="${displayCat}" style="width:14px;height:14px;image-rendering:pixelated;">
                            </div>
                            <span class="tier-badge-label">${cleanTier}</span>
                            <div class="tier-tooltip">
                                <strong>${displayCat}</strong>
                                <span>${cleanTier}</span>
                            </div>
                        </div>`;
                }).join('');

                // Nameplate popup tiers
                const nameplateKitsHtml = processedTiers.map(t => {
                    const cleanTier = t.tier.toUpperCase().replace(';', '').trim();
                    const displayCat = KIT_DISPLAY[t.category.toLowerCase()] || t.category;
                    const iconKey = Object.keys(KIT_ICONS).find(k => k.toLowerCase() === displayCat.toLowerCase());
                    const iconSrc = iconKey ? KIT_ICONS[iconKey] : KIT_ICONS['Sword'];
                    return `<div class="np-kit">
                        <img src="${iconSrc}" alt="${displayCat}">
                        <span class="np-kit-name">${displayCat}</span>
                        <span class="np-kit-tier np-tier-${cleanTier.toLowerCase()}">${cleanTier}</span>
                    </div>`;
                }).join('');

                const region = (player.region || 'AS').toUpperCase();
                row.innerHTML = `
                    <div class="rank-box"><span class="rank-text">${index + 1}.</span></div>
                    <div class="col-player">
                        <div class="player-card">
                            <div class="avatar-wrapper">
                                <img src="https://mc-heads.net/avatar/${player.minecraft_ign}/48" alt="${player.minecraft_ign}">
                            </div>
                            <div>
                                <div class="player-name">${player.minecraft_ign}</div>
                                <div class="player-title">
                                    <span class="title-icon">❖</span> ${player.title}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-region">
                        <span class="region-badge region-${region}">${region}</span>
                    </div>
                    <div class="col-tiers">
                        <div class="tiers-list">${tiersHtml}</div>
                    </div>
                    <div class="player-nameplate">
                        <div class="np-top">
                            <img class="np-avatar" src="https://mc-heads.net/avatar/${player.minecraft_ign}/96" alt="${player.minecraft_ign}">
                            <div class="np-info">
                                <div class="np-name">${player.minecraft_ign}</div>
                                <div class="np-title">${player.title}</div>
                                <div class="np-meta">
                                    <span class="region-badge region-${region}">${region}</span>
                                    <span class="np-rank-num">#${index + 1} Overall</span>
                                </div>
                            </div>
                        </div>
                        <div class="np-kits">${nameplateKitsHtml}</div>
                    </div>`;
                rankingsList.appendChild(row);
            });

        } else {
            // KIT VIEW — columns
            document.getElementById('podiumSection')?.remove();
            tableHeader.style.display = 'none';
            const kitName = KIT_DISPLAY[currentCategory.toLowerCase()] || currentCategory;
            contentTitle.innerHTML = `<i class="fa-solid fa-layer-group" style="color:#ffb800"></i> ${kitName} — Tier List`;

            const filterCat = normalizeCategory(currentCategory);

            const tierGroups = {};
            HIERARCHY.forEach(t => tierGroups[t] = []);

            playersWithData.forEach(player => {
                const relevant = (player.tiers || []).filter(t => normalizeCategory(t.category) === filterCat);
                if (relevant.length > 0) {
                    const best = relevant.reduce((b, c) => getTierVal(c.tier) > getTierVal(b.tier) ? c : b);
                    const clean = best.tier.toUpperCase().replace(';', '').trim();
                    if (tierGroups[clean]) tierGroups[clean].push(player);
                }
            });

            const COLUMNS = [
                { name: 'Tier 1', bg: '#7a5a1a', sub: ['HT1', 'LT1'], icon: '🥇' },
                { name: 'Tier 2', bg: '#3a3d48', sub: ['HT2', 'LT2'], icon: '🥈' },
                { name: 'Tier 3', bg: '#6b3a1a', sub: ['HT3', 'LT3'], icon: '🥉' },
                { name: 'Tier 4', bg: '#2a1a3d', sub: ['HT4', 'LT4'], icon: '🎯' },
                { name: 'Tier 5', bg: '#172038', sub: ['HT5', 'LT5'], icon: '⚡' }
            ];

            const grid = document.createElement('div');
            grid.className = 'tier-cols-grid';

            COLUMNS.forEach(col => {
                const colDiv = document.createElement('div');
                colDiv.className = 'tier-column';

                let playersHtml = '';
                col.sub.forEach(tierLabel => {
                    const group = tierGroups[tierLabel] || [];
                    const color = `var(--t-${tierLabel.toLowerCase()})`;
                    group.forEach(p => {
                        playersHtml += `
                            <div class="tcp-row tier-player-head" style="border-left:3px solid ${color}">
                                <img class="tcp-avatar" src="https://mc-heads.net/avatar/${p.minecraft_ign}/48" alt="${p.minecraft_ign}">
                                <span class="tcp-name">${p.minecraft_ign}</span>
                                <span class="tcp-arrow"><i class="fa-solid fa-angles-up"></i></span>
                                <div class="tier-player-tooltip">
                                    <strong>${p.minecraft_ign}</strong>
                                    <span>${p.region || 'AS'} · ${tierLabel}</span>
                                </div>
                            </div>`;
                    });
                });

                colDiv.innerHTML = `
                    <div class="tier-col-header" style="background:${col.bg}">
                        <span class="col-icon">${col.icon}</span>${col.name}
                    </div>
                    <div class="tier-col-body">
                        ${playersHtml || '<div class="tcp-empty">—</div>'}
                    </div>`;
                grid.appendChild(colDiv);
            });

            rankingsList.appendChild(grid);
        }
    }

    // ─── NAV CLICK ────────────────────────────────────────────────────────────
    navRankings.addEventListener('click', e => {
        e.preventDefault();
        currentView = 'rankings';
        navRankings.classList.add('active');
        navQueue.classList.remove('active');
        rankingsContainer.style.display = 'block';
        queueContainer.style.display = 'none';
        renderRankings(allData);
    });

    navQueue.addEventListener('click', e => {
        e.preventDefault();
        currentView = 'queue';
        navQueue.classList.add('active');
        navRankings.classList.remove('active');
        rankingsContainer.style.display = 'none';
        queueContainer.style.display = 'block';
        fetchQueue();
    });

    // ─── SEARCH ───────────────────────────────────────────────────────────────
    playerSearch.addEventListener('input', e => {
        const term = e.target.value.toLowerCase();
        const filtered = allData.filter(p => p.minecraft_ign.toLowerCase().includes(term));
        renderRankings(filtered);
    });

    // ─── KIT FILTER ───────────────────────────────────────────────────────────
    kitButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            kitButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategory = btn.dataset.category;

            if (currentCategory === 'all') {
                renderRankings(allData);
            } else {
                const filterCat = normalizeCategory(currentCategory);
                const filtered = allData.filter(p =>
                    (p.tiers || []).some(t => normalizeCategory(t.category) === filterCat)
                );
                renderRankings(filtered);
            }
        });
    });

    // ─── KEYBOARD SHORTCUT ( / = search, Esc = close modal ) ─────────────────
    document.addEventListener('keydown', e => {
        if (e.key === '/' && document.activeElement !== playerSearch) {
            e.preventDefault();
            playerSearch.focus();
            playerSearch.select();
        }
        if (e.key === 'Escape') { closeModal(); playerSearch.blur(); }
    });

    // ─── ANIMATED COUNTER ─────────────────────────────────────────────────────
    function animateCount(el, target) {
        let start = null;
        const dur = 900;
        const step = ts => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / dur, 1);
            el.textContent = Math.floor(p * target);
            if (p < 1) requestAnimationFrame(step);
            else el.textContent = target;
        };
        requestAnimationFrame(step);
    }

    // ─── TOAST NOTIFICATION ───────────────────────────────────────────────────
    function showToast(msg, type = 'info') {
        document.querySelector('.live-toast')?.remove();
        const t = document.createElement('div');
        t.className = `live-toast toast-${type}`;
        t.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'rotate'}"></i> ${msg}`;
        document.body.appendChild(t);
        setTimeout(() => t.classList.add('toast-visible'), 10);
        setTimeout(() => { t.classList.remove('toast-visible'); setTimeout(() => t.remove(), 400); }, 3200);
    }

    // ─── PLAYER PROFILE MODAL ─────────────────────────────────────────────────
    const modal = document.createElement('div');
    modal.id = 'playerModal';
    modal.className = 'player-modal';
    modal.innerHTML = `<div class="modal-backdrop"></div><div class="modal-card"><button class="modal-close" id="modalClose"><i class="fa-solid fa-xmark"></i></button><div id="modalContent"></div></div>`;
    document.body.appendChild(modal);

    document.getElementById('modalClose').addEventListener('click', closeModal);
    modal.querySelector('.modal-backdrop').addEventListener('click', closeModal);

    function closeModal() { modal.classList.remove('modal-open'); document.body.classList.remove('modal-active'); }

    function openModal(player, rank) {
        const processedTiers = (player.tiers || []).reduce((acc, cur) => {
            const cat = normalizeCategory(cur.category);
            const ex = acc.find(t => normalizeCategory(t.category) === cat);
            if (!ex) acc.push({ ...cur, category: cat });
            else if (getTierVal(cur.tier) > getTierVal(ex.tier)) Object.assign(ex, { ...cur, category: cat });
            return acc;
        }, []).sort((a, b) => getTierVal(b.tier) - getTierVal(a.tier));

        const kitsHtml = processedTiers.map(t => {
            const cleanTier = (t.tier || '').toUpperCase().replace(';', '').trim();
            const displayCat = KIT_DISPLAY[t.category.toLowerCase()] || t.category;
            const icon = KIT_ICONS[Object.keys(KIT_ICONS).find(k => k.toLowerCase() === displayCat.toLowerCase())] || KIT_ICONS['Sword'];
            return `
                <div class="modal-kit-row">
                    <img src="${icon}" alt="${displayCat}">
                    <span class="modal-kit-name">${displayCat}</span>
                    <span class="modal-kit-tier np-tier-${cleanTier.toLowerCase()}">${cleanTier}</span>
                    <button class="remove-tier-btn" data-userid="${player.user_id}" data-category="${t.category}">
                        <i class="fa-solid fa-trash"></i> Remove
                    </button>
                </div>`;
        }).join('') || '<p style="color:var(--text-muted);font-size:0.85rem">No kits rated yet.</p>';

        const bestVal = getBestTierValue(player.tiers || []);
        const region = (player.region || 'AS').toUpperCase();

        document.getElementById('modalContent').innerHTML = `
            <div class="modal-header">
                <img class="modal-avatar" src="https://mc-heads.net/avatar/${player.minecraft_ign}/128" alt="${player.minecraft_ign}">
                <div class="modal-glow"></div>
                <div class="modal-rank-badge">#${rank}</div>
            </div>
            <div class="modal-body">
                <h2 class="modal-name">${player.minecraft_ign}</h2>
                <div class="modal-subtitle">${getTitle(bestVal)}</div>
                <div class="modal-tags">
                    <span class="region-badge region-${region}">${region}</span>
                    <span class="modal-tag-kits"><i class="fa-solid fa-layer-group"></i> ${processedTiers.length} Kit${processedTiers.length !== 1 ? 's' : ''}</span>
                </div>
                <div class="modal-divider"></div>
                <div class="modal-kits-title">RATED KITS</div>
                <div class="modal-kits">${kitsHtml}</div>
            </div>`;
        modal.classList.add('modal-open');
        document.body.classList.add('modal-active');
    }

    // ─── TOP 3 PODIUM ─────────────────────────────────────────────────────────
    function renderPodium(top3) {
        document.getElementById('podiumSection')?.remove();
        if (!top3 || top3.length < 1) return;

        const order = [top3[1], top3[0], top3[2]].filter(Boolean);
        const podium = document.createElement('div');
        podium.id = 'podiumSection';
        podium.className = 'podium-section';
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

    setInterval(async () => {
        try {
            const res = await fetch(`${API_BASE}/api/tiers`);
            const data = await res.json();
            if (JSON.stringify(data) !== JSON.stringify(allData)) {
                allData = data;
                animateCount(statPlayers, allData.length);
                renderRankings(allData);
                showToast('Rankings updated live!', 'success');
            }
        } catch (e) { }
    }, 30000);

    fetchRankings();
    
    function renderQueue(queue, isOpen) {
        const qCount = document.getElementById('statQueueCount');
        if (qCount) qCount.textContent = queue.length;

        const qStatusText = document.getElementById('queueStatusText');
        if (qStatusText) qStatusText.textContent = isOpen ? 'QUEUE OPEN' : 'QUEUE CLOSED';

        const qList = document.getElementById('queueList');
        if (!qList) return;

        if (queue.length === 0) {
            qList.innerHTML = '<div class="tcp-empty">The queue is currently empty.</div>';
            return;
        }

        qList.innerHTML = queue.map((q, i) => {
            const time = new Date(q.join_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="player-row" style="height: 50px; padding: 0 15px;">
                    <div class="rank-box" style="width: 30px;">${i + 1}</div>
                    <div class="col-player">
                        <span style="font-weight: 700;">${q.minecraft_ign || 'Member'}</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted); margin-left: 10px;">Joined ${time}</span>
                    </div>
                    <div class="col-region" style="width: auto;">
                        <span class="region-badge region-AS">${q.category}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    setInterval(fetchQueue, 10000);
    fetchQueue();

    // Row click → open modal
    rankingsList.addEventListener('click', e => {
        const row = e.target.closest('.player-row');
        if (!row) return;
        const rows = [...rankingsList.querySelectorAll('.player-row')];
        const idx = rows.indexOf(row);
        if (idx === -1) return;
        const sorted = [...allData].map(p => ({
            ...p,
            bestVal: getBestTierValue(p.tiers || []),
            title: getTitle(getBestTierValue(p.tiers || []))
        })).sort((a, b) => b.bestVal - a.bestVal || (b.tiers || []).length - (a.tiers || []).length);
        if (sorted[idx]) openModal(sorted[idx], idx + 1);
    });

    // ─── ADMIN LOGIC ──────────────────────────────────────────────────────────
    const adminModal = document.getElementById('adminModal');
    const adminLoginBtn = document.getElementById('adminLoginBtn');
    const adminModalClose = document.getElementById('adminModalClose');
    const adminLoginSubmit = document.getElementById('adminLoginSubmit');
    const adminPasswordInput = document.getElementById('adminPassword');

    if (ADMIN_TOKEN) document.body.classList.add('is-admin');

    adminLoginBtn?.addEventListener('click', () => {
        adminModal.classList.add('modal-open');
    });

    adminModalClose?.addEventListener('click', () => {
        adminModal.classList.remove('modal-open');
    });

    adminLoginSubmit?.addEventListener('click', async () => {
        const password = adminPasswordInput.value;
        try {
            const res = await fetch(`${API_BASE}/api/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            const data = await res.json();
            if (data.success) {
                ADMIN_TOKEN = data.token;
                localStorage.setItem('adminToken', ADMIN_TOKEN);
                document.body.classList.add('is-admin');
                adminModal.classList.remove('modal-open');
                showToast('Logged in as Admin', 'success');
            } else {
                showToast('Invalid password', 'error');
            }
        } catch (e) {
            showToast('Login failed', 'error');
        }
    });

    // Handle Tier Removal
    document.addEventListener('click', async e => {
        const btn = e.target.closest('.remove-tier-btn');
        if (!btn) return;

        const { userid, category } = btn.dataset;
        if (!confirm(`Are you sure you want to remove the ${category} tier for this player?`)) return;

        try {
            const res = await fetch(`${API_BASE}/api/admin/remove-tier`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: userid, category, token: ADMIN_TOKEN })
            });
            const data = await res.json();
            if (data.success) {
                showToast('Tier removed successfully', 'success');
                closeModal();
                fetchRankings(); // Refresh list
            } else {
                showToast(data.error || 'Failed to remove tier', 'error');
            }
        } catch (e) {
            showToast('Connection error', 'error');
        }
    });

    // Mobile Menu Button Logic
    mobileMenuBtn?.addEventListener('click', () => {
        if (sidebar) {
            sidebar.scrollIntoView({ behavior: 'smooth', block: 'start' });
            // Add a brief highlight to the sidebar
            sidebar.style.boxShadow = '0 0 20px var(--primary)';
            setTimeout(() => { sidebar.style.boxShadow = ''; }, 1000);
        }
    });

    // Handle touch device specific behavior
    document.addEventListener('touchstart', function () { }, { passive: true });
});
