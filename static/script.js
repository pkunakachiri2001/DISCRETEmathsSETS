python app.pydocument.addEventListener('DOMContentLoaded', function() {
    const addMemberBtn = document.getElementById('add-member');
    const memberListDiv = document.getElementById('member-list');
    const compareBtn = document.getElementById('compare-btn');
    const resultsDiv = document.getElementById('results');

    function showNextMemberInput() {
        const members = memberListDiv.querySelectorAll('.member-list');
        members.forEach((div, idx) => {
            if (idx === members.length - 1) {
                div.style.display = 'flex';
                div.querySelector('.member-name').focus();
            } else {
                div.style.display = 'none';
            }
        });
    }

    function hideCurrentAndAddNext(currentDiv) {
        currentDiv.style.display = 'none';
        addMemberBtn.click();
        showNextMemberInput();
    }

    addMemberBtn.addEventListener('click', function() {
        const memberDiv = document.createElement('div');
        memberDiv.className = 'member-list';
        memberDiv.innerHTML = `<input type="text" placeholder="Member Name" class="member-name" required> <input type="text" placeholder="Grocery items (comma separated)" class="member-items" required> <button type="button" class="remove-member">✖</button>`;
        memberListDiv.appendChild(memberDiv);
        memberDiv.querySelector('.remove-member').onclick = () => {
            memberDiv.remove();
            showNextMemberInput();
        };
        // Hide previous member input
        showNextMemberInput();
        // Add event to hide and show next on Enter or blur
        const nameInput = memberDiv.querySelector('.member-name');
        const itemsInput = memberDiv.querySelector('.member-items');
        itemsInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                hideCurrentAndAddNext(memberDiv);
            }
        });
        itemsInput.addEventListener('blur', function() {
            if (nameInput.value.trim() && itemsInput.value.trim()) {
                hideCurrentAndAddNext(memberDiv);
            }
        });
    });

    // Initial state: only show first member input
    showNextMemberInput();

    compareBtn.addEventListener('click', function() {
        const members = document.querySelectorAll('.member-list');
        const lists = {};
        members.forEach(div => {
            const name = div.querySelector('.member-name').value.trim();
            const items = div.querySelector('.member-items').value.split(',').map(i => i.trim()).filter(i => i);
            if (name && items.length) lists[name] = items;
        });
        fetch('/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lists })
        })
        .then(res => res.json())
        .then(data => {
            resultsDiv.innerHTML = `<h2>Items everyone needs</h2><ul>${data.everyone_needs.map(i => `<li>${i}</li>`).join('')}</ul>
                <h2>Items unique to each member</h2>${Object.entries(data.unique_items).map(([k,v]) => `<b>${k}:</b> <ul>${v.map(i => `<li>${i}</li>`).join('')}</ul>`).join('')}
                <h2>Items suggested by only one person</h2><ul>${data.suggested_by_one.map(i => `<li>${i}</li>`).join('')}</ul>`;
        });
    });
});
