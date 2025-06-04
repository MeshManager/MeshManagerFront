'use client';

import { Home, Package, Rocket, Settings } from "lucide-react"
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

// Menu items.
const items = [
  {
    title: "Home",
    url: "/",
    icon: Home,
  },
  {
    title: "Canary Deploy",
    url: "#",
    icon: Rocket,
  },
  {
    title: "Dark Release",
    url: "#",
    icon: Package,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
]

export function AppSidebar() {
  const { state: sidebarState } = useSidebar();

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          {/* Header for the sidebar content, including the MeshManager label and the trigger */} 
          <div className="flex items-center justify-between p-2">
            <SidebarGroupLabel className="flex-grow">MeshManager</SidebarGroupLabel>
            {sidebarState === "expanded" && (
              <SidebarTrigger className="flex-shrink-0" />
            )}
          </div>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <Link href={item.url} passHref>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}