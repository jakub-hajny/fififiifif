// Entry for vendor/three.bundle.min.js: only the parts of three.js the gear section uses.
// Rebuild (three@0.186.1 and esbuild installed next to this file):
//   npx esbuild three-entry.js --bundle --minify --format=esm --outfile=three.bundle.min.js
export {
	ACESFilmicToneMapping,
	AdditiveBlending,
	Box3,
	BufferGeometry,
	CanvasTexture,
	CircleGeometry,
	DirectionalLight,
	DoubleSide,
	EdgesGeometry,
	Euler,
	GridHelper,
	Group,
	HemisphereLight,
	LineBasicMaterial,
	LineLoop,
	LineSegments,
	Mesh,
	MeshBasicMaterial,
	Object3D,
	PCFShadowMap,
	PerspectiveCamera,
	Plane,
	PlaneGeometry,
	PMREMGenerator,
	PropertyBinding,
	Scene,
	ShadowMaterial,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer,
} from 'three';
export { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
export { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
export { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
