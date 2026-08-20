import { useEffect, useRef } from 'react';
import gsap from 'gsap';

// Standard-tier hover lift: subtle depth (lift + scale + shadow) that reads as
// "premium" without being distracting. Respects prefers-reduced-motion.
export function useHoverLift<T extends HTMLElement>() {
    const ref = useRef<T | null>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const mm = gsap.matchMedia();
        mm.add('(prefers-reduced-motion: no-preference)', () => {
            const yTo = gsap.quickTo(el, 'y', { duration: 0.25, ease: 'power2.out' });
            const scaleTo = gsap.quickTo(el, 'scale', { duration: 0.25, ease: 'power2.out' });

            const onEnter = () => {
                yTo(-4);
                scaleTo(1.02);
                el.style.boxShadow = '0 12px 24px rgba(15, 23, 42, 0.12)';
            };
            const onLeave = () => {
                yTo(0);
                scaleTo(1);
                el.style.boxShadow = '';
            };

            el.addEventListener('mouseenter', onEnter);
            el.addEventListener('mouseleave', onLeave);

            return () => {
                el.removeEventListener('mouseenter', onEnter);
                el.removeEventListener('mouseleave', onLeave);
            };
        });

        return () => mm.revert();
    }, []);

    return ref;
}
