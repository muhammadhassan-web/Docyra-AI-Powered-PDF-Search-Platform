import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Complex-tier 3D perspective tilt driven by pointer position — reserve for
// one or two focal elements per screen (per motion guidance); overusing this
// reads as noisy rather than premium.
export function useTilt3D<T extends HTMLElement>(strength = 10) {
    const ref = useRef<T | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        el.style.transformStyle = 'preserve-3d';
        el.style.perspective = '800px';

        const mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
            const rotateXTo = gsap.quickTo(el, 'rotateX', { duration: 0.4, ease: 'power2.out' });
            const rotateYTo = gsap.quickTo(el, 'rotateY', { duration: 0.4, ease: 'power2.out' });
            const scaleTo = gsap.quickTo(el, 'scale', { duration: 0.4, ease: 'power2.out' });

            const onPointerMove = (e: PointerEvent) => {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - 0.5;
                const py = (e.clientY - r.top) / r.height - 0.5;
                rotateXTo(-py * strength);
                rotateYTo(px * strength);
            };
            const onEnter = () => scaleTo(1.015);
            const onLeave = () => {
                rotateXTo(0);
                rotateYTo(0);
                scaleTo(1);
            };

            el.addEventListener('pointermove', onPointerMove);
            el.addEventListener('pointerenter', onEnter);
            el.addEventListener('pointerleave', onLeave);

            return () => {
                el.removeEventListener('pointermove', onPointerMove);
                el.removeEventListener('pointerenter', onEnter);
                el.removeEventListener('pointerleave', onLeave);
            };
        });

        return () => mm.revert();
    }, [strength]);

    return ref;
}
