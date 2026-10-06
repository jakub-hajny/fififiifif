// Wireframe drone for the gear section.
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

	const ARM_LEN = 1.1;
	const PROP_LEN = 0.5;
	const BODY = box(1.0, 0.32, 1.5, 0.8);
	const BATTERY = shift(box(0.55, 0.12, 0.9), [0, 0.22, -0.1]);
	const SENSORS = shift(box(0.5, 0.08, 0.02), [0, 0.02, 0.76]);
	const ARM = shift(box(ARM_LEN, 0.07, 0.1), [ARM_LEN / 2, 0, 0]);
	const MOTOR = shift(cylinder(0.11, 0.14), [ARM_LEN, 0.08, 0]);
	const DISC = shift(cylinder(PROP_LEN, 0, 24), [ARM_LEN, 0.17, 0]);
	const BLADE = [
		[[-PROP_LEN, 0, 0], [0, 0, 0.05]], [[0, 0, 0.05], [PROP_LEN, 0, 0]],
		[[PROP_LEN, 0, 0], [0, 0, -0.05]], [[0, 0, -0.05], [-PROP_LEN, 0, 0]],
	];
	const GIMBAL = shift(box(0.32, 0.06, 0.2), [0, -0.21, 0.62]);
	const CAMERA = [...box(0.26, 0.22, 0.24), ...shift(cylinder(0.07, 0.08, 12, 'z'), [0, 0, 0.16])];
	const GRID = [];
	for (let i = -3; i <= 3; i += 0.5) {
		GRID.push([[i, 0, -3], [i, 0, 3]], [[-3, 0, i], [3, 0, i]]);
	}
	const GROUND_Y = -0.75;

	// Arm yaw angles (folded -> open). Front arms fold back along the body, rear arms fold forward.
	const ARMS = [
		{ pivot: [0.55, 0.05, 0.55], folded: Math.PI / 2, open: -Math.PI / 4, dir: 1 },
		{ pivot: [-0.55, 0.05, 0.55], folded: -Math.PI * 1.5, open: -Math.PI * 0.75, dir: -1 },
		{ pivot: [0.55, -0.08, -0.55], folded: -Math.PI / 2, open: Math.PI / 4, dir: -1 },
		{ pivot: [-0.55, -0.08, -0.55], folded: Math.PI * 1.5, open: Math.PI * 0.75, dir: 1 },
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
		put(BATTERY, T);
		put(SENSORS, T);
		put(GIMBAL, T);
		put(CAMERA, p => T(add(rotX(p, s.tilt), [0, -0.36, 0.68])));

		for (const arm of ARMS) {
			const yaw = lerp(arm.folded, arm.open, s.unfold);
			const armT = p => T(add(rotY(p, yaw), arm.pivot));
			put(ARM, armT);
			put(MOTOR, armT);
			// Blades rest along the arm, spin around the motor and blur into a disc at speed
			const spinYaw = s.propAngle * arm.dir;
			const blade = p => armT(add(rotY(p, spinYaw), [ARM_LEN, 0.17, 0]));
			put(BLADE, blade, 1 - s.spin * 0.75);
			if (s.spin > 0.01) put(DISC, armT, s.spin * 0.5);
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
			spin,
			lift: liftT * 0.5 + Math.sin(time / 600) * 0.03 * liftT,
			tilt: -0.5 * phase(p, 0.7, 0.9),
			propAngle,
		};
		const t = ease(p);
		render(buildScene(state), {
			yaw: lerp(-2.6, -0.45, t),
			pitch: lerp(0.75, 0.15, t),
			dist: 6,
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
	function loop(time) {
		if (!running) return;
		frame(time, progress());
		requestAnimationFrame(loop);
	}
	new IntersectionObserver(([entry]) => {
		running = entry.isIntersecting;
		if (running) {
			lastTime = performance.now();
			requestAnimationFrame(loop);
		}
	}).observe(scroller);
})();
