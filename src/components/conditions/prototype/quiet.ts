/**
 * PROTOTYPE - throwaway. See `NOTES.md` in this directory.
 *
 * The rule that drops the region-leading prose a register. Shared because
 * two variants test it and a difference between them would be noise rather
 * than a finding.
 *
 * It matches paragraphs leading a region, which is where `withheldWords`
 * lands via `WeekGrid` and `DayPanel`. A scoped selector is a prototype
 * shortcut; the real change would be a prop on those panels.
 */

export const QUIET_PROSE = `
  .proto-quiet section > h2 + p,
  .proto-quiet section > h2 + p + p {
    font-size: var(--text-sm);
    line-height: 1.6;
    opacity: 0.7;
    margin-bottom: 0.5rem;
    max-width: 78ch;
  }
`;
