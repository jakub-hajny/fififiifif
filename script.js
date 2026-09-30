//    |\__/,|   (`\
//  -.|0 0  |_   ) )
// -((---(((--------

const video = document.querySelector('.hero video');
const hero = document.querySelector('.hero');

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

// Initialize Lenis. autoRaf is left off (default) because we drive a single
// shared rAF loop below instead of running Lenis's loop and our own side by side.
const lenis = new Lenis();

function raf(time) {
	lenis.raf(time);
	updateVideoClip();
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

// IntersectionObserver for animations
if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
	const observer = new IntersectionObserver((entries, observer) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				if (entry.target.matches('#slogan span')) {
					entry.target.classList.add('slogan-anim');
					observer.unobserve(entry.target);
				}
				if (entry.target.id === 'vids') {
					for (const child of entry.target.children) {
						child.classList.add('vids-anim');
					}
					observer.unobserve(entry.target);
				}
				if (entry.target.id === 'clients') {
					for (const child of entry.target.children) {
						child.classList.add('vids-anim');
					}
					observer.unobserve(entry.target);
				}
				if (entry.target.id === 'team-content') {
					for (const child of entry.target.children) {
						child.classList.add('scale-up');
					}
					observer.unobserve(entry.target);
				}
			}
		});
	});
	document.querySelectorAll('#slogan span').forEach(span => observer.observe(span));
	observer.observe(document.querySelector('#vids'));
	observer.observe(document.querySelector('#clients'));
	observer.observe(document.querySelector('#team-content'));
}

// Tohle se edituje, kdyz Vercel ma schizu