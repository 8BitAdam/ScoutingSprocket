/* ---------- Form builder (in-memory only, nothing is saved) ---------- */

(function () {
	'use strict';

	/* ---------- Elements ---------- */

	const sectionList = document.getElementById('section-list');
	const sectionEmpty = document.getElementById('section-empty');
	const sectionForm = document.getElementById('section-form');
	const sectionName = document.getElementById('section-name');

	const sectionTabs = document.getElementById('section-tabs');
	const elementsPanel = document.getElementById('elements-panel');
	const elementsTitleName = document.getElementById('elements-title-name');
	const elementList = document.getElementById('element-list');
	const elementEmpty = document.getElementById('element-empty');

	const elementForm = document.getElementById('element-form');
	const elementKind = document.getElementById('element-kind');
	const dataType = document.getElementById('data-type');
	const questionName = document.getElementById('question-name');
	const questionHint = document.getElementById('question-hint');

	const toasts = document.getElementById('toasts');

	/* ---------- Element / data type rules ---------- */

	/* What each element can actually hold. A bool is a True/False answer, so it
	   only fits a checkbox or a drop; a slider only numbers; long text is text. */
	const ALLOWED_TYPES = {
		'Short Text': ['Text', 'Number'],
		'Long Text': ['Text'],
		'Drop': ['Text', 'Number', 'Bool', 'Choice'],
		'Checkbox': ['Bool'],
		'Slider': ['Number']
	};

	const ALL_KINDS = Object.keys(ALLOWED_TYPES);
	const ALL_TYPES = ['Text', 'Number', 'Bool', 'Choice'];

	/* When an element forces a type change, measured from least surprising:
	   swapping text elements should not turn text into a number, and a drop
	   should land on Choice before anything else. */
	const TYPE_FALLBACK = {
		'Short Text': ['Text', 'Number'],
		'Long Text': ['Text'],
		'Drop': ['Choice', 'Text', 'Bool', 'Number'],
		'Checkbox': ['Bool'],
		'Slider': ['Number']
	};

	/* When the data type is picked first, the element to move to, best first. */
	const KIND_FALLBACK = {
		Text: ['Short Text', 'Long Text', 'Drop'],
		Number: ['Short Text', 'Slider', 'Drop'],
		Bool: ['Checkbox', 'Drop'],
		Choice: ['Drop']
	};

	const typesFor = (kind) => ALLOWED_TYPES[kind] || ALL_TYPES;
	const kindsFor = (type) => ALL_KINDS.filter((kind) => ALLOWED_TYPES[kind].includes(type));
	const pairIsValid = (kind, type) => Boolean(ALLOWED_TYPES[kind]) && ALLOWED_TYPES[kind].includes(type);

	function describeList(items) {
		if (items.length <= 1) return items.join('');
		return items.slice(0, -1).join(', ') + ' or ' + items[items.length - 1];
	}

	/* The type this element should carry: the current one when it fits,
	   otherwise the closest one the element can hold. */
	function closestType(kind, from) {
		const allowed = typesFor(kind);
		if (allowed.includes(from)) return from;
		return (TYPE_FALLBACK[kind] || []).find((type) => allowed.includes(type)) || allowed[0];
	}

	/* The element this type needs: the current one when it fits,
	   otherwise the closest one that can hold the type. */
	function closestKind(type, from) {
		if (from && pairIsValid(from, type)) return from;
		return (KIND_FALLBACK[type] || []).find((kind) => pairIsValid(kind, type))
			|| ALL_KINDS.find((kind) => pairIsValid(kind, type))
			|| '';
	}

	/* Picking an element always settles the data type, so a switch can never
	   leave a pair the element cannot hold, and an empty type gets filled in. */
	function onKindChange() {
		const kind = elementKind.value;
		if (!kind) return;

		const before = dataType.value;
		const next = closestType(kind, before);
		dataType.value = next;

		if (next !== before) {
			toast(kind + ' holds ' + describeList(typesFor(kind)) + ' \u2014 data type set to ' + next + '.');
		}
	}

	/* Picking a data type keeps the element when it can hold it, otherwise
	   moves to the closest element that can. With no element yet, the type waits
	   for one to be picked. */
	function onTypeChange() {
		const type = dataType.value;
		const before = elementKind.value;
		if (!type || !before) return;

		const next = closestKind(type, before);
		if (next === before) return;

		elementKind.value = next;
		toast(before + ' can\u2019t hold ' + type + ' \u2014 element set to ' + next + '.');
	}

	/* ---------- State ---------- */

	let nextId = 1;
	const makeId = (prefix) => prefix + '-' + nextId++;

	/* Demo state so the page has something to show. Replaced by real data later. */
	const state = {
		activeId: null,
		sections: []
	};

	function addSectionRecord(name, elements) {
		const section = { id: makeId('section'), name: name, elements: elements || [] };
		state.sections.push(section);
		return section;
	}

	function addElementRecord(section, name, kind, type, hint) {
		section.elements.push({
			id: makeId('element'),
			name: name,
			kind: kind,
			dataType: type,
			hint: hint || ''
		});
	}

	/* ---------- Seed data ---------- */

	const autos = addSectionRecord('Autos');
	addElementRecord(autos, 'Team Number', 'Short Text', 'Number');
	addElementRecord(autos, 'Alliance color', 'Drop', 'Bool');
	addElementRecord(autos, 'Name', 'Short Text', 'Text');
	addElementRecord(autos, '...Movement', 'Drop', 'Text');
	addSectionRecord('Teleop');
	addSectionRecord('Null');
	state.activeId = autos.id;

	/* ---------- Helpers ---------- */

	function make(tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text !== undefined) node.textContent = text;
		return node;
	}

	function separator() {
		const sep = make('span', 'elem-sep', '\u2022');
		sep.setAttribute('aria-hidden', 'true');
		return sep;
	}

	function removeButton(datasetKey, id, label) {
		const button = make('button', 'icon-btn', '\u2715');
		button.type = 'button';
		button.dataset[datasetKey] = id;
		button.setAttribute('aria-label', label);
		return button;
	}

	function activeSection() {
		return state.sections.find((section) => section.id === state.activeId) || null;
	}

	function labelFor(section) {
		return section.name.trim() || 'Untitled section';
	}

	function toast(message, isError) {
		const node = make('div', 'toast' + (isError ? ' toast-alert' : ''), message);
		toasts.appendChild(node);

		/* .toast starts transparent; .show fades it in (see style.css) */
		requestAnimationFrame(() => node.classList.add('show'));

		window.setTimeout(() => {
			node.classList.remove('show');
			window.setTimeout(() => node.remove(), 400);
		}, 2600);
	}

	/* ---------- Rendering ---------- */

	function renderSections() {
		sectionList.textContent = '';
		sectionEmpty.hidden = state.sections.length > 0;

		state.sections.forEach((section) => {
			const item = make('li', 'section-item');
			item.append(
				make('span', 'section-item-name', labelFor(section)),
				removeButton('removeSection', section.id, 'Remove section ' + labelFor(section))
			);
			sectionList.appendChild(item);
		});
	}

	function renderTabs() {
		sectionTabs.textContent = '';

		const hasSections = state.sections.length > 0;
		sectionTabs.hidden = !hasSections;
		elementsPanel.hidden = !hasSections;

		let activeTabId = '';

		state.sections.forEach((section) => {
			const selected = section.id === state.activeId;

			const tab = make('button', 'section-tab', labelFor(section));
			tab.type = 'button';
			tab.id = 'section-tab-' + section.id;
			tab.dataset.sectionId = section.id;
			tab.setAttribute('role', 'tab');
			tab.setAttribute('aria-selected', String(selected));
			tab.setAttribute('tabindex', selected ? '0' : '-1');
			tab.addEventListener('click', () => selectSection(section.id));

			if (selected) activeTabId = tab.id;
			sectionTabs.appendChild(tab);
		});

		if (activeTabId) {
			elementsPanel.setAttribute('aria-labelledby', activeTabId);
		} else {
			elementsPanel.removeAttribute('aria-labelledby');
		}
	}

	function renderElements() {
		const section = activeSection();
		elementList.textContent = '';

		if (!section) {
			elementsTitleName.textContent = 'No Section';
			elementEmpty.hidden = false;
			elementEmpty.textContent = 'Add a section to start building a form.';
			return;
		}

		elementsTitleName.textContent = labelFor(section);
		elementEmpty.hidden = section.elements.length > 0;
		elementEmpty.textContent = 'No elements yet. Add one below.';

		section.elements.forEach((element) => {
			const dot = make('span', 'elem-dot');
			dot.setAttribute('aria-hidden', 'true');

			const text = make('span', 'elem-text');
			text.append(
				make('span', '', element.name),
				separator(),
				make('span', '', element.kind),
				separator(),
				make('span', 'elem-datatype', element.dataType)
			);

			const item = make('li', 'element-item');
			if (element.hint) item.title = element.hint;

			item.append(dot, text, removeButton('removeElement', element.id, 'Remove element ' + element.name));
			elementList.appendChild(item);
		});
	}

	function render() {
		renderSections();
		renderTabs();
		renderElements();
	}

	/* ---------- Actions ---------- */

	function selectSection(id) {
		if (id === state.activeId) return;
		state.activeId = id;
		render();
	}

	function removeSection(id) {
		const index = state.sections.findIndex((section) => section.id === id);
		if (index === -1) return;

		const [removed] = state.sections.splice(index, 1);

		if (state.activeId === removed.id) {
			const neighbour = state.sections[index] || state.sections[index - 1] || null;
			state.activeId = neighbour ? neighbour.id : null;
		}

		render();
		toast('Removed section "' + labelFor(removed) + '".');
	}

	function removeElement(id) {
		const section = activeSection();
		if (!section) return;

		const index = section.elements.findIndex((element) => element.id === id);
		if (index === -1) return;

		const [removed] = section.elements.splice(index, 1);
		render();
		toast('Removed element "' + removed.name + '".');
	}

	/* ---------- Events ---------- */

	sectionForm.addEventListener('submit', (event) => {
		event.preventDefault();

		const name = sectionName.value.trim();
		if (!name) {
			sectionName.classList.add('is-invalid');
			sectionName.focus();
			toast('Give the section a name first.', true);
			return;
		}

		const exists = state.sections.some(
			(section) => section.name.trim().toLowerCase() === name.toLowerCase()
		);
		if (exists) {
			sectionName.classList.add('is-invalid');
			sectionName.select();
			toast('A section called "' + name + '" already exists.', true);
			return;
		}

		const section = addSectionRecord(name);
		state.activeId = section.id;
		sectionName.value = '';
		render();
		sectionName.focus();
		toast('Added section "' + name + '".');
	});

	sectionName.addEventListener('input', () => sectionName.classList.remove('is-invalid'));

	elementForm.addEventListener('submit', (event) => {
		event.preventDefault();

		const section = activeSection();
		if (!section) {
			toast('Add a section before adding elements.', true);
			return;
		}

		const name = questionName.value.trim();
		if (!name) {
			questionName.classList.add('is-invalid');
			questionName.focus();
			toast('Give the element a question name first.', true);
			return;
		}

		if (!elementKind.value) {
			elementKind.focus();
			toast('Choose an element type.', true);
			return;
		}

		if (!dataType.value) {
			dataType.value = closestType(elementKind.value, '');
			dataType.focus();
		}

		/* Defensive: the selects settle each other on change, so this only runs
		   if something forced an invalid pair. It snaps rather than blocks. */
		if (!pairIsValid(elementKind.value, dataType.value)) {
			dataType.value = closestType(elementKind.value, dataType.value);
			toast(elementKind.value + ' can only hold ' + describeList(typesFor(elementKind.value)) + '.', true);
			dataType.focus();
			return;
		}

		addElementRecord(section, name, elementKind.value, dataType.value, questionHint.value.trim());

		elementForm.reset();
		render();
		questionName.focus();
		toast('Added "' + name + '" to ' + labelFor(section) + '.');
	});

	questionName.addEventListener('input', () => questionName.classList.remove('is-invalid'));

	/* Any element, any type, at any time: the other select follows. */
	elementKind.addEventListener('change', onKindChange);
	dataType.addEventListener('change', onTypeChange);

	sectionList.addEventListener('click', (event) => {
		const button = event.target.closest('[data-remove-section]');
		if (button) removeSection(button.dataset.removeSection);
	});

	elementList.addEventListener('click', (event) => {
		const button = event.target.closest('[data-remove-element]');
		if (button) removeElement(button.dataset.removeElement);
	});

	sectionTabs.addEventListener('keydown', (event) => {
		const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
		if (!keys.includes(event.key)) return;

		const tabs = Array.from(sectionTabs.querySelectorAll('.section-tab'));
		if (tabs.length === 0) return;

		event.preventDefault();
		const current = tabs.findIndex((tab) => tab.dataset.sectionId === state.activeId);
		let next = current;

		if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
		if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
		if (event.key === 'Home') next = 0;
		if (event.key === 'End') next = tabs.length - 1;

		const target = tabs[next];
		selectSection(target.dataset.sectionId);

		/* rendering rebuilds the tabs, so look the fresh one up by id */
		const fresh = document.getElementById('section-tab-' + target.dataset.sectionId);
		if (fresh) fresh.focus();
	});

	render();
})();
