/* ---------- Export page (simulated) ---------- */
/* Nothing is really exported, downloaded or sent. Each action waits a moment
   and then reports success, so the page can be shown off before it is wired up.
   Replace these handlers with real Blob downloads and fetch() later. */

(function () {
	'use strict';

	const toasts = document.getElementById('toasts');
	const endpoint = document.getElementById('endpoint');
	const postBtn = document.getElementById('post-json');

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

	/* Pretend to do the work on a button, then show the result. */
	function pretend(button, busyLabel, message, isError) {
		if (button.disabled) return;

		const label = button.textContent;
		button.disabled = true;
		button.textContent = busyLabel;

		window.setTimeout(() => {
			button.disabled = false;
			button.textContent = label;
			toast(message, isError);
		}, 700);
	}

	/* Form files: counted, not built */
	document.getElementById('export-csv').addEventListener('click', (event) => {
		pretend(event.currentTarget, 'Building\u2026', 'Form data bundled as .CSV');
	});

	document.getElementById('export-json').addEventListener('click', (event) => {
		pretend(event.currentTarget, 'Building\u2026', 'Form data bundled as .JSON');
	});

	document.getElementById('export-token').addEventListener('click', (event) => {
		pretend(event.currentTarget, 'Building\u2026', 'Exported scouting-sprocket.token');
	});

	document.getElementById('fountain-codes').addEventListener('click', (event) => {
		pretend(event.currentTarget, 'Encoding\u2026', 'Fountain codes generated');
	});

	/* POST: checks that the box looks like an endpoint, then fakes the reply */
	postBtn.addEventListener('click', () => {
		if (postBtn.disabled) return;

		const value = endpoint.value.trim();

		if (value === '') {
			toast('Type in the API endpoint first.', true);
			endpoint.focus();
			return;
		}

		let host = value;
		try {
			host = new URL(value).host || value;
		} catch (error) {
			toast('That does not look like an endpoint (' + value + ').', true);
			endpoint.focus();
			return;
		}

		postBtn.disabled = true;
		postBtn.textContent = 'Posting\u2026';

		window.setTimeout(() => {
			postBtn.disabled = false;
			postBtn.textContent = 'Post';
			toast('Posted form data to ' + host + ' \u2014 200 OK');
		}, 900);
	});

	/* Enter inside the box posts too */
	endpoint.addEventListener('keydown', (event) => {
		if (event.key !== 'Enter') return;
		event.preventDefault();
		postBtn.click();
	});
})();
