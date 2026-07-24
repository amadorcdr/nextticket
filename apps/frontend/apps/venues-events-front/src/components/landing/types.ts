export interface EventCard {
  id: number;
  category: string;
  title: string;
  location: string;
  image: string;
}

export interface BentoCard {
  id: number;
  category: string;
  title: string;
  description?: string;
  date?: string;
  image: string;
  colSpan?: string;
  rowSpan?: string;
  height?: string;
  large?: boolean;
}
