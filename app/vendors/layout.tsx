"use client";

import { Sidebar } from "@/components/layout/sidebar";

export default function VendorsLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}
