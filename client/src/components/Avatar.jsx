import { colorFor, initials } from '../utils.js';

export default function Avatar({ user, size = 32, title, ring }) {
  return (
    <span
      className="avatar"
      title={title ?? user.name}
      style={{ width: size, height: size, fontSize: size * 0.4, background: user.color || colorFor(user.id), ...(ring ? { boxShadow: `0 0 0 2px var(--surface)` } : {}) }}
    >
      {initials(user.name)}
    </span>
  );
}
