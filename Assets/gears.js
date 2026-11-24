/* How see-through the gears are, in percent: 0 = solid, 100 = invisible. */
const GEAR_TRANSPARENCY = 95;

/*
	gears.js — static light gears on the outer edge of the viewport.

	Builds rows of interlocking gears that run the full length of the browser
	window's edges: across the top, across the bottom and down both sides. The
	rows are fixed to the viewport and sit behind the page, so they frame the
	screen rather than the cream card. Nothing moves and nothing is clickable.
*/
(function () {
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}

	function init() {
		const frame = document.querySelector('.frame');
		if (!frame) return;

		const SVG_NS = 'http://www.w3.org/2000/svg';
		const GEAR_COLOR = '#3F3F3F'; // FIX: was '3F3F3F' (no '#'), which is invalid and fell back to black
		const TOOTH = 12; // tooth size in px, shared within a row so the gears mesh

		const layer = document.createElement('div');
		layer.className = 'gear-layer';
		layer.setAttribute('aria-hidden', 'true');
		layer.style.position = 'fixed';
		layer.style.inset = '0';
		layer.style.overflow = 'hidden'; /* keep edge gears from adding scrollbars */
		layer.style.zIndex = '-1';
		layer.style.pointerEvents = 'none';
		layer.style.opacity = String(1 - GEAR_TRANSPARENCY / 100);
		document.body.insertBefore(layer, document.body.firstChild);

		/* One row per viewport edge. The pattern is the tooth count of each gear;
		   it repeats until the row is long enough to cross the whole edge. */
		const rows = [
			{ edge: 'top', angle: 0, pattern: [12, 15, 10, 13, 8, 14] },
			{ edge: 'bottom', angle: 0, pattern: [9, 14, 11, 16, 10, 12] },
			{ edge: 'left', angle: 90, pattern: [11, 15, 12, 9, 13] },
			{ edge: 'right', angle: -90, pattern: [10, 14, 11, 16, 9] }
		];

		layout();

		/* Resize fires constantly while dragging; redraw at most once per frame. */
		let queued = false;
		window.addEventListener('resize', () => {
			if (queued) return;
			queued = true;
			requestAnimationFrame(() => {
				queued = false;
				layout();
			});
		});

		/* The frame's position can shift once fonts and images have loaded. */
		window.addEventListener('load', layout);

		function layout() {
			layer.replaceChildren();

			const vw = document.documentElement.clientWidth;
			const vh = document.documentElement.clientHeight;

			/* Thin amber margins get smaller gears, or they read as pale slices. */
			const narrow = frame.getBoundingClientRect().left < 60;
			const tooth = narrow ? TOOTH * 0.3 : TOOTH;

			for (const row of rows) {
				const horizontal = row.edge === 'top' || row.edge === 'bottom';
				const length = horizontal ? vw : vh;
				const gears = buildChain(length + tooth * 3, tooth, row.pattern);

				const x = horizontal ? vw / 2 : row.edge === 'left' ? 0 : vw;
				const y = horizontal ? (row.edge === 'top' ? 0 : vh) : vh / 2;

				layer.appendChild(makeRow(gears, x, y, row.angle));
			}
		}

		/* FIX: the old chainFor() estimated the row length with a formula that
		   overshot the real one, so long rows stopped early and left gaps at the
		   ends (and a 60-gear cap made it worse on wide screens). This places the
		   gears with the same maths used for drawing and adds them until the
		   chain really covers the edge. */
		function buildChain(length, tooth, pattern) {
			const gears = [];
			let cx = 0;

			for (let i = 0; i < 500; i++) {
				const teeth = pattern[i % pattern.length];
				const pitch = (teeth * tooth) / 2;
				const outer = pitch + tooth * 0.45;

				if (i > 0) {
					const prev = gears[i - 1];
					cx = prev.cx + prev.pitch + pitch + tooth * 0.35;
				}

				gears.push({ teeth, pitch, outer, cx, tooth });

				if (cx + outer - (gears[0].cx - gears[0].outer) >= length) break;
			}

			return gears;
		}

		/* Drop a ready-made chain of gears on x/y, rotated to run along an edge. */
		function makeRow(gears, x, y, angle) {
			const wrap = document.createElement('div');
			wrap.style.position = 'absolute';
			wrap.style.top = '0';
			wrap.style.left = '0';

			const first = gears[0];
			const last = gears[gears.length - 1];
			const min = first.cx - first.outer;
			const max = last.cx + last.outer;
			const span = max - min;

			gears.forEach((gear, i) => {
				const box = gear.outer + 2;
				const svg = document.createElementNS(SVG_NS, 'svg');
				svg.setAttribute('viewBox', `${-box} ${-box} ${box * 2} ${box * 2}`);
				svg.setAttribute('width', String(box * 2));
				svg.setAttribute('height', String(box * 2));
				svg.setAttribute('focusable', 'false');
				svg.style.position = 'absolute';
				svg.style.left = `${gear.cx - min - box}px`;
				svg.style.top = `${-box}px`;

				const path = document.createElementNS(SVG_NS, 'path');
				path.setAttribute('d', gearPath(gear, gear.tooth));
				path.setAttribute('fill', GEAR_COLOR);
				path.setAttribute('fill-rule', 'evenodd');
				path.setAttribute('transform', `rotate(${i * 13 + gear.teeth * 3})`);

				svg.appendChild(path);
				wrap.appendChild(svg);
			});

			wrap.style.transform =
				`translate(${x}px, ${y}px) rotate(${angle}deg) translate(${-span / 2}px, 0)`;

			return wrap;
		}

		/* A ring gear: trapezoid teeth around a big centre hole. */
		function gearPath({ teeth, pitch, outer }, tooth) {
			const root = pitch - tooth * 0.5;
			const hole = pitch * 0.62;
			const step = (Math.PI * 2) / teeth;
			const at = (r, angle) =>
				`${(r * Math.cos(angle)).toFixed(2)} ${(r * Math.sin(angle)).toFixed(2)}`;

			let d = '';

			for (let i = 0; i < teeth; i++) {
				const a = i * step;
				d += (i === 0 ? 'M' : 'L') + at(root, a - step * 0.33);
				d += 'L' + at(outer, a - step * 0.18);
				d += 'L' + at(outer, a + step * 0.18);
				d += 'L' + at(root, a + step * 0.33);
			}

			d += 'Z';
			d += `M ${-hole} 0 a ${hole} ${hole} 0 1 0 ${hole * 2} 0 a ${hole} ${hole} 0 1 0 ${-hole * 2} 0 Z`;

			return d;
		}
	}
})();
