/* ---------- Accessibility preferences (shared by every page) ---------- */
/* Load this in <head>, before the page paints, so the saved preferences are
   on <html> from the first frame and nothing flashes in the default look.

   Preferences:
     font          -> data-font="<id>" on <html> (see FONTS below)
     spacing       -> a11y-spacing  (wider letter + word spacing)
     contrast      -> a11y-contrast (darker text, whiter surfaces)
     reduceMotion  -> a11y-motion   (animations and transitions off)

   They are kept in localStorage on this device only. Nothing is sent
   anywhere. If storage is blocked the settings still work for the current
   page; they just will not carry over to the next one.

   smoothie.js asks window.A11y.get().reduceMotion before it fades between
   pages, so the Reduce motion switch also turns the page transitions off.

   ADDING A FONT
   1. Drop the font file into the /Fonts folder.
   2. Add one line to FONTS below. It then shows up in Settings > Reading font
      and gets its @font-face and CSS rule automatically.
        id          short lowercase name (saved in localStorage)
        label       what the Settings dropdown shows
        family      the CSS font-family name
        files       [{ file, weight }]  paths inside /Fonts. Leave out `files`
                    if the family is already loaded by Assets/style.css.
        regularOnly true if there is no bold file, so bold text is not faked
        tall        true to loosen the line height (helps some readers)      */

(function () {
	'use strict';

	var KEY = 'sprocket-a11y';
	var FONT_DIR = 'Fonts/';

	var FONTS = [
		{ id: 'default', label: 'Default (Anta headings, Nunito text)' },
		{ id: 'nunito', label: 'Nunito', family: 'Nunito' },
		{ id: 'anta', label: 'Anta', family: 'Anta', regularOnly: true },
		{
			id: 'opendyslexic',
			label: 'OpenDyslexic',
			family: 'OpenDyslexic',
			files: [{ file: 'OpenDyslexic.otf', weight: 400 }],
			regularOnly: true,
			tall: true
		},
		{
			id: 'atkinson',
			label: 'Atkinson Hyperlegible',
			family: 'Atkinson Hyperlegible',
			files: [
				{ file: 'AtkinsonHyperlegible-Regular.woff2', weight: 400 },
				{ file: 'AtkinsonHyperlegible-Bold.woff2', weight: 700 }
			]
		},
		{
			id: 'lexend',
			label: 'Lexend',
			family: 'Lexend',
			files: [
				{ file: 'Lexend-Regular.woff2', weight: 400 },
				{ file: 'Lexend-Bold.woff2', weight: 700 }
			]
		}
	];

	var TOGGLES = { spacing: 'a11y-spacing', contrast: 'a11y-contrast', reduceMotion: 'a11y-motion' };
	var root = document.documentElement;

	function fontById(id) {
		for (var i = 0; i < FONTS.length; i += 1) {
			if (FONTS[i].id === id) return FONTS[i];
		}
		return null;
	}

	function formatOf(file) {
		var ext = file.split('.').pop().toLowerCase();
		return { woff2: 'woff2', woff: 'woff', otf: 'opentype', ttf: 'truetype' }[ext] || 'truetype';
	}

	/* One <style> with every extra font's @font-face and its html[data-font] rule.
	   Browsers only download a font file once something on the page uses it. */
	function injectFontCss() {
		var css = [];

		FONTS.forEach(function (font) {
			if (!font.family) return;

			(font.files || []).forEach(function (item) {
				css.push(
					'@font-face{font-family:"' + font.family + '";src:url("' + FONT_DIR + item.file +
					'") format("' + formatOf(item.file) + '");font-weight:' + item.weight +
					';font-style:normal;font-display:swap}'
				);
			});

			var stack = '"' + font.family + '","Nunito",Arial,Helvetica,sans-serif';
			var sel = 'html[data-font="' + font.id + '"]';

			css.push(sel + '{--font-body:' + stack + ';--font-heading:' + stack + '}');

			/* single-weight fonts: stop the browser smearing a fake bold on top */
			if (font.regularOnly) css.push(sel + ' body *:not(strong):not(b){font-weight:400}');
			if (font.tall) css.push(sel + ' p,' + sel + ' .settings-state,' + sel + ' .picker-row{line-height:1.6}');
		});

		var style = document.createElement('style');
		style.id = 'a11y-fonts';
		style.textContent = css.join('\n');
		(document.head || root).appendChild(style);
	}

	function systemPrefersReducedMotion() {
		try {
			return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		} catch (error) {
			return false;
		}
	}

	function defaults() {
		/* Respect the operating system setting until the person chooses. */
		return { font: 'default', spacing: false, contrast: false, reduceMotion: systemPrefersReducedMotion() };
	}

	function load() {
		var base = defaults();

		try {
			var saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');

			if (saved && typeof saved === 'object') {
				if (typeof saved.font === 'string' && fontById(saved.font)) {
					base.font = saved.font;
				} else if (saved.dyslexic === true) {
					base.font = 'opendyslexic'; /* from the earlier on/off switch */
				}

				Object.keys(TOGGLES).forEach(function (name) {
					if (typeof saved[name] === 'boolean') base[name] = saved[name];
				});
			}
		} catch (error) {
			/* storage blocked or the saved value is not valid JSON: use defaults */
		}

		return base;
	}

	function save() {
		try {
			window.localStorage.setItem(KEY, JSON.stringify(state));
		} catch (error) {
			/* private mode or storage blocked: keep going without saving */
		}
	}

	function apply() {
		if (state.font === 'default') {
			root.removeAttribute('data-font');
		} else {
			root.setAttribute('data-font', state.font);
		}

		Object.keys(TOGGLES).forEach(function (name) {
			root.classList.toggle(TOGGLES[name], !!state[name]);
		});
	}

	function announce() {
		try {
			document.dispatchEvent(new CustomEvent('a11y:change', { detail: Object.assign({}, state) }));
		} catch (error) {
			/* very old browser without CustomEvent: nothing is listening anyway */
		}
	}

	injectFontCss();

	var state = load();
	apply();

	window.A11y = {
		fonts: FONTS.map(function (font) {
			return { id: font.id, label: font.label };
		}),

		get: function () {
			return Object.assign({}, state);
		},

		set: function (patch) {
			if (patch && typeof patch.font === 'string' && fontById(patch.font)) state.font = patch.font;

			Object.keys(TOGGLES).forEach(function (name) {
				if (patch && typeof patch[name] === 'boolean') state[name] = patch[name];
			});

			apply();
			save();
			announce();
		},

		reset: function () {
			state = defaults();
			apply();
			save();
			announce();
		}
	};

	/* Another tab changed a preference: follow it. */
	window.addEventListener('storage', function (event) {
		if (event.key !== KEY) return;
		state = load();
		apply();
		announce();
	});
})();
