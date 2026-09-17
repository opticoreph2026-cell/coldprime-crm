"use client";

import { Sidebar } from "@/components/layout/sidebar";

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return <Sidebar>{children}</Sidebar>;
}