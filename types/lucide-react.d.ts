declare module "lucide-react" {
  import type { SVGProps, ForwardRefExoticComponent, RefAttributes } from "react";

  interface LucideProps extends SVGProps<SVGSVGElement> {
    size?: number | string;
    strokeWidth?: number | string;
  }

  type IconComponent = ForwardRefExoticComponent<
    LucideProps & RefAttributes<SVGSVGElement>
  >;

  const icons: Record<string, IconComponent>;

  export type LucideIcon = IconComponent;
  export const ArrowLeft: IconComponent;
  export const ArrowRight: IconComponent;
  export const Bell: IconComponent;
  export const Briefcase: IconComponent;
  export const Building2: IconComponent;
  export const CalendarClock: IconComponent;
  export const CalendarPlus: IconComponent;
  export const Check: IconComponent;
  export const ChevronDown: IconComponent;
  export const Clock: IconComponent;
  export const CornerDownLeft: IconComponent;
  export const FolderKanban: IconComponent;
  export const FolderPlus: IconComponent;
  export const Home: IconComponent;
  export const LayoutGrid: IconComponent;
  export const LogOut: IconComponent;
  export const Mail: IconComponent;
  export const MapPin: IconComponent;
  export const PencilRuler: IconComponent;
  export const Plus: IconComponent;
  export const Search: IconComponent;
  export const Settings: IconComponent;
  export const ShoppingCart: IconComponent;
  export const Target: IconComponent;
  export const UserPlus: IconComponent;
  export const Wrench: IconComponent;
  export const X: IconComponent;

  export default icons;
}
