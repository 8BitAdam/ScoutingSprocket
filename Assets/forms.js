/* ---------- Form page (in-memory only, nothing is saved) ---------- */

(function () {
	'use strict';

	const tabsBox = document.getElementById('form-tabs');
	const panel = document.getElementById('form-panel');
	const fieldsBox = document.getElementById('form-fields');
	const saveBtn = document.getElementById('save-next');
	const toasts = document.getElementById('toasts');

	/* Demo form. Kinds match the builder: Short Text, Long Text, Drop,
	   Checkbox and Slider (a five-step star scale). */
	const SECTIONS = [
		{
			id: 'autos',
			name: 'Autos',
			fields: [
				{ id: 'team-number', label: 'Team Number', kind: 'Short Text', dataType: 'Number', hint: 'The number on the robot' },
				{ id: 'alliance', label: 'Alliance', kind: 'Drop', dataType: 'Choice', hint: 'Choose your alliance', options: ['Red', 'Blue'] },
				{ id: 'name', label: 'Name', kind: 'Short Text', dataType: 'Text', hint: 'What is your name Example: John Doe' },
				{ id: 'auto-movement', label: 'Autonomous movement', kind: 'Drop', dataType: 'Text', hint: 'What did the robot do?', options: ['No movement', 'Scored no movement', 'Movement no Scored', 'Movement & Scored'] },
				{ id: 'auto-notes', label: 'Notes', kind: 'Long Text', dataType: 'Text', hint: 'Anything else that happened?' },
				{ id: 'auto-did', label: 'What we did', kind: 'Checkbox', dataType: 'Bool', options: ['Left the starting zone', 'Picked up a piece', 'Scored a piece', 'Climbed the stage'] },
				{ id: 'auto-rating', label: 'How did it go', kind: 'Slider', dataType: 'Number', low: 'Bad text', high: 'Good text' }
			]
		},
		{
			id: 'teleop',
			name: 'Teleop',
			fields: [
				{ id: 'teleop-scored', label: 'Pieces scored', kind: 'Short Text', dataType: 'Number', hint: 'How many pieces did you score?' },
				{ id: 'teleop-notes', label: 'Notes', kind: 'Long Text', dataType: 'Text', hint: 'Anything else that happened?' },
				{ id: 'teleop-did', label: 'What we did', kind: 'Checkbox', dataType: 'Bool', options: ['Scored a piece', 'Defended', 'Climbed the stage'] },
				{ id: 'teleop-rating', label: 'How did it go', kind: 'Slider', dataType: 'Number', low: 'Bad text', high: 'Good text' }
			]
		},
		{
			id: 'end-game',
			name: 'End Game',
			fields: [
				{ id: 'end-action', label: 'End game action', kind: 'Drop', dataType: 'Choice', hint: 'Choose one', options: ['Nothing', 'Parked', 'Climbed shallow', 'Climbed deep'] },
				{ id: 'end-comments', label: 'Comments', kind: 'Long Text', dataType: 'Text', hint: 'Anything the next scout should know?' },
				{ id: 'end-rating', label: 'How did it go', kind: 'Slider', dataType: 'Number', low: 'Bad text', high: 'Good text' }
			]
		}
	];

	/* Answers typed so far, keyed "<section>:<field>". Cleared on reload. */
	const answers = {};
	let activeId = SECTIONS[0].id;

	const activeIndex = () => SECTIONS.findIndex((section) => section.id === activeId);
	const activeSection = () => SECTIONS[activeIndex()];
	const answerKey = (section, field) => section.id + ':' + field.id;

	function toast(message, isError) {
		const node = document.createElement('div');
		node.className = 'toast' + (isError ? ' toast-alert' : '');
		node.textContent = message;
		toasts.appendChild(node);

		/* .toast starts transparent; .show fades it in (see style.css) */
		requestAnimationFrame(() => node.classList.add('show'));

		window.setTimeout(() => {
			node.classList.remove('show');
			window.setTimeout(() => node.remove(), 400);
		}, 2600);
	}

	/* ---------- Building one field ---------- */

	function buildField(section, field) {
		const key = answerKey(section, field);
		const saved = answers[key];
		const labelId = 'label-' + section.id + '-' + field.id;

		const wrap = document.createElement('div');
		wrap.className = 'form-field';

		const label = document.createElement('p');
		label.className = 'form-label';
		label.id = labelId;
		label.textContent = field.label;

		wrap.appendChild(label);

		if (field.kind === 'Short Text') {
			const input = document.createElement('input');
			input.type = 'text';
			input.id = 'input-' + section.id + '-' + field.id;
			input.placeholder = field.hint || '';
			input.autocomplete = 'off';
			input.value = saved || '';
			if (field.dataType === 'Number') input.inputMode = 'numeric';
			input.dataset.answerKey = key;
			input.setAttribute('aria-labelledby', labelId);
			wrap.appendChild(input);
			return wrap;
		}

		if (field.kind === 'Long Text') {
			const area = document.createElement('textarea');
			area.rows = 4;
			area.placeholder = field.hint || '';
			area.value = saved || '';
			area.dataset.answerKey = key;
			area.setAttribute('aria-labelledby', labelId);
			wrap.appendChild(area);
			return wrap;
		}

		if (field.kind === 'Drop') {
			const select = document.createElement('select');
			select.required = true;
			select.dataset.answerKey = key;
			select.setAttribute('aria-labelledby', labelId);

			const placeholder = document.createElement('option');
			placeholder.value = '';
			placeholder.disabled = true;
			placeholder.textContent = field.hint || 'Choose one';
			select.appendChild(placeholder);

			(field.options || []).forEach((option) => {
				const item = document.createElement('option');
				item.value = option;
				item.textContent = option;
				select.appendChild(item);
			});

			if (saved) select.value = saved;
			wrap.appendChild(select);
			return wrap;
		}

		if (field.kind === 'Checkbox') {
			const checked = Array.isArray(saved) ? saved : [];

			const group = document.createElement('div');
			group.className = 'check-list';
			group.setAttribute('role', 'group');
			group.setAttribute('aria-labelledby', labelId);

			(field.options || []).forEach((option) => {
				const row = document.createElement('label');
				row.className = 'check-row';

				const text = document.createElement('span');
				text.textContent = option;

				const box = document.createElement('input');
				box.type = 'checkbox';
				box.value = option;
				box.checked = checked.includes(option);
				box.dataset.answerKey = key;

				row.append(text, box);
				group.appendChild(row);
			});

			wrap.appendChild(group);
			return wrap;
		}

		/* Slider: a five-star scale with the low and high ends labelled */
		const value = Number(saved) || 0;

		const rating = document.createElement('div');
		rating.className = 'rating';
		rating.setAttribute('role', 'group');
		rating.setAttribute('aria-labelledby', labelId);

		const stars = document.createElement('div');
		stars.className = 'rating-stars';

		for (let step = 1; step <= 5; step += 1) {
			const star = document.createElement('button');
			star.type = 'button';
			star.className = 'star';
			star.dataset.value = String(step);
			star.dataset.answerKey = key;
			star.setAttribute('aria-pressed', String(step <= value));
			star.setAttribute('aria-label', step + ' of 5');
			star.textContent = step <= value ? '\u2605' : '\u2606';
			stars.appendChild(star);
		}

		const scale = document.createElement('div');
		scale.className = 'rating-scale';

		const low = document.createElement('span');
		low.textContent = field.low || 'Bad text';

		const high = document.createElement('span');
		high.textContent = field.high || 'Good text';

		scale.append(low, high);
		rating.append(stars, scale);
		wrap.appendChild(rating);
		return wrap;
	}

	/* ---------- Rendering ---------- */

	function renderTabs() {
		tabsBox.textContent = '';

		SECTIONS.forEach((section) => {
			const selected = section.id === activeId;

			const tab = document.createElement('button');
			tab.type = 'button';
			tab.className = 'section-tab';
			tab.id = 'form-tab-' + section.id;
			tab.dataset.sectionId = section.id;
			tab.setAttribute('role', 'tab');
			tab.setAttribute('aria-selected', String(selected));
			tab.setAttribute('tabindex', selected ? '0' : '-1');
			tab.textContent = section.name;
			tab.addEventListener('click', () => selectSection(section.id));
			tabsBox.appendChild(tab);
		});

		panel.setAttribute('aria-labelledby', 'form-tab-' + activeId);
	}

	function renderFields() {
		const section = activeSection();
		fieldsBox.textContent = '';

		section.fields.forEach((field) => fieldsBox.appendChild(buildField(section, field)));

		const next = SECTIONS[activeIndex() + 1];
		saveBtn.textContent = next ? 'Save & move to ' + next.name : 'Save Form';
	}

	function render() {
		renderTabs();
		renderFields();
	}

	/* ---------- Actions ---------- */

	function selectSection(id) {
		if (id === activeId) return;
		activeId = id;
		render();
	}

	fieldsBox.addEventListener('input', storeAnswer);
	fieldsBox.addEventListener('change', storeAnswer);

	function storeAnswer(event) {
		const target = event.target;
		const key = target.dataset.answerKey;
		if (!key) return;

		if (target.type === 'checkbox') {
			answers[key] = Array.from(fieldsBox.querySelectorAll('[data-answer-key="' + key + '"]'))
				.filter((box) => box.checked)
				.map((box) => box.value);
			return;
		}

		answers[key] = target.value;
	}

	fieldsBox.addEventListener('click', (event) => {
		const star = event.target.closest('.star');
		if (!star) return;

		const value = Number(star.dataset.value);
		answers[star.dataset.answerKey] = String(value);

		Array.from(star.parentElement.children).forEach((sibling) => {
			const filled = Number(sibling.dataset.value) <= value;
			sibling.setAttribute('aria-pressed', String(filled));
			sibling.textContent = filled ? '\u2605' : '\u2606';
		});
	});

	saveBtn.addEventListener('click', () => {
		const next = SECTIONS[activeIndex() + 1];
		if (!next) {
			toast('End of the form \u2014 nothing is saved yet.');
			return;
		}

		selectSection(next.id);
		toast('Moved to ' + next.name + ' \u2014 nothing is saved yet.');
	});

	tabsBox.addEventListener('keydown', (event) => {
		const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
		if (!keys.includes(event.key)) return;

		const tabs = Array.from(tabsBox.querySelectorAll('.section-tab'));
		if (tabs.length === 0) return;

		event.preventDefault();
		const current = tabs.findIndex((tab) => tab.dataset.sectionId === activeId);
		let next = current;

		if (event.key === 'ArrowRight') next = (current + 1) % tabs.length;
		if (event.key === 'ArrowLeft') next = (current - 1 + tabs.length) % tabs.length;
		if (event.key === 'Home') next = 0;
		if (event.key === 'End') next = tabs.length - 1;

		selectSection(tabs[next].dataset.sectionId);
		tabs[next].focus();
	});

	render();
})();
