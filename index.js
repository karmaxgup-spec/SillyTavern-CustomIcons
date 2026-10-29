import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, renderExtensionTemplateAsync } from '../../../extensions.js';

const MODULE = 'topSidebar';
const EXTENSION_FOLDER = 'third-party/st-top-sidebar';

const GROUPS = [
    ['sys-settings-button', 'ai-config-button', 'advanced-formatting-button'],
    ['WI-SP-button', 'backgrounds-button', 'extensions-settings-button'],
    ['persona-management-button', 'user-settings-button', 'rightNavHolder'],
];

let built = false;
let originalIds = [];

function ensureSettings() {
    if (!extension_settings[MODULE]) extension_settings[MODULE] = {};
    if (extension_settings[MODULE].enabled === undefined) extension_settings[MODULE].enabled = true;
}

function isEnabled() {
    return !!extension_settings[MODULE]?.enabled;
}

function getExpanded() {
    // Always start collapsed; the user must open the menu to reveal the icons.
    return false;
}

function setExpanded(value) {
    document.body.classList.toggle('tsb-expanded', value);
}

function addLabel(drawer) {
    const toggle = drawer.querySelector(':scope > .drawer-toggle');
    const icon = toggle?.querySelector('.drawer-icon');
    if (!toggle || !icon || toggle.querySelector('.tsb-label')) return;
    const label = document.createElement('span');
    label.className = 'tsb-label';
    label.textContent = toggle.getAttribute('title') || icon.getAttribute('title') || drawer.id;
    icon.after(label);
}

function build() {
    const holder = document.getElementById('top-settings-holder');
    if (!holder || built) return;

    const drawers = Array.from(holder.querySelectorAll(':scope > .drawer'));
    if (!drawers.length) return;
    originalIds = drawers.map(d => d.id);
    const byId = new Map(drawers.map(d => [d.id, d]));

    const toggleRow = document.createElement('div');
    toggleRow.id = 'tsb-toggle-row';
    toggleRow.innerHTML = '<div id="tsb-toggle" class="tsb-toggle" title="Expand or collapse the sidebar"><i class="fa-solid fa-bars fa-fw"></i><span class="tsb-label">Menu</span></div>';

    const used = new Set();
    const groupEls = GROUPS.map(ids => {
        const group = document.createElement('div');
        group.className = 'tsb-group';
        for (const id of ids) {
            const drawer = byId.get(id);
            if (!drawer) continue;
            addLabel(drawer);
            group.append(drawer);
            used.add(id);
        }
        return group;
    });

    for (const drawer of drawers) {
        if (!used.has(drawer.id)) {
            addLabel(drawer);
            groupEls[groupEls.length - 1].append(drawer);
        }
    }

    holder.append(toggleRow);
    let first = true;
    for (const group of groupEls) {
        if (!group.children.length) continue;
        if (!first) {
            const divider = document.createElement('div');
            divider.className = 'tsb-divider';
            holder.append(divider);
        }
        holder.append(group);
        first = false;
    }

    built = true;
}

function restore() {
    const holder = document.getElementById('top-settings-holder');
    if (!holder || !built) return;

    const drawers = Array.from(holder.querySelectorAll('.tsb-group > .drawer'));
    for (const drawer of drawers) {
        drawer.querySelectorAll('.tsb-label').forEach(label => label.remove());
    }
    holder.querySelectorAll('#tsb-toggle-row, .tsb-group, .tsb-divider').forEach(node => node.remove());

    for (const id of originalIds) {
        const drawer = drawers.find(d => d.id === id);
        if (drawer) holder.append(drawer);
    }
    built = false;
}

function applyState() {
    const enabled = isEnabled();
    const holder = document.getElementById('top-settings-holder');
    document.body.classList.toggle('tsb-on', enabled);
    holder?.classList.toggle('tsb-sidebar', enabled);

    if (enabled) {
        build();
        setExpanded(getExpanded());
    } else {
        restore();
        document.body.classList.remove('tsb-expanded');
    }

    const checkbox = document.getElementById('tsb_enabled');
    if (checkbox) checkbox.checked = enabled;
}

function onDocumentClick(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    if (!target) return;

    // The menu button only controls whether the sidebar is expanded.
    if (target.closest('#tsb-toggle')) {
        setExpanded(!document.body.classList.contains('tsb-expanded'));
        return;
    }

    // After a sidebar icon is selected (for example, Extensions), collapse
    // the navigation rail while leaving SillyTavern's selected drawer/panel open.
    if (
        document.body.classList.contains('tsb-expanded') &&
        target.closest('#top-settings-holder.tsb-sidebar .tsb-group .drawer-toggle')
    ) {
        setExpanded(false);
    }
}

jQuery(async () => {
    ensureSettings();

    try {
        const html = await renderExtensionTemplateAsync(EXTENSION_FOLDER, 'settings');
        $('#extensions_settings').append(html);
        $('#tsb_enabled').on('change', function () {
            extension_settings[MODULE].enabled = this.checked;
            saveSettingsDebounced();
            applyState();
        });
    } catch (error) {
        console.error('[Top Icon Sidebar] Could not render settings', error);
    }

    document.addEventListener('click', onDocumentClick);
    applyState();
});

eventSource.on(event_types.APP_READY, applyState);

