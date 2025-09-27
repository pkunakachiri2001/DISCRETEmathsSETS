document.addEventListener('DOMContentLoaded', () => {
    // Core Elements
    const nameInput = document.getElementById('member-name');
    const itemsInput = document.getElementById('member-items');
    const addBtn = document.getElementById('add-member');
    const clearCurrentBtn = document.getElementById('clear-current');
    const membersRows = document.getElementById('members-rows');
    const memberCount = document.getElementById('member-count');
    const toggleMembersBtn = document.getElementById('toggle-members');
    const membersContainer = document.getElementById('members-container');
    const resetAllBtn = document.getElementById('reset-all');
    const compareBtn = document.getElementById('compare-btn');
    const resultsWrapper = document.getElementById('results');
    const resultsContent = document.getElementById('results-content');
    const livePreview = document.getElementById('live-preview');
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const modalClose = helpModal?.querySelector('.modal-close');
    const loadingOverlay = document.getElementById('loading-overlay');

    let currentStep = 1;
    const members = []; // {name, items:Array}

    function updateSteps() {
        document.querySelectorAll('.step').forEach(step => {
            const n = parseInt(step.getAttribute('data-step'));
            step.classList.remove('active', 'completed');
            if (n < currentStep) step.classList.add('completed');
            else if (n === currentStep) step.classList.add('active');
        });
    }

    function renderMembersTable() {
        membersRows.innerHTML = members.map((m, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${m.name}</td>
                <td class="items-cell">{${m.items.join(', ')}}</td>
                <td>${m.items.length}</td>
                <td><button class="row-remove" data-index="${i}"><i class="fas fa-times"></i></button></td>
            </tr>`).join('');
        memberCount.textContent = members.length;

        membersRows.querySelectorAll('.row-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-index'));
                members.splice(idx, 1);
                renderMembersTable();
                refreshStats();
                updateControls();
            });
        });
    }

    function addMember() {
        const name = nameInput.value.trim();
        const items = itemsInput.value.split(',').map(x => x.trim()).filter(Boolean);
        if (!name || items.length === 0) return;
        members.push({ name, items });
        nameInput.value = '';
        itemsInput.value = '';
        renderMembersTable();
        refreshStats();
        updateControls();
        currentStep = Math.max(currentStep, 2);
        updateSteps();
    }

    function updateControls() {
        if (members.length >= 2) {
            compareBtn.removeAttribute('disabled');
            document.getElementById('stat-ready').textContent = 'Yes';
            document.getElementById('stat-ready').classList.add('ok');
        } else {
            compareBtn.setAttribute('disabled', 'disabled');
            document.getElementById('stat-ready').textContent = 'No';
            document.getElementById('stat-ready').classList.remove('ok');
        }
        resetAllBtn.disabled = members.length === 0;
    }

    function refreshStats() {
        if (members.length === 0) {
            livePreview.classList.add('hidden');
            return;
        }
        livePreview.classList.remove('hidden');
        const union = new Set();
        members.forEach(m => m.items.forEach(i => union.add(i)));
        let intersection = [];
        if (members.length === 1) intersection = [...members[0].items];
        else {
            const sets = members.map(m => new Set(m.items));
            intersection = [...sets[0]].filter(it => sets.every(s => s.has(it)));
        }
        const freq = {};
        members.forEach(m => m.items.forEach(i => freq[i] = (freq[i] || 0) + 1));
        const exactlyOne = Object.entries(freq).filter(([,c]) => c === 1).length;
        const avgVal = members.length ? (members.reduce((acc,m)=>acc+m.items.length,0)/members.length).toFixed(1) : 0;

        document.getElementById('stat-members').textContent = members.length;
        document.getElementById('stat-union').textContent = union.size;
        document.getElementById('stat-intersection').textContent = intersection.length;
        document.getElementById('stat-exactly-one').textContent = exactlyOne;
        document.getElementById('stat-average').textContent = avgVal;
    }

    async function compare() {
        if (members.length < 2) return;
        showLoading();
        const lists = {};
        members.forEach(m => lists[m.name] = m.items);
        try {
            const res = await fetch('/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lists })
            });
            const data = await res.json();
            renderResults(data);
            currentStep = 3;
            updateSteps();
        } catch (e) {
            console.error(e);
            alert('Comparison failed');
        } finally { hideLoading(); }
    }

    function renderResults(data) {
        resultsWrapper.classList.remove('hidden');

        // Build deterministic colors for members (hash to hue)
        const colorMap = {};
        const usedHues = new Set();
        const hashToHue = (str) => {
            let h = 0; for (let i=0;i<str.length;i++) h = str.charCodeAt(i) + ((h<<5)-h);
            // Spread hues avoiding collisions by small increments
            let hue = Math.abs(h) % 360;
            while (usedHues.has(hue)) hue = (hue + 37) % 360; // jump to reduce similarity
            usedHues.add(hue);
            return hue;
        };
        Object.keys(data.unique_per_member).forEach(name => {
            const hue = hashToHue(name);
            colorMap[name] = `hsl(${hue} 75% 60%)`;
        });

        const uniquePerMemberHTML = Object.entries(data.unique_per_member).map(([member, arr]) => {
            const itemsHTML = (arr.length ? arr : ['—']).map((item, idx) => {
                if (item === '—') return `<span class="unique-item" style="color:${colorMap[member]};opacity:.55">${item}</span>`;
                const sep = idx === arr.length - 1 ? '' : ',';
                return `<span class="unique-item" style="color:${colorMap[member]}" data-sep="${sep}">${item}</span>`;
            }).join('');
            return `<div class="member-unique-line" style="--member-color:${colorMap[member]}; border-left:4px solid ${colorMap[member]};">
                <span class="member-color-dot" style="background:${colorMap[member]};"></span>
                <strong style="color:${colorMap[member]}">${member}</strong> only: <span class="unique-items-wrapper">${itemsHTML}</span>
            </div>`;
        }).join('');

        const legendHTML = `<div style="margin-top:.75rem; font-size:.6rem; letter-spacing:.4px; display:flex; flex-wrap:wrap; gap:.4rem;">
            ${Object.keys(colorMap).map(name => `<span style="display:inline-flex; align-items:center; gap:4px; background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:8px;">
                <span style="width:10px;height:10px;border-radius:50%;background:${colorMap[name]};box-shadow:0 0 0 2px rgba(0,0,0,0.25);"></span>${name}
            </span>`).join('')}
        </div>`;

        resultsContent.innerHTML = `
            <div class="results-grid">
                <div class="result-card">
                    <div class="result-operation">∪ Union <span class="op-desc">(All groceries anyone asked for)</span></div>
                    <div class="result-value">{${data.union.join(', ') || '—'}}</div>
                </div>
                <div class="result-card">
                    <div class="result-operation">∩ Intersection <span class="op-desc">(Groceries every member wants)</span></div>
                    <div class="result-value">{${data.intersection.join(', ') || '—'}}</div>
                </div>
                <div class="result-card">
                    <div class="result-operation">Exactly One <span class="op-desc">(Suggested by only one member)</span></div>
                    <div class="result-value">{${data.exactly_one.join(', ') || '—'}}</div>
                </div>
                <div class="result-card">
                    <div class="result-operation">Unique Per Member <span class="op-desc">(Exclusive groceries)</span></div>
                    <div class="result-value" style="font-family:inherit;">
                        ${uniquePerMemberHTML || '<em>No exclusive items</em>'}
                        ${legendHTML}
                    </div>
                </div>
                <div class="result-card">
                    <div class="result-operation">Cardinalities <span class="op-desc">(How many distinct items each member listed)</span></div>
                    <div class="result-value">${Object.entries(data.cardinalities).map(([k,v])=>`${k}: ${v} item${v===1?'':'s'}`).join('<br>')}</div>
                </div>
            </div>
            <div class="legend-note">Plain language: We translate math set operations into grocery meaning so non-math users understand the comparisons. Color legend shows which exclusive items belong to which member.</div>`;
        resultsWrapper.scrollIntoView({ behavior: 'smooth' });
    }

    function resetAll() {
        if (!members.length) return;
        if (!confirm('Clear all members?')) return;
        members.splice(0, members.length);
        renderMembersTable();
        refreshStats();
        updateControls();
        resultsWrapper.classList.add('hidden');
        currentStep = 1;
        updateSteps();
    }

    function showLoading() { loadingOverlay?.classList.remove('hidden'); }
    function hideLoading() { loadingOverlay?.classList.add('hidden'); }

    // Events
    addBtn.addEventListener('click', addMember);
    clearCurrentBtn.addEventListener('click', () => { nameInput.value=''; itemsInput.value=''; nameInput.focus(); });
    compareBtn.addEventListener('click', compare);
    resetAllBtn.addEventListener('click', resetAll);
    itemsInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addMember(); }});
    nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); itemsInput.focus(); }});

    toggleMembersBtn.addEventListener('click', () => {
        const expanded = toggleMembersBtn.getAttribute('aria-expanded') === 'true';
        toggleMembersBtn.setAttribute('aria-expanded', String(!expanded));
        membersContainer.classList.toggle('collapsed');
        toggleMembersBtn.querySelector('.label').textContent = expanded ? 'Show Members' : 'Hide Members';
        toggleMembersBtn.querySelector('i').classList.toggle('rot');
    });

    // Help modal
    helpBtn?.addEventListener('click', () => helpModal.classList.remove('hidden'));
    modalClose?.addEventListener('click', () => helpModal.classList.add('hidden'));
    helpModal?.addEventListener('click', e => { if (e.target === helpModal) helpModal.classList.add('hidden'); });

    updateSteps();
    updateControls();
});
