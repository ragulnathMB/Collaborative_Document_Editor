import { useTheme } from '../theme.js';
import { IconMoon, IconSun } from './Icons.jsx';

export default function ThemeToggle() {
  const [theme, toggle] = useTheme();
  return (
    <button className="icon-btn" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
      {theme === 'dark' ? <IconSun /> : <IconMoon />}
    </button>
  );
}
