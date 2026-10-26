import {
  Bank,
  ChartLineUp,
  Cpu,
  FilmSlate,
  Heartbeat,
  Leaf,
  Megaphone,
  ShieldWarning,
  SoccerBall,
  TrendUp,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import type { Category } from "../../shared/types";

const ICONS: Record<Category, Icon> = {
  politics: Bank,
  protest: Megaphone,
  economy: ChartLineUp,
  society: UsersThree,
  security: ShieldWarning,
  environment: Leaf,
  culture: FilmSlate,
  sport: SoccerBall,
  viral: TrendUp,
  tech: Cpu,
  health: Heartbeat,
};

export function CategoryIcon({ category, size = 14 }: { category: Category; size?: number }) {
  const Glyph = ICONS[category];
  return <Glyph size={size} weight="light" aria-hidden />;
}
