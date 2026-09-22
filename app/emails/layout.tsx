"use client";

import { Sidebar } from "@/components/layout/sidebar";

export default function EmailsLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}
