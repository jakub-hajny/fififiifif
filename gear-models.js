// Textured 3D models for the gear section, drawn over the wireframe stages from gear3d.js.
// A stage opts in with data-model="models/….glb" on its .gear-scroll element. Three.js and the
// model are only downloaded once the visitor scrolls near that stage; until then (and whenever
// WebGL or the download fails) the hand-drawn wireframe stays. The pose comes from gear3d.js
// 'gearframe' events, so the scroll timeline lives in one place.

// Per-stage setup, in the stage units of gear3d.js (y up, front towards +z):
// - transform: scale / rotation / position that bring the model file into those units
// - ground: floor height; lift: follow state.lift (drone take-off)
// - hinges: parts rotated about `pivot` (or 'center' of the parts) around `axis` by angle(state);
//   `parent` nests a hinge inside another one, `disc` adds a propeller blur disc of that radius
// - screen: live-view overlay on the camera display (centre, size, outward normal, parent hinge)
const RIGS = {
	'gear-drone': { ground: -0.6, lift: true, hinges: [] },
	'gear-camera': { ground: -1.25, hinges: [] },
};

const ACCENT = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#E8A33D';

for (const root of document.querySelectorAll('.gear-scroll[data-model]')) {
	const observer = new IntersectionObserver(([entry]) => {
		if (!entry.isIntersecting) return;
		observer.disconnect();
		mount(root).catch(err => console.warn(`3D model for #${root.id} unavailable, keeping the wireframe.`, err));
	}, { rootMargin: '100% 0px' });
	observer.observe(root);
}

async function mount(root) {
	// three.js needs WebGL 2; check before downloading it
	const probe = document.createElement('canvas').getContext('webgl2');
	if (!probe) throw new Error('WebGL 2 unavailable');
	probe.getExtension('WEBGL_lose_context')?.loseContext();

	const THREE = await import('./vendor/three.bundle.min.js');
	const rig = RIGS[root.id] || {};
	const canvas = root.querySelector('.gear-model');

	// Throws when WebGL is unavailable, which leaves the wireframe in place
	const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	renderer.localClippingEnabled = true;

	const loader = new THREE.GLTFLoader().setMeshoptDecoder(THREE.MeshoptDecoder);
	const gltf = await loader.loadAsync(root.dataset.model);

	// ---- Scene: soft studio reflections, warm key light, amber rim light, shadow on the HUD grid
	const scene = new THREE.Scene();
	scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new THREE.RoomEnvironment(), 0.04).texture;
	scene.environmentIntensity = 0.5;

	const key = new THREE.DirectionalLight('#fff3e3', 2.5);
	key.position.set(3, 6, 4);
	key.castShadow = true;
	key.shadow.mapSize.set(1024, 1024);
	Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 20 });
	key.shadow.normalBias = 0.02;
	key.shadow.radius = 3;
	const rim = new THREE.DirectionalLight(ACCENT, 3);
	rim.position.set(-4, 3, -5);
	scene.add(key, rim, new THREE.HemisphereLight('#f2efea', '#0b0b0c', 0.4));

	const groundY = rig.ground ?? 0;
	const ground = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.ShadowMaterial({ opacity: 0.45 }));
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = groundY;
	ground.receiveShadow = true;
	const grid = new THREE.GridHelper(6, 12, ACCENT, ACCENT);
	grid.position.y = groundY + 0.002;
	Object.assign(grid.material, { transparent: true, opacity: 0.18, depthWrite: false });
	scene.add(ground, grid);

	// ---- Model, brought into stage units. `model` only moves for the lift, so at setup its
	// space equals world space and pivots / bounds below can be measured directly.
	const model = new THREE.Group();
	const asset = gltf.scene;
	const t = rig.transform || {};
	asset.scale.setScalar(t.scale ?? 1);
	if (t.rotation) asset.rotation.set(...t.rotation);
	if (t.position) asset.position.set(...t.position);
	model.add(asset);
	scene.add(model);
	model.updateMatrixWorld(true);

	// ---- Scan-in: amber edges traced from the model's own meshes above the scan height,
	// the textured model below it, and a glowing sheet at the boundary
	const keepBelow = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
	const keepAbove = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
	const edgeMaterial = new THREE.LineBasicMaterial({
		color: ACCENT, transparent: true, opacity: 0.8, toneMapped: false, clippingPlanes: [keepAbove],
	});
	const meshes = [];
	asset.traverse(o => o.isMesh && meshes.push(o));
	const edges = meshes.map(mesh => {
		mesh.castShadow = true;
		for (const material of [].concat(mesh.material)) Object.assign(material, { clippingPlanes: [keepBelow], clipShadows: true });
		const lines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), edgeMaterial);
		mesh.add(lines);
		return lines;
	});

	// Unit-sized sweep, scaled each frame to the model's current (e.g. folded) footprint
	const sweep = new THREE.Group();
	const sheet = new THREE.Mesh(
		new THREE.PlaneGeometry(1, 1),
		new THREE.MeshBasicMaterial({
			color: ACCENT, transparent: true, opacity: 0.045, depthWrite: false,
			side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
		}),
	);
	sheet.rotation.x = -Math.PI / 2;
	sweep.add(
		new THREE.LineLoop(
			new THREE.BufferGeometry().setFromPoints([
				new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 0, -0.5),
				new THREE.Vector3(0.5, 0, 0.5), new THREE.Vector3(-0.5, 0, 0.5),
			]),
			new THREE.LineBasicMaterial({ color: ACCENT, toneMapped: false }),
		),
		sheet,
	);
	scene.add(sweep);
	const bounds = new THREE.Box3(), meshBounds = new THREE.Box3();
	const measurePose = () => {
		model.updateMatrixWorld(true);
		bounds.makeEmpty();
		for (const mesh of meshes) {
			if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
			bounds.union(meshBounds.copy(mesh.geometry.boundingBox).applyMatrix4(mesh.matrixWorld));
		}
	};

	// ---- Moving parts
	// Parts get re-parented onto pivots, so look nodes up anywhere under the model
	const findNode = name => model.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
	const hinges = {};
	for (const spec of rig.hinges || []) {
		const parts = spec.nodes.map(findNode).filter(Boolean);
		const parent = spec.parent ? hinges[spec.parent]?.pivot : model;
		if (!parts.length || !parent) {
			console.warn(`Hinge "${spec.name}" skipped: parts not found in the model`);
			continue;
		}
		let at;
		if (spec.pivot === 'center') {
			const box = new THREE.Box3();
			for (const part of parts) box.expandByObject(part);
			at = box.getCenter(new THREE.Vector3());
		} else {
			at = new THREE.Vector3(...spec.pivot);
		}
		const pivot = new THREE.Object3D();
		parent.add(pivot);
		parent.updateMatrixWorld(true);
		pivot.position.copy(parent.worldToLocal(at));
		pivot.updateMatrixWorld(true);
		for (const part of parts) pivot.attach(part);
		const hinge = { spec, pivot, axis: new THREE.Vector3(...spec.axis).normalize() };
		if (spec.disc) {
			hinge.disc = new THREE.Mesh(
				new THREE.CircleGeometry(spec.disc, 48),
				new THREE.MeshBasicMaterial({ color: '#d9d2c7', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
			);
			hinge.disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hinge.axis);
			pivot.add(hinge.disc);
		}
		hinges[spec.name] = hinge;
	}

	let liveView = null;
	if (rig.screen) {
		const { center, size, normal, parent } = rig.screen;
		liveView = new THREE.Mesh(
			new THREE.PlaneGeometry(...size),
			new THREE.MeshBasicMaterial({
				map: liveViewTexture(THREE),
				transparent: true,
				opacity: 0,
				depthWrite: false,
				toneMapped: false,
				blending: THREE.AdditiveBlending,
			}),
		);
		liveView.position.set(...center);
		liveView.lookAt(new THREE.Vector3(...center).add(new THREE.Vector3(...normal)));
		model.add(liveView);
		model.updateMatrixWorld(true);
		(hinges[parent]?.pivot ?? model).attach(liveView);
	}

	// ---- Per-frame drawing from the gear3d.js pose
	const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
	const viewRotation = new THREE.Euler(0, 0, 0, 'YXZ');

	function draw(detail) {
		const width = canvas.clientWidth, height = canvas.clientHeight;
		if (!detail || !width || !height) return;
		const { state, view, focal } = detail;

		model.position.y = rig.lift ? state.lift ?? 0 : 0;
		for (const hinge of Object.values(hinges)) {
			hinge.pivot.quaternion.setFromAxisAngle(hinge.axis, hinge.spec.angle(state));
			if (hinge.disc) hinge.disc.material.opacity = (state.spin ?? 0) * 0.18;
		}
		if (liveView) liveView.material.opacity = state.live ?? 0;

		const scan = state.scan ?? 1;
		const scanning = scan > 0 && scan < 1;
		// Far past either end when not scanning, so one side is fully shown
		let scanY = scan >= 1 ? 1e6 : -1e6;
		if (scanning) {
			measurePose();
			scanY = bounds.min.y - 0.01 + (bounds.max.y - bounds.min.y + 0.02) * scan;
			sweep.position.set((bounds.min.x + bounds.max.x) / 2, scanY, (bounds.min.z + bounds.max.z) / 2);
			sweep.scale.set(bounds.max.x - bounds.min.x + 0.2, 1, bounds.max.z - bounds.min.z + 0.2);
		}
		keepBelow.constant = scanY;
		keepAbove.constant = -scanY;
		sweep.visible = scanning;
		for (const lines of edges) lines.visible = scan < 1;

		// gear3d.js projects points rotated by pitch·yaw onto a camera at (0, lookY, dist) with the
		// given focal length; place the Three.js camera the same way so both framings match
		camera.fov = 2 * Math.atan(height / 2 / focal) * 180 / Math.PI;
		camera.aspect = width / height;
		camera.updateProjectionMatrix();
		viewRotation.set(-view.pitch, -view.yaw, 0);
		camera.quaternion.setFromEuler(viewRotation);
		camera.position.set(0, view.lookY, view.dist).applyQuaternion(camera.quaternion);

		renderer.render(scene, camera);
	}

	new ResizeObserver(() => {
		renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
		draw(root.gearLast);
	}).observe(canvas);
	root.addEventListener('gearframe', event => draw(event.detail));
	canvas.addEventListener('webglcontextlost', () => root.classList.remove('has-model'));

	renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
	root.classList.add('has-model');
	draw(root.gearLast);
}

// Amber live-view overlay for the camera display: thirds grid, focus brackets, REC
function liveViewTexture(THREE) {
	const c = document.createElement('canvas');
	c.width = 600;
	c.height = 400;
	const g = c.getContext('2d');
	g.strokeStyle = ACCENT;
	g.lineWidth = 3;
	g.globalAlpha = 0.85;
	const line = (x1, y1, x2, y2) => {
		g.beginPath();
		g.moveTo(x1, y1);
		g.lineTo(x2, y2);
		g.stroke();
	};
	for (const f of [1 / 3, 2 / 3]) {
		line(f * 600, 0, f * 600, 400);
		line(0, f * 400, 600, f * 400);
	}
	const b = 46, l = 20;
	for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
		line(300 + sx * b, 200 + sy * b, 300 + sx * (b - l), 200 + sy * b);
		line(300 + sx * b, 200 + sy * b, 300 + sx * b, 200 + sy * (b - l));
	}
	g.globalAlpha = 1;
	g.fillStyle = '#E5484D';
	g.beginPath();
	g.arc(40, 40, 11, 0, Math.PI * 2);
	g.fill();
	g.fillStyle = ACCENT;
	g.font = '500 26px "JetBrains Mono", monospace';
	g.fillText('REC', 62, 49);
	const texture = new THREE.CanvasTexture(c);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}
