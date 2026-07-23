export type SiteNavKey = "home" | "catalog" | "publications" | "contacts";

export type SiteNavItem = {
  key: SiteNavKey;
  href: string;
  label: string;
};

export const siteNavigationItems: SiteNavItem[] = [
  { key: "home", href: "/", label: "Про нас" },
  { key: "catalog", href: "/shop/", label: "Асортимент" },
  { key: "publications", href: "/publications/", label: "Поради та ідеї" },
  { key: "contacts", href: "/contacts/", label: "Контакти" }
];
