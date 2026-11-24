/* ---------- Data actions (demo records, real arithmetic) ---------- */
/* Every scouting row below stands in for a saved Forms submission. The chart,
   the axis ticks and the raw CSV are all computed from this one list, so the
   numbers on the page agree with each other. Nothing is stored or loaded. */

(function () {
	'use strict';

	const RECORDS = [
		/* Panthers */
		{ team: 'Panthers', number: 1001, alliance: 'Red', scout: 'James', auto: 4, teleop: 3, end: 'Parked' },
		{ team: 'Panthers', number: 1001, alliance: 'Red', scout: 'Daniel', auto: 5, teleop: 2, end: 'Climbed shallow' },
		{ team: 'Panthers', number: 1001, alliance: 'Red', scout: 'Matthew', auto: 3, teleop: 4, end: 'Climbed deep' },

		/* Ravens */
		{ team: 'Ravens', number: 1002, alliance: 'Blue', scout: 'Michael', auto: 3, teleop: 2, end: 'Nothing' },
		{ team: 'Ravens', number: 1002, alliance: 'Blue', scout: 'Olivia', auto: 4, teleop: 3, end: 'Parked' },
		{ team: 'Ravens', number: 1002, alliance: 'Blue', scout: 'Jessica', auto: 2, teleop: 1, end: 'Climbed shallow' },

		/* Shooting Stars */
		{ team: 'Shooting Stars', number: 1003, alliance: 'Red', scout: 'Sarah', auto: 5, teleop: 5, end: 'Climbed deep' },
		{ team: 'Shooting Stars', number: 1003, alliance: 'Red', scout: 'Andrew', auto: 4, teleop: 4, end: 'Climbed shallow' },
		{ team: 'Shooting Stars', number: 1003, alliance: 'Red', scout: 'Ashley', auto: 5, teleop: 3, end: 'Climbed deep' },

		/* Rockets */
		{ team: 'Rockets', number: 1004, alliance: 'Blue', scout: 'Emily', auto: 4, teleop: 3, end: 'Climbed shallow' },
		{ team: 'Rockets', number: 1004, alliance: 'Blue', scout: 'Anthony', auto: 3, teleop: 4, end: 'Parked' },
		{ team: 'Rockets', number: 1004, alliance: 'Blue', scout: 'Chloe', auto: 5, teleop: 2, end: 'Climbed deep' }
	];

	const COLORS = {
		Panthers: '#F2A054',
		Ravens: '#F0506E',
		'Shooting Stars': '#BE05E8',
		Rockets: '#109B73'
	};

	const END_POINTS = {
		Nothing: 0,
		Parked: 1,
		'Climbed shallow': 3,
		'Climbed deep': 5
	};

	const TEAMS = ['Panthers', 'Ravens', 'Shooting Stars', 'Rockets'];

	/* One row's score: auto rating, plus two points a piece in Teleop,
	   plus the end game bonus. */
	function points(row) {
		return row.auto + row.teleop * 2 + END_POINTS[row.end];
	}

	function teamAverage(team) {
		const rows = RECORDS.filter((row) => row.team === team);
		if (rows.length === 0) return 0;
		const total = rows.reduce((sum, row) => sum + points(row), 0);
		return total / rows.length;
	}

	/* ---------- Bar graph ---------- */

	const chart = document.getElementById('chart');
	const plot = document.getElementById('chart-plot');
	const bars = document.getElementById('chart-bars');
	const tickBox = document.getElementById('chart-ticks');
	const labelBox = document.getElementById('chart-x-labels');

	function renderChart() {
		const series = TEAMS.map((team) => ({ team, value: teamAverage(team) }));
		const peak = Math.max.apply(null, series.map((item) => item.value));

		/* Round the top of the axis up to a multiple of five, with headroom
		   so the tallest bar never touches the top line. */
		const top = Math.max(5, Math.ceil((peak * 1.1) / 5) * 5);
		const bands = top / 5; /* five points per band */

		plot.style.setProperty('--bands', String(bands));
		bars.style.gridTemplateColumns = 'repeat(' + series.length + ', 1fr)';
		labelBox.style.gridTemplateColumns = 'repeat(' + series.length + ', 1fr)';

		/* Axis labels run from the top down; the CSS gridlines follow --bands */
		tickBox.textContent = '';
		for (let step = bands; step >= 0; step -= 1) {
			const tick = document.createElement('span');
			tick.textContent = String(step * 5);
			tickBox.appendChild(tick);
		}

		bars.textContent = '';
		labelBox.textContent = '';

		series.forEach((item) => {
			const bar = document.createElement('div');
			bar.className = 'chart-bar';
			bar.style.setProperty('--h', ((item.value / top) * 100).toFixed(1) + '%');
			bar.style.setProperty('--c', COLORS[item.team] || '#F2A054');
			bar.title = item.team + ': ' + item.value.toFixed(1) + ' points per match';
			bars.appendChild(bar);

			const label = document.createElement('span');
			const name = document.createElement('span');
			name.textContent = item.team;
			const score = document.createElement('b');
			score.className = 'chart-x-score';
			score.textContent = item.value.toFixed(1);
			label.append(name, score);
			labelBox.appendChild(label);
		});

		chart.setAttribute(
			'role',
			'img'
		);
		chart.setAttribute(
			'aria-label',
			'Bar graph, average points per match. ' +
				series.map((item) => item.team + ' ' + item.value.toFixed(1)).join(', ') + '.'
		);
	}

	/* ---------- Raw form data ---------- */

	const raw = document.getElementById('raw-data');

	function renderRaw() {
		const header = ['Team', 'Alliance', 'Scout', 'Team number', 'Auto rating', 'Teleop pieces', 'End game', 'Points'];

		const lines = [header.join(',')].concat(
			RECORDS.map((row) => [
				row.team,
				row.alliance,
				row.scout,
				row.number,
				row.auto,
				row.teleop,
				row.end,
				points(row)
			].join(','))
		);

		raw.textContent = lines.join('\n');
	}

	renderChart();
	renderRaw();
})();
