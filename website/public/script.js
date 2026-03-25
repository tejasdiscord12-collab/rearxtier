document.addEventListener('DOMContentLoaded', () => {

    // ─── CONFIGURATION (v6.0) ────────────────────────────────────────────────
    const GIST_ID = '62dcff9fb06d470d2b7bf5c1bdc63cf2';
    const GIST_RAW_BASE = `https://gist.githubusercontent.com/tejasdiscord12-collab/${GIST_ID}/raw/`;

    // ─── DOM REFS ────────────────────────────────────────────────────────────
    const rankingsList = document.getElementById('rankingsList');
    const playerSearch = document.getElementById('playerSearch');
    const kitList = document.getElementById('kitList');
    const podiumContainer = document.getElementById('podiumContainer');
    const statPlayers = document.getElementById('statPlayers');
    const statQueueCount = document.getElementById('statQueueCount');
    
    // Modals
    const playerModal = document.getElementById('playerModal');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalName = document.getElementById('modalName');
    const modalTitle = document.getElementById('modalTitle');
    const modalRegion = document.getElementById('modalRegion');
    const modalTiers = document.getElementById('modalTiers');
    const playerModalClose = document.getElementById('playerModalClose');

    const TIER_VALUES = {
        'HT1': 100, 'LT1': 95, 'HT2': 90, 'LT2': 85,
        'HT3': 80, 'LT3': 75, 'HT4': 70, 'LT4': 65,
        'HT5': 60, 'LT5': 55
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
            
            // Sync Stats
            if (statPlayers) statPlayers.textContent = allData.length;
            
            detectKits(allData);
            renderRankings(allData);
        } catch (e) {
            console.error('Fetch Failed:', e);
            if (rankingsList) rankingsList.innerHTML = `<div class="loading-state"><span>System Failure: ${e.message}</span></div>`;
        }
    }

    function detectKits(data) {
        if (!kitList) return;
        const kits = new Set(['all']);
        data.forEach(p => (p.tiers || []).forEach(t => kits.add(normalizeCategory(t.category))));
        
        const kitArray = Array.from(kits).map(k => k === 'all' ? k : k.charAt(0).toUpperCase() + k.slice(1));
        kitList.innerHTML = kitArray.map(k => `
            <button class="kit-btn ${currentCategory === k.toLowerCase() ? 'active' : ''}" data-category="${k.toLowerCase()}">
                <span>${k}</span>
            </button>
        `).join('');

        kitList.querySelectorAll('.kit-btn').forEach(btn => btn.onclick = () => {
            currentCategory = btn.dataset.category;
            kitList.querySelectorAll('.kit-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRankings(allData);
            window.scrollTo({ top: 400, behavior: 'smooth' });
        });
    }

    function renderRankings(data) {
        if (!rankingsList) return;
        rankingsList.innerHTML = '';
        
        const normalizedCurrent = currentCategory.toLowerCase();
        let filtered = normalizedCurrent === 'all' 
            ? data.map(p => ({ ...p, bestVal: getBestTierValue(p.tiers), title: getTitle(getBestTierValue(p.tiers)) })).sort((a,b) => b.bestVal - a.bestVal)
            : data.filter(p => (p.tiers || []).some(t => normalizeCategory(t.category) === normalizedCurrent))
                .map(p => {
                    const t = p.tiers.find(ti => normalizeCategory(ti.category) === normalizedCurrent);
                    return { ...p, currentTier: t.tier, tierVal: getTierVal(t.tier), title: getTitle(getTierVal(t.tier)) };
                })
                .sort((a,b) => b.tierVal - a.tierVal);

        if (normalizedCurrent === 'all') renderPodium(filtered.slice(0, 3));
        else if (podiumContainer) podiumContainer.innerHTML = '';

        filtered.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'player-row';
            const rank = index + 1;
            const rankStamp = rank <= 3 ? ['🥇', '🥈', '🥉'][rank-1] : rank;

            row.innerHTML = `
                <div class="col-rank">${rankStamp}</div>
                <div class="col-player">
                    <img src="https://mc-heads.net/avatar/${player.minecraft_ign}/42" class="player-head">
                    <div>
                        <div class="player-name">${player.minecraft_ign}</div>
                        <div class="player-subtitle"><i class="fa-solid fa-medal"></i> ${player.title}</div>
                    </div>
                </div>
                <div class="col-region">${player.region || 'AS'}</div>
                <div class="col-tiers">
                    ${(player.tiers || []).slice(0, 6).map(t => `
                        <div class="tier-chip ${t.tier.toLowerCase().replace(';', '')}" data-tooltip="${t.category}: ${t.tier}">
                            <img src="${getIcon(t.category)}" style="width:14px;">
                            <span>${t.tier}</span>
                        </div>
                    `).join('')}
                </div>
            `;
            row.onclick = () => openPlayerModal(player);
            rankingsList.appendChild(row);
        });
    }

    function getIcon(cat) {
        const c = normalizeCategory(cat);
        const icons = {
            'sword': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/diamond_sword.png',
            'nethpot': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/netherite_chestplate.png',
            'axe': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/diamond_axe.png',
            'uhc': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/golden_apple.png',
            'crystal': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/end_crystal.png',
            'smpkit': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/ender_pearl.png',
            'mace': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.21/assets/minecraft/textures/item/mace.png',
            'diapot': 'https://raw.githubusercontent.com/InventivetalentDev/minecraft-assets/1.20.1/assets/minecraft/textures/item/diamond_chestplate.png'
        };
        return icons[c] || icons['sword'];
    }

    function renderPodium(top3) {
        if (!podiumContainer) return;
        podiumContainer.innerHTML = `
            <div class="podium-grid">
                ${top3[1] ? `<div class="podium-node spot-2"><img src="https://mc-heads.net/body/${top3[1].minecraft_ign}/100" class="podium-body"><h3>${top3[1].minecraft_ign}</h3><p>🥈 #${top3[1].bestVal}</p><div class="podium-base"></div></div>` : ''}
                ${top3[0] ? `<div class="podium-node spot-1"><img src="https://mc-heads.net/body/${top3[0].minecraft_ign}/120" class="podium-body"><h3>${top3[0].minecraft_ign}</h3><p>🥇 #${top3[0].bestVal}</p><div class="podium-base"></div></div>` : ''}
                ${top3[2] ? `<div class="podium-node spot-3"><img src="https://mc-heads.net/body/${top3[2].minecraft_ign}/100" class="podium-body"><h3>${top3[2].minecraft_ign}</h3><p>🥉 #${top3[2].bestVal}</p><div class="podium-base"></div></div>` : ''}
            </div>
        `;
    }

    function openPlayerModal(player) {
        if (!playerModal) return;
        modalName.textContent = player.minecraft_ign;
        modalAvatar.src = `https://mc-heads.net/body/${player.minecraft_ign}`;
        modalRegion.textContent = player.region || 'AS';
        modalTitle.textContent = getTitle(getBestTierValue(player.tiers));
        modalTiers.innerHTML = (player.tiers || []).map(t => `
            <div class="modal-tier-card">
                <div class="mtc-val">${t.tier}</div>
                <div class="mtc-cat">${t.category}</div>
            </div>
        `).join('');
        playerModal.classList.add('active');
    }

    playerSearch?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allData.filter(p => p.minecraft_ign.toLowerCase().includes(term));
        renderRankings(filtered);
    });

    playerModalClose?.onclick = () => playerModal.classList.remove('active');
    window.onclick = (e) => { if (e.target === playerModal) playerModal.classList.remove('active'); };

    fetchRankings();
    setInterval(fetchRankings, 60000);
});
