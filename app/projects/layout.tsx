"use client";

import { Sidebar } from "@/components/layout/sidebar";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}