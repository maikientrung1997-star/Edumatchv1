import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

// Reveal existing catalog results in batches, without moving the page on filter changes.
export function useDiscoveryFeed(total, queryKey, enabled, batchSize) {
  const key = `${batchSize}:${queryKey}`;
  const [batch, setBatch] = useState({ key, count: batchSize });
  const sentinelRef = useRef(null);
  const count = Math.min(total, batch.key === key ? batch.count : batchSize);
  const showMore = () => setBatch((current) => ({
    key,
    count: Math.min(total, (current.key === key ? current.count : batchSize) + batchSize),
  }));

  useLayoutEffect(() => {
    if (!enabled || count >= total || !sentinelRef.current) return;
    let observing = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!observing || !entry.isIntersecting) return;
      observer.disconnect();
      setBatch((current) => ({
        key,
        count: Math.min(total, (current.key === key ? current.count : batchSize) + batchSize),
      }));
    }, { rootMargin: '240px 0px' });
    observer.observe(sentinelRef.current);
    return () => {
      observing = false;
      observer.disconnect();
    };
  }, [enabled, count, total, key, batchSize]);

  return { count, sentinelRef, showMore };
}

export function useDiscoveryNavigation(enabled, { heroRef, courseRef, tutorRef, sponsoredRef, endRef }) {
  const [navigation, setNavigation] = useState({ activeSection: null, direction: 1, hasDestination: false });
  const [isMoving, setIsMoving] = useState(false);
  const [pausedSections, setPausedSections] = useState([]);
  const moveRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    const sections = [heroRef.current, courseRef.current, tutorRef.current, sponsoredRef.current, endRef.current].filter(Boolean);
    const header = document.querySelector('.edu-header');
    let frame;
    let idleTimer;
    let moving = false;
    let lastScrollY = window.scrollY;
    let direction = 1;
    let previousActiveId;
    let previousDirection;
    const update = () => {
      frame = null;
      const scrollY = Math.max(0, window.scrollY);
      if (Math.abs(scrollY - lastScrollY) >= 4 || moving) {
        if (!moving) direction = scrollY > lastScrollY ? 1 : -1;
        lastScrollY = scrollY;
      }
      if (moving) return;

      const top = Math.ceil(header?.getBoundingClientRect().height || 0) + 2;
      const endBounds = endRef.current?.getBoundingClientRect();
      // A short footer can prevent the last section from reaching the sticky header.
      const atEnd = endBounds && (endBounds.top <= top || endBounds.bottom <= window.innerHeight);
      const activeIndex = atEnd ? sections.length - 1 : sections.findIndex((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.top <= top && bounds.bottom > top;
      });
      const activeId = sections[activeIndex]?.id || null;
      if (activeId !== previousActiveId && activeId) {
        setPausedSections((current) => current.includes(activeId) ? current.filter((id) => id !== activeId) : current);
      }
      if (activeId !== previousActiveId || direction !== previousDirection) {
        previousActiveId = activeId;
        previousDirection = direction;
        setNavigation({ activeSection: activeId, direction, hasDestination: Boolean(activeId && sections[activeIndex + direction]) });
      }
    };
    const scheduleUpdate = () => {
      if (frame == null) frame = requestAnimationFrame(update);
    };
    const finishMove = () => {
      moving = false;
      lastScrollY = window.scrollY;
      setIsMoving(false);
      if (frame != null) cancelAnimationFrame(frame);
      update();
    };
    const onScroll = () => {
      if (moving) {
        clearTimeout(idleTimer);
        idleTimer = setTimeout(finishMove, 150);
      }
      scheduleUpdate();
    };
    moveRef.current = () => {
      if (moving) return;
      const source = sections.findIndex((section) => section.id === previousActiveId);
      const destination = source >= 0 ? sections[source + direction] : null;
      if (!destination) return;
      moving = true;
      // Pause observers during the transition so growing lists cannot move its destination.
      flushSync(() => {
        setIsMoving(true);
        setPausedSections((current) => current.includes(previousActiveId) ? current : [...current, previousActiveId]);
      });
      const headerHeight = header?.getBoundingClientRect().height || 0;
      const padding = destination.querySelector('.discovery-section__header')
        ? parseFloat(getComputedStyle(destination).paddingTop)
        : 0;
      window.scrollTo({
        top: window.scrollY + destination.getBoundingClientRect().top + padding - headerHeight,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
      destination.querySelector('h1, h2')?.focus({ preventScroll: true });
      idleTimer = setTimeout(finishMove, 150);
    };

    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (header) resizeObserver.observe(header);
    sections.forEach((section) => resizeObserver.observe(section));
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      clearTimeout(idleTimer);
      if (moving) setIsMoving(false);
      moveRef.current = null;
      resizeObserver.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [enabled, heroRef, courseRef, tutorRef, sponsoredRef, endRef]);

  return {
    activeSection: enabled ? navigation.activeSection : null,
    direction: navigation.direction,
    hasDestination: enabled && navigation.hasDestination,
    isMoving,
    pausedSections,
    goToAdjacent: () => moveRef.current?.(),
  };
}
