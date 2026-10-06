// Wireframe DJI Air 3S for the gear section.
// A tiny hand-rolled 3D line renderer (no library): the drone unfolds, spins up,
// lifts off and tilts its camera as you scroll through .drone-scroll.
(() => {
	const canvas = document.querySelector('#drone');
	if (!canvas) return;
	const ctx = canvas.getContext('2d');
	const scroller = document.querySelector('.drone-scroll');
	const steps = document.querySelectorAll('.drone-steps li');
	const readout = document.querySelector('#drone-readout');
	const reducedMotion = !window.matchMedia('(prefers-reduced-motion: no-preference)').matches;

	// ---- 3D helpers: points are [x, y, z], y up, drone nose towards +z
	const rotY = (p, a) => {
		const c = Math.cos(a), s = Math.sin(a);
		return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
	};
	const rotX = (p, a) => {
		const c = Math.cos(a), s = Math.sin(a);
		return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
	};
	const add = (p, q) => [p[0] + q[0], p[1] + q[1], p[2] + q[2]];
	const lerp = (a, b, t) => a + (b - a) * t;
	const clamp01 = t => Math.min(1, Math.max(0, t));
	const ease = t => t * t * (3 - 2 * t);
	const phase = (p, from, to) => ease(clamp01((p - from) / (to - from)));

	// ---- Shapes as lists of line segments in local coordinates
	function box(w, h, d, taper = 1) {
		const x = w / 2, y = h / 2, z = d / 2, tx = x * taper, tz = z * taper;
		const v = [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z], [-tx, y, -tz], [tx, y, -tz], [tx, y, tz], [-tx, y, tz]];
		const e = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
		return e.map(([a, b]) => [v[a], v[b]]);
	}
	function cylinder(r, h, n = 12, axis = 'y') {
		const pt = (a, t) => axis === 'y'
			? [r * Math.cos(a), t, r * Math.sin(a)]
			: [r * Math.cos(a), r * Math.sin(a), t];
		const segs = [];
		for (let i = 0; i < n; i++) {
			const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2;
			segs.push([pt(a, -h / 2), pt(b, -h / 2)], [pt(a, h / 2), pt(b, h / 2)]);
			if (i % 3 === 0) segs.push([pt(a, -h / 2), pt(a, h / 2)]);
		}
		return segs;
	}
	const shift = (shape, d) => shape.map(([a, b]) => [add(a, d), add(b, d)]);

	const rotZ = (p, a) => {
		const c = Math.cos(a), s = Math.sin(a);
		return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
	};
	// Rounded-rectangle (superellipse) outline; `at(u, v)` places it in 3D
	function ring(rx, ry, n, at, power = 2.6) {
		const pts = [];
		for (let i = 0; i < n; i++) {
			const a = i / n * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
			pts.push(at(rx * Math.sign(c) * Math.abs(c) ** (2 / power), ry * Math.sign(s) * Math.abs(s) ** (2 / power)));
		}
		return pts;
	}
	const loop = pts => pts.map((p, i) => [p, pts[(i + 1) % pts.length]]);
	// Lofted surface through a list of rings with the same point count
	function loft(rings, every) {
		const segs = rings.flatMap(loop);
		for (let i = 0; i < rings[0].length; i += every) {
			for (let k = 0; k < rings.length - 1; k++) segs.push([rings[k][i], rings[k + 1][i]]);
		}
		return segs;
	}
	const circle = (r, n, at) => loop(ring(r, r, n, at, 2));

	// ---- DJI Air 3S (1 unit ≈ 10 cm; folded 207 × 100 × 91 mm, unfolded 267 × 326 mm, 8.8" props)
	// Fuselage cross-sections: [z, half-width, half-height, centre y]. Low rear deck rising
	// into the tall rounded "head" at the nose.
	const STATIONS = [
		[-1.0, 0.28, 0.15, 0.02],
		[-0.85, 0.38, 0.2, 0.03],
		[-0.4, 0.44, 0.22, 0.05],
		[0.05, 0.47, 0.26, 0.09],
		[0.4, 0.45, 0.3, 0.1],
		[0.64, 0.38, 0.27, 0.1],
		[0.77, 0.27, 0.2, 0.1],
	];
	const BODY = [
		...loft(STATIONS.map(([z, w, h, y]) => ring(w, h, 24, (u, v) => [u, y + v, z])), 2),
		// battery seam on the rear deck and the fisheye sensor on top of the head
		...loop(ring(0.24, 0.42, 16, (u, v) => [u, 0.27, -0.5 + v], 4)),
		...circle(0.06, 12, (u, v) => [u, 0.4, 0.42 + v]),
		// nose: stereo vision sensors in the top corners with the dark window between them
		...circle(0.05, 12, (u, v) => [0.17 + u, 0.2 + v, 0.765]),
		...circle(0.05, 12, (u, v) => [-0.17 + u, 0.2 + v, 0.765]),
		...loop(ring(0.09, 0.035, 12, (u, v) => [u, 0.22 + v, 0.775], 4)),
	];

	// Gimbal: tall camera block under the nose, medium tele on top, 1" wide camera below
	const GIMBAL_POS = [0, -0.28, 0.72];
	const GIMBAL = [
		...loft([-0.17, 0.17].map(z => ring(0.22, 0.27, 20, (u, v) => [u, v, z], 3.5)), 5),
		...loop(ring(0.1, 0.085, 14, (u, v) => [u, 0.13 + v, 0.175], 4)),
		...circle(0.06, 14, (u, v) => [u, 0.13 + v, 0.18]),
		...circle(0.12, 18, (u, v) => [u, -0.11 + v, 0.175]),
		...circle(0.075, 14, (u, v) => [u, -0.11 + v, 0.185]),
		// roll motors on the gimbal yoke
		...circle(0.08, 12, (u, v) => [0.235, v, u]),
		...circle(0.08, 12, (u, v) => [-0.235, v, u]),
	];

	// Tapered arm along +x, from (w0, h0) at the hinge to (w1, h1) at the motor
	function beam(len, w0, h0, w1, h1) {
		const a = ring(w0, h0, 8, (u, v) => [0, v, u], 4);
		const b = ring(w1, h1, 8, (u, v) => [len, v, u], 4);
		return [...loop(a), ...loop(b), ...a.map((p, i) => [p, b[i]])];
	}
	// Motor pod at the arm tip: housing around the arm, motor bell on top
	const pod = len => [
		...shift(cylinder(0.12, 0.24, 14), [len, 0, 0]),
		...shift(cylinder(0.11, 0.06, 14), [len, 0.15, 0]),
	];
	// Leg hanging from the pod, angled down and outward
	const leg = (len, length) => beam(length, 0.055, 0.05, 0.035, 0.03)
		.map(seg => seg.map(p => add(rotZ(p, -Math.PI / 2 + 0.22), [len, -0.1, 0])));
	const HUB_Y = 0.22;
	const FRONT_LEN = 1.08, REAR_LEN = 1.2;
	const FRONT_ARM = [...beam(FRONT_LEN, 0.09, 0.06, 0.06, 0.045), ...pod(FRONT_LEN), ...leg(FRONT_LEN, 0.42)];
	const REAR_ARM = [...beam(REAR_LEN, 0.09, 0.06, 0.06, 0.045), ...pod(REAR_LEN), ...leg(REAR_LEN, 0.1)];

	// One slender, slightly swept propeller blade pointing along +x from the hub
	const PROP_R = 1.1;
	const lead = [], trail = [];
	for (let i = 0; i <= 10; i++) {
		const t = i / 10, r = 0.07 + (PROP_R - 0.07) * t;
		const chord = 0.12 * Math.sin(Math.PI * (0.12 + 0.88 * t)) + 0.02;
		const sweep = -0.06 * t * t;
		lead.push([r, 0, sweep + chord * 0.6]);
		trail.push([r, 0, sweep - chord * 0.4]);
	}
	const BLADE = [...loop(lead).slice(0, -1), ...loop(trail).slice(0, -1), [lead[10], trail[10]], [lead[0], trail[0]]];
	const DISC = circle(PROP_R, 36, (u, v) => [u, 0, v]);

	const GRID = [];
	for (let i = -3; i <= 3; i += 0.5) {
		GRID.push([[i, 0, -3], [i, 0, 3]], [[-3, 0, i], [3, 0, i]]);
	}
	const GROUND_Y = -0.6;

	// Front arms (high, at the head) swing back along the sides so their legs end up at the rear;
	// rear arms (low) swing forward along the belly. yaw = arm direction, droop = tip tilt (folded -> open).
	const ARMS = [
		{ shape: FRONT_ARM, len: FRONT_LEN, pivot: [0.47, 0.05, 0.35], yaw: [Math.PI / 2, -0.38], droop: [0, -0.04], dir: 1 },
		{ shape: FRONT_ARM, len: FRONT_LEN, pivot: [-0.47, 0.05, 0.35], yaw: [Math.PI / 2, Math.PI + 0.38], droop: [0, -0.04], dir: -1 },
		{ shape: REAR_ARM, len: REAR_LEN, pivot: [0.42, -0.12, -0.55], yaw: [-Math.PI / 2, 0.53], droop: [-0.06, 0.05], dir: -1 },
		{ shape: REAR_ARM, len: REAR_LEN, pivot: [-0.42, -0.12, -0.55], yaw: [Math.PI * 1.5, Math.PI - 0.53], droop: [-0.06, 0.05], dir: 1 },
	];

	// ---- Build the posed drone as world-space lines: [a, b, alpha]
	function buildScene(s) {
		const lines = [];
		const put = (shape, f, alpha = 1) => {
			for (const [a, b] of shape) lines.push([f(a), f(b), alpha]);
		};
		put(GRID, p => add(p, [0, GROUND_Y, 0]), 0.18);

		const lift = [0, s.lift, 0];
		const T = p => add(p, lift);
		put(BODY, T);
		put(GIMBAL, p => T(add(rotX(p, s.tilt), GIMBAL_POS)));

		for (const arm of ARMS) {
			const yaw = lerp(arm.yaw[0], arm.yaw[1], s.unfold);
			const droop = lerp(arm.droop[0], arm.droop[1], s.unfold);
			const armT = p => T(add(rotY(rotZ(p, droop), yaw), arm.pivot));
			put(arm.shape, armT);
			// Blades rest folded back towards the hinge, flick open when the motors start,
			// then spin and blur into a disc at speed
			const hub = [arm.len, HUB_Y, 0];
			const spinYaw = s.propAngle * arm.dir;
			for (const [rest, open] of [[Math.PI - 0.1, 0], [Math.PI + 0.1, Math.PI]]) {
				const a = spinYaw + lerp(rest, open, s.bladeOpen);
				put(BLADE, p => armT(add(rotY(p, a), hub)), 1 - s.spin * 0.75);
			}
			if (s.spin > 0.01) put(DISC, p => armT(add(p, hub)), s.spin * 0.5);
		}
		return lines;
	}

	// ---- Rendering
	const color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#E8A33D';
	let width = 0, height = 0, dpr = 1;

	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		width = canvas.clientWidth;
		height = canvas.clientHeight;
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
	}

	function render(lines, view) {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);
		ctx.strokeStyle = color;
		ctx.lineWidth = 1.25;
		ctx.lineCap = 'round';
		const f = Math.min(width, height) * (width < 600 ? 1.2 : 1.6);
		const cx = width / 2, cy = height / 2;
		const project = p => {
			const q = rotX(rotY(p, view.yaw), view.pitch);
			const depth = view.dist - q[2];
			return [cx + f * q[0] / depth, cy - f * (q[1] - view.lookY) / depth, depth];
		};
		for (const [a, b, alpha] of lines) {
			const pa = project(a), pb = project(b);
			// Fade lines further from the camera for a sense of depth
			const fog = clamp01(1.35 - ((pa[2] + pb[2]) / 2 - view.dist + 2) / 4);
			ctx.globalAlpha = alpha * (0.25 + 0.75 * fog);
			ctx.beginPath();
			ctx.moveTo(pa[0], pa[1]);
			ctx.lineTo(pb[0], pb[1]);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	// ---- Scroll timeline
	let propAngle = 0;
	let lastTime = performance.now();

	function progress() {
		const rect = scroller.getBoundingClientRect();
		const travel = rect.height - window.innerHeight;
		return travel > 0 ? clamp01(-rect.top / travel) : 1;
	}

	function frame(time, p) {
		const dt = Math.min(0.05, (time - lastTime) / 1000);
		lastTime = time;
		const spin = phase(p, 0.35, 0.5);
		const liftT = phase(p, 0.5, 0.7);
		propAngle += dt * spin * 40;

		const state = {
			unfold: phase(p, 0.05, 0.35),
			bladeOpen: phase(p, 0.33, 0.4),
			spin,
			lift: liftT * 0.6 + Math.sin(time / 600) * 0.03 * liftT,
			tilt: -0.5 * phase(p, 0.7, 0.9),
			propAngle,
		};
		const t = ease(p);
		render(buildScene(state), {
			yaw: lerp(-2.6, -0.45, t),
			pitch: lerp(0.75, 0.15, t),
			dist: 7,
			lookY: lerp(-0.2, 0.1, t),
		});

		const active = p < 0.35 ? 0 : p < 0.5 ? 1 : p < 0.7 ? 2 : 3;
		steps.forEach((li, i) => li.classList.toggle('active', i === active));
		readout.textContent = `ALT ${(liftT * 120).toFixed(1).padStart(5, '0')} m · RPM ${String(Math.round(spin * 9800)).padStart(4, '0')}`;
	}

	new ResizeObserver(() => {
		resize();
		if (reducedMotion) frame(performance.now(), 1);
	}).observe(canvas);

	if (reducedMotion) return;

	// Only animate while the section is on screen
	let running = false;
	function tick(time) {
		if (!running) return;
		frame(time, progress());
		requestAnimationFrame(tick);
	}
	new IntersectionObserver(([entry]) => {
		running = entry.isIntersecting;
		if (running) {
			lastTime = performance.now();
			requestAnimationFrame(tick);
		}
	}).observe(scroller);
})();
