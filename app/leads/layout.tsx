"use client";

import { Sidebar } from "@/components/layout/sidebar";

export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}