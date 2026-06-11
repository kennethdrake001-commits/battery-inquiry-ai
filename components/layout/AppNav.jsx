import Link from "next/link";

const navItems = [
  { href: "/", label: "工作台" },
  { href: "/customers", label: "客户" },
  { href: "/prospecting", label: "主动开发" },
  { href: "/tasks", label: "任务" },
  { href: "/quotes", label: "报价" }
];

export default function AppNav() {
  return (
    <nav>
      {navItems.map((item) => (
        <Link key={item.href} href={item.href}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
