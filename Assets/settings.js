/* ---------- Settings page (prototype) ---------- */
/* The password only gates this page's destructive actions. It is checked
   against the demo value below, and the buttons never change or delete
   anything. The password is never stored or sent anywhere. Only the reading
   preferences are saved, on this device, by Assets/a11y.js. */

const DEMO_PASSWORD = 'sprocket';

(function () {
	'use strict';

	const password = document.getElementById('password');
	const lockBtn = document.getElementById('lock-btn');
	const stateNote = document.getElementById('lock-state');
	const toasts = document.getElementById('toasts');
	const actions = Array.from(document.querySelectorAll('[data-locked]'));

	const fontSelect = document.getElementById('a11y-font');
	const spacingToggle = document.getElementById('a11y-spacing');
	const contrastToggle = document.getElementById('a11y-contrast');
	const motionToggle = document.getElementById('a11y-motion');
	const a11yState = document.getElementById('a11y-state');

	let unlocked = false;

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

	function setUnlocked(next) {
		unlocked = next;

		actions.forEach((button) => {
			button.disabled = !next;
		});

		/* The label is the action: locked shows Unlock, unlocked shows Lock. */
		lockBtn.textContent = next ? 'Lock' : 'Unlock';
		password.classList.remove('is-invalid');

		stateNote.textContent = next
			? 'Unlocked \u2014 reset and clear are available.'
			: 'Locked \u2014 reset and clear are disabled.';
		stateNote.classList.toggle('is-unlocked', next);
	}

	lockBtn.addEventListener('click', () => {
		if (unlocked) {
			setUnlocked(false);
			password.value = '';
			toast('Settings locked.');
			return;
		}

		if (!password.value.trim()) {
			password.classList.add('is-invalid');
			password.focus();
			toast('Enter the password first.', true);
			return;
		}

		if (password.value !== DEMO_PASSWORD) {
			password.classList.add('is-invalid');
			password.focus();
			password.select();
			toast('That password is not right.', true);
			return;
		}

		password.value = '';
		setUnlocked(true);
		toast('Settings unlocked.');
	});

	password.addEventListener('input', () => password.classList.remove('is-invalid'));

	/* Enter in the box presses Lock */
	password.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		lockBtn.click();
	});

	/* ---------- Accessibility ---------- */
	/* The preferences live in Assets/a11y.js (loaded in <head> on every page),
	   which adds the classes to <html>, saves them on this device and tells
	   smoothie.js about Reduce motion. This page only drives the controls. */
	function initAccessibility(A11y) {
		/* The dropdown lists every font in A11y.fonts (defined in Assets/a11y.js) */
		fontSelect.textContent = '';
		A11y.fonts.forEach((font) => {
			const option = document.createElement('option');
			option.value = font.id;
			option.textContent = font.label;
			fontSelect.appendChild(option);
		});

		function fontLabel(id) {
			const match = A11y.fonts.find((font) => font.id === id);
			return match ? match.label : id;
		}

		function describe(prefs) {
			const active = [];
			if (prefs.font !== 'default') active.push(fontLabel(prefs.font) + ' font');
			if (prefs.spacing) active.push('wider letter spacing');
			if (prefs.contrast) active.push('high contrast');
			if (prefs.reduceMotion) active.push('reduced motion');

			return active.length
				? 'On: ' + active.join(', ') + '. Applies to every page on this device.'
				: 'Default reading settings.';
		}

		/* Controls follow the saved state (also runs on load and when another tab changes it) */
		function syncControls() {
			const prefs = A11y.get();
			fontSelect.value = prefs.font;
			spacingToggle.checked = prefs.spacing;
			contrastToggle.checked = prefs.contrast;
			motionToggle.checked = prefs.reduceMotion;
			a11yState.textContent = describe(prefs);
		}

		function saveFromControls() {
			A11y.set({
				font: fontSelect.value,
				spacing: spacingToggle.checked,
				contrast: contrastToggle.checked,
				reduceMotion: motionToggle.checked
			});
		}

		[fontSelect, spacingToggle, contrastToggle, motionToggle].forEach((control) => {
			control.addEventListener('change', saveFromControls);
		});

		document.addEventListener('a11y:change', syncControls);
		syncControls();
	}

	/* If Assets/a11y.js did not load (usually because only some of the files were
	   copied over), say so on the page rather than leaving an empty dropdown. */
	if (window.A11y) {
		initAccessibility(window.A11y);
	} else {
		[fontSelect, spacingToggle, contrastToggle, motionToggle].forEach((control) => {
			control.disabled = true;
		});
		a11yState.textContent = 'Accessibility settings are off: Assets/a11y.js did not load. Copy it, the updated Assets/style.css and the Fonts folder next to this page.';
		a11yState.classList.add('is-error');
	}

	/* The destructive buttons stay fake: they report, they never touch data. */
	document.getElementById('reset-data').addEventListener('click', () => {
		toast('Reset data \u2014 prototype only, nothing was changed.');
	});

	document.getElementById('clear-data').addEventListener('click', () => {
		toast('Clear data \u2014 prototype only, nothing was deleted.');
	});

	setUnlocked(false);
})();
