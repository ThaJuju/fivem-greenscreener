'use strict';

let resourceName = 'fivem-greenscreener';
let openedViaPanel = false;

const CLOTHING_COMPONENTS = {
    clothing: [
        { id: 1,  name: 'Masques' },
        { id: 2,  name: 'Coiffures' },
        { id: 3,  name: 'Torses' },
        { id: 4,  name: 'Jambes' },
        { id: 5,  name: 'Sacs' },
        { id: 6,  name: 'Chaussures' },
        { id: 7,  name: 'Accessoires' },
        { id: 8,  name: 'Sous-vêtements' },
        { id: 9,  name: 'Armure / Gilet' },
        { id: 10, name: 'Décalques' },
        { id: 11, name: 'Hauts' },
    ],
    props: [
        { id: 0, name: 'Chapeaux' },
        { id: 1, name: 'Lunettes' },
        { id: 2, name: 'Oreilles' },
        { id: 6, name: 'Montres' },
        { id: 7, name: 'Bracelets' },
    ],
};

const TAB_TITLES = {
    clothing:         'Vêtements',
    vehicles:         'Véhicules',
    weapons:          'Armes',
    weaponComponents: 'Accessoires armes',
    objects:          'Objets',
};

// ── Helpers ──────────────────────────────────────────────

function nuiCallback(name, data = {}) {
    return fetch(`https://${resourceName}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    }).catch(() => {});
}

function el(id) { return document.getElementById(id); }

function activeTab() {
    return document.querySelector('.tab.active')?.dataset.tab ?? 'clothing';
}

// ── Progress widget (visible pendant les screenshots) ─────

function showWidget(label, count, pct) {
    el('pw-label').textContent = label;
    el('pw-count').textContent = count;
    el('pw-bar').style.width = pct + '%';
    el('progress-widget').style.display = 'flex';
}

function updateWidget(label, value, max) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    el('pw-label').textContent = label;
    el('pw-count').textContent = `${value} / ${max}`;
    el('pw-bar').style.width = pct + '%';
}

function hideWidget() {
    el('progress-widget').style.display = 'none';
    el('pw-bar').style.width = '0%';
}

function startScreenshotsUI() {
    el('overlay').style.display = 'none';
    el('pw-pause').classList.remove('hidden');
    el('pw-resume').classList.add('hidden');
    el('pw-stop').classList.remove('hidden');
    showWidget('Initialisation…', '—', 0);
}

function setWidgetFinished(label) {
    el('pw-label').textContent = label;
    el('pw-count').textContent = '';
    el('pw-bar').style.width = label === 'Terminé' ? '100%' : el('pw-bar').style.width;
    el('pw-controls').style.display = 'none';
    nuiCallback('releaseUI');
    setTimeout(() => {
        hideWidget();
        el('pw-controls').style.display = '';
    }, 2000);
}

function onDone()         { setWidgetFinished('Terminé'); }
function onStopped()      { setWidgetFinished('Arrêté'); }
function onError(msg)     { setWidgetFinished(msg || 'Erreur'); }

el('pw-pause').addEventListener('click', () => {
    nuiCallback('pauseScreenshots');
    el('pw-pause').classList.add('hidden');
    el('pw-resume').classList.remove('hidden');
    el('pw-label').textContent = 'En pause…';
});

el('pw-resume').addEventListener('click', () => {
    nuiCallback('resumeScreenshots');
    el('pw-resume').classList.add('hidden');
    el('pw-pause').classList.remove('hidden');
});

el('pw-stop').addEventListener('click', () => {
    nuiCallback('stopScreenshots');
    el('pw-pause').classList.add('hidden');
    el('pw-resume').classList.add('hidden');
    el('pw-stop').classList.add('hidden');
    el('pw-label').textContent = 'Arrêt en cours…';
});

// ── UI open / close ───────────────────────────────────────

function openPanel() {
    openedViaPanel = true;
    hideWidget();
    el('overlay').style.display = 'flex';
    el('start-btn').disabled = false;
    el('footer-hint').textContent = 'ESC pour fermer';
}

function closeOverlay() {
    el('overlay').style.display = 'none';
    openedViaPanel = false;
    nuiCallback('closeUI');
}

// ── Tab switching ─────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        el(`panel-${tab.dataset.tab}`).classList.add('active');
        el('header-title').textContent = TAB_TITLES[tab.dataset.tab];
    });
});

// ── Close button + ESC ───────────────────────────────────

el('close-btn').addEventListener('click', closeOverlay);

document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && el('overlay').style.display !== 'none') {
        closeOverlay();
    }
});

// ── Clothing: toggle custom fields ───────────────────────

function populateClothingComponents() {
    const type = el('clothing-type').value;
    const sel = el('clothing-component');
    sel.innerHTML = '';
    CLOTHING_COMPONENTS[type].forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = `${c.id} — ${c.name}`;
        sel.appendChild(opt);
    });
}

el('clothing-type').addEventListener('change', populateClothingComponents);
populateClothingComponents();

document.querySelectorAll('input[name="clothing-mode"]').forEach(r => {
    r.addEventListener('change', () => {
        const custom = document.querySelector('input[name="clothing-mode"]:checked').value === 'custom';
        el('clothing-custom-fields').classList.toggle('disabled', !custom);
    });
});

// ── Vehicle color palette ─────────────────────────────────

// [r, g, b, name] — GTA V paint colors 0–159
const GTA_COLORS = [
    [13,17,22,'Metallic Black'],[28,29,28,'Metallic Graphite Black'],[31,31,31,'Metallic Black Steal'],
    [69,69,69,'Metallic Dark Silver'],[153,157,160,'Metallic Silver'],[116,134,140,'Metallic Blue Silver'],
    [95,101,112,'Metallic Steel Gray'],[163,171,176,'Metallic Shadow Silver'],[131,134,130,'Metallic Stone Silver'],
    [83,89,96,'Metallic Midnight Silver'],[71,80,85,'Metallic Gun Metal'],[52,55,55,'Metallic Anthracite Grey'],
    [31,31,31,'Matte Black'],[84,88,89,'Matte Gray'],[168,170,171,'Matte Light Gray'],
    [20,20,20,'Util Black'],[26,30,35,'Util Black Poly'],[83,89,96,'Util Dark Silver'],
    [156,159,162,'Util Silver'],[71,80,85,'Util Gun Metal'],[107,110,113,'Util Shadow Silver'],
    [40,37,35,'Worn Black'],[65,60,55,'Worn Graphite'],[143,142,135,'Worn Silver Grey'],
    [172,173,163,'Worn Silver'],[119,125,126,'Worn Blue Silver'],[101,102,100,'Worn Shadow Silver'],
    [188,32,32,'Metallic Red'],[217,47,39,'Metallic Torino Red'],[195,23,25,'Metallic Formula Red'],
    [229,60,51,'Metallic Blaze Red'],[199,63,57,'Metallic Grace Red'],[139,60,63,'Metallic Garnet Red'],
    [199,138,138,'Metallic Desert Rose'],[125,28,35,'Metallic Cabernet Red'],[219,40,56,'Metallic Candy Red'],
    [226,120,40,'Metallic Sunrise Orange'],[204,168,48,'Metallic Classic Gold'],[230,106,34,'Metallic Orange'],
    [199,50,43,'Matte Red'],[136,29,27,'Matte Dark Red'],[219,108,44,'Matte Orange'],
    [234,206,60,'Matte Yellow'],[199,50,43,'Util Red'],[222,67,54,'Util Bright Red'],
    [139,60,63,'Util Garnet Red'],[163,91,76,'Worn Red'],[191,112,83,'Worn Golden Red'],
    [119,62,58,'Worn Dark Red'],
    [37,67,40,'Metallic Dark Green'],[24,73,41,'Metallic Racing Green'],[44,102,81,'Metallic Sea Green'],
    [85,103,54,'Metallic Olive Green'],[42,131,54,'Metallic Green'],[39,107,89,'Metallic Gasoline Blue Green'],
    [152,203,73,'Matte Lime Green'],[77,127,60,'Matte Green'],[184,192,152,'Matte Pale Green'],
    [97,112,72,'Matte Olive Drab'],[37,67,40,'Util Dark Green'],[42,131,54,'Util Green'],
    [90,113,80,'Worn Medium Green'],[140,168,92,'Worn Lime Green'],[55,79,52,'Worn Dark Green'],
    [27,55,88,'Metallic Midnight Blue'],[27,43,91,'Metallic Dark Blue'],[52,83,144,'Metallic Saxony Blue'],
    [52,102,171,'Metallic Blue'],[64,121,160,'Metallic Mariner Blue'],[37,79,153,'Metallic Harbor Blue'],
    [52,126,199,'Metallic Diamond Blue'],[52,160,206,'Metallic Surf Blue'],[40,105,149,'Metallic Nautical Blue'],
    [43,147,218,'Metallic Bright Blue'],[74,49,137,'Metallic Purple Blue'],[34,94,185,'Metallic Spinnaker Blue'],
    [40,60,200,'Metallic Ultra Blue'],[35,47,150,'Metallic Series Blue'],[27,43,91,'Util Dark Blue'],
    [27,55,88,'Util Midnight Blue'],[52,102,171,'Util Blue'],[64,121,160,'Util Sea Foam Blue'],
    [52,126,199,'Util Lightning Blue'],[52,160,206,'Util Maui Blue Poly'],[77,132,181,'Util Brighton Blue'],
    [35,47,70,'Worn Dark Blue'],[49,72,120,'Worn Blue'],[90,121,160,'Worn Light Blue'],
    [230,192,35,'Metallic Taxi Yellow'],[242,218,52,'Metallic Race Yellow'],[166,122,51,'Metallic Bronze'],
    [237,204,56,'Metallic Yellow Bird'],[162,202,43,'Metallic Lime'],[204,180,122,'Metallic Champagne'],
    [183,161,111,'Metallic Pueblo Beige'],[207,195,157,'Metallic Dark Ivory'],[95,74,58,'Metallic Choco Brown'],
    [143,105,66,'Metallic Golden Brown'],[174,143,101,'Metallic Light Brown'],[212,182,131,'Metallic Straw Beige'],
    [117,127,68,'Metallic Moss Brown'],[109,80,49,'Metallic Biston Brown'],[140,112,72,'Metallic Beechwood'],
    [91,67,42,'Metallic Dark Beechwood'],[167,101,58,'Metallic Choco Orange'],[212,184,136,'Metallic Beach Sand'],
    [224,133,34,'Metallic Sun Blaze Orange'],[141,80,52,'Metallic Dark Copper'],[121,101,72,'Matte Earthy Brown'],
    [195,182,144,'Matte Sand'],[95,74,58,'Util Brown'],[143,105,66,'Util Medium Brown'],
    [174,143,101,'Util Light Brown'],[106,86,64,'Worn Brown'],[71,58,45,'Worn Dark Brown'],
    [192,168,124,'Worn Straw Beige'],
    [238,240,240,'Metallic White'],[243,246,246,'Metallic Frost White'],[232,228,218,'Util Off White'],
    [207,202,192,'Worn White'],[220,214,196,'Worn Cream White'],[255,255,255,'Metallic Bright White'],
    [240,59,136,'Metallic Hot Pink'],[237,137,115,'Metallic Salmon Pink'],[205,57,100,'Metallic Raspberry Red'],
    [245,89,160,'Metallic Bright Pink'],[128,134,212,'Metallic Periwinkle'],[237,166,179,'Metallic Camellia Rose'],
    [228,57,58,'Metallic Cadmium Red'],[219,40,56,'Metallic Candy Red Classic'],[226,120,40,'Metallic Sunrise Orange 2'],
    [192,192,192,'Chrome'],
    [200,50,50,'Classic Red'],[210,120,50,'Classic Orange'],[220,200,50,'Classic Yellow'],
    [50,180,50,'Classic Green'],[50,180,180,'Classic Teal'],[50,50,200,'Classic Blue'],
    [150,50,200,'Classic Purple'],[200,50,150,'Classic Pink'],[180,170,140,'Classic Beige'],
    [100,70,40,'Classic Brown'],[60,100,60,'Classic Olive'],[30,80,120,'Classic Navy'],
    [220,140,80,'Classic Peach'],[80,180,220,'Classic Sky'],[160,80,160,'Classic Mauve'],
    [240,160,40,'Classic Amber'],[100,160,80,'Classic Sage'],[180,60,60,'Classic Crimson'],
    [60,140,140,'Classic Cyan'],[140,100,60,'Classic Caramel'],[200,200,100,'Classic Khaki'],
    [80,60,120,'Classic Indigo'],[220,100,100,'Classic Coral'],[100,140,180,'Classic Steel'],
    [160,140,100,'Classic Tan'],[60,80,60,'Classic Forest'],[180,140,180,'Classic Lavender'],
    [220,180,100,'Classic Gold'],
];

let colorTarget = 'primary';
const selectedColors = { primary: -1, secondary: -1 };

function renderColorPalette() {
    const palette = el('color-palette');
    palette.innerHTML = '';
    GTA_COLORS.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'color-swatch';
        div.style.backgroundColor = `rgb(${c[0]},${c[1]},${c[2]})`;
        div.title = `${i}${c[3] ? ' — ' + c[3] : ''}`;
        div.dataset.idx = i;
        div.addEventListener('click', () => applyColor(i));
        palette.appendChild(div);
    });
}

function applyColor(idx) {
    selectedColors[colorTarget] = idx;
    const c = GTA_COLORS[idx];
    const rgb = `rgb(${c[0]},${c[1]},${c[2]})`;
    el(`swatch-${colorTarget}`).style.backgroundColor = rgb;
    el(`label-${colorTarget}`).textContent = `${idx} — ${c[3] || ''}`;

    document.querySelectorAll('.color-swatch').forEach((s, i) => {
        s.classList.toggle('sel-primary',   selectedColors.primary   === i);
        s.classList.toggle('sel-secondary', selectedColors.secondary === i);
    });
}

function clearColors() {
    selectedColors.primary   = -1;
    selectedColors.secondary = -1;
    ['primary', 'secondary'].forEach(t => {
        el(`swatch-${t}`).style.backgroundColor = '';
        el(`label-${t}`).textContent = 'Aucune';
    });
    document.querySelectorAll('.color-swatch').forEach(s => {
        s.classList.remove('sel-primary', 'sel-secondary');
    });
}

document.querySelectorAll('.color-target-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        colorTarget = btn.dataset.target;
        document.querySelectorAll('.color-target-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

el('color-clear').addEventListener('click', clearColors);

renderColorPalette();

// ── Vehicles: toggle specific fields ─────────────────────

document.querySelectorAll('input[name="vehicle-mode"]').forEach(r => {
    r.addEventListener('change', () => {
        const specific = document.querySelector('input[name="vehicle-mode"]:checked').value === 'specific';
        el('vehicle-specific-fields').classList.toggle('disabled', !specific);
    });
});

// ── Weapons: toggle specific fields ──────────────────────

document.querySelectorAll('input[name="weapon-mode"]').forEach(r => {
    r.addEventListener('change', () => {
        const specific = document.querySelector('input[name="weapon-mode"]:checked').value === 'specific';
        el('weapon-specific-fields').classList.toggle('disabled', !specific);
    });
});

// ── Weapon components: toggle specific fields ─────────────

document.querySelectorAll('input[name="wcomp-mode"]').forEach(r => {
    r.addEventListener('change', () => {
        const specific = document.querySelector('input[name="wcomp-mode"]:checked').value === 'specific';
        el('wcomp-specific-fields').classList.toggle('disabled', !specific);
    });
});

// ── Start button ──────────────────────────────────────────

el('start-btn').addEventListener('click', () => {
    const tab = activeTab();
    const data = { category: tab };

    switch (tab) {
        case 'clothing': {
            data.mode   = document.querySelector('input[name="clothing-mode"]:checked').value;
            data.gender = document.querySelector('input[name="clothing-gender"]:checked').value;
            if (data.mode === 'custom') {
                data.clothingType = el('clothing-type').value;
                data.component    = el('clothing-component').value;
                data.drawable     = el('clothing-drawable').value.trim() || 'all';
            }
            break;
        }
        case 'vehicles': {
            data.mode = document.querySelector('input[name="vehicle-mode"]:checked').value;
            if (data.mode === 'specific') {
                data.model = el('vehicle-model').value.trim();
                if (!data.model) { alert('Entrez un modèle de véhicule.'); return; }
            }
            if (selectedColors.primary   >= 0) data.color1 = selectedColors.primary;
            if (selectedColors.secondary >= 0) data.color2 = selectedColors.secondary;
            break;
        }
        case 'weapons': {
            data.mode = document.querySelector('input[name="weapon-mode"]:checked').value;
            if (data.mode === 'specific') data.weapon = el('weapon-select').value;
            break;
        }
        case 'weaponComponents': {
            data.mode = document.querySelector('input[name="wcomp-mode"]:checked').value;
            if (data.mode === 'specific') data.weapon = el('wcomp-weapon-select').value;
            break;
        }
        case 'objects': {
            data.hash = el('object-hash').value.trim();
            if (!data.hash) { alert("Entrez le hash de l'objet."); return; }
            break;
        }
    }

    nuiCallback('startScreenshots', data);
    startScreenshotsUI();
});

// ── NUI messages from client.js ───────────────────────────

window.addEventListener('message', event => {
    const data = event.data;

    // Open UI from /greenscreener command
    if (data.uiAction === 'open') {
        if (data.resourceName) resourceName = data.resourceName;

        if (data.weapons) {
            const wSel = el('weapon-select');
            wSel.innerHTML = '';
            data.weapons.forEach(w => {
                const opt = document.createElement('option');
                opt.value = w;
                opt.textContent = w;
                wSel.appendChild(opt);
            });
        }

        if (data.weaponComponents) {
            const wcSel = el('wcomp-weapon-select');
            wcSel.innerHTML = '';
            data.weaponComponents.forEach(w => {
                const opt = document.createElement('option');
                opt.value = w;
                opt.textContent = w;
                wcSel.appendChild(opt);
            });
        }

        openPanel();
        return;
    }

    // Progress: start (déclenché par commande chat ou par le panel)
    if (data.hasOwnProperty('start')) {
        el('overlay').style.display = 'none';
        showWidget('Initialisation…', '—', 0);
        return;
    }

    // Progress: update
    if (data.hasOwnProperty('value') && data.hasOwnProperty('max') && !data.hasOwnProperty('uiAction')) {
        updateWidget(data.type ?? '', data.value, data.max);
        return;
    }

    // Progress: done
    if (data.hasOwnProperty('end')) { onDone(); return; }

    // Progress: stopped
    if (data.hasOwnProperty('stopped')) { onStopped(); return; }

    // Progress: error
    if (data.hasOwnProperty('error')) {
        onError(data.error === 'weathersync' ? 'Désactive weathersync !' : 'Erreur');
        return;
    }
});
