"use client";

import { Sidebar } from "@/components/layout/sidebar";

export default function ActivitiesLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}