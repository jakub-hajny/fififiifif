//    |\__/,|   (`\
//  -.|0 0  |_   ) )
// -((---(((--------

const video = document.querySelector('.hero video');
const hero = document.querySelector('.hero');
const timecode = document.querySelector('#timecode');

// Cache hero height instead of reading offsetHeight (forces layout) every frame.
// ResizeObserver keeps it correct across window resizes and mobile viewport changes.
let heroHeight = hero.offsetHeight;
new ResizeObserver(() => {
	heroHeight = hero.offsetHeight;
}).observe(hero);

function updateVideoClip() {
	const scrollFraction = window.scrollY / (heroHeight * 1.5);
	const inset = Math.min(50, scrollFraction * 50);
	video.style.clipPath = `inset(${inset}% ${inset}%)`;
}

// Viewfinder timecode (HH:MM:SS:FF) following the hero video's playhead.
// Keep FPS in sync with the frame rate shown in the HUD spec label.
const FPS = 60;
let lastFrame = -1;
const pad = n => String(n).padStart(2, '0');

function updateTimecode() {
	const frame = Math.floor(video.currentTime * FPS);
	if (frame === lastFrame) return;
	lastFrame = frame;
	const s = Math.floor(frame / FPS);
	timecode.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(frame % FPS)}`;
}

// Initialize Lenis. autoRaf is left off (default) because we drive a single
// shared rAF loop below instead of running Lenis's loop and our own side by side.
const lenis = new Lenis();

function raf(time) {
	lenis.raf(time);
	updateVideoClip();
	updateTimecode();
	requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// Handle tab visibility to prevent issues when returning from background
document.addEventListener('visibilitychange', () => {
	if (!document.hidden) {
		lenis.resize();
		heroHeight = hero.offsetHeight;
		updateVideoClip();
	}
});

// IntersectionObserver for animations:
// containers marked data-reveal="<class>" add that class to each child once scrolled into view
if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
	const observer = new IntersectionObserver((entries, observer) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				for (const child of entry.target.children) {
					child.classList.add(entry.target.dataset.reveal);
				}
				observer.unobserve(entry.target);
			}
		});
	});
	document.querySelectorAll('[data-reveal]').forEach(el => observer.observe(el));
}

// Tohle se edituje, kdyz Vercel ma schizu