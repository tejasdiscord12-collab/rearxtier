document.addEventListener('DOMContentLoaded', () => {

    const GIST_ID = '62dcff9fb06d470d2b7bf5c1bdc63cf2';
    const GIST_RAW_BASE = `https://gist.githubusercontent.com/tejasdiscord12-collab/${GIST_ID}/raw/`;

    const rankingsList = document.getElementById('rankingsList');
    const playerSearch = document.getElementById('playerSearch');
    const kitList = document.getElementById('kitList');
    const playerModal = document.getElementById('playerModal');
    const modalAvatar = document.getElementById('modalAvatar');
    const modalName = document.getElementById('modalName');
    const modalRegion = document.getElementById('modalRegion');
    const modalTiers = document.getElementById('modalTiers');
    const playerModalClose = document.getElementById('playerModalClose');

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
            detectKits(allData);
            renderRankings(allData);
        } catch (e) {
            console.error('Fetch Failed:', e);
            if (rankingsList) rankingsList.innerHTML = `<div class="loading-state"><span>Failed to load: ${e.message}</span></div>`;
        }
    }

    function detectKits(data) {
        if (!kitList) return;
        const kits = new Set(['all']);
        data.forEach(p => (p.tiers || []).forEach(t => kits.add(normalizeCategory(t.category))));
        const kitArray = Array.from(kits).map(k => k === 'all' ? k : k.charAt(0).toUpperCase() + k.slice(1));
        kitList.innerHTML = kitArray.map(k => `
            <button class="kit-btn ${currentCategory === k.toLowerCase() ? 'active' : ''}" data-category="${k.toLowerCase()}">
                <span>${k} Rankings</span>
            </button>
        `).join('');

        kitList.querySelectorAll('.kit-btn').forEach(btn => btn.onclick = () => {
            currentCategory = btn.dataset.category;
            kitList.querySelectorAll('.kit-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderRankings(allData);
        });
    }

    function renderRankings(data) {
        if (!rankingsList) return;
        rankingsList.innerHTML = '';
        const normalizedCurrent = currentCategory.toLowerCase();
        let filtered = normalizedCurrent === 'all' 
            ? data.map(p => ({ ...p, bestVal: getBestTierValue(p.tiers) })).sort((a,b) => b.bestVal - a.bestVal)
            : data.filter(p => (p.tiers || []).some(t => normalizeCategory(t.category) === normalizedCurrent))
                .map(p => ({ ...p, currentTier: p.tiers.find(ti => normalizeCategory(ti.category) === normalizedCurrent).tier }))
                .sort((a,b) => getTierVal(b.currentTier) - getTierVal(a.currentTier));

        filtered.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'player-row';
            row.innerHTML = `
                <div class="col-rank">#${index + 1}</div>
                <div class="col-player">
                    <img src="https://mc-heads.net/avatar/${player.minecraft_ign}/32">
                    <span>${player.minecraft_ign}</span>
                </div>
                <div class="col-region">${player.region || 'AS'}</div>
                <div class="col-kits">
                    ${(player.tiers || []).map(t => `<span class="tier-badge tier-${t.tier.toLowerCase().replace(';', '')}">${t.category}: ${t.tier}</span>`).join('')}
                </div>
            `;
            row.onclick = () => openPlayerModal(player);
            rankingsList.appendChild(row);
        });
    }

    function openPlayerModal(player) {
        if (!playerModal) return;
        modalName.textContent = player.minecraft_ign;
        modalAvatar.src = `https://mc-heads.net/body/${player.minecraft_ign}`;
        modalRegion.textContent = player.region || 'AS';
        modalTiers.innerHTML = (player.tiers || []).map(t => `
            <div style="background:rgba(255,255,255,0.03); padding:15px; border-radius:10px; border:1px solid var(--border);">
                <div style="font-weight:900; color:var(--primary); font-size:1.1rem;">${t.tier}</div>
                <div style="font-size:0.65rem; color:#666; text-transform:uppercase; letter-spacing:1px;">${t.category}</div>
            </div>
        `).join('');
        playerModal.classList.add('active');
    }

    playerSearch?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allData.filter(p => p.minecraft_ign.toLowerCase().includes(term));
        renderRankings(filtered);
    });

    playerModalClose?.addEventListener('click', () => playerModal.classList.remove('active'));
    window.addEventListener('click', (e) => { if (e.target === playerModal) playerModal.classList.remove('active'); });

    fetchRankings();
});
