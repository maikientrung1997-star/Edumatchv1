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

export function useDiscoveryNavigation(enabled, courseRef, tutorRef, sponsoredRef) {
  const [activeSection, setActiveSection] = useState(null);
  const [pausedSections, setPausedSections] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    const sections = [courseRef.current, tutorRef.current, sponsoredRef.current].filter(Boolean);
    const header = document.querySelector('.edu-header');
    let frame;
    let previousActiveId;
    const update = () => {
      frame = null;
      const top = Math.ceil(header?.getBoundingClientRect().height || 0) + 2;
      const atPageEnd = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      const active = sections.find((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.top <= top && bounds.bottom > top
          && !(section === sponsoredRef.current && atPageEnd);
      });
      const activeId = active?.id || null;
      if (activeId === previousActiveId) return;
      previousActiveId = activeId;
      setActiveSection(activeId);
      // Returning to an earlier section resumes its feed.
      if (activeId) setPausedSections((current) => current.includes(activeId)
        ? current.filter((id) => id !== activeId)
        : current);
    };
    const scheduleUpdate = () => {
      if (frame == null) frame = requestAnimationFrame(update);
    };
    // Three section bounds, at most once per frame; the passive listener never blocks scrolling.
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    if (header) resizeObserver.observe(header);
    sections.forEach((section) => resizeObserver.observe(section));
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    scheduleUpdate();
    return () => {
      if (frame != null) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [enabled, courseRef, tutorRef, sponsoredRef]);

  const goToNext = (targetRef) => {
    // Detach the current sentinel before jumping, so the skipped list cannot grow underneath the destination.
    if (activeSection) flushSync(() => setPausedSections((current) => current.includes(activeSection)
      ? current
      : [...current, activeSection]));
    const destination = targetRef.current?.querySelector('.discovery-section__header') || targetRef.current;
    destination?.scrollIntoView({ behavior: 'instant', block: 'start' });
    targetRef.current?.querySelector('h2')?.focus({ preventScroll: true });
  };

  return { activeSection: enabled ? activeSection : null, pausedSections, goToNext };
}
